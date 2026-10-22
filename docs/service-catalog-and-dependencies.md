# Catalogue des services et dépendances

Responsables nominatifs : **non assignés** dans le dépôt.

| Service | Rôle | Criticité | Dépendances | Santé | Impact si down |
| --- | --- | --- | --- | --- | --- |
| `apps/api` | API métier Nest | **Critique** | Postgres, Redis, (R2, SMTP, SMS, OS optionnels) | `/health/live\|ready` | Plateforme API KO |
| `apps/web` | Site public Next | Critique UX | API (rewrite) | HTTP 200 pages | Site KO / erreur SSR |
| `apps/admin` | Back-office | Élevé | API | — | Modération KO |
| `services/workers` | Jobs BullMQ | Élevé | Redis | `:4001/health/*` | Async KO |
| `services/recommendation` | FastAPI ML (opt.) | Faible | — | `/health` | Fallback rules Nest |
| PostgreSQL+PostGIS | Source de vérité | **Critique** | — | ready checks | Ready 503, données KO |
| Redis | Cache, RL, BullMQ | Critique ops | — | ready | Ready 503, sessions/jobs |
| OpenSearch | Index search | Moyen | — | `/health/search` | Fallback Postgres si configuré |
| R2/S3 | Médias | Élevé | — | upload smoke | Images KO |
| Vercel (cible) | Hosting front | Critique UX | — | plateforme | Front KO |
| Conteneurs API (cible) | Hosting API | Critique | — | health | API KO |

## Graphe simplifié

```
Web/Admin → API → Postgres
                → Redis → Workers
                → R2
                → OpenSearch (opt.)
                → Recommendation (opt.)
```

## Points uniques de défaillance (phase 1)

- Une seule instance Postgres.
- Une seule région compute.
- Un seul bucket médias.
- Redis unique.

Mitigations progressives : HA Postgres managé, multi-AZ, réplicas lecture, versioning R2.
