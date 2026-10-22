# Stratégie de déploiement

Complète [deployment-architecture.md](./deployment-architecture.md) et [ci-cd.md](./ci-cd.md).

## Compatible aujourd’hui

| Stratégie | Faisable ? | Notes |
| --- | --- | --- |
| Standard + smoke | **Oui** (cible) | Health + scripts smoke |
| Feature flags env | **Oui** | Kill-switch / progressive config |
| Rolling containers | Oui si hébergeur le permet | API stateless |
| Canary % trafic | **Non** out-of-the-box | Documenter quand infra le permet |
| Blue-green | Possible manuellement | Deux slots + bascule DNS |

## Releases à risque élevé — fiche minimale

1. Périmètre
2. Users affectés
3. Dépendances
4. Métriques à surveiller (5xx, ready, search)
5. Succès / seuils d’arrêt
6. Rollback
7. Validations post-deploy

## Migrations

Voir [database-migrations-production.md](./database-migrations-production.md).

## Interdit

- Rebuild silencieux différent en prod.
- `migrate reset` / `db push` hors local.
- Déclarer canary opérationnel sans mécanisme réel.
