# Tests et validation BI

## Jeux de tests automatisés

| Cible | Commande | Objectif |
| ----- | -------- | -------- |
| Catalogue métriques | `pnpm --filter @mon-appart/analytics test` | IDs stables, rôles, présence des métriques clés |
| Domaine marché | `pnpm --filter @mon-appart/api test:unit` (fichier `market-stats.spec.ts`) | Seuil k-anonymat, percentiles, pas de mélange de périodicités |
| Domaine analytics | même suite (`analytics-domain.spec.ts`) | Plages de dates, règles d’ingestion |
| Intégration DB | `pnpm --filter @mon-appart/api test:db` (specs analytics) | Agrégats / lectures sur base de test |

Données : fixtures / DB de test uniquement — jamais la production.

## Validations manuelles recommandées

1. Comparer un KPI overview à la somme des `analytics_daily_metrics` sur la même plage.
2. Vérifier qu’un éditeur A ne voit pas les listings de B via `/analytics/me/listings`.
3. Confirmer qu’un rôle sans `analytics:admin` reçoit 403 sur `/admin/analytics/*`.
4. Marché : groupe &lt; `ANALYTICS_MIN_GROUP_SIZE` absent ou fusionné en `OTHER`.
5. Direction : disclaimer + note billing présents ; pas de CA inventé.
6. Espace `/espace` : taux « — » si vues = 0.

## Critères de fiabilité

Un indicateur est « fiable » seulement si : définition catalogue + calcul backend + test ou contrôle manuel sur données connues. L’affichage d’un graphique seul ne suffit pas.
