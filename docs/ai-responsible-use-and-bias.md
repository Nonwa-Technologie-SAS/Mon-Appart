# Usage responsable et biais

## Principes appliqués dans le code

- Pas d’attributs sensibles (origine, religion, genre, santé) dans les préférences reco ni l’analytics.
- Le budget n’intervient que s’il est **déclaré** ; un prix au-delà du plafond exclut l’annonce (`scoreBudget` → `null`).
- Popularité (`recentViews`) est une dimension pondérée, pas le classifieur unique. Baseline popularité battue ou non sur le jeu synthétique — à ne pas généraliser.
- Diversification : `maxPerOwner` évite qu’une même agence occupe toute la page.
- Les nouvelles agences ne sont pas pénalisées par un modèle d’historique (pas de ML). Le risque restant est la boucle de vues.
- Trust : signal ≠ fraude. Les codes de risque ne sont pas une identité.

## Limites

L’absence d’anomalie sur un jeu de 8 annonces synthétiques **ne prouve pas** l’équité. Les volumes par commune / type / budget en production restent à observer via Analytics (segments immobiliers, pas socio-démographiques).
