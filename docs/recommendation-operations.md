# Opérations — recommandation

## Cache Redis

- Clés `rec:list:v1:*`, génération `rec:gen`, version utilisateur
- Invalidation catalogue : debounce 1 s (événements listing/property)
- Invalidation user : favoris, feedback non-DISPLAYED, clear profil
- Sans Redis : recalcul à chaque requête (dégradé acceptable)

## Jobs asynchrones

- File `recommendation.compute` déclarée dans `JOB_QUEUES` — **non consommée** par `services/workers` (seulement `system.ping`)
- Rebuild profil : paresseux à la lecture
- Purge `recommendations.expires_at` : documentée comme gap (pas de worker dédié V1 Prompt 20)

## Observabilité

Métriques Prometheus `recommendation.*` (latence, feedback, rebuild profil, dégradation remote).

## Dépannage

| Symptôme | Action |
| --- | --- |
| Liste vide | Vérifier filtres / budget / stock publié |
| `meta.degraded` | Remote KO → règles actives |
| Profil stale | Feedback / favori → dirty ; ou `DELETE behavior-profile` |
| Favoris sans effet | Vérifier écriture `favorites` + Redis bump |

## Config utile

`RECOMMENDATION_*`, `INTERACTION_RATE_LIMIT`, `NEXT_PUBLIC_NEST_API_URL` (UI web).
