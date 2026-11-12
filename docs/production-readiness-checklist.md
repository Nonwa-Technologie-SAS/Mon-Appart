# Checklist mise en production

Légende : `[ ]` à faire · `[x]` vérifié dans le dépôt / local · `[~]` partiel

## Technique

- [x] Build monorepo (`pnpm build`) reproductible en local
- [x] Healthchecks API live/ready
- [x] Migrations versionnées + `migrate deploy`
- [x] CI lint/types/tests/build/intégration/docker build
- [ ] Domaine + HTTPS Cloudflare/Vercel configurés
- [ ] Staging déployé et smoke OK (Contabo DIY : [deployment-contabo.md](./deployment-contabo.md))
- [ ] Production déployée
- [ ] Sauvegardes Postgres activées + **restauration testée**
- [ ] Médias R2/S3 + CORS + URLs publiques
- [ ] Workers déployés et files consommées
- [ ] Variables staging/production renseignées (pas dans Git)

## Sécurité

- [x] Garde-fous seed / test DB anti-prod
- [x] Validation env Zod (`parseApiEnv`)
- [x] Mock paiement refusé hors local
- [ ] Secrets dans un gestionnaire / GitHub Environments
- [ ] Postgres/Redis non exposés public
- [ ] Comptes admin limités + 2FA hébergeur
- [ ] Rate limits et CORS de production validés
- [ ] Revue [security-hardening-checklist.md](./security-hardening-checklist.md)

## Produit

- [ ] Inscription / connexion Nest
- [ ] Recherche + fiche annonce
- [ ] Publication éditeur
- [ ] Demandes de visite
- [ ] Notifications e-mail/SMS réels (ou plan B documenté)
- [ ] Pages légales / CGU / confidentialité
- [ ] Paiements : **non** (simulateur seulement) — décision go/no-go

## Opérations

- [ ] On-call nommé
- [ ] Runbook lu par l’équipe ([production-runbook.md](./production-runbook.md))
- [ ] Canal incident
- [ ] Monitoring erreurs (Sentry ou équivalent)
- [ ] Budget / alertes coût Cloud

Ne cocher un élément qu’après vérification réelle, pas parce qu’un fichier existe.
