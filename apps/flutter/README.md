# Mon Appart — application Flutter

Socle mobile Android et iOS. Il consomme l’API NestJS (`apps/api`), pas le prototype Next.js.

L’application Expo existante (`apps/mobile`) n’est **pas** remplacée : voir [ADR 0016](../../docs/decisions/0016-flutter-mobile-foundation.md).

## Prérequis

| Outil       | Version vérifiée lors de l’initialisation                                |
| ----------- | ------------------------------------------------------------------------ |
| Flutter     | 3.47.8 (stable)                                                          |
| Dart        | 3.13.7                                                                   |
| Android SDK | 36.1.0 (min SDK Flutter par défaut)                                      |
| iOS         | 15.0 (fichiers générés). **Compilation iOS : macOS + Xcode uniquement.** |

```bash
flutter doctor
```

## Structure

```
apps/flutter/
  lib/
    app/          # bootstrap, config, thème, router, providers
    core/         # HTTP, erreurs, auth, listing, widgets DS
    features/     # splash, accueil, explorer, assistant, comparaison, fiche, favoris, notifs, messagerie, visites, espace pro, publication, compte
  test/
  config/         # exemples --dart-define-from-file (non secrets)
  android/
  ios/
```

## Choix d’architecture

| Sujet      | Choix                    | Pourquoi                                                       |
| ---------- | ------------------------ | -------------------------------------------------------------- |
| État       | Riverpod 3               | Une seule solution, overrides de test, pas de singleton global |
| Navigation | go_router                | Déclarative, prête pour les liens profonds                     |
| HTTP       | Dio derrière `ApiClient` | Timeouts, interceptors, tests par doublure                     |
| Session    | `flutter_secure_storage` | Jetons Identity hors préférences ordinaires                    |
| Config     | `--dart-define`          | Pas de `.env` embarqué, échec explicite si URL absente         |

Les fonctionnalités n’appellent pas Dio. Les règles métier restent côté Nest.

## Configuration

Variables de compilation (non secrètes, extractibles du binaire) :

| Clé                   | Obligatoire          | Exemple local                                                                                                                      |
| --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `API_BASE_URL`        | oui                  | `http://10.0.2.2:4000` (émulateur Android)                                                                                         |
| `APP_ENV`             | non (défaut `local`) | `local` \| `staging` \| `production`                                                                                               |
| `ENABLE_NETWORK_LOGS` | non                  | `true` en local ; **forcé à false en production**                                                                                  |
| `PUBLIC_WEB_HOST`     | non                  | Hôte public du site (`www.exemple.ci`), **sans** schéma. Vide = pas d’App Links / pas d’URL de partage. Ne pas mettre `localhost`. |
| `MAP_TILE_URL`        | non                  | Gabarit de tuiles `{z}/{x}/{y}`. Vide = OpenStreetMap. Pas un secret.                                                              |

En production, `API_BASE_URL` doit être en **HTTPS**. TLS n’est jamais désactivé.

Exemples versionnés (placeholders, pas des URL opérationnelles) :

- `config/local.example.json`
- `config/staging.example.json`
- `config/production.example.json`

```bash
# Émulateur Android, API locale sur le port 4000
flutter run --dart-define-from-file=config/local.example.json

# Simulateur iOS (macOS) : l’hôte 10.0.2.2 ne s’applique pas
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000 --dart-define=APP_ENV=local --dart-define=ENABLE_NETWORK_LOGS=true
```

Sans `API_BASE_URL`, l’application affiche l’écran « Configuration API manquante ».

L’API Nest doit tourner (`pnpm --filter @mon-appart/api dev`). L’accueil appelle **`GET /api/v1/search?sort=NEWEST`** et **`GET /api/v1/recommendations`**. L’assistant (`/assistant`) appelle **`POST /api/v1/ai-assistant/search`** puis **`/conversations/:id/messages`**. La sonde **`GET /health/live`** reste disponible pour les tests de connectivité, mais n’est plus l’écran d’accueil.

