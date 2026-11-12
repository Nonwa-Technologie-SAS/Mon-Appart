# Déploiement Contabo (VPS) — guide pas à pas

Ce guide cible un **VPS Contabo** (Ubuntu 22.04/24.04) pour faire tourner l’API Nest, les workers, PostgreSQL/PostGIS et Redis derrière **Caddy** (HTTPS).

**Domaine de production :** `monappart.ci`  
Sous-domaines prévus : `www.monappart.ci`, `api.monappart.ci`, `admin.monappart.ci`.

Ce n’est **pas** l’architecture Cloud recommandée à long terme ([deployment-architecture.md](./deployment-architecture.md) : Vercel + conteneurs managés + Postgres/Redis managés + R2). Contabo convient pour un **staging** ou un **MVP ops DIY**, à condition de respecter les garde-fous ci-dessous.

Fichiers fournis :

| Fichier                                      | Rôle                                  |
| -------------------------------------------- | ------------------------------------- |
| `infrastructure/docker/compose.contabo.yaml` | Stack prod VPS                        |
| `infrastructure/docker/Caddyfile.contabo`    | TLS + reverse proxy                   |
| `infrastructure/docker/env.contabo.example`  | Modèle de variables                   |
| `infrastructure/docker/init-contabo/`        | Init PostGIS (sans bases test/legacy) |

## 0. Prérequis serveur

- VPS Contabo avec **au moins 4 Go RAM** (8 Go recommandé si web+admin sur la même machine).
- Contrôle DNS de **monappart.ci**.
- Accès SSH root ou sudo.
- Compte **Cloudflare R2** (ou MinIO en profil `minio` pour un lab uniquement).

Sur le VPS :

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw
# Docker Engine + Compose plugin : https://docs.docker.com/engine/install/ubuntu/
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# se reconnecter SSH après
```

Pare-feu (UFW) :

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

**Interdit :** ouvrir 5432 (Postgres), 6379 (Redis), 4000 (API brute), 9000/9001 (MinIO) sur Internet.

## 1. DNS (`monappart.ci`)

Créer des enregistrements **A** (ou AAAA) vers l’IP publique Contabo :

| Nom     | FQDN                 | Cible                                          |
| ------- | -------------------- | ---------------------------------------------- |
| `api`   | `api.monappart.ci`   | IP Contabo (obligatoire pour ce guide)         |
| `www`   | `www.monappart.ci`   | Contabo **ou** Vercel (recommandé)             |
| `@`     | `monappart.ci`       | Contabo **ou** Vercel ; rediriger apex → `www` |
| `admin` | `admin.monappart.ci` | Contabo **ou** Vercel                          |

Attendre la propagation avant de démarrer Caddy (Let’s Encrypt).

## 2. Récupérer le code et préparer `.env`

```bash
git clone <votre-remote> Mon-Appart
cd Mon-Appart
cp infrastructure/docker/env.contabo.example infrastructure/docker/.env.contabo
chmod 600 infrastructure/docker/.env.contabo
```

Éditer `.env.contabo` :

1. Domaines + `ACME_EMAIL`.
2. `POSTGRES_PASSWORD` fort ; aligner `DATABASE_URL` (hôte = **`postgres`**, pas `127.0.0.1`).
3. `REDIS_URL=redis://redis:6379` (hôte = **`redis`**).
4. `JWT_SECRET` et `JWT_REFRESH_SECRET` (≥ 32 car., **différents**, pas les placeholders locaux).
5. `MEDIA_STORAGE_PROVIDER=r2` + clés R2 (le stockage `local` est **refusé** en staging/production).
6. `WEB_APP_URL` / `CORS_ORIGINS` / `ADMIN_APP_URL` en HTTPS publics.
7. `TRUST_PROXY=1` (obligatoire derrière Caddy).
8. `PAYMENT_PROVIDER=none` (pas de prestataire réel encore).

Générer des secrets :

