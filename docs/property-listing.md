# Biens et annonces

Modules `apps/api/src/modules/property` et `apps/api/src/modules/listing`. Décision : [ADR 0005](./decisions/0005-property-listing-model.md). Schéma : [database.md](./database.md).

**Un bien n'est pas une annonce.** Le bien (`properties`) décrit l'objet physique : type, surfaces, pièces, localisation, équipements. L'annonce (`listings`) est une offre commerciale sur ce bien : type d'offre, statut, prix historisé, dates de publication. Un bien peut porter une location et une vente en même temps, mais une seule annonce en cours (`PENDING_REVIEW`, `PUBLISHED`, `PAUSED`) par type d'offre.

## Organisation

Chaque module suit les couches d'Identity :

| Couche         | Contenu                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| domain         | règles pures et testées sans base : transitions, complétude, prix, confidentialité, accès       |
| application    | cas d'usage transactionnels (`PropertyService`, `ListingService`) et lectures (`*QueryService`) |
| infrastructure | repositories Prisma, recherche SQL brute (PostGIS), cache des référentiels                      |
| presentation   | contrôleurs, DTO validés, sérialiseurs, documentation Swagger                                   |

Le module Listing dépend de Property (`PropertyAccessService`, règles de complétude). L'inverse n'existe pas : Property compte les annonces en cours par une requête, sans importer Listing.

## Endpoints

Préfixe `/api/v1`. Les identifiants exposés sont les `public_id` (UUID v4) ; un identifiant mal formé répond 400.

### Biens

| Méthode | Chemin                          | Accès                                                       |
| ------- | ------------------------------- | ----------------------------------------------------------- |
| POST    | `/properties`                   | `property:create`                                           |
| GET     | `/properties`                   | public (biens actifs) ; `scope=mine` / `scope=all` connecté |
| GET     | `/properties/:id`               | public si actif, sinon gestionnaire du bien ou admin        |
| PATCH   | `/properties/:id`               | `property:update` + gestionnaire du bien, ou admin          |
| DELETE  | `/properties/:id`               | `property:delete` + propriétaire légal, ou admin (204)      |
| PUT     | `/properties/:id/amenities`     | `property:update` + gestionnaire ; remplace la liste        |
| GET     | `/property-types`, `/amenities` | public ; référentiels actifs                                |

Filtres de liste : `propertyType`, `commune`, `neighborhood` (exige `commune`), `minSurface`, `maxSurface`, `bedrooms`, `bathrooms` (au moins N), `latitude` + `longitude` + `radiusKm` (0,5 à 50 km), `status` (hors scope public), `cursor`, `limit` (1 à 100, 20 par défaut).

### Annonces

| Méthode | Chemin                  | Accès                                                               |
| ------- | ----------------------- | ------------------------------------------------------------------- |
| POST    | `/listings`             | `listing:create` + gestionnaire du bien ; crée un brouillon         |
| GET     | `/listings`             | public (publiées, bien actif) ; `scope=mine` / `scope=all` connecté |
| GET     | `/listings/:id`         | public si publiée ; sinon gestionnaire, modération ou admin         |
| GET     | `/listings/:id/history` | gestionnaire, modération ou admin : prix et statuts                 |
| PATCH   | `/listings/:id`         | `listing:update` : titre, description, échéance                     |
| PUT     | `/listings/:id/price`   | `listing:update` : nouveau prix, l'ancien est clôturé               |
| POST    | `/listings/:id/publish` | `listing:publish` : publie ou reprend après pause                   |
| POST    | `/listings/:id/pause`   | `listing:publish`                                                   |
| POST    | `/listings/:id/status`  | selon la transition : vendu, loué, archivé, revue, suspension       |
| DELETE  | `/listings/:id`         | `listing:delete` : archive puis masque (204), historique conservé   |

Filtres de liste : ceux des biens, plus `listingType`, `minPrice`, `maxPrice`, `period` (sur le prix courant). Le fil public est trié par date de publication décroissante.

La fiche d'une annonce contient le résumé du bien (type, surfaces, pièces, équipements), le prix courant, la localisation filtrée selon la confidentialité et un résumé des médias (`count`, `coverUrl`). Les champs `relation`, `createdAt` et `updatedAt` n'apparaissent que dans la vue privée.

Les DTO refusent tout champ non déclaré : `ownerId`, `createdById`, `status` dans un PATCH d'annonce, `currency` autre que `XOF`... répondent 400.

## Autorisation

