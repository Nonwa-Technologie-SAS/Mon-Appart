# Mon Appart

Plateforme immobilière pour la Côte d'Ivoire. Ce dépôt est un monorepo pnpm + Turborepo : monolithe modulaire côté API, sites Next.js, workers asynchrones et service de recommandation Python.

Le site public et l'application mobile déjà en cours sont conservés. Le socle nouveau (API NestJS, back-office, packages, Docker) est prêt à recevoir le métier, sans le réécrire ici.

## Applications et services

| Chemin                    | Rôle                                                 |
| ------------------------- | ---------------------------------------------------- |
| `apps/web`                | Site public Next.js existant (prototype)             |
| `apps/admin`              | Back-office Next.js, socle seulement                 |
| `apps/api`                | API NestJS versionnée `/api/v1`                      |
| `apps/mobile`             | Application Expo déjà commencée                      |
| `apps/flutter`            | Socle Flutter Android/iOS (API Nest `/api/v1`)       |
| `services/workers`        | Jobs BullMQ                                          |
| `services/recommendation` | Service FastAPI, sans moteur ML                      |
| `packages/*`              | Types, validation, configuration, ESLint, TypeScript |

## Prérequis

- Node.js 22 ou plus (développé avec Node 24)
- pnpm 10.27
- Docker, pour PostgreSQL/PostGIS, Redis et pgAdmin
- Python 3.12 ou plus, pour le service de recommandation

## Démarrage

```bash
cp .env.example .env
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

| Service         | URL                               |
| --------------- | --------------------------------- |
| Site public     | http://localhost:3000             |
| Back-office     | http://localhost:3001             |
| pgAdmin (SQL)   | http://127.0.0.1:5050             |
| API             | http://localhost:4000/api/v1/meta |
| Santé API       | http://localhost:4000/health      |
| OpenAPI (local) | http://localhost:4000/docs        |

Le site web consomme exclusivement l’API Nest (`mon_appart`). La base Docker `mon_appart_legacy` est un résidu hors parcours web (voir `docs/web-nest-cutover.md`).

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm db:migrate
pnpm db:generate
pnpm db:seed
pnpm dev:workers
pnpm dev:recommendation
```

`pnpm test:e2e` lance les tests HTTP de l'API. Le smoke test Playwright du site est `pnpm --filter @mon-appart/web test:e2e` (nécessite les navigateurs Playwright).

## Documentation

- [Architecture](docs/architecture.md)
- [Développement](docs/development.md)
- [Base de données](docs/database.md)
- [API](docs/api.md)
- [Sécurité](docs/security.md)
- [Décisions](docs/decisions/0001-initial-architecture.md)

### Déploiement et opérations

- [Architecture de déploiement](docs/deployment-architecture.md)
- [Déploiement Contabo (VPS)](docs/deployment-contabo.md)
- [Environnements](docs/environments.md)
- [CI/CD](docs/ci-cd.md)
- [Migrations production](docs/database-migrations-production.md)
- [Sauvegardes / DR](docs/backup-and-disaster-recovery.md)
- [Monitoring](docs/monitoring-and-alerting.md)
- [Runbook](docs/production-runbook.md)
- [Checklist go-live](docs/production-readiness-checklist.md)
- [Estimation coûts](docs/cloud-cost-estimation.md)

### Fiabilité (SRE)

- [Stratégie SRE](docs/sre-reliability-strategy.md)
- [SLI / SLO / error budgets](docs/sre-sli-slo-error-budgets.md)
- [Observabilité](docs/observability-architecture.md)
- [Incidents](docs/incident-management.md)
- [Runbooks](docs/runbooks/api-and-dependencies.md)
- [Catalogue services](docs/service-catalog-and-dependencies.md)
- [Checklist ops SRE](docs/sre-operational-readiness-checklist.md)
- Charge : `k6 run -e BASE_URL=http://127.0.0.1:4000 scripts/load/k6-smoke.js`

### Produit & releases

- [Gouvernance produit](docs/product-governance.md)
- [Vision](docs/product-vision-and-principles.md)
- [Roadmap](docs/product-roadmap.md)
- [Feature flags](docs/feature-flags-architecture.md)
- [Release management](docs/release-management.md)
- [Launch checklist](docs/launch-readiness-checklist.md)
- [ADR index](docs/architecture-decision-records.md)

```bash
# Smoke health (API locale ou distante)
node scripts/smoke-health.mjs
SMOKE_API_URL=https://api.exemple.ci node scripts/smoke-health.mjs
```

Aucun déploiement Cloud n’est effectué depuis ce dépôt sans autorisation explicite.

## Branches

`main`, `develop`, `feature/*`, `fix/*`, `chore/*`.
