# Catalogue des indicateurs BI

Source de vérité code : `packages/analytics/src/metrics-catalog.ts` (`METRICS_CATALOG`). Exposé en lecture seule : `GET /api/v1/admin/analytics/metrics` (`analytics:admin`).

Les interfaces **ne recalculent pas** les formules : elles affichent les valeurs renvoyées par Nest.

## Convention d’identifiants

Préfixe par famille : `kpi.*`, `search.*`, `funnel.*`, `reco.*`, `market.*`, `listing.*`, `billing.*`.

## Indicateurs disponibles

| ID | Nom | Fraîcheur | Rôles | Endpoint principal |
| -- | --- | --------- | ----- | ------------------ |
| `kpi.registrations` | Inscriptions (flux) | daily_aggregate | analytics:admin | `/admin/analytics/overview` |
| `kpi.listings_published` | Annonces publiées (flux) | daily_aggregate | analytics:admin | overview |
| `kpi.contacts` | Prises de contact | daily_aggregate | analytics:admin | overview |
| `kpi.appointments_requested` | Visites demandées | daily_aggregate | analytics:admin | overview |
| `kpi.qualified_leads` | Contacts qualifiés | daily_aggregate | analytics:admin | overview |
| `search.zero_result_rate` | Taux recherches sans résultat | daily_aggregate | analytics:admin | `/admin/analytics/search` |
| `funnel.actor_day` | Entonnoir acteur-jour | daily_aggregate | analytics:admin | `/admin/analytics/funnel` |
| `reco.click_through_rate` | CTR recommandations | daily_aggregate | analytics:admin | `/admin/analytics/recommendations` |
| `market.active_listings` | Stock annonces actives | on_demand_snapshot | analytics:admin | `/admin/analytics/market` |
| `market.price_median` | Médiane / P25 / P75 prix annonces | on_demand_snapshot | analytics:admin | market |
| `listing.contact_rate` | Contacts / vues détail | daily_aggregate | analytics:read, admin | `/analytics/me/listings`, `/analytics/listings/:id` |
| `billing.gross_collected` | Encaissé brut plateforme | live | billing:read | `/admin/billing/summary` |

Vue composée direction : `GET /api/v1/admin/analytics/direction` (overview + search + market ; pas de KPI inventés).

## Distinctions obligatoires

- **Stock vs flux** : `market.active_listings` (instantané) ≠ `kpi.listings_published` (période).
- **Bien vs annonce** : le marché expose `activeListings` et `distinctProperties`.
- **Acteurs vs événements** : le funnel utilise des acteurs distincts par jour ; sommer plusieurs jours ≠ utilisateurs uniques sur la période.
- **Prix** : toujours groupés par `listing_type` + `period` ; montants en XOF ; disclaimer marché systématique.
- **Revenus** : uniquement billing ; jamais dérivés des prix d’annonces.

## Indicateurs non calculables aujourd’hui

| Besoin | Raison |
| ------ | ------ |
| Impressions / CTR après impression listing | Tracker client non branché sur les frontends |
| Favoris | Pas d’API favoris ; événements non instrumentés |
| Canal d’acquisition | Collecté via `acquisition_touch` (consent) ; agrégats BI à brancher sur raw/daily |
| Type d’appareil | Non collecté (pas de fingerprinting) |
| Transaction immobilière conclue | Plateforme ne confirme pas loyers/ventes |
| Revenu net / MRR | Modèle billing : encaissé brut ; abonnements selon implémentation billing |
| Classement agences concurrentes | Isolation + confidentialité |
| CAC / ROAS | Dépenses pub non importées |

## Filtres supportés

Période `from` / `to` (jours calendaires, fuseau de l’API), `listingId` pour stats éditeur, dimensions déjà agrégées (commune, type d’offre). Pas d’endpoint SQL libre côté client.
