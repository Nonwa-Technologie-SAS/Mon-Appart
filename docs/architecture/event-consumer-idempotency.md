# Idempotence des consommateurs

La livraison est **at-least-once** : un même `eventId` peut arriver deux fois (crash après `emit` et avant `PUBLISHED`, rejeu admin).

## Stratégies par consommateur

| Consommateur        | Stratégie                                                                                                                          | Inbox table |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| SearchIndexer       | Relit l’état courant des tables métier ; document identique. `inbox_events` (`search.indexer` + `eventId`) saute un second travail | oui         |
| Recommendation      | Invalidation de cache / suppression de lignes précalculées : répéter est inoffensif                                                | non         |
| Analytics           | `deterministicEventId` unique en base                                                                                              | non         |
| Partners            | Contrainte unique `(integrationId, eventId)`                                                                                       | dédiée      |
| Billing fulfillment | Transitions `ALREADY` / `CONFLICT` ; webhook dédupliqué en amont                                                                   | non         |
| Notifications       | `dedup_key` par utilisateur                                                                                                        | file dédiée |
| Trust signals       | `dedupKey` journalier sur certaines règles                                                                                         | non         |

Tous les consommateurs **n’ont pas** besoin d’inbox. L’inbox sert quand un effet n’est pas naturellement idempotent ou quand on veut éviter un travail coûteux.

## Inbox

`inbox_events (consumer_name, event_id)` unique. `claim` insère la ligne ; une violation d’unicité retourne `false` (déjà traité). L’indexeur enregistre **après** un sync réussi : un échec n’empêche pas une livraison ultérieure du même id (si l’outbox republie).

## Rejeu

Le rejeu admin d’un événement `DEAD` crée une nouvelle tentative de publication avec le **même** `event_id`. Les consommateurs ci-dessus ne dupliquent pas l’effet métier.
