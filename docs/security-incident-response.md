# Réponse aux incidents de sécurité

Procédure opérationnelle de base. Adapter les contacts avant la production.

## Classification

| Niveau | Exemples |
| --- | --- |
| P0 | Fuite de secrets, accès admin massif, dump base |
| P1 | Compromission de comptes en série, fraude paiement confirmée |
| P2 | Fausses annonces en volume, abus back-office limité |
| P3 | Tentatives échouées, faux positifs antifraude |

## Scénarios

### Compte compromis

1. Révoquer toutes les sessions (`logout-all` / admin).
2. Forcer reset mot de passe ; invalider OTP en cours.
3. Auditer `AuditLog` et connexions récentes.
4. Notifier l’utilisateur par un canal déjà vérifié si disponible.

### Secret exposé (Git, logs, ticket)

1. Révoquer et **rotation** immédiate (JWT, HMAC, S3, DB, Redis, paiement).
2. Ne pas se contenter d’un `git rm` : historique à traiter.
3. Redémarrer services avec nouveaux secrets.
4. Vérifier absence d’usage du secret (logs cloud, Alertes).

### Fuite de données

1. Contenir (révoquer accès, fermer endpoint).
2. Préserver preuves (logs, dumps ciblés) hors production utilisateur.
3. Évaluer notification autorités / personnes concernées avec conseil juridique.
4. Post-mortem documenté.

### Fraude paiement / webhooks

1. Suspendre fulfillment si doute.
2. Vérifier signatures et idempotence `PaymentEvent`.
3. Ne jamais « marquer payé » manuellement hors procédure refund.
4. Contacter le prestataire (sandbox vs live).

### Abus back-office

1. Retirer `admin:access` / rôles (seul `SUPER_ADMIN` pour pairs).
2. Révoquer sessions staff.
3. Rejouer décisions suspectes (listings, vérifications).

## Alertes

Les notifications automatiques ne sont actives que si un canal (e-mail/SMS/ops) est **réellement configuré**. Sinon : surveillance manuelle des logs et de la file `TrustSignal`.

## Post-incident

Chronologie, cause racine, correctifs, tests ajoutés, checklist hardening mise à jour.
