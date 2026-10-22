# Runbook — API indisponible / 5xx

## Symptômes

- `/health/live` ou `/health/ready` en échec
- Taux 5xx élevé
- Timeouts clients web/admin

## Vérifications non destructives

```bash
curl -fsS "$API/health/live"
curl -sS -o /tmp/ready.json -w "%{http_code}" "$API/health/ready"
cat /tmp/ready.json
curl -fsS "$API/api/v1/meta"
pnpm smoke:health
# SMOKE_API_URL=$API pnpm smoke:health
```

Logs : chercher `request_id`, niveau `error`, sans dumper de secrets.

## Hypothèses

1. Process crash / OOM
2. Postgres / Redis down (voir ready.checks)
3. Déploiement défectueux
4. Saturation (CPU, connexions, rate limit amont)

## Mitigation

- Si live KO : redémarrer **une** instance API ; vérifier liveness loop.
- Si ready KO postgres/redis : **ne pas** scaler l’API en boucle → runbook DB/cache.
- Si version récente : rollback image/commit (voir deployment-and-rollback).
- Freeze déploiements pendant SEV-1/2.

## Escalade

SEV-1 si > 5 min down global ; contacter hébergeur compute + owner DB.

## Retour normal

live 200, ready 200, meta 200, smoke search OK, 5xx redescendu.

## À éviter

- `migrate reset`, restore prod, restart Redis/Postgres sans diagnostic.
- Relancer des paiements / webhooks en masse.
