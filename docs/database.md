# Base de données

PostgreSQL 16 + PostGIS 3.5 est la source de vérité de Mon Appart. Redis n'est qu'un cache et un transport de files. Les fichiers (photos, vidéos, justificatifs) vivent dans S3/R2 ; la base ne garde que leurs métadonnées.

Schéma : `apps/api/prisma/schema.prisma`. Diagramme : [database-erd.md](./database-erd.md). Décision : [ADR 0003](./decisions/0003-database-model.md).

## Démarrage

```bash
pnpm docker:up                                   # PostgreSQL/PostGIS (5433), Redis (6380), pgAdmin (5050)
pnpm --filter @mon-appart/api db:migrate         # migrate deploy
pnpm --filter @mon-appart/api db:seed            # référentiels (+ données fictives en local)
```

| Base                | Usage                                           | Variable            |
| ------------------- | ----------------------------------------------- | ------------------- |
| `mon_appart`        | API, développement local                        | `DATABASE_URL`      |
| `mon_appart_test`   | Tests d'intégration base de données             | `TEST_DATABASE_URL` |
| `mon_appart_legacy` | Résidu historique (plus utilisé par `apps/web`) | —                   |

Staging et production ont chacun leur propre serveur et leurs propres identifiants, injectés par l'hébergeur. Aucune URL de staging ou de production n'est écrite dans le dépôt.

