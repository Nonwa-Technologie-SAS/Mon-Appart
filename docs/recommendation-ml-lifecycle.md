# Cycle de vie ML — recommandation

## Statut

**Aucun modèle n’a été entraîné, évalué hors ligne à grande échelle, ni déployé.**

- `RECOMMENDATION_ENGINE=rules` (défaut)
- `services/recommendation` : FastAPI `/health` uniquement (pas de `/v1/rank`)
- Client Nest `RemoteRecommendationEngine` prêt + repli règles (`meta.degraded`)

## Conditions pour démarrer le ML

1. Volume fiable de vues, favoris, feedback et conversions attribuées
2. Jeu de données versionné, split chronologique, sans fuite
3. Baseline `rules-v1` battue sur Precision@K / NDCG@K **et** métrique métier (contact qualifié)
4. Explicabilité minimale (raisons ou features interprétables)
5. Repli automatique si remote indisponible

## Versionnement prévu

| Artefact | Emplacement envisagé |
| --- | --- |
| Features | pipeline Python versionnée |
| Modèle | registre + `algorithm_version` déjà persisté |
| Rollback | `RECOMMENDATION_ENGINE=rules` |

## Biais connus à surveiller

Popularité (boucle de clics), sous-représentation de nouvelles annonces, biais géographique Abidjan vs intérieur, confusion location/achat.
