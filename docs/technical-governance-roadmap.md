# Feuille de route — gouvernance technique

## Aujourd’hui (fait)

- Monorepo pnpm/turbo, Node 22, lockfile.
- Config Zod, garde-fous seed/test DB, Docker non-root, CI PR, drift Prisma.
- Docs déploiement / migrations / flags déjà présentes ; étendues par ce lot.
- `.env` retiré de l’index ; Gitleaks working-tree ; Dependabot ; modèle de PR.

## Cible proche (sans nouvel outil lourd)

1. Activer protections `main` / Environments GitHub (reviewers).
2. Secret scanning + push protection GitHub.
3. Brancher registry + `deploy-staging` (OIDC).
4. Rotation effective des identifiants qui ont vécu dans Git.
5. Dual-key JWT **si** une prod a des sessions longues — pas avant.

## Moyen terme

- Promouvoir le **même** digest d’image staging → prod.
- Sauvegardes PITR testées ([backup-and-restore.md](./backup-and-restore.md)).
- Scan d’historique Gitleaks après rotation.
- Preview frontend sans secrets prod, si un hébergeur le justifie.

## Ne pas introduire maintenant

- HashiCorp Vault / cluster Kubernetes « pour faire comme ».
- Terraform sans compte cloud choisi.
- Kafka, microservices, canary automatique.
- Copie de la base de production sur les laptops.

## Risques

| Risque                        | Mitigation actuelle   | Reste                      |
| ----------------------------- | --------------------- | -------------------------- |
| `.env` dans l’historique Git  | Untrack + ignore + CI | Rotation + scan historique |
| Staging non déployé           | Workflow placeholder  | Hébergeur                  |
| Rollback schéma               | Doc expand/contract   | Exercice réel              |
| Rate limits via `process.env` | Repli numérique       | Aligner sur ConfigService  |
