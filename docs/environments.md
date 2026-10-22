# Environnements

## Matrice

| | local | test (CI) | staging | production |
| --- | --- | --- | --- | --- |
| `APP_ENV` | `local` | `test` | `staging` | `production` |
| `NODE_ENV` | `development` | `test` | `production` | `production` |
| Base métier | Compose `mon_appart` | `mon_appart_test` | instance dédiée | instance dédiée |
| Redis | Compose `:6380` | service CI ou mock | managé dédié | managé dédié |
| Secrets | `.env` local | secrets CI de test | GitHub Environment `staging` | GitHub Environment `production` |
| Seed | `development` (défaut) | `reference` | `reference` | `reference` |
| Swagger | oui | n/a | non (sauf override) | non |
| Paiement mock | autorisé | autorisé | **refusé** | **refusé** |
| `AUTH_DEV_PRINT_CODES` | possible | non | **refusé** | **refusé** |

## Règles anti-contamination

- `TEST_DATABASE_URL` doit finir par `_test` ; scripts `db:test:*` refusent sinon.
- Seed `development` refusé si `APP_ENV` ∈ {staging, production} ou `NODE_ENV=production`.
- Aucune URL staging/production dans le dépôt (voir `.env.example`).
- Les jobs PR n’ont pas accès aux secrets production (OIDC / environments GitHub).

## Variables critiques

Référence complète : `.env.example` à la racine.

Minimales pour démarrer l’API en staging/production :

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET` / `JWT_REFRESH_SECRET` (≥ 32 caractères, distincts par env)
- `WEB_APP_URL` / `ADMIN_APP_URL` / `CORS_ORIGINS`
- `NEST_API_URL` (côté web/admin build) et `NEXT_PUBLIC_NEST_API_URL=same-origin` (web)
- `MEDIA_STORAGE` + credentials R2/S3 en production
- `APP_ENV` / `NODE_ENV`

Frontend public : uniquement `NEXT_PUBLIC_*` (jamais de JWT ni `DATABASE_URL`).

## Compose local

```bash
pnpm docker:up    # Postgres 5433, Redis 6380, pgAdmin 5050
pnpm docker:down
```

Détails : [infrastructure/docker/README.md](../infrastructure/docker/README.md).
