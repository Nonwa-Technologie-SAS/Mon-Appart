# 0005 — Modules Property et Listing

Date : 2026-10-08

Numérotation : le brief proposait « 0003 », déjà pris par [0003-database-model](./0003-database-model.md). Ce document prend le numéro libre suivant.

## Contexte

Le schéma (ADR 0003) séparait déjà bien (`properties`), propriété historisée (`property_ownerships`) et annonce (`listings`, `listing_prices`, `listing_status_history`), mais aucune API ne les exploitait. Identity (ADR 0004) fournissait l'authentification et des permissions par rôle, sans notion de ressource possédée. Il fallait permettre aux propriétaires et agents de décrire et publier des biens en Côte d'Ivoire, et au public de les rechercher par critères et par distance, sans exposer les adresses précises ni laisser un utilisateur agir sur le bien d'un autre.

## Décision

1. **Deux modules** (`property`, `listing`) aux couches d'Identity. Listing dépend de Property, jamais l'inverse.
2. **Autorisation à deux niveaux** : permission fonctionnelle du jeton (garde global), puis relation courante au bien dans `property_ownerships`, relue en base. La décision (`ALLOW`, `ALLOW_OVERRIDE`, `FORBIDDEN`, `NOT_FOUND`) est une fonction pure testée. Pas de colonne `owner_id` : le créateur est rattaché par une relation.
3. **Mandat comme relation** : ajout des valeurs `AGENT` et `MANAGER` à `ownership_type` plutôt qu'une table de mandats. Elles donnent la gestion, pas la suppression du bien.
4. **404 plutôt que 403** pour une ressource non publique dont l'appelant n'a aucune relation.
5. **Dérogation admin auditée** (`adminOverride: true`) par les permissions `property:manage` et `listing:manage`, distinctes des permissions de rôle publieur.
6. **Matrice de transitions explicite** dans le domaine, avec l'acteur autorisé par transition (gestionnaire, modérateur, système). La modération ne peut ni vendre ni mettre en pause.
7. **Prix append-only** : verrou de ligne sur l'annonce, clôture du prix courant puis insertion, dans une transaction `READ COMMITTED`. L'index unique partiel `valid_to IS NULL` reste le filet de sécurité. Montants entiers en XOF seulement.
8. **Confidentialité de la localisation par bien** (`EXACT`, `APPROXIMATE` par défaut, `HIDDEN`), appliquée à la sérialisation et à la recherche publique.
9. **Attributs JSONB sur liste blanche par catégorie** ; tout critère filtrable reste une colonne indexée.
10. **Recherche en deux temps** : SQL brut (filtres, `ST_DWithin`, pagination par curseur) pour les identifiants, puis une requête Prisma d'hydratation. Pas de moteur de recherche à ce stade.
11. **Événements en processus après commit**, audit dans la transaction, comme Identity.

Migration `20261008190000_property_listing` : enums `amenity_category` et `location_visibility`, valeurs `AGENT`/`MANAGER`, colonnes `amenities.category`, `properties.attributes`, `properties.location_visibility`, `property_types.is_active`, index du fil récent, de l'expiration et du prix courant, CHECK `attributes` objet et montant strictement positif. Aucune donnée supprimée.

## Alternatives écartées

- **Colonne `properties.owner_id`** : perd l'historique et l'indivision, et invite à faire confiance à un `ownerId` venu du client.
- **Table `mandates` dédiée** : plus riche (dates, commission) mais prématurée ; la relation `AGENT` pourra migrer vers elle.
- **Verrou optimiste (colonne `version`) sur les prix** : impose une relance côté client ; le verrou de ligne est court et sérialise naturellement.
- **Isolation `SERIALIZABLE`** : erreurs de sérialisation à relancer partout pour un seul point de contention.
- **Brouillage aléatoire des coordonnées** : une même annonce afficherait des positions différentes et la moyenne révélerait l'emplacement ; l'arrondi est stable.
- **OpenSearch dès maintenant** : PostgreSQL + PostGIS suffit au volume actuel ; les événements permettront de l'alimenter plus tard.
- **Prisma seul pour la recherche** : ni `geography` ni tri par sous-requête de prix courant sans N+1.

## Conséquences

- Rattacher un agent au bien d'un propriétaire se fait en base tant que le flux de mandat n'existe pas.
- Un rôle ajouté ou retiré agit sur la relation immédiatement (relue en base), sur les permissions du jeton au prochain refresh.
- Un événement peut être perdu si le processus s'arrête entre le commit et la publication : l'outbox corrigera ce point.
- L'expiration automatique n'est pas encore exécutée : une annonce échue reste `PUBLISHED` jusqu'au worker (documenté dans [property-listing.md](../property-listing.md)).
- Toute nouvelle clé d'attribut passe par le code (liste blanche), pas par la saisie libre.
