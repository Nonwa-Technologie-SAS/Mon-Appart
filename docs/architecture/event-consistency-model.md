# Modèle de cohérence inter-modules

## PostgreSQL

Source de vérité. Une lecture HTTP voit l’état commité, **indépendamment** de l’outbox.

## Index de recherche

Projection `listing_search_documents` (+ OpenSearch s’il est configuré). Visibilité toujours **re-vérifiée** à la requête. Une annonce `PAUSED` / `SUSPENDED` / `EXPIRED` / `ARCHIVED` est désindexée du public au prochain événement ou via `search:reindex`.

Cohérence : **éventuelle**, typiquement sub-seconde après `flush()`. En cas d’erreur d’indexation avalée par le listener : rattrapage CLI / rejeu.

## Redis

Cache-aside recherche (TTL court, génération incrémentée à l’indexation). Invalidation reco sur événements listing/property. Un cache ne doit pas conserver durablement une annonce retirée : la génération et les TTL courts limitent la fenêtre. Ce n’est pas une source de vérité.

## Recommandations

Pré-calcul optionnel + calcul à la demande. Les événements listing **invalident** ; ils ne déclenchent pas un recalcul global bloquant la publication.

## Analytics

Pipeline indépendant (`suppressErrors`). Une panne analytics n’empêche ni la consultation ni le contact. Déduplication par `eventId` déterministe.

## Paiements

Le navigateur n’est jamais une preuve. Seul un statut prestataire appliqué en transaction (signature webhook / interrogation authentifiée) produit `billing.payment_succeeded`. Une seconde notification ne ré-active pas un abonnement (`ALREADY`).

## Ordre

Obligatoire : transitions d’un même agrégat **relues en base** (l’événement ne pousse pas un statut aveugle dans l’index).  
Acceptable en éventuel : compteurs analytics, invalidation reco, partenaires.

Un timestamp seul n’ordonne pas les événements concurrents. L’`id` d’outbox ordonne les inserts d’une instance ; les consommateurs d’agrégat s’appuient sur l’état PostgreSQL.
