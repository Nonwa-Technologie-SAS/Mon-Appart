# Architecture de données BI

Business Intelligence de Mon Appart : lecture décisionnelle au-dessus du module Analytics existant. Décision de collecte : [0011](./decisions/0011-analytics-architecture.md). Suivi d’usage : [analytics-and-tracking.md](./analytics-and-tracking.md). Catalogue d’indicateurs : [bi-metrics-catalog.md](./bi-metrics-catalog.md).

## Principes

- **PostgreSQL + Prisma** restent la source de vérité métier.
- **Pas de second système analytique** : réutilisation de `AnalyticsModule`, des tables `analytics_*` et de `@mon-appart/analytics`.
- **Progression maîtrisée** : étape 1 = agrégats journaliers + requêtes snapshot ; pas de Kafka, lac de données ni entrepôt dédié tant que le volume ne le justifie pas.
- **Aucun chiffre inventé** : les UIs consomment uniquement les API Nest ; zéros = absence de données ou compteurs réellement nuls (voir qualité).
- **Prix d’annonce ≠ transaction immobilière ≠ revenus plateforme**.

## Flux

```
Faits métier (Nest) ──▶ analytics_events ──▶ agrégation journalière
Client (consent) ─────▶ analytics_events ──▶ analytics_daily_metrics
                                              analytics_listing_daily
                                                      │
                         ┌────────────────────────────┤
                         ▼                            ▼
              GET /api/v1/analytics/me/*    GET /api/v1/admin/analytics/*
                         │                            │
                         ▼                            ▼
              Espace propriétaire/agence    Admin BI (direction, marché, …)
                                              + catalogue METRICS_CATALOG
```

Billing / monétisation : `GET /api/v1/admin/billing/summary` (permission `billing:read`), jamais mélangé aux KPI Analytics.

## Couches

| Couche | Rôle | Emplacement |
| ------ | ---- | ----------- |
| Collecte | Validation catalogue, consentement, faits serveur | `apps/api/.../analytics` + `packages/analytics` |
| Agrégation | Worker ~15 min, rejouable | `aggregation.service.ts`, CLI |
| Catalogue métriques | Définitions stables (formule, rôles, fraîcheur) | `packages/analytics/src/metrics-catalog.ts` |
| Requêtes BI | Overview, funnel, search, market, direction, listing | `analytics-query.service.ts` |
| Marché (offre) | Snapshot SQL on-demand, k-anonymat | `domain/market-stats.ts` |
| Présentation | Admin console + espace éditeur | `apps/admin/.../analytics`, `apps/web/.../publisher-analytics` |

## Concepts métier (ne pas confondre)

| Concept | Définition opérationnelle |
| ------- | ------------------------- |
| Bien | `properties` (actif physique) |
| Annonce | `listings` (offre commerciale ; plusieurs possibles par bien) |
| Annonce active | `PUBLISHED`, non expirée, bien `ACTIVE` |
| Consultation | Événement / agrégat `listing_detail_viewed` (client) |
| Contact | Fait métier contact soumis / conversation |
| Demande de visite | `appointment_requested` |
| Lead qualifié | Règle `ANALYTICS_QUALIFIED_LEAD_RULE` |
| Paiement plateforme | Tables billing — services Mon Appart uniquement |

## Dimensions disponibles aujourd’hui

- Temps : jour (agrégats), période `from`/`to` sur les lectures admin.
- Localisation : code commune (recherche + stock) ; quartier masqué si groupe trop petit.
- Type d’offre (`listing_type`) et type de bien (`property_types.code`).
- Périodicité de prix (`listing_prices.period`) — location mensuelle / journalière / vente séparées.
- Version d’algorithme de recommandation (métriques reco).

Mesure acquisition : événement client `acquisition_touch` (UTM normalisés + referrer host) — voir [growth-events-and-attribution.md](./growth-events-and-attribution.md). Non mesurés : type d’appareil (pas de fingerprinting), dépenses pub, impressions hors consentement.

## Évolution prévue

1. **Actuel** — Agrégats journaliers + snapshots marché + dashboards.
2. **Si perf insuffisante** — Vues matérialisées / tables d’agrégats dédiées, cache Redis TTL court pour `direction`/`market`.
3. **Si volume / historique** — Pipeline vers entrepôt ; les formules du catalogue restent la référence métier.

Les règles de calcul ne doivent pas être dupliquées dans le frontend.
