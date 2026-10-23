# Segmentation du cycle de vie

Les segments sont dérivés d’événements observables et de déclarations. Jamais d’une baisse de fréquentation seule.

| Segment             | Signaux                                         | Objectif                            |
| ------------------- | ----------------------------------------------- | ----------------------------------- |
| `ACTIVE_SEARCH`     | Recherche enregistrée ou favoris                | Alertes utiles, reprise             |
| `EXPLORATORY`       | Recherches récentes sans persistance            | Proposer d’enregistrer des critères |
| `VISIT_PHASE`       | Visite à venir                                  | Rappels transactionnels             |
| `WAITING`           | Visite réalisée sans retour, ou projet `PAUSED` | Reprise sans relance commerciale    |
| `PROJECT_COMPLETED` | Déclaré par l’utilisateur                       | Stopper les alertes de recherche    |
| `PUBLISHER`         | Rôle propriétaire / agence / agent              | CRM et rappels d’annonces existants |

Implémentation : `classifyLifecycle` et `isReactivationEligible` dans `apps/api/src/modules/search/domain/user-lifecycle.ts`.
