# Stratégie de fidélisation et de rétention

Complète [user-retention-and-notifications.md](./user-retention-and-notifications.md). Objectif : aider à concrétiser un projet immobilier, pas maximiser le temps passé sur le site.

## Livré

- Recherches persistantes (`SavedSearch`) distinctes de l’historique `searches`.
- Alertes groupées `NEW_PROPERTY` / catégorie `SAVED_SEARCHES` via `NotificationService`.
- Baisse de prix et indisponibilité des favoris (`PRICE_DROP`, `LISTING_UPDATES`).
- Retour post-visite facultatif, note privée jamais exposée au côté annonce.
- Centre de préférences sur `/profil` (vérification serveur à l’envoi).
- Statut de projet déclaré (`ACTIVE` / `PAUSED` / `COMPLETED`) ; une inactivité ne termine jamais un projet.
- Réactivation uniquement s’il existe des annonces **exactement** compatibles, avec cooldown.

## Partiel

- Comparaison post-visite : tableau des biens visités (titre, date, retour). Prix et surface détaillés restent sur la fiche.
- E-mail / SMS / push : canaux existants ; e-mail et SMS seulement si configurés. Push et WhatsApp restent désactivés.
- Reco `/pour-vous` : inchangée (`rules-v1`). Les critères sauvegardés n’écrasent pas `UserPreference` tant que l’utilisateur ne les met pas à jour dans `/recommendations/preferences`.

## Non livré (volontaire)

- Campagnes marketing de masse, fausse urgence, second CRM, second moteur de recommandation.
- Apprentissage statistique à partir d’un seul refus.
- File BullMQ `listing.alerts` : le worker in-process (SKIP LOCKED) suffit.
