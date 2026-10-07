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

Copier `.env.example` vers `.env` à la racine. Aucun secret réel ne va dans Git.

Le prototype `apps/web` ne lit pas ce fichier. Il a besoin de son propre `apps/web/.env.local` (ignoré par Git), avec `DATABASE_URL` vers `mon_appart_legacy` et `BETTER_AUTH_SECRET`. Ne pas lui donner la base de l'API.

L'API lit `apps/api/.env` puis `../../.env`. Une variable déjà présente dans l'environnement du processus n'est pas écrasée.

`APP_ENV=local` active Swagger et les logs lisibles. En `staging` et `production`, Swagger est éteint sauf `SWAGGER_ENABLED=true`.

## Commandes utiles

```bash
pnpm docker:up
# PostgreSQL hôte : 127.0.0.1:5433 — Redis hôte : 127.0.0.1:6380
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
pnpm --filter @mon-appart/api test:e2e
```

La CI GitHub Actions exécute la même chaîne, sans secrets de production. Le job Python teste le service de recommandation.

Prettier n'est pas bloquant sur tout le prototype web historique, pour éviter un reformatage massif. Les fichiers nouveaux suivent `.prettierrc.json`.

## Branches

- `main` : ligne stable
- `develop` : intégration
- `feature/*`, `fix/*`, `chore/*`

## Identifiant de requête

Chaque requête HTTP reçoit `X-Request-ID` (reçu s'il est sûr, sinon généré). Il est repris dans les logs sous `request_id`. Les workers et le service Python pourront le propager quand ils seront appelés par l'API.
