# Architecture feature flags

## Décision

**Pas de LaunchDarkly / Unleash** au stade actuel. Registre typé dans `@mon-appart/config` + variables d’environnement, réutilisant les toggles déjà présents (`SEARCH_ENGINE`, `RECOMMENDATION_ENGINE`, `METRICS_ENABLED`, etc.).

## Code

| Emplacement                            | Rôle                                                 |
| -------------------------------------- | ---------------------------------------------------- |
| `packages/config/src/feature-flags.ts` | Catalogue, `resolveFeatureFlags`, `isFeatureEnabled` |
| `apps/web/lib/feature-flags.ts`        | Flags UI publics                                     |
| Pages `/assistant`, `/pour-vous`       | Exemple de kill-switch UI                            |

## Catalogue (extrait)

| Flag                    | Env                                  | Défaut | Server-only |
| ----------------------- | ------------------------------------ | ------ | ----------- |
| `search_opensearch`     | `SEARCH_ENGINE=opensearch`           | off    | oui         |
| `recommendation_remote` | `RECOMMENDATION_ENGINE=remote`       | off    | oui         |
| `metrics_scrape`        | `METRICS_ENABLED`                    | off    | oui         |
| `web_assistant`         | `FF_WEB_ASSISTANT` / `NEXT_PUBLIC_…` | on     | non         |
| `web_recommendations`   | `FF_WEB_RECOMMENDATIONS`             | on     | non         |
| `partners_api`          | `FF_PARTNERS_API`                    | on     | oui         |

Voir catalogue complet dans le code.

## Règles

1. **Fail-safe** : défaut sûr si env absente/invalide.
2. Flag UI ≠ permission : authz Nest inchangée.
3. Pas de contournement client pour accès données.
4. Documenter objectif + critère de retrait (éviter detritus).
5. Pas de % rollout distant tant qu’aucun provider n’est branché — alternative : staging → % manuel via env.

Gouvernance (expiration, nettoyage) : [feature-flags-governance.md](./feature-flags-governance.md).

## Cycle de vie

Création → activation staging → prod → mesure → **retrait** du code conditionnel quand stable.

## Tests

`packages/config` : `feature-flags.test.ts` (vitest).
