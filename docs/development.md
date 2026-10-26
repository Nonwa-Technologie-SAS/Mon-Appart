# Développement

## Outils

- pnpm 10.27, workspaces déclarés dans `pnpm-workspace.yaml`
- Turborepo pour `build`, `lint`, `typecheck`, `test`
- TypeScript strict
- ESLint 9 (flat config) et Prettier
- Husky, lint-staged, Commitlint (Conventional Commits)
- Vitest pour l'API, les packages, l'admin et les workers
- Playwright pour un smoke test du site, lancé à part

## Environnement

Copier `.env.example` vers `.env` à la racine (`pnpm secrets:local` pour des JWT distincts). Aucun secret réel ne va dans Git (`pnpm secrets:check`). Détail : [environment-strategy.md](./environment-strategy.md), [secrets-management.md](./secrets-management.md).

Le site `apps/web` ne lit pas ce fichier pour le métier : il a besoin de `apps/web/.env.local` avec `NEST_API_URL` / `NEXT_PUBLIC_NEST_API_URL=same-origin` (rewrite vers Nest). Plus de `DATABASE_URL` legacy côté web — voir [web-nest-cutover.md](./web-nest-cutover.md).

L'API lit `apps/api/.env` puis `../../.env`. Une variable déjà présente dans l'environnement du processus n'est pas écrasée.

`APP_ENV=local` active Swagger et les logs lisibles. En `staging` et `production`, Swagger est éteint sauf `SWAGGER_ENABLED=true`.

## Commandes utiles

```bash
pnpm docker:up
# PostgreSQL hôte : 127.0.0.1:5433 — Redis hôte : 127.0.0.1:6380
# pgAdmin : http://127.0.0.1:5050 (admin@example.com / mon_appart_dev)
pnpm --filter @mon-appart/api dev
pnpm --filter @mon-appart/web dev
pnpm --filter @mon-appart/admin dev
pnpm dev:workers
pnpm dev:recommendation
```

Le mobile Expo reste installable depuis `apps/mobile` (`pnpm --filter @mon-appart/mobile start` ou les scripts Expo). Ce n'est pas une application Flutter : voir la décision 0002.

## Qualité

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:db          # nécessite TEST_DATABASE_URL (*_test) + db:test:migrate
pnpm test:e2e:web     # Playwright — installer chromium une fois
pnpm test:coverage
```

Détails : [testing-strategy.md](./testing-strategy.md), [test-environments.md](./test-environments.md), [e2e-test-catalog.md](./e2e-test-catalog.md).

Mobile / PWA : [pwa-architecture.md](./pwa-architecture.md), [mobile-architecture.md](./mobile-architecture.md), [offline-and-cache-strategy.md](./offline-and-cache-strategy.md).

La CI GitHub Actions exécute lint/types/unitaires/build, le job d’intégration Postgres/PostGIS (migrate + tests + anti-dérive), le build des images Docker (sans push), et pytest pour le service de recommandation. Pas de secrets de production. Détails : [ci-cd.md](./ci-cd.md), [deployment-architecture.md](./deployment-architecture.md).

Prettier n'est pas bloquant sur tout le prototype web historique, pour éviter un reformatage massif. Les fichiers nouveaux suivent `.prettierrc.json`.

## Branches

- `main` : ligne stable
- `develop` : intégration
- `feature/*`, `fix/*`, `chore/*`

## Identifiant de requête

Chaque requête HTTP reçoit `X-Request-ID` (reçu s'il est sûr, sinon généré). Il est repris dans les logs sous `request_id`. Les workers et le service Python pourront le propager quand ils seront appelés par l'API.
