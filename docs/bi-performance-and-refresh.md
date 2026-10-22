# Performance et actualisation BI

## Fréquences par famille

| Famille | Fraîcheur affichée | Mécanisme |
| ------- | ------------------ | --------- |
| KPI, funnel, search, reco, listing daily | Agrégat journalier (~15 min worker, jours clos + `ANALYTICS_LATE_DAYS`) | `analytics_daily_metrics` / `analytics_listing_daily` |
| Marché (stock, percentiles) | Snapshot on-demand | SQL live avec filtres statut |
| Direction | Composite | overview + search + market en parallèle |
| Billing | Live / quasi-live | Module billing |

L’UI doit afficher `completedDay` / `computedAt` / `freshness` : un agrégat n’est **pas** présenté comme temps réel.

## Stratégie actuelle (étape 1)

- Lectures admin sur tables d’agrégats indexées (pas de scan `properties` JSONB).
- Market : requêtes ciblées listings/prices ; coût acceptable tant que le catalogue reste modeste.
- Pagination sur `me/listings`.
- Worker partagé dans l’API (verrou PostgreSQL) — pas de file BullMQ dédiée BI pour l’instant.

## Optimisations futures (étape 2)

- Cache Redis TTL (ex. 5–15 min) pour `direction` / `market` si latence ou charge CPU montent.
- Vue matérialisée stock + prix si les snapshots ralentissent les opérations.
- Limites strictes de plage de dates côté DTO (déjà bornées par validation de période).

## Surveillance

Réutiliser les métriques Prometheus Analytics (`analytics_job_*`, `analytics_ingest_latency_ms`). Alerter sur échec d’agrégation et latence inhabituelle des endpoints admin.