## Commandes

Depuis `apps/flutter` :

```bash
flutter pub get
dart format --output=none --set-exit-if-changed .
flutter analyze
flutter test
flutter run --dart-define-from-file=config/local.example.json
flutter build apk --debug --dart-define-from-file=config/local.example.json
```

Compilation iOS (macOS uniquement) :

```bash
flutter build ios --no-codesign --dart-define-from-file=config/local.example.json
```

## Identifiants natifs

| Plateforme              | Identifiant généré        |
| ----------------------- | ------------------------- |
| Android `applicationId` | `ci.monappart.mon_appart` |
| iOS bundle              | `ci.monappart.monAppart`  |
| Nom affiché             | Mon Appart                |

Permissions déclarées : `INTERNET`, `POST_NOTIFICATIONS` (Android 13+). La permission de notification n’est **pas** demandée au premier lancement : uniquement depuis le centre de notifications, après explication. Schéma d’application `monappart://` (Android intent-filter + iOS `CFBundleURLTypes`). **Pas** d’App Links / Universal Links : aucun domaine n’est associé ni vérifié.

## Sécurité

- Pas de secret dans le dépôt ni dans `--dart-define`.
- Access / refresh tokens : Keystore / Keychain uniquement.
- Header mobile : `Authorization: Bearer` ; **ne pas** envoyer `X-Auth-Transport: cookie`. Le `refreshToken` doit être présent dans le JSON, sinon la session n’est pas persistée.
- Refresh : `POST /api/v1/auth/refresh` avec `{ refreshToken }` sur un client Dio **sans** interceptor, un seul vol à la fois. Uniquement si la réponse métier est `401 TOKEN_EXPIRED`.
- Les `POST /api/v1/conversations` **et tous les POST sous** `/api/v1/conversations/` (messages, lecture, signalement) ainsi que `POST /api/v1/appointments` ne sont **pas** rejoués après refresh. L’idempotence d’envoi repose sur `clientMessageId` (UUID v4).
- Un `401` `TOKEN_EXPIRED` / `TOKEN_INVALID` / `SESSION_REVOKED` / `UNAUTHENTICATED` n’efface la session locale qu’après échec du renouvellement (ou si le code n’est pas renouvelable).
- Inscription mobile : `accountType=CUSTOMER` uniquement. Mot de passe min. 10 caractères (règles Nest).
- `forgot-password` : message générique identique, que le compte existe ou non. Pas de liens universels configurés : le jeton se colle sur `/reset-password`.
- OTP e-mail / SMS : `POST /auth/email|phone/verify/request|confirm` (session requise). Les codes ne sont pas stockés. Un compte `PENDING` peut déjà utiliser l’app.
- Les journaux masquent `Authorization`, cookies, jetons, `identifier`, OTP et mots de passe.

## Recherche (Explorer)

`GET /api/v1/search` — critères dans `ExploreQuery`, pagination curseur (`pagination.nextCursor` / `hasMore`).

| Paramètre Nest                                      | UI                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `q`                                                 | Champ texte, soumis au clavier (pas d’interprétation NL)                 |
| `listingType`, `propertyType`                       | Filtres multi-valeurs (codes seed)                                       |
| `city`, `commune`, `neighborhood`                   | Abidjan + communes du seed                                               |
| `minPrice`, `maxPrice`                              | Budget XOF entier                                                        |
| `bedrooms`, `bathrooms`, `minSurface`, `maxSurface` | Caractéristiques                                                         |
| `amenities`                                         | Équipements du seed                                                      |
| `sort`                                              | RELEVANCE, NEWEST, PRICE__, SURFACE__ — **pas DISTANCE** (exige lat/lng) |
| `cursor`, `limit`                                   | Chargement progressif, page de 20                                        |
| `submit=true`                                       | Uniquement lors d’une recherche validée (pas au load-more)               |

