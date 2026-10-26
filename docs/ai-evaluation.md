# Évaluation qualité — Assistant IA

## Jeu de requêtes (marché CI)

| Cas                                 | Attendu                                             |
| ----------------------------------- | --------------------------------------------------- |
| Maison 3 ch. louer Cocody 250k/mois | Search avec RENT, HOUSE, COCODY, maxPrice, bedrooms |
| Appartement louer Abidjan           | Clarification commune ou budget                     |
| Terrain Cocody                      | Clarification achat vs location                     |
| Location sans budget                | Clarification ; « Sans budget » → Search            |
| 250k ambigu                         | Période MONTH si location seule                     |
| Localité inconnue                   | Pas d’ID inventé ; freeText ou clarification        |
| Soft « calme »                      | Hint unverifiable, pas de filtre faux               |
| Search vide                         | Mode `empty` + suggestions d’élargissement          |
| Correction budget                   | `mergeCriteria` conserve lieu / type                |
| Session étrangère                   | 404 conversation                                    |

## Tests automatisés

```bash
pnpm --filter api exec vitest run src/modules/ai-assistant
```

Couverture : extracteur, fusion, service (Search mocké), isolation session.

## Mesures produit (à instrumenter plus tard)

Taux de clarification, échecs Search, latence p50/p95, erreurs fournisseur, conversion favoris/contact. Ne pas afficher de chiffres avant collecte réelle.

Voir aussi le cadre étendu : `ai-governance-framework.md`, `llm-evaluation-and-prompt-governance.md`, jeu golden `assistant-eval-synthetic-v1`.

## Production

1. Définir `NEXT_PUBLIC_NEST_API_URL` sur le web.
2. Garder `AI_ASSISTANT_PROVIDER=rules` jusqu’à validation OpenAI.
3. Activer OpenAI seulement avec budget et monitoring.
4. Remplacer `ConversationStore` mémoire par Redis/Postgres si multi-instance.
