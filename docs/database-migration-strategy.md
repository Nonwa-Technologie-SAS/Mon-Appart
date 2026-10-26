# Stratégie de migration PostgreSQL / Prisma

Complète [database.md](./database.md) et [database-migrations-production.md](./database-migrations-production.md).

PostgreSQL est la source de vérité. Les migrations vivent dans `apps/api/prisma/migrations/` (SQL versionné, y compris CHECK / PostGIS). **Ne pas modifier** une migration déjà appliquée.

## Commandes

| Contexte              | Commande                                               | Interdit                                        |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| Local, nouveau schéma | `pnpm --filter @mon-appart/api` + `prisma migrate dev` | En staging/prod                                 |
| Déploiement           | `pnpm db:migrate` = `prisma migrate deploy`            | `db push`, `migrate reset`                      |
| Tests                 | `pnpm db:test:migrate`                                 | Toute base dont le nom ne finit pas par `_test` |

L’API **n’exécute pas** les migrations au démarrage (Dockerfile : `node dist/main.js`). Une seule étape de déploiement, URL **directe** (pas le pooler transactionnel).

## Cycle

1. Écrire le SQL (nom `YYYYMMDDHHMMSS_description`).
2. `migrate dev` en local sur `mon_appart`.
3. Tests `test:db` + job CI `prisma migrate diff` (anti-dérive).
4. Relire locks (ALTER table chaude, index sans `CONCURRENTLY`).
5. Staging : snapshot → `migrate deploy` → smoke.
6. Production : idem, hors heures de pic si lock probable.
7. Échec : ne pas « down » ; forward-fix.

## Expand–Migrate–Contract

Obligatoire seulement si le code actuel casserait. Sinon une migration additive simple suffit (ex. `20261026120000_domain_outbox`).

1. **Expand** : colonnes/tables nullables.
2. **Migrate** : backfill, dual-write si besoin, déployer le code bi-compatible.
3. **Contract** : NOT NULL, drop ancien, **après** que tout le trafic utilise le nouveau.

Un rollback d’image **n’annule pas** le schéma.

## Longues opérations

Évaluer volume, `ACCESS EXCLUSIVE`, `CREATE INDEX CONCURRENTLY` (hors transaction Prisma unique — souvent SQL manuel). Ne pas déclarer « zéro interruption » sans mesure.

## Seeds

- `reference` : rôles, permissions, types — staging/prod/test.
- `development` : comptes démo locaux — **refusé** si production-like (`apps/api/prisma/seed.ts`).
