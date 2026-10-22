# Runbook — Files BullMQ / workers

## Contexte dépôt

- Workers : `services/workers` (Queue/Worker `systemPing` minimal).
- Health workers : `http://127.0.0.1:${WORKER_PORT:-4001}/health/live|ready`
- Redis requis (`REDIS_URL`).

D’autres jobs métier peuvent être ajoutés dans l’API ; ce runbook reste valide pour backlog Redis/BullMQ.

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
