# Contrôle d’accès BI

La sécurité est appliquée dans Nest (`@Permissions`, ownership listing), pas seulement dans les UIs.

## Rôles et permissions

| Permission | Qui (seed typique) | Accès |
| ---------- | ------------------ | ----- |
| `analytics:admin` | ANALYST (+ rôles admin) | Catalogue, overview, direction, market, funnel, search, recommendations, quality |
| `analytics:read` | Propriétaire / agence gérant l’annonce | Stats d’une annonce gérée |
| Authentifié (éditeur) | OWNER / AGENCY | `GET /analytics/me/listings` — uniquement ses annonces |
| `billing:read` | Rôles finance / admin billing | Encaissé plateforme (hors Analytics) |
| `admin:access` | Console admin | Navigation UI ; les endpoints Analytics exigent encore `analytics:admin` |

Nav admin « Business Intelligence » : `apps/admin/lib/permissions.ts` → `anyOf: ["analytics:admin"]`.

## Isolation

- Un propriétaire / une agence ne voit **que** les totaux de ses annonces (`myListings` / `listing` vérifient la gestion).
- Aucune identité ni comportement individuel de visiteur dans les réponses éditeur.
- Ventilations admin : groupes &lt; `ANALYTICS_MIN_GROUP_SIZE` regroupés (`OTHER`) pour limiter la réidentification.
- Pas de classement public d’agences concurrentes.

## Surfaces UI

| Dashboard | App | Permission |
| --------- | --- | ---------- |
| Direction / marché / funnel / qualité | `apps/admin` `/analytics` | analytics:admin |
| Performances mes annonces | `apps/web` `/espace` | session éditeur + API Nest |
| Revenus | Billing admin (existant) | billing:read |

## Endpoints

- Rate limit ingestion client : `ANALYTICS_RATE_LIMIT`.
- Pas d’exécution SQL fournie par le client.
- Exports : voir [bi-exports-and-reports.md](./bi-exports-and-reports.md) — non livrés en v1 BI.
