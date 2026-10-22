# Qualité des données BI

Contrôles et anomalies pour la couche Analytics / BI. Complète [analytics-and-tracking.md](./analytics-and-tracking.md) (ingestion_stats, checkpoints).

## Sources de contrôle

| Signal | Table / API | Usage |
| ------ | ----------- | ----- |
| Acceptés / doublons / rejetés | `analytics_ingestion_stats` | `GET /api/v1/admin/analytics/quality` |
| Dernier jour agrégé | `analytics_checkpoints` (job `aggregate_daily`) | Méta `completedDay` / fraîcheur UI |
| Échecs instrumentation | Prometheus `analytics_tracking_failures_total` | Ops |
| Petits groupes | `ANALYTICS_MIN_GROUP_SIZE` | Masquage marché / ventilations |

## Règles d’interprétation

- **Ne pas transformer le manquant en zéro silencieux** pour les taux : si le dénominateur est 0 (ex. pas de vues détail), le taux est `null` / « — » dans l’UI éditeur.
- **Doublons** : idempotence par `event_id` ; comptés en outcome duplicate, non double-comptés dans les agrégats.
- **Horodatages** : événements client trop vieux rejetés (`ANALYTICS_MAX_EVENT_AGE_HOURS`).
- **Prix** : montants ≤ 0 exclus des percentiles ; périodicités incompatibles jamais fusionnées.
- **Orphelins** : événements listing sans annonce actuelle restent dans le brut jusqu’à purge ; les agrégats listing ne créent pas d’identité visiteur.
- **Écart agrégat / métier** : après correction de règle, `analytics:recompute --from … --to …` dans la fenêtre de rétention.

## Anomalies à surveiller

1. Taux de rejet d’ingestion > 5 % sur une journée.
2. Aucun succès d’agrégation depuis plus d’une heure (worker actif).
3. Snapshot marché avec beaucoup de `suppressedGroups` : échantillon trop faible pour publier des stats par commune.
4. KPI contacts élevés alors que vues détail à 0 : tracker client non branché (biais de dénominateur).

## Corrections

- Pas de suppression de données métier pour « arranger » un graphique.
- Recalcul journalier rejouable uniquement ; documenter la règle changée dans le commit / ops.
- Données de test automatisées : fixtures isolées, jamais la production.
