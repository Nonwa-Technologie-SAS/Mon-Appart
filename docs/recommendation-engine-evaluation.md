# Évaluation du moteur de recommandation

## Production

Le classifieur servi est **`rules-v1`** (score pondéré + MMR). `services/recommendation` n’expose que `/health`. L’historique utilisateur est l’upsert Prisma `(userId, listingId, context, algorithmVersion)` plus les événements `reco.*`. Les visiteurs anonymes ne sont pas persistés.

Les raisons affichées (`BUDGET_MATCH`, commune, type…) viennent des dimensions qui ont **réellement** contribué (`REASON_MIN_SCORE`).

## Hors ligne

`evaluateRecommendationOffline()` compare `rules-v1` à :

- tri par fraîcheur
- tri par popularité (vues)

Jeu **synthétique** `reco-eval-synthetic-v1` (8 annonces, labels contact > favori > vue). Ce n’est pas un panel utilisateurs.

Métriques calculées : Precision@5, Recall@5, NDCG@5, MAP@5, couverture, diversité commune, redondance propriétaire, taux hors budget, listes vides.

API : `GET /api/v1/admin/ai/eval` (`ai:admin`).

## Production (qualité)

Les clics seuls ne sont pas une preuve de pertinence. Hiérarchie : visite/contact > favori > détail > impression. `recommendation_converted` est une attribution déclarative dans une fenêtre, pas une transaction vérifiée.

Shadow : `RECOMMENDATION_SHADOW=true` appelle le remote sans servir l’ordre (`recommendation_shadow_total{outcome}`).

Voir aussi `docs/recommendation.md`, `docs/recommendation-ml-lifecycle.md`.
