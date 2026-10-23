# Recherches enregistrées et alertes

## API

- `GET/POST /api/v1/saved-searches`
- `PATCH/DELETE /api/v1/saved-searches/:id`
- `POST /api/v1/saved-searches/:id/resume`

Les recherches temporaires ne sont **pas** persistées automatiquement. L’historique `searches` reste un journal de soumissions.

## Matching

`matchListingToSavedSearch` : annonce `PUBLISHED`, non expirée, critères de type / zone / pièces / surface. Un prix au-dessus du maximum déclaré est `near_budget` (jusqu’à +15 %) ou `mismatch` — jamais `exact`.

## Envoi

Job `SavedSearchAlerts` (SKIP LOCKED, toutes les ~2 min via `DeliveryRunner`) :

1. Réclame les recherches `DAILY` / `WEEKLY` échues.
2. Ignore `COMPLETED` / `PAUSED` et les comptes inactifs.
3. Relit le statut et le prix courant.
4. Digest groupé (`NEW_PROPERTY`, `SAVED_SEARCHES`), dédup `saved-search:{id}:digest:{période}`.
5. Les préférences sont revérifiées dans `NotificationDispatcher` / `DeliveryRunner`.

Favoris : `PRICE_DROP` si le prix courant est inférieur au précédent ; `LISTING_UPDATES` si l’annonce n’est plus publiée.
