# Runbook — environnements, secrets, migrations

Diagnostic API : [runbooks/api-and-dependencies.md](./runbooks/api-and-dependencies.md). Déploiement défectueux : [runbooks/deployment-and-rollback.md](./runbooks/deployment-and-rollback.md).

## Démarrage local

```bash
pnpm docker:up
cp .env.example .env
pnpm secrets:local          # coller JWT distincts dans .env
pnpm db:migrate && pnpm db:seed
pnpm dev
pnpm smoke:health
```

Compose n’est **pas** la production. pgAdmin est bound `127.0.0.1:5050`.

## L’API refuse de démarrer

Lire le message `Configuration d'environnement invalide` (chemins de variables, pas les valeurs). Causes fréquentes staging : `DATABASE_URL` absente, loopback, JWT placeholder, `PAYMENT_PROVIDER=mock`.

## Migration

```bash
# local
pnpm --filter @mon-appart/api exec prisma migrate dev --name description
pnpm test:db

# déployé (une fois, URL directe)
pnpm db:migrate
```

Échec `migrate deploy` : inspecter `_prisma_migrations`, **ne pas** reset, écrire une migration corrective.

## Rotation JWT (staging/prod)

1. Prévenir : toutes les sessions tomberont.
2. Injecter deux secrets **distincts** ≥ 32 caractères.
3. Redémarrer l’API.
4. Smoke login.
5. Ancien secret oublié (pas de dual-key).

## Fichier .env retrouvé dans Git

1. `git rm --cached` (déjà fait pour `.env` / `apps/mobile/.env`).
2. **Révoquer** les identifiants exposés (Postgres local n’est pas prod ; un JWT d’exemple n’est pas prod ; un mot de passe **réel** oui).
3. Gitleaks historique = chantier séparé (pas de rewrite sans accord).

## Preview / fork

Les jobs PR n’ont que `contents: read`. Ne jamais donner `DATABASE_URL` prod à un workflow `pull_request` depuis un fork.