```bash
openssl rand -base64 48
```

## 3. Ordre de démarrage (checklist)

Exécuter **dans cet ordre**. Alias utile :

```bash
export COMPOSE="docker compose -f infrastructure/docker/compose.contabo.yaml --env-file infrastructure/docker/.env.contabo"
```

### Étape A — Infra données

```bash
$COMPOSE up -d postgres redis
$COMPOSE ps
```

Attendre `healthy` sur postgres et redis.

### Étape B — Migrations Prisma

Jamais `prisma db push` ni `migrate reset` sur ce serveur.

Prérequis : postgres déjà `healthy` (étape A). `--no-deps` ne démarre pas Postgres ; le conteneur doit quand même joindre l’hôte Docker `postgres` via le réseau Compose.

One-shot avec l’image API (recommandé) :

```bash
$COMPOSE build api
$COMPOSE run --rm --no-deps --entrypoint "" \
  --workdir /repo/apps/api \
  api \
  pnpm db:migrate
```

- `--entrypoint ""` : évite que `tini` + le `CMD` Nest interfèrent avec Prisma.
- `pnpm db:migrate` = `prisma migrate deploy` (jamais `db push` / `migrate reset`).
- `DATABASE_URL` vient de `.env.contabo` (hôte = `postgres`, pas `127.0.0.1`).

Si la commande échoue (`pnpm: not found`, Prisma absent), repli depuis la racine montée :

```bash
docker run --rm --network mon-appart-contabo_internal \
  --env-file infrastructure/docker/.env.contabo \
  -v "$PWD":/repo -w /repo \
  node:22-bookworm-slim \
  bash -lc 'corepack enable && pnpm install --frozen-lockfile --filter @mon-appart/api... && pnpm --filter @mon-appart/api db:migrate'
```

Vérifier : les tables métier existent ; aucune base `*_test` n’est utilisée.

### Étape C — API + workers

```bash
$COMPOSE up -d --build api workers
$COMPOSE logs -f api
# Ctrl+C quand /health/live répond
```

Test interne :

```bash
$COMPOSE exec api node -e "fetch('http://127.0.0.1:4000/health/ready').then(async r=>console.log(r.status, await r.text()))"
```

`/health/ready` doit indiquer Postgres + Redis OK.

### Étape D — Caddy (HTTPS)

```bash
$COMPOSE up -d caddy
curl -fsS "https://api.monappart.ci/health/live"
curl -fsS "https://api.monappart.ci/api/v1/meta"
```

Si Let’s Encrypt échoue : DNS pas encore pointé, ports 80/443 filtrés, ou domaine déjà utilisé ailleurs.

### Étape E — Smoke

Depuis votre machine (avec Node) :

```bash
SMOKE_API_URL=https://api.monappart.ci pnpm smoke:health
```

Parcours manuels : inscription/connexion, recherche, fiche, publication éditeur (si comptes de test).

### Étape F — Fronts

**Recommandé :** déployer `apps/web` et `apps/admin` sur **Vercel** avec :

- `NEST_API_URL` / rewrite vers `https://api.monappart.ci`
- `ADMIN_API_URL=https://api.monappart.ci`
- `NEXT_PUBLIC_SITE_URL=https://www.monappart.ci`
- CORS API déjà aligné sur `https://www.monappart.ci`, `https://monappart.ci`, `https://admin.monappart.ci`

**Alternative même VPS :** construire des images `mon-appart-web:contabo` / `mon-appart-admin:contabo` (Dockerfiles fronts pas encore dans le dépôt), décommenter les blocs web/admin du `Caddyfile.contabo`, puis :

```bash
$COMPOSE --profile front up -d
```

## 4. Médias

| Mode              | Quand                           | Config                                                                                      |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Cloudflare R2     | Prod / staging sérieux          | `MEDIA_STORAGE_PROVIDER=r2` + `S3_*`                                                        |
| MinIO sur Contabo | Lab uniquement                  | `$COMPOSE --profile minio up -d` + `MEDIA_STORAGE_PROVIDER=s3` + `S3_FORCE_PATH_STYLE=true` |
| `local`           | **Interdit** hors développement | Refusé au boot API                                                                          |

