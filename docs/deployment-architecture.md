# Architecture de déploiement

Document d’architecture **recommandée**. Aucune ressource Cloud n’a été créée depuis ce dépôt.

## 1. Constat dépôt (audit)

| Composant                 | État                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `apps/web` Next.js        | Opérationnel en local ; consomme Nest via rewrite `/api/v1/*`        |
| `apps/admin` Next.js      | Socle back-office                                                    |
| `apps/api` NestJS         | Monolithe modulaire, health `/health/live` + `/health/ready`         |
| `services/workers`        | BullMQ                                                               |
| `services/recommendation` | FastAPI optionnel (`RECOMMENDATION_ENGINE=rules` par défaut)         |
| PostgreSQL + PostGIS      | Compose local + migrations Prisma versionnées                        |
| Redis                     | Compose local (cache, rate-limit, BullMQ)                            |
| OpenSearch                | Code présent, **désactivé** si `OPENSEARCH_NODE` vide                |
| Médias                    | Local ou S3/R2 (`MEDIA_STORAGE`)                                     |
| CI GitHub Actions         | Lint, types, tests, build, intégration PostGIS, images Docker        |
| Terraform                 | Dossier réservé, **aucun module** tant que le Cloud n’est pas choisi |
| Kubernetes                | **Non** recommandé au démarrage                                      |

## 2. Architecture logique cible (phase initiale)

```
Internet
   │
   ├─ Cloudflare (DNS, TLS, CDN, WAF basique)
   │
   ├─ Vercel (ou équivalent) ── apps/web + apps/admin
   │         │ rewrite /api/v1/* ──► API
   │
   ├─ Conteneurs (Fly.io / Render / Cloud Run / ECS Fargate)
   │         ├─ Nest API (stateless, N replicas)
   │         └─ Workers BullMQ (1+ replicas)
   │
   ├─ PostgreSQL managé + PostGIS (source de vérité)
   ├─ Redis managé (cache + files, reconstructible)
   └─ Cloudflare R2 / S3 (médias)
```

Principes :

- L’API reste **stateless** (JWT + cookies refresh ; pas de session mémoire).
- PostgreSQL est la source de vérité ; Redis et OpenSearch sont dérivés / caches.
- Les médias ne vont pas dans PostgreSQL.
- Frontend, API et workers se déploient **indépendamment**.

## 3. Choix Cloud — options et recommandation

### Option A — Recommandée (simplicité + maîtrise des coûts)

| Couche               | Fournisseur                                                                  | Motif                                                 |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| Web / Admin          | **Vercel**                                                                   | Next.js natif, previews PR, HTTPS                     |
| API + workers        | **Fly.io** ou **Render**                                                     | Conteneurs Docker déjà prêts, scale horizontal simple |
| PostgreSQL + PostGIS | **Aiven**, **DigitalOcean**, **AWS RDS**, ou **Supabase** (vérifier PostGIS) | Sauvegardes managées, PostGIS                         |
| Redis                | **Upstash** ou Redis managé du même fournisseur que l’API                    | Faible friction                                       |
| Médias               | **Cloudflare R2**                                                            | Compatible S3, egress réduit                          |
| DNS / CDN / WAF      | **Cloudflare**                                                               | Latence Afrique de l’Ouest acceptable via Anycast     |

**Pourquoi pas Kubernetes tout de suite :** un seul monolithe API + workers + 2 fronts ne justifie pas le coût d’exploitation d’un cluster. Réévaluer si > ~10 services, multi-région obligatoire, ou équipe SRE dédiée.

### Option B — Tout-en-un (MVP ultra-rapide)

Railway / Render : API, workers, Postgres, Redis sur une plateforme. Vérifier **PostGIS** avant choix. Coût et vendor lock-in à surveiller.

### Option Contabo — VPS DIY (staging / MVP ops)

Un seul VPS (Docker Compose + Caddy + PostGIS + Redis). Convient pour valider le déploiement avant le Cloud managé. **Pas** de HA. Guide pas à pas : [deployment-contabo.md](./deployment-contabo.md) (`infrastructure/docker/compose.contabo.yaml`).

### Option C — Entreprise AWS

CloudFront + Amplify/ECS + RDS PostGIS + ElastiCache + S3. Plus de surface IAM/Terraform ; à réserver si contrainte entreprise.

### Critères Côte d’Ivoire

- Latence : CDN Cloudflare + région Europe (eu-west) ou Afrique si disponible chez le fournisseur DB.
- Coût egress médias : privilégier R2.
- Paiements / SMS / e-mail : fournisseurs régionaux à brancher sans les coupler à l’hébergeur compute.

## 4. Évolution

1. **Maintenant** : Option A, 1 région, Postgres + Redis, recherche PostgreSQL.
2. **Trafic réel** : scale API horizontal, PgBouncer si saturation connexions.
3. **Recherche** : OpenSearch seulement si les métriques Postgres search le justifient.
4. **ML reco** : activer `services/recommendation` si le moteur rules ne suffit plus.
5. **Kubernetes** : uniquement si orchestration multi-services + compétences ops.

## 5. Interdits opérationnels

- Ne pas exposer Postgres/Redis sur Internet.
- Ne pas utiliser `prisma db push` / `migrate reset` en staging/production.
- Ne pas déployer OpenSearch ou un cluster K8s « pour plus tard ».
- Ne pas committer de secrets ; séparer les environnements GitHub.

Voir aussi : [environments.md](./environments.md), [ci-cd.md](./ci-cd.md), [deployment-contabo.md](./deployment-contabo.md), [cloud-cost-estimation.md](./cloud-cost-estimation.md).
