# Architecture Decision Records (ADR)

## Emplacement

`docs/decisions/` — format libre déjà utilisé par le projet.

## Index existant

| ADR | Sujet |
| --- | --- |
| [0001](./decisions/0001-initial-architecture.md) | Monolithe modulaire |
| [0002](./decisions/0002-preserve-existing-applications.md) | Préserver apps existantes |
| [0003](./decisions/0003-database-model.md) | Modèle DB |
| [0004](./decisions/0004-identity-architecture.md) | Identity |
| [0005](./decisions/0005-property-listing-model.md) | Property / listing |
| [0006](./decisions/0006-search-architecture.md) | Search |
| [0007](./decisions/0007-recommendation-architecture.md) | Recommendation |
| [0008](./decisions/0008-media-architecture.md) | Media |
| [0009](./decisions/0009-trust-architecture.md) | Trust |
| [0010](./decisions/0010-messaging-architecture.md) | Messaging |
| [0011](./decisions/0011-analytics-architecture.md) | Analytics |
| [0012](./decisions/0012-admin-backoffice.md) | Admin |
| [0013](./decisions/0013-billing-architecture.md) | Billing |

## Quand écrire un ADR

Changement de modèle de données, authz, search engine, paiement, provider externe, cache, déploiement.

Pas d’ADR pour chaque fix mineur.

## Template court

Contexte → Décision → Raisons → Conséquences (et alternatives rejetées si utile).

## ADR produit lié

Feature flags env-only : [feature-flags-architecture.md](./feature-flags-architecture.md) (décision documentée hors numéro ADR pour rester pragmatique ; un ADR 0014 pourra formaliser si l’équipe le souhaite).
