# Observabilité des événements

Outils existants : logs Pino JSON, `X-Request-ID`, Prometheus (`METRICS_ENABLED`). Pas de Grafana / Loki déployés. Pas de traces OTel (flag existant, non branché sur l’outbox).

## Logs

`DomainEventPublisher` journalise `event`, `event_id`, `aggregate_id`, `producer`, `correlation_id`, `causation_id`, `trace_id`. **Jamais le payload.**

Le dispatcher journalise `outbox_publish_failed` avec `event_id` et `last_error` sanitizé.

`correlation_id` = `request_id` HTTP lorsqu’il est un UUID.

## Métriques Prometheus

| Métrique                            | Type      | Labels (basse cardinalité)            |
| ----------------------------------- | --------- | ------------------------------------- |
| `outbox_events_published_total`     | counter   | `event_type` (préfixe `domaine.fait`) |
| `outbox_events_retries_total`       | counter   | `event_type`, `reason`                |
| `outbox_events_dead_total`          | counter   | `event_type`                          |
| `outbox_events_pending`             | gauge     | —                                     |
| `outbox_events_dead_letters`        | gauge     | —                                     |
| `outbox_oldest_pending_age_seconds` | gauge     | —                                     |
| `outbox_publish_latency_ms`         | histogram | `event_type`                          |
| `domain_events_consumed_total`      | counter   | `consumer`, `event_type`              |
| `domain_events_deduplicated_total`  | counter   | `consumer`                            |

Pas d’identifiant utilisateur ou d’annonce en label.

## Alertes recommandées (à brancher quand Grafana existera)

- `outbox_events_dead_letters > 0` pendant 15 min.
- `outbox_oldest_pending_age_seconds > 120`.
- Absence de `outbox_events_published_total` alors que le trafic HTTP d’écriture continue.

## Dashboards

Aucun JSON Grafana n’est versionné : la stack n’est pas déployée. Les métriques ci-dessus suffisent à un premier dashboard Prometheus.
