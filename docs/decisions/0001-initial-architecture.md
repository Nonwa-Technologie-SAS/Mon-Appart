# 0001 — Monolithe modulaire, événements, PostgreSQL, Redis

Date : 2026-10-07

## Contexte

Mon Appart doit tenir de quelques milliers à plusieurs centaines de milliers d'utilisateurs, puis au-delà, sans réécriture complète. Le métier (biens, annonces, confiance, recommandation) n'est pas encore stabilisé.

## Décision

Démarrer avec un monolithe modulaire NestJS, PostgreSQL/PostGIS comme source de vérité, Redis pour le cache, les données temporaires et BullMQ, et une publication d'événements d'abord interne au processus.

Ne pas créer de microservices maintenant.

## Raisons

Un découpage en services dès le départ figerait des frontières métier encore fausses, multiplierait les déploiements, les transactions distribuées et le tracing, pour un trafic qui ne l'exige pas.

Le monolithe modulaire garde des modules remplaçables. Une transaction PostgreSQL reste possible. L'outbox permettra plus tard de sortir les événements critiques sans coupler les modules par des appels directs.

PostgreSQL couvre le relationnel, les contraintes et la géographie (PostGIS). Redis est rapide et éphémère : s'il est vide, le système reste correct. OpenSearch, Kafka et un service ML séparé s'ajoutent quand un besoin mesuré apparaît, pas par anticipation.

## Conséquences

- Un seul déploiement API au début, scalable horizontalement tant qu'il reste stateless.
- Les workers sont déjà un processus séparé, parce que le travail lourd ne doit pas bloquer HTTP. Ce n'est pas un microservice métier.
- Extraire un module plus tard coûtera un contrat d'API et un déplacement de données, pas une réécriture du domaine.
