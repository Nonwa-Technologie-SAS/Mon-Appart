# Versionnement, déploiement et rollback

Aucun modèle ML n’est déployé. Les artefacts versionnés aujourd’hui :

| Artefact             | Identifiant                   | Où                                                   |
| -------------------- | ----------------------------- | ---------------------------------------------------- |
| Classifieur règles   | `rules-v1`                    | `RULES_ENGINE_VERSION` + colonne `algorithm_version` |
| Contrat remote       | `remote-v1`                   | client Nest ; service Python stub                    |
| Prompt reformulation | `assistant-reply-v1`          | `prompt-governance.ts`                               |
| Jeu éval reco        | `reco-eval-synthetic-v1`      | fixtures                                             |
| Jeu éval assistant   | `assistant-eval-synthetic-v1` | `eval-dataset.ts`                                    |
| Poids reco           | `RECOMMENDATION_WEIGHTS`      | env validé (somme 100)                               |

## Processus actuel (sans MLOps séparé)

1. Tests unitaires + jeu synthétique (`pnpm --filter api exec vitest …`)
2. Revue du prompt / des poids
3. Déploiement API
4. Flags : `RECOMMENDATION_ENGINE`, `RECOMMENDATION_SHADOW`, `AI_ASSISTANT_PROVIDER`, `FF_WEB_*`
5. Observation Prometheus / Analytics
6. Rollback env (pas de registre de modèles)

## Shadow

`RECOMMENDATION_SHADOW=true` + URL remote : compare le top-3, n’expose pas l’ordre distant.

## Canary

Pas de canary utilisateur. Le flag UI masque le panneau ; le moteur distant n’est servi que si `RECOMMENDATION_ENGINE=remote`.

Complète `docs/recommendation-ml-lifecycle.md` et `docs/runbooks/deployment-and-rollback.md`.
