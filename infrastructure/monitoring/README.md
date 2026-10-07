# Observabilité

Activation progressive :

- logs JSON (pino) dès maintenant
- `METRICS_ENABLED=true` expose `GET /metrics` (prom-client)
- `OTEL_ENABLED` et `SENTRY_DSN` sont lus, les SDK ne sont pas encore installés
- Grafana, Loki et Prometheus seront ajoutés quand un environnement partagé existera

Ne pas les ajouter au Compose local tant qu'ils n'aident pas le développement quotidien.