L'utilisateur courant vient toujours du jeton (`AuthenticatedUser`) ; ses rôles sont relus en base à chaque requête (`ActorService`) et un compte suspendu ou banni est refusé. Le garde global `PermissionsGuard` contrôle d'abord les permissions du jeton, puis le service vérifie la relation au bien. Le propriétaire n'est jamais lu dans la requête : la création d'un bien rattache le créateur dans `property_ownerships`.

| Rôle               | Biens                                                       | Annonces                                                         |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| CUSTOMER           | lecture publique                                            | lecture publique                                                 |
| OWNER              | crée ; gère ceux dont il est propriétaire courant           | crée, publie, met en pause, clôture sur ses biens                |
| AGENT / AGENCY     | crée (relation `AGENT`) ; gère les biens où il est rattaché | idem, sur les biens où il est rattaché                           |
| MODERATOR          | lecture publique                                            | valide une revue, suspend, rétablit ; ne vend ni ne met en pause |
| ADMIN, SUPER_ADMIN | tous (`property:manage`), dérogation auditée                | toutes (`listing:manage`), dérogation auditée                    |

Relations qui donnent la gestion : `SOLE`, `JOINT`, `USUFRUCT`, `AGENT`, `MANAGER`. La suppression d'un bien est réservée aux relations légales (`SOLE`, `JOINT`, `USUFRUCT`) : un mandataire ne supprime pas le bien de son mandant. Les relations `AGENT` et `MANAGER` ne sont attribuables à la création que par un compte AGENT ou AGENCY (`INVALID_OWNERSHIP_TYPE` sinon) ; le rattachement d'un agent au bien d'un propriétaire passera par un flux de mandat (hors périmètre).

Réponses de refus : un tiers reçoit **404** si la ressource n'est pas publique (son existence ne fuit pas), **403** si elle l'est ou s'il a une relation sans la permission. Une action d'admin sur un bien qu'il ne gère pas est autorisée et l'audit porte `adminOverride: true`.

## Biens : règles

- **Statuts** : `DRAFT → ACTIVE | ARCHIVED`, `ACTIVE → INACTIVE | ARCHIVED`, `INACTIVE → ACTIVE | ARCHIVED`. `ARCHIVED` est final.
- **Complétude pour `ACTIVE`** : titre, coordonnées, `landSurface` pour un terrain ou `surface` sinon, chambres et salles de bain pour un bien résidentiel. Sinon `PROPERTY_INCOMPLETE` (422) avec la liste des champs manquants.
- **Retrait** (`INACTIVE`, `ARCHIVED`, suppression) refusé tant qu'une annonce est en cours : `PROPERTY_HAS_ACTIVE_LISTINGS` (409). La suppression masque le bien et ses annonces non en cours (`deleted_at`).
- **Coordonnées** : les deux ou aucune, dans l'emprise de la Côte d'Ivoire (latitude 4,2 à 10,8, longitude −8,7 à −2,4). `geo_point` est une colonne générée : l'application ne l'écrit jamais.
- **Cohérence** : pas de chambres, salles de bain ni étage sur un terrain ; étage ≤ nombre d'étages.
- **Attributs JSONB** limités à une liste par catégorie ; tout ce qui sert de filtre reste une colonne.

| Catégorie   | Clés autorisées                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| RESIDENTIAL | `parkingSpaces`, `servantQuarters`, `standing` (ECONOMIQUE/MOYEN/HAUT), `waterMeter`, `electricityMeter`                        |
| LAND        | `serviced`, `fenced`, `buildable`, `frontageMeters`, `landTitle` (ACD, CPF, LETTRE_ATTRIBUTION, ATTESTATION_VILLAGEOISE, AUTRE) |
| COMMERCIAL  | `parkingSpaces`, `frontageMeters`, `storefront`                                                                                 |
| INDUSTRIAL  | `ceilingHeightMeters`, `loadingDocks`, `threePhasePower`                                                                        |
| MIXED       | résidentiel + commercial                                                                                                        |

`landTitle` est déclaratif : aucune vérification juridique n'est faite par ce module.

- **Équipements** : `PUT /properties/:id/amenities` calcule la différence (ajouts, retraits) dans une transaction, sous verrou du bien, et l'audite.

### Confidentialité de la localisation

| `locationVisibility`   | Vue publique                                                             |
| ---------------------- | ------------------------------------------------------------------------ |
| `EXACT`                | coordonnées et adresse                                                   |
| `APPROXIMATE` (défaut) | coordonnées arrondies à 2 décimales (environ 1 km), sans adresse         |
| `HIDDEN`               | commune et quartier seulement ; exclu des recherches par rayon publiques |