Le script `infrastructure/docker/init/01-postgis.sh` crée `mon_appart_legacy` et `mon_appart_test` sur un volume neuf. Sur un volume existant : `CREATE DATABASE mon_appart_test;` (aucune autre base n'est touchée).

## Organisation par domaine

| Domaine        | Tables                                                                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity       | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `auth_sessions`, `password_reset_tokens`, `otp_challenges`                                                                                                                                   |
| Location       | `countries`, `districts`, `cities`, `communes`, `neighborhoods`                                                                                                                                                                                                 |
| Property       | `property_types`, `properties`, `property_ownerships`, `amenities`, `property_amenities`                                                                                                                                                                        |
| Listing        | `listings`, `listing_prices`, `listing_status_history`                                                                                                                                                                                                          |
| Media          | `media`, `media_variants` (voir [media-management.md](./media-management.md))                                                                                                                                                                                   |
| Interaction    | `favorites`, `property_views`, `inquiries`, `appointments`                                                                                                                                                                                                      |
| Search         | `searches`, `listing_search_documents` (projection reconstructible, voir [search.md](./search.md))                                                                                                                                                              |
| Recommendation | `user_preferences` (+ 4 tables `user_preferred_*`), `user_behavior_profiles`, `recommendations`, `recommendation_feedback`                                                                                                                                      |
| Trust          | `verifications`, `verification_documents`, `verification_events`, `reports`, `report_events`, `trust_signals`, `trust_scores`                                                                                                                                   |
| Communication  | `conversations`, `conversation_participants`, `messages`, `message_attachments`, `notifications`, `notification_deliveries`, `notification_preferences`, `push_devices`                                                                                         |
| Analytics      | `analytics_events`, `analytics_daily_metrics`, `analytics_listing_daily`, `analytics_ingestion_stats`, `analytics_checkpoints`, `analytics_consents` (voir [analytics-and-tracking.md](./analytics-and-tracking.md))                                            |
| Admin          | `moderation_reasons`, `admin_notes` (voir [admin-backoffice-moderation.md](./admin-backoffice-moderation.md))                                                                                                                                                   |
| Billing        | `billing_products`, `billing_prices`, `billing_orders`, `payment_transactions`, `payment_events`, `payment_refunds`, `subscriptions`, `subscription_periods`, `billing_incidents` (voir [billing-payments-monetization.md](./billing-payments-monetization.md)) |
| Audit          | `audit_logs`                                                                                                                                                                                                                                                    |
| Events         | `user_events` (héritée, non alimentée : la mesure d'usage passe par `analytics_events`)                                                                                                                                                                         |
| Domain events  | `outbox_events`, `inbox_events` (ADR [0014](./decisions/0014-event-driven-outbox.md), [architecture événementielle](./architecture/event-driven-architecture.md))                                                                                               |

Règles structurantes :

- **Bien ≠ annonce.** `properties` décrit le bien physique, sans prix ni statut commercial. `listings` est l'offre (location, vente, courte durée, location-accession). Un bien peut avoir plusieurs annonces dans le temps, mais une seule annonce vivante (`PENDING_REVIEW`, `PUBLISHED`, `PAUSED`) par type.
- **Propriété historisée.** Pas de `properties.owner_id` : `property_ownerships` garde les propriétaires successifs. Les relations courantes ont `is_current = true`. `SOLE`, `JOINT` et `USUFRUCT` sont des droits réels ; `AGENT` et `MANAGER` (migration `20261008190000_property_listing`) représentent un mandataire, qui gère le bien sans pouvoir le supprimer. La base interdit seulement deux `SOLE` courants sur un même bien ; l'exclusion d'un `SOLE` et d'un `JOINT` simultanés reste à la charge de l'application. Règles d'accès : [property-listing.md](./property-listing.md).
- **Prix historisés.** `listing_prices` garde chaque prix ; le prix courant est la ligne sans `valid_to`, unique par annonce.
- **Trois tables de recommandation** : déclaré par l'utilisateur (`user_preferences`), déduit du comportement (`user_behavior_profiles`), produit par l'algorithme (`recommendations`), plus les retours de l'utilisateur (`recommendation_feedback`). Une recommandation référence `(listing_id, property_id)` vers `listings(id, property_id)` comme les demandes. Règles : [recommendation.md](./recommendation.md).
- **Demandes et visites cohérentes.** `inquiries` et `appointments` référencent `(listing_id, property_id)` vers `listings(id, property_id)` : l'annonce appartient forcément au bien. `owner_id` fige le destinataire au moment de la demande.

## Conventions

| Sujet           | Choix                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Clés            | `id` BIGINT (INTEGER pour les référentiels) en `GENERATED BY DEFAULT AS IDENTITY`, jamais exposé             |
| Identifiant API | `public_id UUID DEFAULT gen_random_uuid()`, unique                                                           |
| Nommage         | tables au pluriel, colonnes et contraintes en snake_case ; modèles Prisma en PascalCase via `@@map`          |
| Dates           | `TIMESTAMPTZ` partout ; `created_at` sur toutes les tables, `updated_at` sur les tables modifiables          |
| Suppression     | `deleted_at` (soft delete) sur `users`, `properties`, `listings`, `media`                                    |
| Argent          | `NUMERIC(14,2)` + `currency CHAR(3)` ISO 4217, `XOF` par défaut. Jamais de flottant                          |
| Surfaces        | `NUMERIC(10,2)` / `NUMERIC(12,2)` en m²                                                                      |
| Scores          | recommandation : `DOUBLE PRECISION` dans [0, 1] ; confiance : `NUMERIC(5,2)` dans [0, 100]                   |
| États           | enums PostgreSQL (statuts, types) ; catalogues administrables en tables (types de biens, équipements, lieux) |
| JSON            | `JSONB`, objet obligatoire (CHECK `jsonb_typeof = 'object'`), réservé aux données sans schéma stable         |
| Email           | `CITEXT`, unique parmi les comptes non supprimés                                                             |
| Téléphone       | E.164 (`+225...`), unique parmi les comptes non supprimés                                                    |

### `updated_at`

Un trigger `BEFORE UPDATE` appelle `set_updated_at()` sur chaque table qui a la colonne. Prisma n'utilise pas `@updatedAt` : la date reste juste quand une mise à jour passe par du SQL brut, un script ou un outil d'administration. Une nouvelle table avec `updated_at` doit recevoir son trigger dans sa migration ; le test `triggers.db-spec.ts` échoue sinon.

### Suppression et clés étrangères

- `CASCADE` seulement quand l'enfant n'a aucun sens sans le parent : rôles d'un utilisateur, favoris, notifications, préférences, recommandations, équipements d'un bien, vues d'un bien.
- `RESTRICT` pour l'historique et les données métier : prix, statuts d'annonce, propriétaires, médias, demandes, visites, vérifications.
- `SET NULL` pour les acteurs facultatifs : auteur d'un changement de statut, vérificateur, acteur d'audit, utilisateur d'un événement anonymisable.

Les utilisateurs, biens, annonces et médias se suppriment logiquement (`deleted_at`). Une suppression physique (droit à l'effacement) passera par une procédure dédiée qui anonymise d'abord.

### Ce qui n'est jamais stocké

Mot de passe en clair, JWT, refresh token en clair, secret applicatif, clé API, fichier binaire, URL présignée. `media` et `media_variants` ne contiennent que des clés de stockage, des métadonnées et, pour les variantes publiques, une URL CDN permanente. `password_hash` contient uniquement un hash Argon2id produit par l'application ; il est nul pour un compte OTP seul. `verifications.document_reference` est une clé de stockage S3/R2, pas le document.

Les tables d'authentification (`20261007200817_identity_auth`) ne contiennent que des empreintes HMAC-SHA256 (64 caractères hexadécimaux, vérifiés par CHECK) : `auth_sessions.token_hash` pour le refresh token, `password_reset_tokens.token_hash` pour le lien de réinitialisation, `otp_challenges.code_hash` et `destination_hash` pour le code et sa destination. Les CHECK imposent aussi `expires_at > created_at`, `revoked_at` et `revoked_reason` renseignés ensemble, et `0 ≤ attempts ≤ max_attempts ≤ 20`. Un test qui simule une expiration doit donc reculer `created_at` avec `expires_at`. Détails : [identity.md](./identity.md).

## Contraintes

Prisma exprime les clés, l'unicité (y compris partielle) et les index. Le reste est en SQL dans `20261007191500_constraints_and_triggers` :

- **CHECK** (67) : contact présent et formats email/téléphone, formats des codes de référentiels, surfaces et compteurs positifs, étage cohérent, coordonnées dans les bornes et renseignées par paire, montant positif, devise ISO 4217, périodes de validité ordonnées, annonce publiée datée, statut réellement modifié dans l'historique, taille de média positive, demande non adressée à soi-même, cohérence des fourchettes de recherche et de budget, rayon de recherche borné (1 m à 100 km), scores bornés, vérification de propriété liée à un bien, JSON objet.
- **Unicités partielles** : email et téléphone actifs, une annonce vivante par bien et par type, un prix courant par annonce, un propriétaire courant donné une seule fois, un seul propriétaire `SOLE` courant.
- **Audit append-only** : un trigger refuse tout `UPDATE` sur `audit_logs`. La suppression reste possible pour la rétention.

Prisma ne lit pas les CHECK ni les triggers : ils ne créent pas de dérive et ne seront jamais supprimés par une migration générée.

## Index

| Besoin                                                    | Index                                                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Recherche par rayon / carte                               | GIST `properties_geo_point_gist_idx`                                                          |
| Fil des annonces publiées                                 | partiel `(listing_type, published_at DESC) WHERE status = 'PUBLISHED' AND deleted_at IS NULL` |
| Lignes actives seulement                                  | partiels `WHERE deleted_at IS NULL` sur users, properties, listings, media                    |
| Prix courant / historique                                 | unique partiel `WHERE valid_to IS NULL`, `(listing_id, valid_from DESC)`                      |
| Notifications non lues                                    | partiel `(user_id) WHERE read_at IS NULL`                                                     |
| File de vérifications                                     | partiel `(created_at) WHERE status = 'PENDING'`                                               |
| Recommandations d'un utilisateur                          | `(user_id, score DESC)`                                                                       |
| Boîte de réception propriétaire                           | `(owner_id, status, created_at DESC)`                                                         |
| Tables d'événements (vues, recherches, événements, audit) | BRIN sur `created_at`, B-tree `(user_id, …) WHERE user_id IS NOT NULL`                        |
| Recherche plein texte / autocomplétion tolérante          | GIN `listing_search_documents_vector_idx` (tsvector), GIN trigrammes sur `suggest_text`       |

Chaque clé étrangère a un index (seul ou en tête d'un index composite). Pas d'index spéculatif : un index s'ajoute quand une requête réelle le justifie (`EXPLAIN ANALYZE`).

## PostGIS

- `properties.latitude` / `longitude` : `NUMERIC(9,6)` (environ 10 cm), valeurs saisies et exposées.
- `properties.geo_point` : `GEOGRAPHY(Point, 4326)` **générée** (`GENERATED ALWAYS AS … STORED`) depuis les deux colonnes. Elle ne peut pas diverger, l'application ne l'écrit jamais, et elle porte l'index GIST.
- `GEOGRAPHY` calcule les distances en mètres sur l'ellipsoïde, sans projection à choisir.

Recherche par rayon (5 km autour d'un point) :

```sql
SELECT id, ST_Distance(geo_point, origin) AS distance_m
FROM properties,
     LATERAL (SELECT ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography AS origin) o
WHERE deleted_at IS NULL
  AND ST_DWithin(geo_point, origin, 5000)
ORDER BY distance_m
LIMIT 50;
```

`ST_DWithin` utilise l'index ; `ST_MakePoint` prend la longitude en premier.

## Prisma : limites et contournements

| Limite                                         | Solution                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Pas de type `geography`                        | `Unsupported("geography(Point, 4326)")` en lecture seule ; requêtes spatiales en `$queryRaw` |
| Pas de colonne générée                         | colonne écrite en SQL dans la migration initiale ; `@default(dbgenerated())` évite la dérive |
| Pas de CHECK ni de trigger                     | migration SQL dédiée                                                                         |
| `IDENTITY` non généré                          | migration initiale ajustée avant sa première application (`BIGSERIAL` → `IDENTITY`)          |
| Prédicat d'index partiel comparé au texte près | prédicat écrit sous la forme normalisée par PostgreSQL (`status = ANY (ARRAY[...])`)         |

Fonctionnalités preview utilisées : `partialIndexes`, `postgresqlExtensions` (`postgis`, `citext`, `unaccent`, `pg_trgm`).

`listing_search_documents.search_vector` et `suggest_text` sont des colonnes générées (`Unsupported("tsvector")` et `@default(dbgenerated())`) : l'application ne les écrit jamais.

Le client utilise l'adaptateur `@prisma/adapter-pg`. Les identifiants `BigInt` sont des `bigint` JavaScript : ils ne doivent pas sortir de l'API (seul `public_id` est exposé).

## Migrations

```
apps/api/prisma/migrations/
  20261007143000_enable_postgis/          # extension postgis
  20261007190906_initial_schema/          # enums, tables, index, clés, IDENTITY, geo_point générée
  20261007191500_constraints_and_triggers/ # CHECK, set_updated_at(), audit append-only
  20261007200817_identity_auth/            # sessions, réinitialisations, OTP
  20261008190000_property_listing/         # confidentialité, attributs, catégories, mandats, index annonces
  20261008210000_search/                   # unaccent, pg_trgm, mon_appart_fr, projection de recherche
  20261009200000_recommendation/           # recommandations par annonce, retours, préférences étendues
  20261009230000_media_management/         # visibilité, file de traitement, purge, media_variants
  20261012170000_trust_enum_values/        # nouvelles valeurs d'enum (types, statuts, notification REPORT)
  20261012170100_trust_verification/       # dossiers, pièces, historiques, signalements, alertes, score
  20261012170200_trust_submitted_default/  # submitted_at par défaut pour les vérifications de contact
  20261012170300_notification_public_id/   # identifiant public des notifications
  20261012180000_trust_history_no_delete/  # historiques Trust protégés contre DELETE et TRUNCATE
  20261012190000_communication_enum_values/ # report de visite, média MESSAGE, signalement de message et de conversation
  20261012190100_messaging_notifications/   # conversations, messages, pièces jointes, livraisons, préférences, appareils push
  20261013090000_analytics/                 # événements, agrégats, consentements, checkpoints
  20261013093000_analytics_updated_at/      # triggers updated_at des tables Analytics
  20261013120000_admin_backoffice/          # motifs de modération, notes internes en ajout seul, index trigrammes sur les noms
  20261026120000_domain_outbox/             # outbox_events + inbox_events (événements de domaine)
```

`20261026120000_domain_outbox` est additive. Elle crée les enums `outbox_event_status` / `inbox_event_status`, `outbox_events` (fait métier unique par `event_id`, index de dispatch SKIP LOCKED) et `inbox_events` (déduplication `(consumer_name, event_id)`). Les files métier `notification_deliveries` et `partner_deliveries` restent distinctes. Détail : [transactional-outbox-pattern.md](./architecture/transactional-outbox-pattern.md).

`20261013120000_admin_backoffice` est additive : aucune donnée existante n'est modifiée. Elle crée l'enum `moderation_action`, `moderation_reasons` (code unique au format `^[A-Z][A-Z0-9_]{1,63}$`, libellé et message non vides, trigger `updated_at`) et `admin_notes` (cible `user` ou `listing`, corps non vide, trigger `admin_notes_reject_update` : ajout seul), ainsi que deux index GIN `pg_trgm` sur `users.first_name` et `users.last_name` pour la recherche du back-office. Les motifs de référence et les rôles `SUPPORT` et `ANALYST` viennent du seed.

Les migrations de messagerie sont additives (détails : [messaging-and-notifications.md](./messaging-and-notifications.md)). `20261012190100_messaging_notifications` :

- complète `notifications` (catégorie déduite du type pour l'existant, clé de regroupement unique par utilisateur, expiration) et `appointments` (conversation, demande, fuseau horaire, durée, proposition de report, confirmation, annulation, réalisation, rappel ; une seule visite active par annonce et client ; CHECK de cohérence) ;
- crée `conversations` (une par annonce et demandeur, compteur `last_seq`, fermeture datée), `conversation_participants` (`state` `ACTIVE` | `LEFT`, dernier message lu et distribué, archivage et sourdine par participant), `messages` (`seq` unique par conversation, `client_message_id` unique par auteur ; message `SYSTEM` sans auteur et avec code ; trigger `messages_reject_identity_change` qui interdit de changer la conversation, le rang, le type, la date ou l'auteur) et `message_attachments` (référence unique vers `media`, `RESTRICT`, jamais de binaire ; `media` en `MESSAGE` toujours privé) ;
- crée `notification_deliveries` (outbox : canal, statut, essais, prochaine tentative, identifiant fournisseur, code d'erreur court, repli via `fallback_from_id` ; une livraison par notification et par canal), `notification_preferences` (une ligne par utilisateur, catégorie et canal) et `push_devices` (jeton unique par son empreinte SHA-256, jamais renvoyé par l'API ni journalisé) ;
- étend `reports` à un message ou une conversation (CHECK `reports_target_chk` recréé : une cible exactement).

Les migrations Trust sont additives : `verifications`, `trust_scores`, `media` et `notifications` sont complétées, aucune ligne n'est supprimée. Les valeurs d'enum sont ajoutées dans une migration séparée, car PostgreSQL interdit de les utiliser dans la transaction qui les crée. `20261012170100_trust_verification` :

- complète `media` (`purpose` `PROPERTY` | `VERIFICATION`, `content_sha256`) : une pièce de vérification n'a pas de bien et reste privée (CHECK) ;
- complète `verifications` (cible annonce par clé composite vers `listings(id, property_id)`, rattachement revendiqué, priorité, affectation, déclaration et précontrôles en JSONB objet, dates de soumission et de décision, motif normalisé). Les dossiers existants sont considérés soumis à leur création et décidés à leur vérification. CHECK : motif obligatoire pour un complément, un rejet ou une révocation, échéance postérieure à la vérification, cible cohérente avec le type ;
- crée `verification_documents` (une référence unique par média, `RESTRICT`), `verification_events` et `report_events` (en ajout seul : trigger `reject_history_update`, seule l'anonymisation d'un acteur supprimé est tolérée), `reports` (une cible exactement, pas d'auto-signalement d'un utilisateur, `resolved_at` cohérent avec l'issue, mesure seulement une fois clos ; le service exige en plus la confirmation) et `trust_signals` (dédupliquées tant qu'elles sont ouvertes par un index unique partiel) ;
- complète `trust_scores` (facteurs, version, `is_complete` cohérent avec un score non nul).

`20261012180000_trust_history_no_delete` ajoute les triggers qui refusent `DELETE` et `TRUNCATE` sur ces deux historiques : la première migration ne bloquait que `UPDATE`.

`20261009230000_media_management` est additive. Elle s'arrête avec une erreur si un document (`type = 'DOCUMENT'`) a une URL, plutôt que de la supprimer en silence. Elle :

- ajoute les valeurs `UPLOADED` (`MediaStatus`) et `LOCAL` (`StorageProvider`), et les enums `MediaVisibility` et `MediaVariantKind` ;
- ajoute à `media` la visibilité (les documents existants passent à `PRIVATE`), l'auteur, le nom d'origine, les échéances d'envoi, les champs de file (`next_attempt_at`, `processing_attempts`, `processing_error`), `metadata` (JSONB objet) et la purge (`purge_after`, `purged_at`) ;
- impose par CHECK : document toujours privé, média privé sans URL, essais bornés, purge seulement après suppression ;
- crée `media_variants` (une variante par type et par média, clé de stockage unique, variante privée sans URL), en `CASCADE` depuis `media` ;
- crée les index partiels de la file (`media_job_due_idx`), des sessions à expirer et des purges échues.

`20261013150000_billing_subscriptions` ne fait que des ajouts : enums, neuf tables de facturation, index partiels d'unicité (une commande `PENDING` par acheteur, une tentative ouverte par commande, un abonnement courant par compte, un plan par défaut, un incident ouvert par type et transaction), CHECK de format et de bornes (montants entiers positifs plafonnés, devise ISO, `refunded_amount <= amount`), triggers `BEFORE DELETE` qui refusent toute suppression, et triggers de garde qui figent le contenu des prix, des commandes et des transactions. Aucune table existante n'est modifiée.

`20261009200000_recommendation` s'arrête avec une erreur si `recommendations` contient des lignes : la colonne `listing_id` devient obligatoire et aucune donnée n'est supprimée ni devinée. Elle ajoute à `recommendations` :

- `public_id`, `listing_id`, `context` (`PERSONALIZED` | `SIMILAR`) et `rank`, avec une clé étrangère composite vers `listings(id, property_id)` (`CASCADE`) ;
- une unicité `(user_id, listing_id, context, algorithm_version)`, qui remplace `(user_id, property_id, algorithm_version)`.

Elle crée la table `recommendation_feedback` (un retour de chaque type par recommandation). Elle ajoute enfin à `user_preferences` les colonnes suivantes, avec leurs CHECK nommés :

- types d'offre, période et tolérance de budget (0 à 30 %) ;
- chambres, salles de bain et fourchette de surface ;
- point de référence et rayon.

`20261008210000_search` crée les extensions `unaccent` et `pg_trgm`, la fonction IMMUTABLE `search_normalize()` (minuscules, sans accents), la configuration plein texte `mon_appart_fr` (french + unaccent) et la table `listing_search_documents` (clé = `listing_id`, `ON DELETE CASCADE`, `quality_score` borné par CHECK). Aucune table existante n'est modifiée. La table est une projection : la vider puis lancer `search:reindex` la reconstruit entièrement.

`20261008190000_property_listing` n'ajoute que des colonnes avec défaut, des valeurs d'enum et des index. Elle remplace `listing_prices_amount_chk` (`amount >= 0`) par `listing_prices_amount_positive_chk` (`amount > 0`), sans ligne existante concernée.

Les noms gardent l'horodatage Prisma plutôt qu'une numérotation `0001_` : l'ordre est garanti et deux branches ne se disputent pas le même numéro.

Règles :

- Développement : `pnpm --filter @mon-appart/api db:migrate:dev --name <nom>` crée et applique une migration. Relire le SQL avant de committer.
- Staging et production : `prisma migrate deploy` uniquement, jamais `migrate dev`, `db push` ni `migrate reset`.
- Une migration appliquée n'est jamais modifiée ni supprimée. Toute correction passe par une nouvelle migration.
- Changement risqué sur une table volumineuse : en plusieurs étapes (ajout nullable, backfill par lots, contrainte `NOT VALID` puis `VALIDATE`, index `CONCURRENTLY` dans une migration séparée).
- Vérifier l'absence de dérive : `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` doit produire une migration vide.

## Seed

`apps/api/prisma/seed.ts`, idempotent (upsert, `createMany … skipDuplicates`), sans aucune suppression.

| Profil        | Contenu                                                                                                                                                                                                                            | Par défaut sur                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `reference`   | Côte d'Ivoire, District d'Abidjan, Abidjan, 12 communes et leurs principaux quartiers, 10 rôles, les permissions et leur matrice, 11 types de biens, 12 équipements catégorisés, 8 motifs de modération                            | production, staging, base `*_test` |
| `development` | `reference` + 3 utilisateurs fictifs (OWNER, CUSTOMER, AGENT), 4 biens géolocalisés dont la villa de Cocody Riviera (location 1 500 000 XOF/mois) et le terrain de Bingerville (vente 50 000 000 XOF), annonces publiées avec prix | poste local                        |

`SEED_PROFILE` force le profil. Le profil `development` est refusé si `NODE_ENV=production` ou `APP_ENV` vaut `production` ou `staging`. Le seed ajoute les associations rôle-permission manquantes mais n'en retire jamais : un retrait de droit passe par une migration de données explicite.

Anyama et Bingerville sont des sous-préfectures du District ; elles sont rattachées à la ville d'Abidjan pour la navigation, comme les dix communes.

## Base de test

- Base dédiée `mon_appart_test`, désignée par `TEST_DATABASE_URL`. Son nom doit finir par `_test`.
- `pnpm --filter @mon-appart/api db:test:migrate` applique les migrations et le seed `reference`.
- `pnpm --filter @mon-appart/api db:test:reset` recrée le schéma. Le script refuse si la base ne finit pas par `_test`, si elle est identique à `DATABASE_URL`, ou si l'environnement est `production`/`staging`. Prisma demande en plus une confirmation humaine quand la commande est lancée par un agent IA.
- `pnpm --filter @mon-appart/api test:db` lance `test/database/*.db-spec.ts` (chaque test dans une transaction annulée : la base reste propre sans reset), puis `test/identity` et `test/catalog`, qui passent par l'API et créent des comptes et des biens uniques à chaque exécution.

Les tests couvrent les contraintes (prix négatif, double prix courant, devise invalide, favori en double, annonce d'un autre bien, demande à soi-même, double annonce vivante, double propriétaire unique, suppression d'un bien annoncé, score hors bornes, email en double insensible à la casse), PostGIS (extension, index GIST, colonne générée, écriture interdite, recherche par rayon) et les triggers.

La CI démarre `postgis/postgis:16-3.5`, applique `db:test:migrate`, lance `test:db`, puis vérifie l’absence de dérive `prisma migrate diff`.

## Connexions et pool

L'API ouvre au plus 10 connexions par instance (adaptateur `pg`). Au-delà de quelques instances, PgBouncer en mode transaction s'intercale entre l'API et PostgreSQL ; les migrations passent alors par une URL directe, sans pooler.

## Volumétrie, partitionnement et rétention

`property_views`, `searches`, `user_events` et `audit_logs` ont une clé primaire `(id, created_at)` et un index BRIN sur `created_at`. Elles peuvent devenir des tables partitionnées par mois (déclaratif, `PARTITION BY RANGE (created_at)`) sans changer de clé ni de requêtes.

| Table                     | Rétention cible                                                         |
| ------------------------- | ----------------------------------------------------------------------- |
| `user_events`             | 13 mois détaillés, puis agrégats                                        |
| `analytics_events`        | `ANALYTICS_RETENTION_DAYS` (395 j), purge par lots ; agrégats conservés |
| `property_views`          | 13 mois détaillés, puis compteurs par bien                              |
| `searches`                | 6 mois                                                                  |
| `audit_logs`              | 5 ans minimum (à valider juridiquement)                                 |
| `notifications`           | 6 mois après lecture                                                    |
| `notification_deliveries` | 90 jours après l'état final                                             |
| `recommendations`         | suppression des lignes expirées (`expires_at`)                          |

La purge se fera par `DROP` de partitions anciennes, pas par `DELETE` massif.

## Sauvegardes et reprise

- **PITR** : sauvegarde de base quotidienne + archivage continu des WAL (service managé ou pgBackRest), rétention 14 à 30 jours.
- **Réplication** : un réplica en streaming dans une autre zone ; il sert aussi aux lectures analytiques.
- **Objectifs initiaux** : RPO ≤ 5 minutes, RTO ≤ 1 heure.
- **Test de restauration** mensuel sur une base isolée ; une sauvegarde jamais restaurée n'est pas une sauvegarde.
- Les fichiers S3/R2 ont leur propre versionnement ; la base ne contient que leurs clés.

## Croissance

| Palier                           | Actions                                                                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~100 000 utilisateurs            | Une instance PostgreSQL bien dimensionnée suffit. PgBouncer, réplica de lecture, suivi `pg_stat_statements`.                                                                                                |
| ~1 million d'utilisateurs        | Partitionnement mensuel des tables d'événements, purge par partition, réplicas pour la recherche et l'analytics, OpenSearch pour la recherche plein texte et facettée (alimenté depuis PostgreSQL).         |
| 10 millions d'événements et plus | `user_events` déporté vers un flux (Kafka ou équivalent) et un entrepôt analytique ; PostgreSQL ne garde que les agrégats utiles au produit. Le sharding n'est envisagé qu'après épuisement de ces leviers. |
