# Tests rétention

## Unitaires (exécutés)

- Matching : exact, indisponible, dépassement de budget, commune, déduplication.
- Cycle de vie : projet terminé, pause déclarée, pas d’inférence d’inactivité, cooldown de réactivation.
- Post-visite : visibilité propriétaire, issues déclaratives.
- Préférences : marketing off par défaut ; alertes in-app distinctes du marketing.

## Sécurité à vérifier (domaine + requêtes)

- `SavedSearch` filtré par `userId`.
- Feedback : 409 si pas prospect / pas `COMPLETED` ; note absente du GET côté annonce.
- `MARKETING` off par défaut ; dispatcher refuse un canal désactivé.

## Robustesse du job

- Double exécution : `dedupKey` + SKIP LOCKED.
- Annonce devenue `PAUSED` : `ineligible`.
- Préférences changées entre file et envoi : `DeliveryRunner` annule (`PREFERENCE`).
- Projet `COMPLETED` : pas d’alerte.
