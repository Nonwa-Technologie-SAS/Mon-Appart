# Checklist readiness opérationnelle SRE

Légende : `[x]` vérifié dans le dépôt · `[~]` partiel · `[ ]` à faire

## P0

- [x] Health live/ready API
- [x] Timeout checks dépendances
- [x] Workers health
- [x] Logs structurés + redact + request_id
- [x] Métriques protégées par token
- [x] Stratégie backup documentée
- [ ] Backups Cloud activés
- [ ] Restore testé (staging)
- [x] Runbooks incidents majeurs
- [x] Processus SEV documenté

## P1

- [x] SLI/SLO proposés (non mesurés)
- [x] Catalogue alertes
- [ ] Canal d’alerte testé
- [ ] Sentry (ou équivalent) branché
- [x] Catalogue services
- [~] Prometheus scrape en staging

## P2

- [x] Modes dégradés search/IA documentés
- [x] Rollback documenté
- [ ] Game day restore
- [~] Workers jobs métier (socle ping seulement)

## P3

- [x] Scripts k6
- [ ] Exécution k6 staging + rapport
- [ ] Error budget suivi en continu
- [ ] OpenTelemetry

Ne cocher que sur preuve (commande, capture, ticket).
