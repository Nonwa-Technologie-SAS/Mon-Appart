# Gouvernance des feature flags

Le système existe : registre typé `@mon-appart/config` (`feature-flags.ts`), **sans** LaunchDarkly. Voir [feature-flags-architecture.md](./feature-flags-architecture.md).

## Règles

- Un flag UI (`NEXT_PUBLIC_FF_*`) n’est **pas** une autorisation.
- Un flag ne doit pas désactiver une protection (authz, paiement live, garde seed).
- Défaut fail-safe.
- Pas de % distant : promotion `local → staging → production` via env.

## Fiche (à remplir à la création)

| Champ                  | Contenu                            |
| ---------------------- | ---------------------------------- |
| Id                     | Catalogue `FEATURE_FLAG_IDS`       |
| Description            | Une phrase                         |
| Variable               | `envKey`                           |
| Server-only            | oui/non                            |
| Responsable            | Module                             |
| Créé                   | Date                               |
| Expiration prévue      | Date ou « retirer après adoption » |
| Critère de suppression | Code conditionnel inutile          |

## Catalogue actuel (code)

`search_opensearch`, `recommendation_remote`, `recommendation_shadow`, `metrics_scrape`, `listing_moderation_required`, `payment_mock`, `swagger`, `web_assistant`, `web_recommendations`, `partners_api`.

`payment_mock` est **forcé off** en staging/production par `parseApiEnv`, pas seulement par le flag.

## Nettoyage

Retirer le flag quand le comportement est le défaut partout. Un flag permanent est une dette. Revue trimestrielle recommandée, non automatisée.