Le total n’est affiché que si `total.strategy` est `exact` ou `estimated`.

**Non branché (contrat Nest existant, hors UI)** : `lat` / `lng` / `radius`, tri `DISTANCE`, `minLandSurface` / `maxLandSurface` (Nest applique déjà `minSurface` au terrain nu), `maxBedrooms`, `amenitiesMode`, `facets`, `GET /search/suggestions`, filtre « vérifié ».

## Compte et préférences

L’onglet Compte consomme Identity et les modules Nest déjà exposés. Pas de second moteur de recommandation dans Flutter.

| Écran                         | Contrat                                                                                  | Notes                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Profil                        | `GET /auth/me`                                                                           | Nom affiché, e-mail / téléphone avec statut `*Verified` réel                                                      |
| Édition                       | `PATCH /auth/me` `{ firstName, lastName }`                                               | E-mail et téléphone en lecture seule (`/auth/email\|phone/change` absents)                                        |
| Préférences                   | `GET` / `PUT /recommendations/preferences`                                               | Remplacement complet, devise XOF, périodicité déduite ou saisie, pas de GPS                                       |
| Favoris                       | `GET /interactions/favorites`, `POST`/`DELETE /interactions/favorites/:listingId`        | Cœur sur cartes + fiche ; liste titre uniquement (payload Nest sans prix/photo). Optimistic + rollback            |
| Recherches enregistrées       | `GET`/`POST /saved-searches`, `PATCH`/`DELETE /:id`, `POST /:id/resume`                  | Création depuis Explorer, relance via `params` (pas `resumePath` web), `sort`/`limit` exclus                      |
| Alertes                       | champs `alertsEnabled` + `frequency` (`DAILY` \| `WEEKLY` \| `PAUSED`)                   | Pas d’API `/alerts`, pas d’envoi immédiat. `q` seul n’est pas alertable                                           |
| Inbox                         | `GET /notifications` (curseur), `GET /unread-count`, `PATCH /:id/read`, `POST /read-all` | Catégories Nest, dates, badge, pagination curseur, lecture optimiste + rollback. Pas d’API de suppression         |
| Préférences de notif          | `GET` / `PUT /notification-preferences`                                                  | Cellules catégorie × canal ; `locked` / `!available` non commutables. Permission OS demandée sur l’inbox, pas ici |
| Appareils push                | `POST` / `DELETE /push-devices`                                                          | Jeton enregistré seulement s’il existe (FCM absent → no-op). Jamais journalisé. Désinscription avant logout       |
| Mot de passe                  | `POST /auth/change-password`                                                             | Autres sessions révoquées côté Nest                                                                               |
| Sessions                      | `GET /auth/sessions` (tableau), `DELETE /auth/sessions/:id`                              | Session courante non révocable ici                                                                                |
| Déconnexion globale           | `POST /auth/logout-all`                                                                  | Efface aussi la session locale                                                                                    |
| Photo / suppression de compte | absents                                                                                  | Documentés dans Confidentialité, aucun succès fictif                                                              |

Après un `PUT` préférences, le fil `GET /recommendations` de l’accueil est invalidé. Le classement reste calculé par Nest (`meta.level`).

## Fiche détaillée

`GET /api/v1/listings/:id` (OptionalAuth, 404 si non publiée). Galerie : `GET /api/v1/properties/:propertyId/media`. Badges : `GET /api/v1/trust/listings/:id/badges`. Similaires : `GET /api/v1/recommendations/similar/:id`. Consultation comportementale : `POST /api/v1/interactions/views` (non bloquant).

