# Runbook — Déploiement défectueux / rollback

## Avant déploiement

- CI verte (lint, tests, build, docker build).
- Artefact = commit SHA.
- Migrations relues ; backup/snapshot si risqué.
- Plan rollback écrit.

## Post-déploiement

```bash
SMOKE_API_URL=$API pnpm smoke:health
curl -fsS "$API/api/v1/meta"
# Parcours manuels : login, search, fiche, publish (éditeur)
```

## Rollback applicatif

1. Redéployer l’image / release Vercel du SHA précédent.
2. Vérifier compatibilité schéma (expand/contract) — **rollback app ≠ undo migration**.
3. Smoke + ready.
4. Inspecter jobs en cours / failed.

## Migration problématique

- Ne pas `migrate reset`.
- Forward-fix : nouvelle migration corrective.
- Si données corrompues : procédure DR ([disaster-recovery.md](../disaster-recovery.md)) avec validation humaine.

## Feature flags

Registre env `@mon-appart/config` — voir [feature-flags-architecture.md](../feature-flags-architecture.md).
Kill-switch UI : `FF_WEB_ASSISTANT`, `FF_WEB_RECOMMENDATIONS`. Moteurs : `SEARCH_ENGINE`, `RECOMMENDATION_ENGINE`.

## À éviter

- Rebuild différent au moment du rollback prod.
- Déployer sans smoke.
- Appliquer `db push` en prod.
