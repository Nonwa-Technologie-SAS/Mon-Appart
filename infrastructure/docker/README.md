# Docker local

`compose.yaml` démarre PostgreSQL/PostGIS, Redis et pgAdmin.

```bash
pnpm docker:up
pnpm docker:down
```

Sur la machine hôte :

| Service    | Adresse               | Notes                                     |
| ---------- | --------------------- | ----------------------------------------- |
| PostgreSQL | `127.0.0.1:5433`      | Conteneur interne : 5432                  |
| Redis      | `127.0.0.1:6380`      | Conteneur interne : 6379                  |
| pgAdmin    | http://127.0.0.1:5050 | Interface SQL, liée à localhost seulement |

Le décalage 5433 / 6380 évite un PostgreSQL ou un Redis déjà installés localement.

## pgAdmin

Identifiants d'interface (local uniquement, alignés sur le Compose) :

- e-mail : `admin@example.com`
- mot de passe : `mon_appart_dev`

Le serveur « Mon Appart (Docker) » est préconfiguré (`Host=postgres`, port interne `5432`). À la première connexion au serveur, saisir le mot de passe PostgreSQL : `mon_appart_dev` (même valeur que `POSTGRES_PASSWORD`). Les bases `mon_appart`, `mon_appart_test` et `mon_appart_legacy` y sont visibles.

Ne pas exposer ce service hors de la machine de développement. Ce n'est pas le back-office métier (`apps/admin`) : pgAdmin édite SQL brut ; l'admin applicatif reste dans `apps/admin`.

Les Dockerfiles de l'API, des workers et du service de recommandation servent à une étape de déploiement. Ils ne sont pas lancés par Compose (profils applicatifs volontairement absents : le dev reste `pnpm dev` + Compose infra).

```bash
# Depuis la racine du monorepo
docker build -f apps/api/Dockerfile -t mon-appart-api:local .
docker build -f services/workers/Dockerfile -t mon-appart-workers:local .
docker build -f services/recommendation/Dockerfile -t mon-appart-recommendation:local .
```

Exigences images : Node/Python versionnés, multi-stage, utilisateur non-root, `tini`, healthcheck API/reco, pas de secrets dans l’image.

OpenSearch, Kafka, Prometheus, Grafana et Loki ne font pas partie du Compose de développement. Voir [docs/deployment-architecture.md](../../docs/deployment-architecture.md).

## Contabo / VPS (staging DIY)

Ne pas confondre avec ce Compose local. Pour un VPS Contabo :

- Guide : [docs/deployment-contabo.md](../../docs/deployment-contabo.md)
- `compose.contabo.yaml` + `Caddyfile.contabo` + `env.contabo.example`
- Copier `env.contabo.example` → `.env.contabo` (hors Git), puis démarrer selon le guide
- Fronts : `docker compose … --profile front up -d --build` (`apps/web/Dockerfile`, `apps/admin/Dockerfile`)

Postgres/Redis n’y publient **aucun** port hôte ; seul Caddy expose 80/443.