| Action  | Contrat                                                                                                                  | Sans session                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Favori  | `POST` / `DELETE /interactions/favorites/:listingId`                                                                     | Aucun appel, parcours login + `next`                                     |
| Contact | `POST /conversations` `{ listingId, message, clientMessageId }` → ouvre `/conversations/:id`                             | Aucun appel, parcours login + `next`                                     |
| Visite  | `POST /appointments` `{ listingId, scheduledAt, timezone: Africa/Abidjan }` — statut `PENDING`, puis `/appointments/:id` | Aucun appel, parcours login + `next`                                     |
| Partage | Feuille native (titre, prix, localisation)                                                                               | URL `https://{PUBLIC_WEB_HOST}/biens/:id` seulement si l’hôte est fourni |

Les badges Trust sont affichés avec leur libellé factuel et le disclaimer API. Pas de téléphone, WhatsApp, carte, ni lecteur vidéo.

## Messagerie

Contrats Nest du module `communication` — pas de second backend.

| Écran / action           | Contrat                                                                                 | Notes                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Liste `/messages`        | `GET /conversations` (curseur, `archived`), `GET /conversations/unread-count`           | Compte → tuile Messages. Pas d’onglet supplémentaire.                                                                              |
| Fil `/conversations/:id` | `GET /conversations/:id`, `GET /:id/messages` (`before` historique, `after` rattrapage) | Ordre `seq`. Pagination des plus anciens.                                                                                          |
| Envoi                    | `POST /:id/messages` `{ body, clientMessageId }`                                        | Pas d’envoi tant que Nest n’a pas répondu. Un timeout réutilise le même `clientMessageId`.                                         |
| Lecture                  | `POST /:id/read` `{ upToSeq }`                                                          | Uniquement à l’ouverture du fil, jamais depuis la liste.                                                                           |
| Contexte bien            | `listing` de la conversation (`id`, `title`, `listingType`, `status`)                   | Pas de photo / prix / localisation dans ce DTO : rien n’est inventé.                                                               |
| Signalement              | `POST /conversations/:id/report` `{ reason, description? }`                             | Trust. Pas d’API de blocage d’un pair.                                                                                             |
| Archive / sourdine       | `PATCH /:id/archive`, `PATCH /:id/mute`                                                 | Propres à l’utilisateur.                                                                                                           |
| Temps réel               | Socket.IO namespace `/realtime`, `auth.token`                                           | Événements `message:new`, `conversation:updated`, `conversation:unread_count` → rattrapage REST `after=`. Ce n’est pas du polling. |

Pièces jointes : le pipeline Media (URL présignée + `complete` + `attachmentIds`) existe côté Nest. L’app affiche le type / nom / `ready` d’une pièce déjà présente ; **l’envoi de fichiers n’est pas branché** dans ce lot (stockage objet + PUT natif).

## Visites

Contrats Nest `appointments` — pas de créneaux inventés, pas de confirmation automatique.

| Écran / action             | Contrat                                                     | Notes                                                                                      |
| -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Demande fiche              | `POST /appointments` `{ listingId, scheduledAt, timezone }` | Statut `PENDING`. Préavis 60 min, horizon 90 jours (`VisitRules` = Nest `checkVisitTime`). |
| Liste `/visits`            | `GET /appointments?scope=upcoming\|past&limit=`             | Compte → tuile Mes visites. Liste chronologique groupée par jour. Pas de calendrier tiers. |
| Détail `/appointments/:id` | `GET /appointments/:id`                                     | Remplace l’écran « bientôt ». Actions uniquement depuis `actions[]`.                       |
| Confirmer                  | `POST /:id/confirm`                                         | Côté annonce sur `PENDING`, autre partie sur `RESCHEDULE_REQUESTED`.                       |
| Reporter                   | `POST /:id/reschedule` `{ scheduledAt }`                    | Passe en `RESCHEDULE_REQUESTED`, pas confirmé.                                             |
| Annuler                    | `POST /:id/cancel` `{ reason }`                             | Motifs `SCHEDULE_CONFLICT` / `NO_LONGER_INTERESTED` / `PROPERTY_UNAVAILABLE` / `OTHER`.    |
| Effectuée / absent         | `POST /:id/complete`, `POST /:id/no-show`                   | Côté annonce, après l’heure prévue.                                                        |
| Retour                     | `POST /:id/feedback`                                        | Prospect après `COMPLETED`. Note privée non collectée ici.                                 |
| 409 déjà actif             | `APPOINTMENT_ALREADY_ACTIVE`                                | Ouverture de la visite existante si elle est retrouvée en `upcoming`.                      |
| Temps réel                 | `appointment:updated`                                       | Indice Socket.IO puis relecture REST. Pas une preuve de confirmation.                      |