Créer le bucket R2 (ou MinIO) avant le premier upload. Console MinIO uniquement via tunnel SSH.

## 5. Sauvegardes (obligatoire avant ouverture publique)

Snapshot Contabo **et** dump logique régulier :

```bash
$COMPOSE exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "backup-$(date +%F).dump"
```

Stocker le dump **hors** du VPS. Tester une restauration sur une machine de lab au moins une fois ([backup-and-disaster-recovery.md](./backup-and-disaster-recovery.md)).

## 6. Mises à jour

1. `git pull` du SHA validé (CI verte).
2. Lire les migrations nouvelles.
3. Backup Postgres.
4. `$COMPOSE build api workers && $COMPOSE run --rm … migrate deploy` (même méthode qu’en §3B).
5. `$COMPOSE up -d api workers`
6. Smoke + `/health/ready`.

Rollback applicatif = redéployer l’image / SHA précédent **si** le schéma reste compatible (expand/contract). Voir [runbooks/deployment-and-rollback.md](./runbooks/deployment-and-rollback.md).

## 7. Checklist go / no-go Contabo

Cocher seulement après vérification réelle :

- [ ] UFW : SSH + 80 + 443 uniquement
- [ ] Postgres / Redis sans ports publics
- [ ] `.env.contabo` hors Git, secrets non-placeholder
- [ ] `DATABASE_URL` / `REDIS_URL` avec hôtes Docker (`postgres`, `redis`)
- [ ] `MEDIA_STORAGE_PROVIDER` = `r2` ou `s3` (pas `local`)
- [ ] `TRUST_PROXY=1`, CORS et `WEB_APP_URL` HTTPS
- [ ] `prisma migrate deploy` OK
- [ ] `https://api…/health/live` et `/health/ready` OK
- [ ] `pnpm smoke:health` OK
- [ ] Backup dump + test de restauration
- [ ] Workers up (`$COMPOSE ps`)
- [ ] Fronts (Vercel ou profil `front`) alignés sur l’API
- [ ] E-mail réel ou décision documentée (`EMAIL_PROVIDER=none`)
- [ ] Paiements : rester sur `none` jusqu’à un prestataire implémenté

Référence globale : [production-readiness-checklist.md](./production-readiness-checklist.md).

## 8. Limites assumées

- Pas de déploiement GitHub Actions → Contabo branché (le workflow staging construit l’image mais ne pousse pas encore).
- Pas de HA : un seul VPS = SPOF.
- OpenSearch / reco Python : laisser désactivés (`SEARCH_ENGINE=postgres`, `RECOMMENDATION_ENGINE=rules`).
- Monitoring (Sentry, alertes) : à brancher avant une ouverture large.
- Les Dockerfiles `apps/web` et `apps/admin` ne sont pas fournis : Vercel reste le chemin le plus simple pour les fronts.

## 9. Dépannage rapide

| Symptôme                                        | Piste                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| API refuse de démarrer (MEDIA / JWT / loopback) | Relire les garde-fous `parseApiEnv` ; pas de `127.0.0.1` ni `local` médias |
| `/health/ready` 503                             | Postgres ou Redis pas healthy ; mauvais `DATABASE_URL` / `REDIS_URL`       |
| Let’s Encrypt fail                              | DNS, UFW, ou Caddy pas sur 80                                              |
| Uploads KO                                      | Bucket R2/MinIO + clés ; CORS bucket si URLs publiques                     |
| Cookies / CSRF admin                            | Admin doit être same-site rewrite vers l’API (`ADMIN_API_URL` au build)    |
| Rate-limit IP = 127.0.0.1                       | `TRUST_PROXY` manquant derrière Caddy                                      |
