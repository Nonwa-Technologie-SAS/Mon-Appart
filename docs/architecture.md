# Architecture

Mon Appart démarre en **monolithe modulaire** avec une voie **événementielle**. PostgreSQL est la source de vérité. Redis est un cache, un stockage temporaire et le transport BullMQ. Les fichiers ne sont pas stockés dans PostgreSQL.

## Forme actuelle

```
Next.js (web, admin) ── HTTP ── NestJS (apps/api)
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
               PostgreSQL         Redis          Workers
               + PostGIS          BullMQ         BullMQ
                                    │
                                    ▼
                            Recommendation (FastAPI)
```

Les modules métier de l'API (`identity`, `location`, `property`, `listing`, `media`, `search`, `interaction`, `recommendation`, `trust`, `communication`, `transaction`, `analytics`) sont des frontières NestJS. Ils n'exposent pas encore de cas d'usage. Quand un module grossit, la structure cible est :

```
application/   commandes, requêtes, services
domain/        entités, value objects, événements, ports
infrastructure/ persistance
presentation/  contrôleurs et DTO
```

Cette arborescence n'est pas créée à vide. Elle sera ajoutée avec le premier cas d'usage du module.

## Property et listing

Un **property** est un bien physique. Un **listing** est une offre publiée sur ce bien (location, vente, courte durée). Un bien peut porter plusieurs offres. Ces concepts ne seront pas fusionnés.

Le prototype `apps/web` a aujourd'hui un modèle `Property` qui mélange bien et prix. C'est un héritage. Le schéma cible de l'API ne reprendra pas ce mélange.

## Événements

`DomainEventPublisher` émet dans le processus (EventEmitter). Les événements critiques passeront par une table **outbox** PostgreSQL, dans la même transaction que l'écriture métier, avant d'être relayés vers BullMQ puis, si le volume l'exige, vers Kafka ou Redpanda.

## Stateless et charge

L'API ne garde pas d'état de session en mémoire. Les traitements lourds (images, notifications, indexation, fraude, recommandations) sont prévus dans `services/workers`, pas dans le cycle HTTP.

La pagination des grandes collections sera à curseur (`packages/validation`). Le pool PostgreSQL est borné (10 connexions) via l'adaptateur Prisma.

## Évolution

OpenSearch, le stockage S3/R2, OpenTelemetry, Sentry, Prometheus/Grafana et Kubernetes sont prévus, pas démarrés en local. Voir `infrastructure/`.

Un module pourra devenir un service le jour où son échelle ou son cycle de vie le justifie. D'ici là, on n'extrait pas de microservice.