DTO listing de visite : `id` + `title` seulement — pas de photo, prix ni localisation inventés. Rappels : worker Nest (`APPOINTMENT_REMINDER_HOURS`), **aucun rappel local** sur l’appareil. Pas d’API de disponibilités / créneaux : le date picker envoie un instant, Nest tranche.

## Espace professionnel (propriétaire / agence / agent)

Pas de 6ᵉ onglet. Accès depuis Compte si `roles` contient `OWNER`, `AGENCY` ou `AGENT` (`AuthUser.isPublisher`). Un particulier qui ouvre `/pro` voit un état vide, sans appel CRM. L’autorisation réelle reste Nest.

| Écran                        | Contrat                                                         | Notes                                                                                                           |
| ---------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tableau de bord `/pro`       | `GET /inquiries/dashboard`                                      | Fenêtre CRM **7 jours** (Nest). Taux `null` affichés `—`, jamais 0 inventé.                                     |
| Audience                     | `GET /analytics/me/listings?from&to`                            | Filtres 7 / 30 / 90 jours **uniquement** sur ces stats. Page vide si pas `analytics:read`.                      |
| Mes annonces `/pro/listings` | `GET /listings?scope=mine`                                      | DTO privé `id` / `coverUrl` / `status` (pas le DTO search). Filtres `status`, `listingType`.                    |
| Actions gestionnaire         | `POST /listings/:id/publish\|pause\|status`                     | Transitions manager (`ListingManagerActions`). Confirmation avant pause / loué / vendu / archive.               |
| Publication `/publish`       | `POST /properties` (DRAFT) puis `POST /listings` `{propertyId}` | Formulaire multi-étapes. Pas de création d'annonce sans bien.                                                   |
| Prospects `/pro/leads`       | `GET /inquiries`                                                | CRM des demandes (contact + visite). Pas de duplication conversation / visite. Recherche `q` = titre d’annonce. |
| Fiche `/pro/leads/:id`       | `GET` / `PATCH /inquiries/:id`, `POST /:id/notes`               | Stages `InquiryStageRules` = Nest `canTransitionInquiryStage`. Note interne jamais envoyée au prospect.         |
| Visites / messages           | écrans existants                                                | Raccourcis uniquement.                                                                                          |

Compteurs d’audience absents du DTO `scope=mine` : non inventés sur les cartes.

## Carte immobilière (Explorer)

Vue liste et vue carte partagent `ExploreQuery` (`/explore?view=map`).

| Sujet         | Contrat réel                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Recherche     | `GET /api/v1/search` avec `lat`, `lng`, `radius` (km, défaut 10, max 50). **Pas de bbox / cluster Nest.** |
| Marqueurs     | Uniquement `location.latitude/longitude` publics (`precision` ≠ `NONE`).                                  |
| Distance      | Champ Nest `distance.value` (km), affichée « à vol d'oiseau ». Jamais un trajet.                          |
| Tuiles        | OSM par défaut, ou `MAP_TILE_URL`. Aucune clé Google/Mapbox dans le dépôt.                                |
| Autour de moi | Permission à la demande (`ACCESS_*_LOCATION` / `NSLocationWhenInUse`). Pas de suivi arrière-plan.         |

## Hors ligne et synchronisation

