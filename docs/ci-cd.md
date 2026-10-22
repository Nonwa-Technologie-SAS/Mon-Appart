# CI/CD

## Workflows présents

| Fichier | Déclencheur | Rôle |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push `main`/`develop`, PR | Lint, typecheck, tests, build, intégration PostGIS, drift migrations, build Docker (sans push) |
| `.github/workflows/deploy-staging.yml` | `workflow_dispatch` | Garde manuelle + build image ; **push/deploy à brancher** après choix Cloud |

## Pipeline PR (obligatoire)

1. `pnpm install --frozen-lockfile`
2. `pnpm lint` / `pnpm typecheck` / `pnpm test`
3. `pnpm --filter @mon-appart/api test:e2e`
4. `pnpm build`
5. Job `integration` : migrate test DB + `test:db` + `prisma migrate diff` (anti-drift)
6. Job `recommendation` : pytest
7. Job `docker` : build images API / workers / recommendation (cache GHA, **pas de push**)

Une PR n’est pas verte si une étape obligatoire échoue.

## Déploiement cible (à activer)

```
feature/* → PR (CI)
    ↓ merge develop/main
artefact immuable (image digérée + commit SHA)
    ↓
staging (migrate deploy → rollout → smoke)
    ↓ approbation Environment production
production (même artefact, pas de rebuild silencieux)
    ↓ health + smoke
rollback applicatif si besoin (voir production-runbook.md)
```

### Secrets à configurer (chez le fournisseur / GitHub)

**Staging / production (Environments GitHub) :**

- Registry : `REGISTRY_HOST`, credentials OIDC ou token
- Hébergeur API : token / OIDC
- `DATABASE_URL`, `REDIS_URL`, JWT, CORS, médias
- Vercel : tokens projet web/admin (ou Git integration)

**Jamais** dans les jobs PR provenant de forks.

### Permissions Actions

- `contents: read` par défaut
- Élévation minimale uniquement sur le job de déploiement (packages write / id-token si OIDC)

## Commandes locales équivalentes

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm docker:up
pnpm db:test:migrate && pnpm test:db
docker build -f apps/api/Dockerfile -t mon-appart-api:local .
docker build -f services/workers/Dockerfile -t mon-appart-workers:local .
docker build -f services/recommendation/Dockerfile -t mon-appart-recommendation:local .
node scripts/smoke-health.mjs
```

## Protections de branche (à activer sur GitHub)

- `main` : reviews + CI verte obligatoire
- Environment `production` : reviewers requis
- Pas de push force sur `main`
