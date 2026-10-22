# Exploitation partenaires

## Diagnostics exposés

- `PartnerIntegration.lastCheckedAt` / `lastError` (sans secret).
- Empreinte tronquée du secret webhook.
- Compteurs livraisons / imports sur détail partenaire.
- `POST /admin/partners/deliveries/run` pour vider l’outbox manuellement.

## Alertes utiles

- Taux d’échec livraisons élevé sur une intégration ACTIVE.
- `PARTNERS_SECRETS_KEY` absente alors que des WEBHOOK_OUT existent.
- Lots CSV `REJECTED` répétés.

## Dépannage

1. Vérifier statut commercial + technique.
2. Tester signature avec le secret partagé hors bande.
3. Relancer `deliveries/run`.
4. Suspendre l’intégration si le partenaire est indisponible longtemps (ne bloque pas Mon Appart).