Le gestionnaire du bien voit toujours les valeurs exactes. Une recherche publique par rayon filtre sur la position publiée : arrondie pour `APPROXIMATE` (avec un préfiltre élargi de 1 km sur l'index GIST), sinon des recherches successives à centre décalé retrouveraient la position réelle. Les recherches `scope=mine` et `scope=all` utilisent la position exacte.

## Annonces : règles

### Transitions

| Depuis           | Vers                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `DRAFT`          | `PENDING_REVIEW`, `PUBLISHED`, `ARCHIVED` (gestionnaire)                                                      |
| `PENDING_REVIEW` | `PUBLISHED` (`listing:moderate`) ; `DRAFT` (gestionnaire ou modération) ; `ARCHIVED`                          |
| `PUBLISHED`      | `PAUSED`, `RENTED`, `SOLD`, `ARCHIVED` (gestionnaire) ; `SUSPENDED` (`listing:suspend`) ; `EXPIRED` (système) |
| `PAUSED`         | `PUBLISHED`, `RENTED`, `SOLD`, `ARCHIVED` (gestionnaire) ; `SUSPENDED` (`listing:suspend`)                    |
| `SUSPENDED`      | `PUBLISHED`, `DRAFT` (`listing:suspend`) ; `ARCHIVED` (gestionnaire ou modération)                            |
| `EXPIRED`        | `PENDING_REVIEW`, `PUBLISHED`, `ARCHIVED` (gestionnaire)                                                      |
| `RENTED`, `SOLD` | `ARCHIVED`                                                                                                    |
| `ARCHIVED`       | aucune                                                                                                        |

Issue commerciale selon le type : vente → `SOLD`, location → `RENTED`, location-accession → l'une ou l'autre, courte durée → aucune (archiver). Erreurs : transition absente `INVALID_LISTING_STATUS_TRANSITION` (409), annonce déjà publiée `LISTING_ALREADY_PUBLISHED`, vendue ou louée `LISTING_ALREADY_SOLD`, acteur non habilité `LISTING_ACCESS_DENIED` (403). Chaque transition écrit une ligne `listing_status_history` (auteur, motif) et un audit.

### Publication

`POST /listings/:id/publish` exige un bien `ACTIVE` et complet (`PROPERTY_NOT_ACTIVE`, `LISTING_INCOMPLETE`), un titre et un prix courant (`NO_ACTIVE_PRICE`). Avec `LISTING_MODERATION_REQUIRED=true`, un brouillon ou une annonce expirée passe en `PENDING_REVIEW` et attend un modérateur.

- `publishedAt` est renouvelé à chaque nouvelle publication ; une reprise après pause le conserve.
- `expiresAt` : valeur demandée (1 h à 365 j), sinon l'échéance en cours lors d'une reprise, sinon `LISTING_DEFAULT_DURATION_DAYS` (90 j).
- Une seconde annonce en cours du même type sur le bien est refusée par l'index unique partiel : `LISTING_ALREADY_LIVE_FOR_TYPE` (409).

### Prix

- Montant entier en XOF, strictement positif, au plus 999 999 999 999 ; stocké en `NUMERIC(14,2)`, exposé en chaîne (`"1500000"`).
- Périodes : vente `TOTAL` ; location `MONTH`, `YEAR` ; courte durée `DAY`, `WEEK`, `MONTH` ; location-accession `MONTH`.
- **Jamais écrasé.** `PUT /listings/:id/price` verrouille l'annonce (`SELECT … FOR UPDATE`), clôture le prix courant (`valid_to`) et insère le nouveau avec `valid_from` égal à cet instant. Deux changements concurrents s'exécutent l'un après l'autre : l'historique reste continu et il n'y a jamais qu'un prix courant (garanti aussi par l'index unique partiel `valid_to IS NULL`).
- Un prix identique au prix courant ne crée aucune ligne. Une annonce vendue, louée ou archivée n'est plus modifiable (`LISTING_NOT_EDITABLE`).

### Suppression

`DELETE /listings/:id` passe l'annonce en `ARCHIVED` (ligne d'historique, motif `deleted`) puis renseigne `deleted_at`. Prix, statuts et audit restent en base.

## Recherche

Une requête SQL brute renvoie les identifiants filtrés et triés (`ST_DWithin` sur l'index GIST, prix courant via l'index partiel `listing_prices_current_amount_idx`), puis une seule requête Prisma charge les lignes avec leurs relations : pas de N+1. La pagination est par curseur opaque (`id` public + date de tri), stable sous insertion ; un curseur invalide répond `INVALID_CURSOR` (400).

Les référentiels (types, équipements, quartiers) sont mis en cache 5 minutes en mémoire ; les filtres les désignent par code (`VILLA`, `COCODY`, `RIVIERA`).

## Événements, audit, logs, métriques

