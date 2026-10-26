# 0014 — Outbox transactionnelle et bus d'événements en processus

Date : 2026-10-26

## Contexte

Les modules NestJS communiquaient déjà par `EventEmitter2` (`DomainEventPublisher`) après le commit d'une transaction Prisma. Les files durables existantes (`notification_deliveries`, `partner_deliveries`, jobs médias) suivaient un outbox **par cas d'usage**. Les événements métier listing / property / paiement / conversation restaient émis après coup : un arrêt du processus entre le commit et `emit` perdait l'indexation, l'invalidation des recommandations et l'analytics.

ADR 0005 et 0006 signalaient déjà cette lacune.

## Décision

1. **PostgreSQL reste la source de vérité.** Les événements décrivent un fait déjà persisté ; Redis, l'index de recherche et l'analytics sont des projections.
2. **Table générique `outbox_events`** : insertion dans la **même transaction** que la mutation métier. Dispatcher in-process (`FOR UPDATE SKIP LOCKED`) publie ensuite vers `EventEmitter2`.
3. **Livraison at-least-once**, pas exactly-once. Les consommateurs sont idempotents (relecture de l'état courant, `deterministicEventId`, inbox `inbox_events` pour l'indexeur de recherche).
4. **Pas de Kafka / Redpanda / nouveau microservice.** Le volume actuel et le monolithe modulaire ne le justifient pas.
5. **Noms d'événements existants conservés** (`listing.published`, pas `listing.published.v1`) : la version vit dans `event_version`.
6. **Payloads minimaux** (identifiants publics, codes). Validation à l'écriture ; pas de secrets, mots de passe, documents ni données bancaires.

## Raisons

- Réutiliser le pattern SKIP LOCKED déjà éprouvé pour les notifications.
- Ne pas casser les listeners existants (Search, Recommendation, Analytics, Trust, Partners).
- Permettre un transport ultérieur (BullMQ puis Kafka) sans changer les règles métier.

## Conséquences

- Les modules listing, property, identity (inscription, statut), billing (paiement / abonnement), communication (conversation, visite) et media (changement d'illustrations) écrivent l'outbox puis appellent `flush()` après commit.
- Les événements de contrôle (`notification.deliveries_queued`, connexions) restent en `emit` direct.
- Un job d'expiration des annonces (`ListingExpiryRunner`) produit `listing.expired` via la même outbox.
- Exploitation : `GET /api/v1/admin/events/outbox`, rejeu `ops:events`.

## Alternatives écartées

- **Kafka dès maintenant** : coût opérationnel sans seuil de volume mesuré.
- **Double émission (emit + outbox)** : double traitement des listeners.
- **Exactly-once de bout en bout** : non démontrable avec EventEmitter + at-least-once.
