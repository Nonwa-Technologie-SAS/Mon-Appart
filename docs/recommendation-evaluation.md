# Évaluation des recommandations

## Hors ligne (implémenté)

Fonctions pures : `apps/api/src/modules/recommendation/domain/evaluation-metrics.ts`

- Precision@K
- Recall@K
- NDCG@K
- Couverture catalogue
- Diversité d’attribut

Tests : `evaluation-metrics.spec.ts`.

Ces métriques s’appliquent à des **jeux synthétiques** ou exports futurs. Elles ne sont pas des KPIs production tant qu’aucun export batch n’est branché.

## En ligne (données partielles)

Disponibles côté analytics admin lorsque des événements existent :

- Pages `recommendations_requested`
- Feedback explicite
- Attribution contact/RDV (fenêtre `ANALYTICS_ATTRIBUTION_HOURS`)

**Non mesuré en prod front** tant que `recommendations_viewed` / ouverture recommandée ne sont pas émis par le client.

## Baseline

Comparer toute variante à `rules-v1` (moteur actuel). Un modèle ML ne remplace la baseline qu’après gain hors ligne + garde-fous.

## A/B

Fondations non activées (volume insuffisant). Ne pas déclarer d’expérience concluyente sans protocole et échantillon.
