# 0015 — Gouvernance des environnements, secrets et migrations

Date : 2026-10-26  
Statut : accepté

## Contexte

Le monorepo avait déjà une config Zod, des garde-fous de seed/test, une CI et des docs de déploiement. Des fichiers `.env` locaux étaient toutefois **suivis par Git**, `.gitignore` ignorait les env en commentaire, et `parseApiEnv` acceptait un `APP_ENV=production` sans `DATABASE_URL` ni distinction des placeholders.

## Problème

Sans séparation stricte et sans échec au boot, un déploiement mal étiqueté peut viser une base de test, un loopback, ou réutiliser un JWT d’exemple.

## Options

1. Vault + Terraform + previews par PR — trop tôt (pas d’hébergeur unique dans le dépôt).
2. Conserver uniquement la documentation — insuffisant (fichiers secrets déjà versionnés).
3. **Renforcer l’existant** : gitignore, untrack, validation Zod déployée, job Gitleaks working-tree, Dependabot, docs nommées.

## Décision

Option 3. PostgreSQL reste la vérité. `migrate deploy` hors process HTTP. Secrets via `.env` local et, plus tard, GitHub Environments. Pas de nouveau gestionnaire de secrets.

## Conséquences

- Boot staging/prod refuse loopback, `*_test`, JWT identiques/placeholders, mock paiement.
- CI bloque un `.env` re-commité.  
  − L’historique Git peut encore contenir d’anciens `.env` jusqu’à rotation / scan.  
  − Pas de dual-key JWT.

## Réévaluation

Quand un cloud et un registry sont choisis ; si une prod réelle exige une rotation JWT sans déconnexion massive ; si le volume de fuites impose un scan d’historique.
