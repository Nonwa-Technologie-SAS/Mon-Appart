# 0002 — Conserver le prototype web et l'application Expo

Date : 2026-10-07

## Contexte

Le dépôt contenait déjà `frontend-public` (Next.js 16, Prisma 7, authentification, biens) et `mobile-app` (Expo 57). Le socle demandé décrit `apps/web`, `apps/admin`, une API NestJS vide de métier, et un dossier mobile Flutter.

## Décision

1. Déplacer le site existant vers `apps/web` et l'application Expo vers `apps/mobile`, sans réécrire leurs fonctionnalités.
2. Ne pas remplacer l'application Expo par un squelette Flutter. Flutter pourra arriver plus tard, à côté, si le produit le choisit. Effacer une application déjà branchée sur l'API du prototype serait une perte, pas un socle.
3. Créer `apps/admin` comme back-office séparé. Le prototype a aussi des pages `app/admin` : elles restent jusqu'à une migration explicite.
4. Garder Prisma 7.10 sur l'API (Prisma 8 est encore en release candidate). Le prototype web reste sur Prisma 7.9.
5. Deux bases : `mon_appart` pour l'API, `mon_appart_legacy` pour le prototype. Le schéma web mélange aujourd'hui le bien et le prix ; le schéma API partira de zéro pour respecter property / listing.
6. Licence propriétaire, faute d'une licence open source demandée pour un produit commercial.
7. BullMQ 5 et ioredis 5, couple déjà éprouvé. Argon2id via `@node-rs/argon2` pour éviter une compilation native sur Windows.
8. OpenTelemetry, Sentry, Grafana, Prometheus, Loki, OpenSearch et Kafka ne sont pas lancés en local. Des drapeaux et un endpoint `/metrics` optionnel préparent l'activation.
9. Compose publie PostgreSQL sur le port hôte 5433 et Redis sur 6380. Les ports 5432 et 6379 sont souvent déjà occupés par des installations locales, et `localhost` peut alors joindre le mauvais serveur.

## Conséquences

Les règles d'outillage qui pointaient vers `frontend-public/` et `mobile-app/` suivent désormais `apps/web/` et `apps/mobile/`. Le métier du prototype n'est pas la cible du modèle : il continue de fonctionner le temps de la bascule.
