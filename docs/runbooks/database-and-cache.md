# Runbook — PostgreSQL / Redis

## Symptômes

- `checks.postgres` / `postgis` / `redis` = down dans `/health/ready`
- Erreurs Prisma / ioredis dans les logs
- Lenteur requêtes, timeouts

## PostgreSQL — vérifications

```bash
# Local Compose
pnpm docker:up
docker compose -f infrastructure/docker/compose.yaml ps
# Connexion (hôte 5433 en local)
# psql "$DATABASE_URL" -c 'SELECT 1; SELECT PostGIS_Version();'
```

Hypothèses : instance stoppée, max connections, disk full, migration lock, réseau.

Mitigation :

- Libérer connexions (réduire replicas API temporairement).
- Attendre fin migration (une seule `migrate deploy`).
- Failover fournisseur managé **si** documenté et autorisé.

**DANGER :** ne pas restaurer un backup sur la prod sans plan DR validé.

## Redis — vérifications

```bash
# Local : port hôte 6380
# redis-cli -u "$REDIS_URL" PING
```

Impact Redis down : ready 503, cache/rate-limit/BullMQ/session refresh dégradés.

Mitigation : redémarrer Redis managé ; accepter cold cache ; workers peuvent échouer → queues runbook.

Ne pas traiter Redis comme source de vérité métier.

## Retour normal

ready 200, ping Redis PONG, `SELECT 1` OK, PostGIS version OK.
