# Stratégie de fiabilité (SRE) — Mon Appart

## État initial (audit)

| Domaine | Statut constaté |
| --- | --- |
| Health API `/health/live` `/health/ready` | Présent + e2e |
| Health workers | Présent (`WORKER_PORT`) |
| Health search | `/health/search` |
| Logs structurés Pino + `request_id` + redact | Présent |
| Métriques Prometheus (`/metrics` + token) | Présent, **désactivé** par défaut |
| OpenTelemetry / Grafana / Loki / Sentry | **Non déployés** |
| Sauvegardes Cloud | **Documentées, non provisionnées** |
| Runbooks / SEV / SLO | Partiels (Prompt 16) → complétés ici |
| Tests de charge | Scripts k6 ajoutés, **non exécutés en CI** |
| Terraform / prod | Absent |

## Principes

1. Mesurer avant de complexifier.
2. PostgreSQL = source de vérité ; Redis / OpenSearch = dérivés.
3. Liveness ≠ readiness (pas de redémarrage en cascade sur panne Redis).
4. Modes dégradés explicites (search fallback, IA rules, notif retry).
5. Pas de Kubernetes / Kafka « pour la fiabilité » sans besoin démontré.

## Priorités

- **P0** : health fiables, secrets/logs, backup strategy, rétablissement documenté.
- **P1** : métriques activables, alertes définies, incidents, runbooks, SLI/SLO proposés.
- **P2** : timeouts health, retries contrôlés, restore drills, rollback.
- **P3** : charge k6, error budgets opérationnels, tracing OTel.

## Documents liés

- [SLI/SLO](./sre-sli-slo-error-budgets.md)
- [Observabilité](./observability-architecture.md)
- [Incidents](./incident-management.md)
- [Catalogue services](./service-catalog-and-dependencies.md)
- [Checklist ops](./sre-operational-readiness-checklist.md)
