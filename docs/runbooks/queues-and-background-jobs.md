# Runbook — Files et workers

## Contexte dépôt

- Workers BullMQ : `services/workers` (Queue/Worker `systemPing` minimal). Redis requis (`REDIS_URL`).
- Files métier **dans PostgreSQL**, servies par l’API :
  - `notification_deliveries` (e-mail / SMS / in-app)
  - `partner_deliveries`
  - jobs médias (`next_attempt_at`)
  - **`outbox_events`** (événements de domaine, ADR 0014)
- Dispatcher Outbox : `OUTBOX_WORKER_ENABLED` (défaut true), poll `OUTBOX_WORKER_POLL_MS`.
- Expiration d’annonces : `LISTING_EXPIRY_WORKER_ENABLED`.
- Health workers : `http://127.0.0.1:${WORKER_PORT:-4001}/health/live|ready`

Les traitements métier critiques **ne dépendent pas** de BullMQ.

## Symptômes

- ready workers 503
- Jobs failed / backlog croissant (métriques futures ou Redis inspect)
- Traitements async absents (indexation, notifications, etc.)

## Vérifications

```bash
curl -fsS "http://127.0.0.1:4001/health/live"
curl -sS "http://127.0.0.1:4001/health/ready"
# Logs worker : erreurs de connexion Redis
pnpm --filter @mon-appart/workers build
# Redémarrage contrôlé d’une instance worker uniquement
```

## Hypothèses

1. Redis down
2. Worker non déployé / crash
3. Job non idempotent en boucle de retry
4. Concurrence trop haute saturant Postgres

## Mitigation

- Réparer Redis d’abord.
- Redémarrer worker.
- Réduire concurrency si saturé.
- Pour failed jobs : inspecter payload **sans** rejouer paiements aveuglément.

## À éviter

- Flush Redis prod.
- `retries: Infinity` sans backoff.
- Rejouer webhooks paiement sans idempotency key.

## Retour normal

Workers ready 200, backlog stable ou décroissant, pas de spike failed.