Pas d’API Nest de sync incrémentale (pas de curseur, pas d’ETag métier, pas de file serveur). Le téléphone conserve un **cache JSON** (`path_provider`, fichier `offline-cache.json`) distinct du trousseau (`flutter_secure_storage` pour les jetons).

| Donnée                                | Lecture hors ligne                | Écriture différée                           | Source de vérité                       |
| ------------------------------------- | --------------------------------- | ------------------------------------------- | -------------------------------------- |
| Fiches consultées (max 30, 7 jours)   | oui, libellé « peut être périmé » | non                                         | `GET /listings/:id`                    |
| Accueil (dernière page NEWEST + reco) | oui si déjà chargée               | non                                         | `GET /search`, `GET /recommendations`  |
| Favoris                               | oui                               | `POST/DELETE` file locale                   | `GET /interactions/favorites`          |
| Shortlist                             | oui (locale, pas Nest)            | disque uniquement                           | appareil                               |
| Recherches enregistrées               | critères oui                      | création/suppression **en ligne**           | `GET /saved-searches`                  |
| Préférences                           | oui                               | `PUT` file locale                           | `GET/PUT /recommendations/preferences` |
| Visites                               | dernier statut connu              | confirmer / annuler / demander **en ligne** | `GET /appointments`                    |
| Messagerie, publication, paiement     | non                               | non                                         | serveur                                |

File d’attente : coalescence par `(userId, type, entityId)`, max 5 essais sur erreur temporaire (`NetworkFailure`, timeout, 429/502/503/504). Une action n’est marquée synchronisée qu’après réponse Nest. 401 arrête la file. Changement de compte : les opérations d’un autre `userId` ne partent pas.

Sonde réelle : `GET /health/live` (déjà dans le dépôt). Un Wi‑Fi sans API n’est pas affiché comme « en ligne ». Pas de tâche OS en arrière-plan : synchro au premier plan et au retour de connexion.

## Tournée de visites

Pas d’API Nest d’itinéraire, de trafic ni de géocodage. Les rendez-vous (`GET /appointments`) n’embarquent que `listing.id` + `title` : les coordonnées viennent de `GET /listings/:id`.

| Écran          | Contrat                                | Notes                                                                                           |
| -------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/visits/tour` | visites upcoming + fiches publiques    | Ordre = horaires Nest. Conflits = chevauchement `scheduledAt` + `durationMinutes`.              |
| Distances      | Haversine client                       | Affichées « à vol d’oiseau ». **Pas** un trajet routier.                                        |
| Navigation     | URL `https://www.google.com/maps/dir/` | `url_launcher`, allowlist d’hôtes. Ouvrir Maps ≠ guidage dans l’app.                            |
| Fiche          | bouton Itinéraire                      | Uniquement si `precision` ≠ `NONE` et coords valides. Position `APPROXIMATE` : libellé honnête. |

Shortlist optionnelle = étapes prévisionnelles, jamais des visites confirmées. L’assistant n’invente ni tournée ni temps de trajet.

## Publication d’annonces

Le backend distingue le **bien** (`Property`, créé `DRAFT`) et l’**annonce** (`Listing`). Flutter n’invente pas de statut : `POST /listings/:id/publish` renvoie `PUBLISHED` ou `PENDING_REVIEW` selon `LISTING_MODERATION_REQUIRED`.

