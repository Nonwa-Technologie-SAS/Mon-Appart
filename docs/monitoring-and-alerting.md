# Monitoring et alertes

Complète [observability-architecture.md](./observability-architecture.md). Les règles ci-dessous sont **définies** ; aucun canal (PagerDuty, Slack, e-mail) n’est branché tant que l’infra n’est pas provisionnée → statut : **documenté uniquement / en attente de configuration externe**.

## Healthchecks

| Endpoint | Rôle | HTTP |
| --- | --- | --- |
| `GET /health/live` | Liveness process (+ `version` si `APP_VERSION`/`GIT_SHA`) | 200 |
| `GET /health/ready` | Postgres + PostGIS + Redis (timeout `HEALTH_CHECK_TIMEOUT_MS`, défaut 2s) | 200 / 503 |
| `GET /health` | Même rapport que ready | 200 / 503 |
| `GET /health/search` | Moteurs search | selon état |
| Workers `GET /health/live\|ready` | Process + Redis worker | 200 / 503 |

Orchestrateur : liveness → live ; readiness → ready (ne pas redémarrer sur panne Redis seule via liveness).

Smoke : `pnpm smoke:health`.

## Alertes proposées

| ID | Signal | Fenêtre / seuil proposé | Sévérité | Runbook |
| --- | --- | --- | --- | --- |
| A1 | Taux 5xx API > 2 % | 5 min | SEV-2 | [api-and-dependencies](./runbooks/api-and-dependencies.md) |
| A2 | Ready 503 | 2 min continus | SEV-1 | idem + [database-and-cache](./runbooks/database-and-cache.md) |
| A3 | p95 HTTP > 2× baseline | 15 min | SEV-2 | api + capacity |
| A4 | Postgres connexions > 80 % max | 5 min | SEV-2 | database-and-cache |
| A5 | Redis ping fail répété | 3 min | SEV-2 | database-and-cache |
| A6 | Backlog BullMQ croissant | 15 min + age max job | SEV-2 | [queues](./runbooks/queues-and-background-jobs.md) |
| A7 | Backup manquant / failed | 24–36 h | SEV-2 | [backup-and-restore](./backup-and-restore.md) |
| A8 | Déploiement smoke fail | immédiat | SEV-2 | [deployment-and-rollback](./runbooks/deployment-and-rollback.md) |
| A9 | Search 5xx élevé (OpenSearch) | 10 min | SEV-3 si fallback OK | [search-and-media](./runbooks/search-and-media.md) |

Seuils à calibrer après baselines staging. Pas d’alerte « CPU > 70 % » seule sans symptôme utilisateur.

## Canaux

| Canal | Statut |
| --- | --- |
| Logs stdout → agrégateur | À brancher |
| Prometheus scrape | Token prêt, scrape **non** déployé |
| Slack / e-mail / Pager | **Non configuré** |

Ne pas considérer une alerte « opérationnelle » tant qu’un test de notification n’a pas réussi.
