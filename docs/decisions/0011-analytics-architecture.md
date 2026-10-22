# 0011 — Analytics et suivi d'usage

Date : 2026-10-13

## Contexte

Le schéma contenait `user_events` (table partitionnable, types d'événements libres, jamais alimentée par l'API) et un module `analytics` vide. Aucun indicateur produit n'était calculé ; les propriétaires n'avaient aucune statistique sur leurs annonces.

Il fallait mesurer l'usage de 10 000 à plus d'un million d'utilisateurs, avec des contraintes fortes : pas de donnée personnelle ou sensible dans les événements, aucun fait métier déclaré par le client, respect du consentement, aucune exposition des visiteurs aux annonceurs, aucune panne métier causée par Analytics, pas d'infrastructure supplémentaire obligatoire.

## Décision

1. **Nouvelle table `analytics_events`** plutôt que réutiliser `user_events` : catalogue fermé (nom, version, propriétés validées), base légale par ligne, idempotence par `event_id`. `user_events` reste une table héritée, non alimentée.
2. **Catalogue partagé** dans `packages/analytics` (schémas zod stricts, clés interdites, routes normalisées), utilisé par l'API, le web et Expo : un seul contrat, testé.
3. **Deux bases légales.** Navigation client : consentement explicite (`analytics_consents` pour un compte, déclaration du client pour un anonyme), retrait avec effacement. Faits métier : produits par le backend à partir des événements de domaine, au titre de l'intérêt légitime, pseudonymisés (à valider juridiquement).
4. **Instrumentation par écouteur asynchrone** des événements de domaine existants (Listing, Identity, Search, Recommendation, Communication, Trust) : aucun module métier ne dépend d'Analytics, une erreur d'Analytics n'atteint jamais l'action principale. Identifiants d'événement déterministes : un fait rejoué n'est compté qu'une fois.
5. **Agrégats journaliers rejouables** (suppression puis réinsertion par jour, verrou consultatif PostgreSQL), calculés par un worker dans l'API avec checkpoint en base, plus une CLI de recalcul. Pas de Redis, BullMQ, Kafka ni entrepôt à ce stade.
6. **Lecture sur agrégats uniquement**, avec contrôle d'accès par la gestion courante du bien (`PropertyAccessService`), 404 pour une annonce non gérée, seuil minimal de groupe pour les ventilations d'administration.
7. **Rétention** de 13 mois pour les événements bruts (purge par lots), agrégats conservés. Pas de partitionnement tant que le volume ne le justifie pas.

## Conséquences

- Les KPI métier sont exhaustifs (lus dans les tables métier) ; l'entonnoir de navigation ne couvre que les visiteurs consentants.
- Le client de suivi existe mais n'est pas branché sur les frontends : tant qu'il ne l'est pas, seuls les événements backend sont produits.
- Le worker en processus suffit pour le volume attendu. Au-delà de quelques dizaines de millions d'événements par mois : partitionnement mensuel de `analytics_events`, puis flux d'événements vers un entrepôt analytique derrière le même catalogue.
- Changer `ANALYTICS_POLICY_VERSION` redemande le consentement à tous les utilisateurs.
- La base légale des événements backend doit être confirmée avant la mise en production.
