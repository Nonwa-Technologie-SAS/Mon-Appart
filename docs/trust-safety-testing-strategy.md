# Stratégie de tests Trust & Safety

Complète [testing-strategy.md](./testing-strategy.md).

## Unitaire (exécuté)

- `listing-risk.spec.ts` : changement notable, signal isolé, CRITICAL, parcours LOW.
- `message-safety.spec.ts` : OTP, lien court, visite normale, WhatsApp, faux support.
- `trust-domain.spec.ts` : cycle de vie, pièces, seuils, burst, sévérité de chaque `RiskRule`.
- `media-infrastructure.spec.ts` : EXIF retiré des variantes publiques.

## Intégration / API (existant Trust)

- Création de signalement, déduplication ouverte, quota.
- Résolution `CONFIRMED`/`DISMISSED` sans effet auto hors mesure explicite.
- Permissions admin vs déclarant.
- Extraordinaire conversation : non-participant 404.

## Sécurité (contrôles déjà côté serveur)

- Document VERIFICATION sans permission → refus.
- `report:review` requis pour clôturer.
- `listing:suspend` distinct de la clôture d’un signalement.
- Throttle reports.
- Alertes sans corps de message.

## Robustesse

- Événements Listing `CREATED` / `PUBLISHED` / `UPDATED` idempotents via `dedupKey`.
- Annonce supprimée : signalement existant reste lisible (relation Restrict).
- Règle conversation désactivée = absence d’émission `message.safety_alert` si le code n’est plus HIGH.

## E2E manuel

1. Fiche annonce : ouvrir « Signaler », motif, succès (compte connecté).
2. Même annonce : second signalement ouvert → message de conflit.
3. Conversation CRM : banner si message à risque, signaler la conversation.
4. Admin : détail avec `listingRisk` et alertes liées ; clôturer `DISMISSED` sans suspendre.

Pas de test intrusif contre des systèmes externes.
