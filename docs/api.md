# API

Préfixe `/api`, version d'URL `v1`.

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| GET | `/health/live` | Processus vivant |
| GET | `/health/ready` | PostgreSQL, PostGIS et Redis |
| GET | `/health` | Même contrôle que ready |
| GET | `/api/v1/meta` | Identité du service |
| GET | `/docs` | OpenAPI, local et development seulement |
| GET | `/metrics` | Prometheus, seulement si `METRICS_ENABLED=true` |

`/health/ready` répond 503 si une dépendance manque. Le processus démarre quand même : une dépendance optionnelle ou temporairement absente ne doit pas empêcher le boot. En production, l'orchestrateur utilisera `ready` pour le trafic.

Les futures ressources suivront par exemple :

```
GET    /api/v1/properties
GET    /api/v1/properties/:id
POST   /api/v1/properties
PATCH  /api/v1/properties/:id
GET    /api/v1/listings
GET    /api/v1/recommendations
POST   /api/v1/properties/:id/favorite
```

Les DTO HTTP ne sont pas des entités de domaine. `ValidationPipe` est global : `whitelist`, `forbidNonWhitelisted`, `transform`. Un champ non déclaré est rejeté (protection contre le mass assignment).

Les listes volumineuses utiliseront la pagination par curseur de `@mon-appart/validation`, pas `OFFSET`.

Le rate limiting est de 120 requêtes par minute. Il s'appuie sur Redis et retombe sur la mémoire du processus si Redis est down. Les sondes `/health` ne sont pas comptées.
