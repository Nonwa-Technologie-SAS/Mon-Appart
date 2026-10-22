# SLI, SLO et error budgets

**Tous les SLO ci-dessous sont des objectifs proposés à valider**, pas des mesures observées ni des engagements contractuels. Le trafic réel est encore trop faible pour des statistiques robustes.

## SLI définis

| SLI               | Numérateur                                   | Dénominateur                  | Fenêtre        | Exclusion                   |
| ----------------- | -------------------------------------------- | ----------------------------- | -------------- | --------------------------- |
| Disponibilité API | Requêtes HTTP non-5xx sur routes versionnées | Total requêtes `/api/v1/*`    | 30 j glissants | Health scrape, métriques    |
| Latence API       | Requêtes avec durée ≤ seuil                  | Total requêtes `/api/v1/*`    | 30 j           | Batch admin hors scope      |
| Ready             | Minutes où `/health/ready` = 200             | Minutes totales               | 7 j            | Maintenance planifiée       |
| Search succès     | Search HTTP 2xx                              | Tentatives search             | 7 j            | Clients 4xx (validation)    |
| Jobs async        | Jobs completed                               | completed + failed définitifs | 7 j            | Jobs annulés volontairement |

Sources de données prévues : Prometheus (`METRICS_ENABLED=true`) + logs Pino. **Pas encore de dashboard Grafana branché.**

## SLO initiaux proposés

| Objectif                   | Proposition                | Commentaire               |
| -------------------------- | -------------------------- | ------------------------- |
| Disponibilité API          | 99,5 % / 30 j              | ≈ 3,6 h d’erreur budget   |
| Latence p95 search + fiche | < 800 ms (hors cold start) | À recalibrer après charge |
| Latence p99 API            | < 2 s                      |                           |
| Ready uptime               | 99,9 % / 7 j               |                           |
| Jobs failed rate           | < 1 %                      |                           |

## Error budget

```
Budget (30 j, 99,5 %) ≈ 0,5 % × 30 × 24 h ≈ 3,6 h d’équivalent indisponibilité
```

Usage suggéré :

- Budget > 50 % restant → livraisons features normales.
- Budget < 25 % → geler features non critiques, prioriser fiabilité.
- Budget épuisé → freeze déploiements non hotfixes jusqu’à rétablissement.

Sans métriques continues, suivre le budget via : incidents SEV-1/2 chronométrés + synthétiques `/health` + k6 staging.

## Ce qui n’est pas un SLO

- Uptime du process Node ≠ succès métier.
- Disponibilité théorique Cloud ≠ disponibilité mesurée Mon Appart.
- Objectif interne ≠ SLA client.
