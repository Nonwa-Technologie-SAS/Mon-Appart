# Gestion des releases

## Git (existant)

- Branches : `main`, `develop`, `feature/*`, `fix/*`, `chore/*`
- Commits : Conventional Commits (commitlint)
- PR → CI obligatoire ([ci-cd.md](./ci-cd.md))

## Versionnement

SemVer pour packages/apps lorsque tagués :

- **MAJOR** : breaking API/clients
- **MINOR** : features compatibles
- **PATCH** : fixes

Monorepo : tag Git `vX.Y.Z` + notes ([release-notes-template.md](./release-notes-template.md)). Packages workspace restent souvent `0.0.0` privés — le tag monorepo fait foi pour le déploiement.

## Flux cible

```
feature → PR (CI) → merge develop/main
       → artefact SHA
       → staging (migrate + smoke)
       → approbation → production (même artefact)
```

Deploy staging workflow : manuel (`deploy-staging.yml`) — push registry **à brancher**.

## Contrôles bloquants (stop-the-line)

- Lint / typecheck / unit / e2e API
- Build apps
- Intégration PostGIS + anti-drift migrations
- Docker build (CI)
- Smoke health post-deploy (staging/prod)

Contournement CI **interdit** pour une release dite « sûre ».

## Hotfix

1. Branche `fix/*` depuis tag prod.
2. CI + staging rapide si possible.
3. Prod + note de version.
4. Back-merge develop.

## Rollback

Voir [runbooks/deployment-and-rollback.md](./runbooks/deployment-and-rollback.md). Migration ≠ undo automatique.
