# Base de données

PostgreSQL 16 avec PostGIS est la source de vérité. Redis ne l'est pas.

## Docker

`pnpm docker:up` démarre :

- PostgreSQL/PostGIS, base `mon_appart`, publié sur le port hôte **5433** (5432 dans le conteneur)
- une base `mon_appart_legacy` pour le prototype web
- Redis 7, publié sur le port hôte **6380** (6379 dans le conteneur)

Ces ports hôte évitent un PostgreSQL ou un Redis déjà installés sur 5432 et 6379.

L'image est `postgis/postgis:16-3.5`. L'extension est créée au premier démarrage du volume et par la migration Prisma `20261007143000_enable_postgis`.

## Prisma

Le schéma canonique du socle est `apps/api/prisma/schema.prisma` (Prisma 7, adaptateur `pg`). Il ne contient pas encore de modèles métier. Les coordonnées des biens seront plus tard des `GEOGRAPHY(Point, 4326)`, pas deux `Float` isolés sans index spatial.

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

`db:migrate` applique les migrations (`migrate deploy`). Pour créer une migration pendant le développement : `pnpm --filter @mon-appart/api db:migrate:dev`.

Le client généré va dans `apps/api/src/generated/` et n'est pas versionné. `moduleFormat = cjs` pour rester compatible avec NestJS.

## Prototype web

`apps/web/prisma` a déjà un schéma et des migrations (auth, biens, visites). Il ne faut pas pointer ce schéma vers `mon_appart` : les tables `_prisma_migrations` entreraient en conflit. Utiliser `mon_appart_legacy` si le prototype tourne sur le Postgres local.

## Transactions et outbox

Une opération métier qui écrit plusieurs lignes utilisera une transaction PostgreSQL. Quand un événement doit quitter le processus de façon fiable, il sera inséré dans une table outbox dans la même transaction. Ce n'est pas encore une table : elle arrivera avec le premier événement critique.

## Pool

L'adaptateur Prisma ouvre au plus 10 connexions. Un pooler externe (PgBouncer) pourra s'intercaler au déploiement, sans changer les modules.
