# Environnements et commandes de test

## Séparation

| Environnement  | Base / services                                    | Usage               |
| -------------- | -------------------------------------------------- | ------------------- |
| Développement  | `DATABASE_URL` (souvent port **5433** via Compose) | `pnpm dev`          |
| Unitaires      | pas de Postgres (`DATABASE_URL=""`)                | `pnpm test`         |
| Intégration    | `TEST_DATABASE_URL` → base `*_test`                | `pnpm test:db`      |
| E2E web        | Next local + évent. Prisma legacy web              | `pnpm test:e2e:web` |
| Staging / prod | hors suite automatisée destructive                 | jamais `test:db`    |

Compose local : `pnpm docker:up` → Postgres `localhost:5433`, Redis `localhost:6380`.

## Variables minimales

```bash
# Racine ou apps/api/.env
TEST_DATABASE_URL=postgresql://mon_appart:mon_appart_dev@127.0.0.1:5433/mon_appart_test
JWT_SECRET=dev-only-change-me-please-32chars-min
JWT_REFRESH_SECRET=dev-only-refresh-change-me-32chars
```

La suite DB force `DATABASE_URL=$TEST_DATABASE_URL`, `PAYMENT_PROVIDER=mock`, providers mail/SMS `none`, média `local`.

## Commandes

```bash
# Unitaire + SEO web + packages (Turbo)
pnpm test

# API uniquement — domaine / guards
pnpm test:unit

# Health + contrats API
pnpm test:e2e

# Intégration Postgres (prérequis migrate)
pnpm db:test:migrate
pnpm test:db
# alias
pnpm test:integration

# Couverture API
pnpm test:coverage

# Smoke rapide
pnpm test:smoke

# Playwright web
pnpm --filter @mon-appart/web exec playwright install chromium
pnpm test:e2e:web
```

## Préparation base de test (local)

1. `pnpm docker:up`
2. Créer `mon_appart_test` si absente (init Compose le fait souvent au premier boot).
3. `pnpm db:test:migrate`
4. `pnpm test:db`

## CI

- Job **verify** : pas de Postgres requis.
- Job **integration** : service `postgis/postgis:16-3.5`, création `mon_appart_test`, migrate, `test:db`.
- Secrets de production : **jamais** injectés dans les jobs PR.

## Charge (k6)

Non configuré dans le dépôt. Toute mesure de charge doit cibler un environnement dédié, avec plan et autorisation explicites — jamais la production sans validation.
