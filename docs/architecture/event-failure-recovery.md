# Erreurs, file morte et reprise

## Classification

| Classe      | Exemples                                          | Action                   |
| ----------- | ------------------------------------------------- | ------------------------ |
| Transitoire | timeout, erreur réseau interne, ECONNRESET        | Retry + backoff + jitter |
| Permanente  | schéma invalide, payload trop gros, clé interdite | `DEAD` immédiat          |

## File morte

`status = DEAD`, `last_error` tronqué (pas de payload). Compteur Prometheus `outbox_events_dead_total`. Jauge `outbox_events_dead_letters`.

Un événement n’est jamais supprimé silencieusement tant qu’il n’est pas `PUBLISHED` (sauf purge des publiés selon rétention).

## Rejeu

- API : `POST /api/v1/admin/events/outbox/:eventId/replay` (`ops:events`).
- Back-office : page `/events`.
- Audit : `OUTBOX_EVENT_REPLAYED`.
- Remet `PENDING`, `next_attempt_at = now()`, puis `runOnce()`.

Le rejeu respecte l’idempotence des consommateurs.

## Procédures

**Retard Outbox** (`outbox_oldest_pending_age_seconds` élevé) :

1. Vérifier que l’API tourne et `OUTBOX_WORKER_ENABLED=true`.
2. `GET /api/v1/admin/events/outbox/stats`.
3. Inspecter `last_error` des `DEAD` (sans payload).
4. Rejouer unitairement après correction (schéma, dépendance).

**Index en retard** : `pnpm --filter api search:reindex` (ou commande documentée Search). L’index n’est pas la vérité.

**Dispatcher interrompu** : au redémarrage, les `PUBLISHING` dont le bail est échu redeviennent éligibles (`next_attempt_at`).

**Redis indisponible** : l’outbox et le bus in-process continuent. Seuls cache recherche / sessions / throttle se dégradent.

## Accès

Lecture et rejeu : permission `ops:events` (ADMIN / SUPER_ADMIN via le catalogue). Pas d’exposition du JSON métier dans l’UI.
