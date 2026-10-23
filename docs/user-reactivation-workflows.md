# Réactivation

Pas de seuil universel unique. Fenêtres configurables :

- `REACTIVATION_IDLE_DAYS` (défaut 7)
- `REACTIVATION_COOLDOWN_DAYS` (défaut 14)

## Scénarios livrés

| Scénario                 | Condition                                     | Canal                         |
| ------------------------ | --------------------------------------------- | ----------------------------- |
| A Nouvelles opportunités | Inactivité + correspondances **exactes**      | `SAVED_SEARCHES` (digest)     |
| B Reprise de recherche   | Action utilisateur `/resume` ou bouton profil | In-app                        |
| C Indisponibilité        | Favori plus publié                            | `LISTING_UPDATES`             |
| D Absence de réponse     | CRM Inquiry existant (Prompt 28)              | Pas de relance marketing auto |
| E Post-visite            | Formulaire facultatif                         | `VISITS`                      |
| F Professionnels         | Tableau de bord `/espace`                     | Transactionnel CRM            |

Un projet `COMPLETED` ou `PAUSED` n’est jamais réactivé. Aucune fausse urgence.
