# Docker local

`compose.yaml` démarre uniquement PostgreSQL/PostGIS et Redis.

```bash
pnpm docker:up
pnpm docker:down
```

Sur la machine hôte, PostgreSQL est publié sur le port **5433** et Redis sur **6380**. Les conteneurs écoutent toujours 5432 et 6379 en interne. Ce décalage évite un PostgreSQL ou un Redis déjà installés localement.

Les Dockerfiles de l'API, des workers et du service de recommandation servent à une étape de déploiement. Ils ne sont pas lancés par Compose.

OpenSearch, Kafka, Prometheus, Grafana et Loki ne font pas partie du Compose de développement.
