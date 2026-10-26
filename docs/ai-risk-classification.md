# Classification interne des risques IA

Classification **interne** pour prioriser les contrôles. Elle ne constitue pas une conformité réglementaire.

| Niveau   | Définition adaptée au marketplace                        | Exemples Mon Appart                                   |
| -------- | -------------------------------------------------------- | ----------------------------------------------------- |
| Faible   | Aide à la recherche, suggestions non engageantes         | Search, suggestions de clarification                  |
| Modéré   | Influence notable sur l’ordre vu par l’utilisateur       | Reco `rules-v1`, assistant, priorisation leads        |
| Élevé    | Visibilité d’une annonce, réputation, accès à un service | Signaux Trust (déclenchent une revue, pas une preuve) |
| Critique | Décision préjudiciable automatisée difficile à contester | **Aucun système actuel**                              |

## Règles

- Trust : un signal déclenche une **évaluation humaine**, jamais une fraude prouvée.
- Le LLM ne suspend pas un compte, n’envoie pas un paiement, ne modifie pas une annonce.
- Les annonces sponsorisées ne sont pas mélangées au ranking organique (fonctionnalité absente).