| Événement (bus en processus)                                                                                         | Charge utile (identifiants publics)             |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `property.created`, `property.updated`, `property.deleted`                                                           | `propertyId`, champs modifiés                   |
| `listing.created`, `listing.updated`, `listing.deleted`                                                              | `listingId`, `propertyId`, type ou champs       |
| `listing.published`, `listing.paused`, `listing.expired`, `listing.sold`, `listing.rented`, `listing.status_changed` | `listingId`, `propertyId`, `from`, `to`         |
| `listing.price_changed`                                                                                              | `listingId`, ancien et nouveau montant, période |

Les événements partent après la validation de la transaction. Ils serviront à l'indexation de recherche, aux notifications et aux recommandations. Étape suivante : une table outbox écrite dans la même transaction, relayée vers Kafka (ou Redis Streams) par un worker, pour ne perdre aucun événement si le processus s'arrête entre le commit et la publication.

Audit (`audit_logs`, dans la transaction) : `PROPERTY_CREATED`, `PROPERTY_UPDATED` (anciennes et nouvelles valeurs des champs modifiés), `PROPERTY_DELETED`, `OWNERSHIP_CHANGED`, `LISTING_CREATED`, `LISTING_UPDATED`, `LISTING_PUBLISHED`, `LISTING_PAUSED`, `LISTING_STATUS_CHANGED`, `PRICE_CHANGED`, `LISTING_DELETED`, avec IP, user agent et `request_id`.

Logs JSON (`listing.published`, `property.created`...) : identifiants publics et `request_id`, jamais d'adresse, de jeton ni de donnée personnelle. Métriques Prometheus : `property_created_total`, `property_deleted_total`, `listing_created_total{listing_type}`, `listing_status_changed_total{to}`, `listing_price_changed_total`.

## Médias

Le module n'accepte aucun fichier. Il lit la table `media` (nombre, couverture) pour les fiches. L'envoi passera par un module Media : URL présignée S3/R2, contrôle du type et de la taille, la base ne gardant que la clé de stockage.

## Expiration (à implémenter)

Tâche planifiée dans `services/workers` (BullMQ, répétition toutes les 15 minutes) :

1. sélectionner par lots de 500 `listings` `WHERE status = 'PUBLISHED' AND expires_at <= now() AND deleted_at IS NULL` (index partiel `listings_expiry_idx`), `FOR UPDATE SKIP LOCKED` ;
2. passer chaque annonce en `EXPIRED` avec une ligne d'historique (`changed_by_id` nul, motif `expired`) et un audit système ;
3. émettre `listing.expired` après validation.

`SKIP LOCKED` permet plusieurs workers sans double traitement. La matrice réserve déjà la transition `PUBLISHED → EXPIRED` à l'acteur `system`. Un rappel au propriétaire quelques jours avant l'échéance relèvera du module de notifications.

## Configuration

| Variable                        | Défaut  | Effet                                                  |
| ------------------------------- | ------- | ------------------------------------------------------ |
| `LISTING_MODERATION_REQUIRED`   | `false` | `true` : toute première publication passe par la revue |
| `LISTING_DEFAULT_DURATION_DAYS` | `90`    | Durée de publication sans échéance demandée (1 à 365)  |

## Données de développement

Le profil `development` du seed ajoute un compte AGENT fictif et deux jeux de données de référence : une villa à Cocody Riviera louée 1 500 000 XOF par mois (agent rattaché) et un terrain de 600 m² à Bingerville (Feh Kessé) vendu 50 000 000 XOF. Aucune donnée réelle.

## Tests

| Fichier                                 | Contenu                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/modules/property/domain/*.spec.ts` | complétude, transitions, coordonnées, attributs, confidentialité, décision d'accès                                 |
| `src/modules/listing/domain/*.spec.ts`  | matrice des transitions, issues par type, prix et périodes, publication, échéance                                  |
| `test/catalog/property.db-spec.ts`      | matrice d'autorisation, audit, dérogation admin, équipements, suppression, filtres, rayon 5 km, curseur            |
| `test/catalog/listing.db-spec.ts`       | cycle de vie, publication, unicité par type, modération, historique des prix et concurrence, recherche, événements |

`pnpm --filter @mon-appart/api test:db` les exécute sur `mon_appart_test`.

## Étapes suivantes

- Flux « devenir propriétaire / agent » et mandat : un propriétaire rattache un agent à son bien (aujourd'hui fait en base par un admin).
- Outbox et Kafka pour les événements ; worker d'expiration.
- Module Media (upload présigné) et Search (OpenSearch alimenté par les événements).
- Vérification juridique des titres fonciers et détection de fraude (hors périmètre).
