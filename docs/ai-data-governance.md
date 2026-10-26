# Gouvernance des données IA

## Provenance

- Catalogue : PostgreSQL (annonces PUBLISHED).
- Préférences reco : déclarées par l’utilisateur.
- Comportement : agrégats (vues, favoris) bornés, pas le contenu des messages.
- Conversations assistant : Map en mémoire, TTL 24 h, pas d’entraînement.
- Feedback assistant : code `helpful | not_helpful | wrong_results` (le commentaire DTO n’est pas persisté).

## Conservation

- `Recommendation.expires_at` (`RECOMMENDATION_TTL_DAYS`).
- Analytics : politique existante (événements sans texte libre, sans email).
- Pas de dataset ML versionné : aucun entraînement.

## Signaux ≠ labels

| Signal                       | Usage                                               |
| ---------------------------- | --------------------------------------------------- |
| Impression                   | Biais de position                                   |
| Vue détail                   | Intérêt faible                                      |
| Favori                       | Intérêt déclaré                                     |
| Contact / visite demandée    | Intention                                           |
| Visite réalisée / conversion | Déclaratif, à distinguer d’une transaction vérifiée |

Jeux synthétiques d’évaluation : identifiés `kind: synthetic`. Ne pas les mélanger aux agrégats production.
