# Analytics et KPI de rétention

Événements ajoutés au catalogue `@mon-appart/analytics` (pas de seconde plateforme). Aucune note privée, e-mail ou téléphone dans les propriétés.

**Serveur (instrumentés)** : `saved_search_created`, `saved_search_updated`, `property_alert_eligible`, `property_alert_sent`, `property_marked_unavailable`, `post_visit_feedback_submitted`, `search_resumed`, `reactivation_eligible`, `reactivation_sent`, `notification_preferences_updated`, `marketing_unsubscribed`, `project_marked_completed`.

Les identifiants `retention.*` du `METRICS_CATALOG` exposent les formules ; les agrégats quotidiens ne sont pas encore calculés (pas de valeur de référence fictive).

**Client (déclarés, non instrumentés)** : `property_alert_opened`, `property_alert_clicked`, `reactivation_returned`.

## KPI (formule / dénominateur / fenêtre)

| KPI                  | Formule                              | Dénominateur                         | Fenêtre  | Limite                                  |
| -------------------- | ------------------------------------ | ------------------------------------ | -------- | --------------------------------------- |
| Reprise de recherche | `search_resumed`                     | recherches actives                   | 7 / 30 j | pas de causalité                        |
| Pertinence alerte    | clics utiles / `property_alert_sent` | digests envoyés                      | 7 j      | opened/clicked pas encore émis          |
| Réactivation         | retours après `reactivation_sent`    | éligibles                            | 14 j     | `reactivation_returned` non instrumenté |
| Post-visite          | feedbacks / visites `COMPLETED`      | visites réalisées                    | 14 j     | déclaré ≠ vérifié                       |
| Désinscription       | `marketing_unsubscribed`             | utilisateurs ayant reçu du marketing | 30 j     | marketing off par défaut                |

Ne pas remplir un tableau avec des valeurs de référence fictives.
