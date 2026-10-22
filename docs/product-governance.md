# Gouvernance produit — Mon Appart

Cadre **léger** pour décider quoi construire, dans quel ordre, et comment livrer sans process lourd.

## Cinq questions obligatoires

Avant de démarrer une initiative :

1. Quel **problème utilisateur** ?
2. Pour quel **segment** ?
3. Quelle **valeur** (confiance, contact, publication, rétention…) ?
4. Comment **mesurer** le succès (baseline d’abord si pas de données) ?
5. Quels **risques / dépendances** avant livraison ?

## Segments

| Segment | Besoin principal |
| --- | --- |
| Chercheurs location | Trouver un bien crédible (commune/quartier, FCFA) |
| Acheteurs / terrains | Offres claires, confiance |
| Propriétaires | Publier et gérer sans friction |
| Agences | Volume + confiance + outils |
| Admins / modérateurs | Qualité des annonces |
| Partenaires | Import / sync (module présent, maturité à valider) |

Contexte CI : mobile-first, connectivité variable, méfiance anti-arnaque.

## Rôles (génériques)

- Product : priorisation, specs, DoR/DoD.
- Eng lead : faisabilité, découpage technique.
- Release : CI, migrations, rollback.
- Ops/SRE : post-déploiement.

Pas d’équipe produit nominative dans le dépôt.

## Documents

| Doc | Rôle |
| --- | --- |
| [Vision](./product-vision-and-principles.md) | Différenciation |
| [Roadmap](./product-roadmap.md) | Now / Next / Later |
| [Priorisation](./product-prioritization-framework.md) | Impact / effort |
| [Template spec](./product-specification-template.md) | Critères testables |
| [DoR / DoD](./definition-of-ready-and-done.md) | Qualité |
| [Feature flags](./feature-flags-architecture.md) | Activation progressive |
| [Release](./release-management.md) | Versionnement & contrôles |
| [ADR index](./architecture-decision-records.md) | Décisions techniques |

## Règles

- Ne pas inventer métriques d’usage / revenus.
- Distinguer **proposé**, **validé**, **livré**, **en production**.
- Un flag n’est pas une ACL.
- Réutiliser analytics, BI, growth, SRE déjà documentés.