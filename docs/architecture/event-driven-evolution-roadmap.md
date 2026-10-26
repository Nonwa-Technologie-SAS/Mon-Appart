# Feuille de route événementielle

## Aujourd’hui (implémenté)

Monolithe NestJS · PostgreSQL vérité · `outbox_events` · dispatcher SKIP LOCKED · EventEmitter2 · inbox indexeur · files métier dédiées · pas de Kafka.

## Cible à moyen terme (même processus)

1. Brancher progressivement les emits restants (messages, trust, refunds) sur l’outbox lorsque la perte d’un événement a un impact métier.
2. Alertes Prometheus sur file morte et âge du plus ancien PENDING.
3. Purge / archivage `DEAD` après investigation (procédure ops, pas automatique).

## Critères d’évolution vers Kafka ou Redpanda

Ne pas migrer sur une hypothèse. Mesurer d’abord :

| Signal                                                                     | Pourquoi ça compte                   |
| -------------------------------------------------------------------------- | ------------------------------------ |
| `outbox_events_pending` durablement élevé malgré le scale-out API          | PostgreSQL file saturée              |
| Latence de publication p99 incompatible avec le SLO recherche              | besoin de consommateurs indépendants |
| Besoin de rejouer un historique de plusieurs jours pour un nouveau service | rétention Outbox trop courte         |
| Plusieurs services de déploiement indépendant consommant les mêmes faits   | frontière de service réelle          |

Aucun seuil chiffré n’est présenté comme mesuré. Les ordres de grandeur de conception (10 k → 100 k → 1 M utilisateurs) restent des **objectifs produit**, pas des benchmarks.

## BullMQ

Déjà présent pour `system.ping`. Utile comme relais **après** l’outbox si un worker dédié (indexation lourde) doit scaler sans scaler l’API. Le domaine continuerait d’écrire PostgreSQL en premier.

## Ce qui ne changera pas

- PostgreSQL source de vérité.
- Consommateurs idempotents.
- Pas d’exactly-once magique.
- Pas de microservices « un module = un service » sans besoin démontré.
