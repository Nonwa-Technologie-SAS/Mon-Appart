# Architecture d’observabilité

## Empilement réel

```
Requête → Nest (Pino JSON + X-Request-ID)
        → MetricsInterceptor (prom-client) si METRICS_ENABLED
        → /metrics (Bearer METRICS_SCRAPE_TOKEN)
```

| Couche | Implémentation | Statut |
| --- | --- | --- |
| Logs | nestjs-pino, redact paths | **Opérationnel** en local/prod si démarré |
| Corrélation | `X-Request-ID` / `request_id` | **Opérationnel** |
| Métriques HTTP | `MetricsService` + interceptor | **Code prêt**, off par défaut |
| Health | `/health/*` | **Opérationnel** |
| Tracing OTel | — | **Non implémenté** |
| Loki / Grafana | — | **Non déployé** |
| Sentry | — | **Non configuré** (ROI recommandé en premier outil externe) |

## Logs

Champs : timestamp, level, `service=api`, `request_id`, status, durée (via pino-http).

Redaction : voir `apps/api/src/logging/redact-paths.ts`. Interdit : mots de passe, tokens, OTP, documents identité, corps de paiement.

`GET /health/live` est exclu de l’auto-logging pour limiter le bruit.

## Métriques

Activation :

```bash
METRICS_ENABLED=true
METRICS_SCRAPE_TOKEN=<≥32 chars>
```

Scrape : `Authorization: Bearer <token>` sur `GET /metrics`.

Labels : `method`, `route` (path Nest, pas d’URL brutes avec IDs), `status`. Éviter userId / listingId.

## Traces

OpenTelemetry : reporté jusqu’à multi-services actifs (API + workers + FastAPI) et volume justifiant le coût. En attendant : `request_id` dans logs + jobs.

## Frontend

Erreurs navigateur : brancher Sentry (DSN staging/prod) — **en attente de configuration externe**.

## Synthétiques

```bash
pnpm smoke:health
# ou
SMOKE_API_URL=https://api.exemple.ci node scripts/smoke-health.mjs
```
