# Mon Appart

Plateforme immobilière pour la Côte d'Ivoire. Ce dépôt est un monorepo pnpm + Turborepo : monolithe modulaire côté API, sites Next.js, workers asynchrones et service de recommandation Python.

Le site public et l'application mobile déjà en cours sont conservés. Le socle nouveau (API NestJS, back-office, packages, Docker) est prêt à recevoir le métier, sans le réécrire ici.

## Applications et services

| Chemin | Rôle |
| --- | --- |
| `apps/web` | Site public Next.js existant (prototype) |
| `apps/admin` | Back-office Next.js, socle seulement |
| `apps/api` | API NestJS versionnée `/api/v1` |
| `apps/mobile` | Application Expo déjà commencée |
| `services/workers` | Jobs BullMQ |
| `services/recommendation` | Service FastAPI, sans moteur ML |
| `packages/*` | Types, validation, configuration, ESLint, TypeScript |

## Prérequis

- Node.js 22 ou plus (développé avec Node 24)
- pnpm 10.27
- Docker, pour PostgreSQL/PostGIS et Redis
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

| Service | URL |
| --- | --- |
| Site public | http://localhost:3000 |
| Back-office | http://localhost:3001 |
| API | http://localhost:4000/api/v1/meta |
| Santé API | http://localhost:4000/health |
| OpenAPI (local) | http://localhost:4000/docs |

Le prototype web garde sa propre base (`mon_appart_legacy` si vous le branchez sur Docker). L'API utilise `mon_appart`. Les deux ne partagent pas les migrations Prisma.

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

## Branches

`main`, `develop`, `feature/*`, `fix/*`, `chore/*`.