| Étape               | Contrat                                                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types / équipements | `GET /property-types`, `GET /amenities` (tableaux). Repli seed `SearchCatalog` si la lecture échoue.                                                                                                                   |
| Localisation        | Communes / quartiers du seed (aucun `GET /communes`). Coordonnées facultatives pour le brouillon, **obligatoires pour publier**. Points approximatifs uniquement pour les quartiers du seed de démo.                   |
| Brouillon           | `POST /properties` + `POST /listings` puis `PATCH` / `PUT /price` / `PUT /amenities`. Statut Nest `DRAFT`, pas de CRM local.                                                                                           |
| Photos              | `POST /media/upload-sessions` → PUT URL présignée (octets exacts, sans Bearer Nest) → `POST .../complete`. Ordre / principale / suppression : `PATCH/DELETE /properties/:id/media`. JPEG/PNG/WebP/AVIF, 15 Mo, 30 max. |
| Publication         | Bien `ACTIVE` et complet, prix courant, puis `POST /listings/:id/publish`.                                                                                                                                             |
| Corrections         | `GET /listings/:id/history` (`reason`). Retrait `PENDING_REVIEW` → `DRAFT` via `POST /status`.                                                                                                                         |

Devise : **XOF** entier. Un montant vide n’est jamais envoyé comme 0. Périodes Nest : SALE=`TOTAL`, RENT=`MONTH`/`YEAR`, SHORT_TERM_RENT=`DAY`/`WEEK`/`MONTH`, LEASE_TO_OWN=`MONTH`.

## Limites de ce lot

## Comparaison et shortlist

Aucune API Nest de shortlist / collections : la sélection de comparaison est **locale à la session Riverpod** (max 4, pas de synchronisation multi-appareils). Distincte des favoris (`GET/POST/DELETE /interactions/favorites`).

