# Gestion de la configuration

La configuration backend est centralisée dans `@mon-appart/config` (`packages/config/src/index.ts`), validée par Zod au **démarrage** Nest (`ConfigModule` → `parseApiEnv`). Un échec lève `Configuration d'environnement invalide: chemin: message` **sans** recopier les valeurs.

## Backend

Domaines (variables dans `.env.example`) : application, PostgreSQL, Redis, JWT/Identity, CORS, search, reco, media/S3, email/SMS, billing, analytics, trust, outbox, observabilité, feature flags.

Les modules métier lisent `ConfigService` / fichiers `*.config.ts` du module. Quelques **rate limits** lisent encore `process.env.*_RATE_LIMIT` avec repli numérique : écart mineur, pas une seconde source de secrets.

### Validation déployée (`APP_ENV` staging \| production)

- `DATABASE_URL` PostgreSQL obligatoire, hors loopback, nom **sans** suffixe `_test`.
- `REDIS_URL` obligatoire, hors loopback.
- `WEB_APP_URL` obligatoire.
- `JWT_SECRET` ≠ `JWT_REFRESH_SECRET`, longueur ≥ 32, pas les placeholders `.env.example` / CI.
- `NODE_ENV=development` incompatible.
- `AUTH_DEV_PRINT_CODES=true` interdit.
- `PAYMENT_PROVIDER=mock` interdit.
- Stockage médias `local` interdit.

Tests : `packages/config/src/env.test.ts`.

## Frontend Next.js

| Variable                   | Visibilité             | Usage                             |
| -------------------------- | ---------------------- | --------------------------------- |
| `NEXT_PUBLIC_NEST_API_URL` | Navigateur             | `same-origin` recommandé          |
| `NEXT_PUBLIC_SITE_URL`     | Navigateur             | Canonique SEO                     |
| `NEXT_PUBLIC_FF_*`         | Navigateur             | Kill-switch UI **≠** autorisation |
| `NEST_API_URL`             | Serveur Next (rewrite) | Build/runtime serveur             |
| `ADMIN_API_URL`            | Serveur admin          | Figée au `next build`             |

Tout `NEXT_PUBLIC_*` est public. Jamais JWT, `DATABASE_URL`, clés S3, secrets paiement.

`ADMIN_API_URL` est une URL de build : un changement d’API admin exige un **rebuild**.

## Fichiers

- Exemple : `.env.example` (racine), `apps/mobile/.env.example`.
- Local : `.env` gitignoré. Génération : `pnpm secrets:local`.
- Pas de `.env.production` versionné.
