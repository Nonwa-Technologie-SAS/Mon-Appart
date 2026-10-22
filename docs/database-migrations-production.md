# Migrations PostgreSQL / Prisma en production

Complète [database.md](./database.md).

## Commande autorisée hors local

```bash
pnpm --filter @mon-appart/api db:migrate
# = prisma migrate deploy
```

Interdit en staging/production :

- `prisma migrate dev`
- `prisma db push`
- `prisma migrate reset`
- `db:test:reset` / `db:seed` profil `development`

## Avant migration risquée

1. Sauvegarde / snapshot (PITR si disponible).
2. Relire le SQL dans `apps/api/prisma/migrations/*/migration.sql`.
3. Estimer locks (ALTER sur tables chaudes, index non CONCURRENTLY).
4. Déployer le code **compatible** ancien + nouveau schéma si besoin (expand/contract).
5. Exécuter `migrate deploy` (job one-shot ou init container, **pas** dans chaque replica HTTP en parallèle sans verrou).
6. Smoke health + parcours critiques.
7. Ne jamais « rollback » une migration déjà appliquée : corriger par une nouvelle migration.

## Expand / contract (rappel)

1. Ajouter colonnes nullable / tables.
2. Déployer code bi-compatible.
3. Backfill.
4. Contraintes / NOT NULL.
5. Plus tard : supprimer l’ancien.

Un rollback d’image **ne annule pas** le schéma.

## Connexions

- Pool applicatif Prisma/pg : borné (~10 / instance) — voir adaptateur API.
- Au-delà de quelques replicas : PgBouncer (mode transaction) ; migrations via URL **directe** (bypass pooler).
- Surveiller `pg_stat_activity`, saturations, timeouts.

## Vérification anti-dérive (CI)

Le job `integration` exécute :

```bash
prisma migrate diff --from-config-datasource --to-schema-datamodel prisma/schema.prisma --script
```

Une sortie non vide fait échouer la CI.

## Seed production

Uniquement profil `reference` (référentiels CI / rôles / types). Pas de comptes fictifs. Voir `SEED_PROFILE` et garde-fous dans `docs/database.md`.