| Écran                    | Contrat                                                 | Notes                                                                                                                         |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/compare`               | `GET /listings/:id` + `GET /trust/listings/:id/badges`  | Tableau déterministe. Préférences `GET /recommendations/preferences` si session.                                              |
| Fiche / favoris / compte | ajout / retrait local                                   | SnackBar honnête : « non synchronisée ».                                                                                      |
| Assistant                | `POST /ai-assistant/conversations/:id/compare` inchangé | Compare Nest = IDs déjà dans la conversation. « Tableau de comparaison » copie les IDs sélectionnés vers la shortlist locale. |

Règles : même devise + même périodicité pour comparer les prix ; loyer ≠ prix de vente ; prix/m² seulement si montant > 0 et surface > 0 ; champ absent = « Information non renseignée » (jamais 0) ; un bien hors budget n’est jamais présenté comme meilleur choix. Pas de score inventé.

- Assistant `/assistant` : client de `POST /api/v1/ai-assistant/*`. NLU, clarifications et Search restent côté Nest. Pas de parseur NLP Flutter, pas de second moteur de recommandation. Conversations process + TTL Nest (pas d’historique Postgres). Header `x-assistant-session` en mémoire d’exécution seulement.
- Recherche textuelle classique Explorer : `GET /search` inchangé. L’assistant peut ouvrir les mêmes filtres via `searchParams`.
- Recommandations : affichage de `meta.level` Nest (GENERIC / PREFERENCES / BEHAVIOR). Aucun second moteur dans Flutter.
- Favoris liste : payload Nest limité à `listingId` / `propertyId` / `title` / `createdAt` — pas de carte prix/photo inventée.
- Alertes : digest serveur uniquement (worker ~120 s, plancher quotidien / hebdomadaire). Aucune fréquence `IMMEDIATE`.
- Push natif : contrat `POST /push-devices` branché, **aucun provider FCM/APNs livré** (`NOTIFICATION_PUSH_PROVIDER = null`, pas de `google-services.json` / `GoogleService-Info.plist`). Les notifications push **ne sont pas opérationnelles**.
- Liens profonds : schéma `monappart://` + allowlist `PUBLIC_WEB_HOST`. Une conversation UUID ouvre le fil ; une visite UUID ouvre le détail réel (relecture REST).
- Universal Links / App Links HTTPS : **bloqués** tant qu’un domaine réel, `apple-app-site-association` et `assetlinks.json` ne sont pas fournis.
- Compte : pas de photo de profil, pas de self-service de suppression, pas de changement d’e-mail / téléphone.
- Paiements, analytics consentie (`POST /analytics/events`) : non implémentés.
- Messagerie : pas d’envoi de pièces jointes, pas de blocage d’un pair, pas de photo/prix dans l’en-tête de conversation (absents du DTO Nest). Le Socket.IO ne remplace pas REST.
- Visites : pas d’API de créneaux, pas de photo/prix sur la carte visite, pas de rappels OS locaux, pas de synchro calendrier appareil.
- Espace pro : formulaire de publication branché sur Nest. Pas de KPI inventé, pas de 6ᵉ onglet, pas de second CRM local. L’inscription mobile reste `CUSTOMER` ; un rôle éditeur créé sur le web fonctionne après connexion.
- Carte Explorer : `flutter_map` + tuiles OSM (ou `MAP_TILE_URL`). Recherche zone = `GET /search?lat&lng&radius` (pas de bbox Nest). Clustering client. « Autour de moi » = permission à la demande, sans suivi arrière-plan. Les biens `precision=NONE` restent en liste seulement. Aucune reco géographique dédiée (`GET /recommendations` n’a pas `lat`/`lng`).
- Assistant : si `AI_ASSISTANT_ENABLED=false`, Nest répond 503 — l’écran le dit et propose Explorer. OpenAI optionnel côté serveur uniquement (reformulation texte). Les tours assistant n’appellent pas `GET /recommendations`.
- Shortlist : locale (max 4), persistée sur l’appareil par compte, **pas** d’API Nest `GET /collections`. `POST .../compare` de l’assistant n’accepte pas une shortlist arbitraire. Charges, caution et statut foncier juridique **absents** du DTO public : posés en questions, jamais calculés.
- Tournée : pas d’OSRM / Google Directions côté Nest. Pas de trafic temps réel. Les distances client sont à vol d’oiseau. `url_launcher` ouvre Maps ; l’app ne guide pas. Perms localisation inchangées (pas d’arrière-plan).
- Hors ligne : pas de moteur de recherche catalogue local, pas de messagerie différée, pas de publication automatique, pas de reprise d’upload à l’octet. Pas de sync incrémentale Nest. Pas de WorkManager / BGTask. Le cache n’est pas chiffré (hors jetons). Les photos hors ligne reposent sur `cached_network_image`.
- L’app Expo `apps/mobile` pointe encore vers le prototype web (`localhost:3000`).
- iOS non compilé sur Windows.
- Aucune URL de staging / production réelle n’est connue du dépôt. Les liens universels ne sont pas configurés.

## Prochaines étapes

1. Configurer un domaine public (`PUBLIC_WEB_HOST`) + `assetlinks.json` + `apple-app-site-association`, puis intent-filters HTTPS / Associated Domains.
2. Provider push FCM/APNs **côté Nest** (`PUSH_PROVIDER`) et fichiers Firebase mobiles — aucun secret serveur dans le binaire.
3. API de disponibilités / créneaux (absente). Envoi de pièces jointes messagerie. Blocage d’un interlocuteur. Provider push FCM.
4. `GET /property-types` et `GET /amenities` sont lus pour la publication ; la recherche conserve le repli seed. Aucun `GET /communes`.
5. Demande d’accès propriétaire / agence depuis l’app (workflow web uniquement aujourd’hui).
6. Endpoint search `bbox` / clusters serveur, et un fournisseur de tuiles contractuel en production (politique OSM). `GET /recommendations` n’accepte pas encore `lat`/`lng`.

## Tests manuels restants (appareils réels)

Non exécutés dans cet environnement (Windows, pas d’envoi FCM) :

- Permission Android 13+ / iOS (accepter, refuser, refuser durable, paramètres).
- Notification au premier plan, en arrière-plan, app tuée (nécessite un provider push).
- Ouverture `monappart://listings/<uuid>` depuis un autre app.
- App Links / Universal Links HTTPS après association de domaine.
- Changement de compte et déconnexion (jeton désassocié).
