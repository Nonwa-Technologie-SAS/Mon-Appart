# Transactional Outbox Pattern

## Fonctionnement

Dans **une** transaction PostgreSQL `READ COMMITTED` :

1. Mutation métier (annonce, paiement, etc.).
2. `INSERT` dans `outbox_events` (`status = PENDING`).
3. `COMMIT`. Si l’une des deux écritures échoue, **rien** n’est visible.

Après commit, le service appelle `OutboxService.flush()` → `OutboxDispatcher.runOnce()`. Un poll périodique (`OUTBOX_WORKER_POLL_MS`) rattrape un crash entre commit et flush.

Le dispatcher **ne garde pas** de transaction ouverte pendant `EventEmitter.emit`.

## Table `outbox_events`

Colonnes : `event_id` (UUID unique), `event_type`, `event_version`, `producer`, `aggregate_type`, `aggregate_id`, `payload` JSONB, `occurred_at`, `status`, `attempt_count`, `next_attempt_at`, `last_error` (200 car. max, sans payload), corrélation / causation / trace.

Index partiel de dispatch : `(next_attempt_at, id) WHERE status IN ('PENDING','PUBLISHING')`.

## Dispatcher

```sql
UPDATE outbox_events SET status = 'PUBLISHING', attempt_count = attempt_count + 1,
       next_attempt_at = now() + lease
WHERE id IN (
  SELECT id FROM outbox_events
  WHERE next_attempt_at <= now() AND status IN ('PENDING','PUBLISHING')
  ORDER BY next_attempt_at, id
  LIMIT $n
  FOR UPDATE SKIP LOCKED
)
```

Plusieurs instances API peuvent tourner. Un bail expiré (`PUBLISHING` + `next_attempt_at` dépassé) rend la ligne à la file.

## Retry

Backoff exponentiel + jitter ±20 %, base `OUTBOX_RETRY_BASE_SECONDS` (défaut 5 s), plafond 6 h, max `OUTBOX_MAX_ATTEMPTS` (8). Erreur permanente (`INVALID_EVENT`, payload) → `DEAD` immédiatement.

## Nettoyage

`OUTBOX_RETENTION_DAYS` (défaut 14) : suppression des lignes `PUBLISHED` plus anciennes, au plus une fois par heure dans le dispatcher. Les `DEAD` ne sont pas purgés automatiquement (exploitation / rejeu).

## Variables

| Variable                    | Défaut | Rôle              |
| --------------------------- | ------ | ----------------- |
| `OUTBOX_WORKER_ENABLED`     | true   | Poller in-process |
| `OUTBOX_WORKER_POLL_MS`     | 2000   | Intervalle        |
| `OUTBOX_WORKER_BATCH_SIZE`  | 50     | Lot               |
| `OUTBOX_MAX_ATTEMPTS`       | 8      | Plafond           |
| `OUTBOX_RETRY_BASE_SECONDS` | 5      | Backoff           |
| `OUTBOX_RETENTION_DAYS`     | 14     | Purge PUBLISHED   |
