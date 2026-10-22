# Messagerie et notifications

Module `apps/api/src/modules/communication`. Il couvre les échanges entre un client et le côté annonce (propriétaire, agents et gestionnaires du bien), les demandes de visite et toutes les notifications de la plateforme (in-app, e-mail, SMS ; push et WhatsApp préparés). Décision d'architecture : [0010-messaging-architecture.md](./decisions/0010-messaging-architecture.md).

## Principes

- **Le message est enregistré d'abord.** L'écriture en base (transaction) ne dépend ni de Redis, ni du temps réel, ni d'un fournisseur d'e-mail ou de SMS. Les notifications sont mises en file dans la même transaction (outbox), puis envoyées par un worker.
- **L'accès se recalcule à chaque requête.** Connaître l'identifiant d'une conversation ne donne aucun droit. Le demandeur y accède ; côté annonce, seuls les gestionnaires **actuels** du bien (`property_ownerships.is_current`) y accèdent. Tout autre appelant reçoit 404.
- **Deux parties, pas de groupe.** Une conversation relie un demandeur et le côté annonce d'une annonce : une seule par couple (annonce, demandeur).
- **Rien n'est simulé.** Un canal sans fournisseur configuré est indisponible : aucune livraison n'est planifiée. Une livraison acceptée par le fournisseur passe à `SENT`, jamais à `DELIVERED` ni « lue ».
- **Pas de contenu sensible hors de l'application.** E-mails, SMS et push ne contiennent jamais le texte d'un message, une note de visite, un document ni un jeton.

## Modèle

| Table                       | Rôle                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inquiries` (existante)     | Demande de contact ou de visite, sans texte libre (`message` nul) : le premier message vit dans `messages`. Passe de `OPEN` à `IN_PROGRESS` à la 1re réponse |
| `conversations`             | Une par (annonce, demandeur), liée à sa demande ; `last_seq` (compteur de messages), `status` `OPEN` / `CLOSED`, `last_activity_at`                          |
| `conversation_participants` | Curseurs de lecture et de réception (`last_read_seq`, `last_delivered_seq`), archivage et sourdine propres à chacun, `state` `ACTIVE` / `LEFT`               |
| `messages`                  | Numéro `seq` sans trou par conversation, type `TEXT` / `IMAGE` / `DOCUMENT` / `SYSTEM`, `client_message_id` (idempotence). Aucun binaire                     |
| `message_attachments`       | Référence vers `media` (`purpose = MESSAGE`, toujours privé), réservée à la conversation et à l'expéditeur jusqu'à l'envoi                                   |
| `appointments` (complétée)  | Fuseau, durée, date proposée et son auteur, confirmation, annulation (motif codé), fin, rappel ; liée à la conversation et à la demande                      |
| `notifications` (complétée) | Catégorie, clé de regroupement `dedup_key` unique par utilisateur, expiration                                                                                |
| `notification_deliveries`   | Une livraison par (notification, canal) : file (`next_attempt_at`), essais, fournisseur, identifiant externe, erreur codée, repli (`fallback_from_id`)       |
| `notification_preferences`  | Choix explicites par (catégorie, canal) ; les valeurs par défaut sont dans le code                                                                           |
| `push_devices`              | Jetons push des applications (empreinte SHA-256 unique, 10 appareils actifs au plus)                                                                         |
| `reports` (complétée)       | Cibles `MESSAGE` et `CONVERSATION` (module Trust)                                                                                                            |

Contraintes en base : un message `SYSTEM` n'a pas d'auteur et porte un code ; un message `TEXT` a un corps non vide ; un trigger interdit de changer la conversation, le rang, le type, la date ou l'auteur d'un message ; une seule visite active par (annonce, client) ; une pièce jointe de message est privée, image ou document.

Migrations : `20261012190000_communication_enum_values` (valeurs d'enum, séparées car PostgreSQL ne peut pas les utiliser dans la transaction qui les crée) et `20261012190100_messaging_notifications`. Toutes deux sont additives.

## Messagerie

### Contacter une annonce

`POST /api/v1/conversations` `{ listingId, message, clientMessageId? }` (permission `conversation:create`) :

1. L'annonce doit être publiée et avoir au moins un gestionnaire. Brouillon ou en revue : 404 ; autre statut : 409 `LISTING_NOT_CONTACTABLE`. Un gestionnaire du bien ne peut pas contacter sa propre annonce (422).
2. Si une conversation existe déjà pour ce couple, le message y est ajouté (`created: false`) : pas de doublon de demande de contact.
3. Sinon, une seule transaction crée la demande (`inquiries`, type `MESSAGE`), la conversation, les participants (demandeur et gestionnaires actuels) et le premier message.

### Envoyer, lire, rattraper

- `POST /conversations/:id/messages` `{ body?, attachmentIds?, clientMessageId? }`. L'expéditeur vient du jeton. Le type est déduit par le serveur ; tout champ `type`, `systemCode` ou auteur est refusé (400). Un renvoi avec le même `clientMessageId` renvoie le message existant (`duplicate: true`).
- Le numéro `seq` est attribué par `UPDATE conversations SET last_seq = last_seq + 1 … WHERE status = 'OPEN' RETURNING` : ordre total sans trou, et aucun message n'entre dans une conversation fermée.
- `GET /conversations/:id/messages` : les plus récents ; `before=` remonte l'historique, `after=` rattrape après une reconnexion. Lire marque les messages comme reçus.
- `POST /conversations/:id/read` `{ upToSeq? }` avance le curseur de lecture (jamais en arrière) et marque lues les notifications de la conversation.
- Statut d'un message vu par son auteur : `SENT`, `DELIVERED` ou `READ`, d'après les curseurs de l'autre partie.
- `PATCH /conversations/:id/archive` et `PATCH /conversations/:id/mute` sont propres à l'appelant. Un nouveau message désarchive la conversation pour tous ; la sourdine coupe l'e-mail, le SMS et le push, pas l'in-app.

Les participants sont présentés par leur prénom et l'initiale du nom : jamais d'e-mail ni de téléphone.

### Messages système

Créés par le backend uniquement (`appendSystem`), sans auteur, avec un code (`APPOINTMENT_REQUESTED`, `APPOINTMENT_CONFIRMED`, `APPOINTMENT_RESCHEDULE_PROPOSED`, `APPOINTMENT_CANCELLED`, `APPOINTMENT_COMPLETED`, `APPOINTMENT_NO_SHOW`, `CONVERSATION_CLOSED`) et des données limitées à des identifiants publics, dates et codes. Le client les traduit. Le curseur de lecture de l'acteur avance : son propre événement ne compte pas comme non lu.

### Pièces jointes

Le pipeline Media existant est réutilisé, sans copie ni second stockage :

1. `POST /conversations/:id/attachments` `{ type: IMAGE | DOCUMENT, mimeType, size }` renvoie une URL d'envoi présignée vers le stockage privé (10 pièces en attente au plus).
2. `PUT` direct, puis `POST /media/upload-sessions/:sessionId/complete`. Le traitement Media vérifie la signature, nettoie les métadonnées et marque le fichier `READY`.
3. Le message cite `mediaId` dans `attachmentIds`. Le serveur verrouille la pièce : elle doit appartenir à l'expéditeur et à cette conversation, être prête et non rattachée.
4. Lecture : `GET /conversations/:id/messages/:messageId/attachments/:attachmentId` renvoie un lien signé court, réservé aux participants, audité.

### Gestionnaires et départ

Le côté annonce est recalculé : un agent ou un gestionnaire rattaché au bien rejoint les conversations à sa première requête. Si son rattachement prend fin, il reçoit 404 et sa participation passe à `LEFT`. L'historique reste intact.

### Anti-abus

Compté en base, exact sur plusieurs instances, sans Redis :

| Règle                                                                                  | Effet                                                             |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `MESSAGING_MAX_CONVERSATIONS_PER_HOUR` nouvelles conversations                         | 429 `CONVERSATION_RATE_LIMITED`, `Retry-After: 3600`              |
| `MESSAGING_MAX_MESSAGES_PER_MINUTE` messages                                           | 429 `MESSAGE_RATE_LIMITED`, `Retry-After: 60`                     |
| Même texte (≥ 20 caractères) dans `MESSAGING_REPEAT_LIMIT` autres conversations en 1 h | 429 `MESSAGE_REPEATED`, `Retry-After: 3600`, journal sans contenu |
| `MESSAGING_RATE_LIMIT` requêtes par minute et par IP                                   | 429 du limiteur global                                            |

Seul le message en cause est refusé : le compte n'est jamais bloqué automatiquement. Les abus se traitent par signalement.

### Signalement et modération

`POST /api/v1/conversations/:id/report` `{ reason, description?, messageId? }` (module Trust, permission `report:create`) : réservé aux participants, impossible pour son propre message ou un message système. Le modérateur (`report:review`) voit un extrait limité au message signalé, ou aux 20 derniers messages pour une conversation : **aucun accès global aux conversations**, même pour un administrateur. La résolution `CONVERSATION_CLOSED` ferme la conversation (message système, audit) ; plus aucun message n'y est accepté.

## Temps réel

Socket.IO, namespace `/realtime`, sur le port de l'API.

- **Connexion** : access token dans `auth.token` (ou en-tête `Authorization: Bearer`). Signature, session non révoquée et compte actif sont vérifiés, sinon `connect_error` avec un code (`UNAUTHENTICATED`, `SESSION_REVOKED`…).
- **Salles** : chaque socket rejoint uniquement `user:{publicId}`. Les destinataires sont calculés par le serveur ; le client ne choisit aucune salle.
- **Événements émis** : `message:new`, `message:delivered`, `message:read`, `conversation:updated`, `conversation:unread_count`, `appointment:updated`, `notification:new`, `session:expired`.
- **Événements reçus** (avec accusé `{ ok, … }` ou `{ ok: false, code }`) : `conversation:read { conversationId, upToSeq? }` et `message:delivered { conversationId, upToSeq }`. Ils sont validés, limités à `REALTIME_EVENT_RATE_LIMIT` par minute et par socket, et soumis au même contrôle d'accès que l'API REST.
- **Session** : la révocation est revérifiée toutes les `REALTIME_REVOCATION_CHECK_SECONDS`. Le socket est fermé à l'expiration du jeton ; le client se reconnecte avec un jeton rafraîchi.
- **Plusieurs instances** : avec `REDIS_URL`, l'adaptateur Redis relaie les émissions. Sans Redis, une seule instance reçoit ses propres émissions. La persistance n'en dépend pas : le client se rattrape par `GET …/messages?after=`.

## Notifications

### Création

`NotificationService.notify(userId, input, tx)` est appelé dans la transaction métier. Le dispatcher :

1. ignore un compte supprimé, et ne prévoit aucun canal externe pour un compte bloqué ;
2. insère la notification, sans doublon grâce à `dedup_key` (ex. `conversation:{id}:after:{dernierLu}` : une notification par série de messages non lus) ;
3. planifie une livraison par canal : `IN_APP` immédiatement, les canaux externes après `externalDelaySeconds` (`MESSAGING_EXTERNAL_DELAY_SECONDS` pour un message).

Un canal externe est planifié seulement s'il est activé (préférence), servi par un fournisseur configuré, et si la destination est **vérifiée** (e-mail ou téléphone confirmé, appareil push actif).

### Catégories et préférences

`GET` et `PUT /api/v1/notification-preferences` exposent la matrice catégorie × canal (`enabled`, `locked`, `available`).

| Catégorie               | Canaux par défaut         |
| ----------------------- | ------------------------- |
| `MESSAGES`              | in-app, e-mail, push      |
| `VISITS`                | in-app, e-mail, SMS, push |
| `APPOINTMENT_REMINDERS` | in-app, e-mail, SMS, push |
| `RECOMMENDATIONS`       | in-app                    |
| `PRICE_DROPS`           | in-app, push              |
| `SAVED_SEARCHES`        | in-app, push              |
| `LISTING_UPDATES`       | in-app, e-mail            |
| `ACCOUNT`               | in-app, e-mail, push      |
| `MARKETING`             | aucun (accord explicite)  |

Verrouillés (422 `PREFERENCE_LOCKED` si on tente de les couper) : l'in-app de toutes les catégories sauf le marketing, et l'e-mail de `ACCOUNT` (sécurité, vérifications). Le SMS est réservé aux visites par défaut : il coûte et il est moins sûr.

### API

- `GET /api/v1/notifications` (`unreadOnly`, `cursor`, `limit`) renvoie `{ items, nextCursor, unread }` ; les notifications expirées sont masquées.
- `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/:id/read` (`POST` conservé, déprécié), `POST /api/v1/notifications/read-all` (idempotents ; la notification d'un autre utilisateur donne 404).
- `GET`, `POST` et `DELETE /api/v1/push-devices` : appareils de l'application mobile. Le jeton n'est jamais renvoyé, journalisé ni audité ; il est stocké pour l'envoi et identifié par son empreinte.

### Livraison (worker)

`DeliveryRunner` tourne dans le processus de l'API (`NOTIFICATION_WORKER_ENABLED`). Il est réveillé après chaque mise en file et interroge la table toutes les `NOTIFICATION_WORKER_POLL_MS` :

1. **Réservation** : `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, essai incrémenté, bail de 3 × `NOTIFICATION_PROVIDER_TIMEOUT_MS`. Plusieurs instances ne prennent jamais la même livraison, et un worker arrêté rend la sienne à l'expiration du bail.
2. **Revérification** juste avant l'envoi : compte supprimé ou bloqué, notification expirée, message déjà lu (`MESSAGES`), préférence coupée entre-temps, destination plus vérifiée, fournisseur retiré. La livraison est alors annulée (`CANCELLED`, motif codé).
3. **Envoi** avec un délai maximal (`AbortSignal.timeout`). Le résultat est classé : `TEMPORARY`, `QUOTA` et `TIMEOUT` sont retentés ; `RECIPIENT`, `VALIDATION`, `PERMANENT` et `CONFIG` échouent tout de suite.
4. **Reprise** : backoff exponentiel depuis `NOTIFICATION_RETRY_BASE_SECONDS`, plafonné à 6 h, avec ±20 % d'aléa, dans la limite de `NOTIFICATION_MAX_ATTEMPTS` essais.
5. **Repli** (`NOTIFICATION_FALLBACKS`, ex. `EMAIL>SMS`) : le canal de repli n'est pas envoyé en parallèle du canal principal. Il n'est créé qu'après l'échec définitif de celui-ci, hors erreur de configuration, et seulement si la préférence et la destination le permettent. Un seul niveau : une livraison de repli n'en déclenche pas d'autre, et la configuration ignore les chaînes et les cycles. Un SMS en échec ne relance donc rien.

Conservé : le nom du fournisseur, l'identifiant externe (200 caractères) et un code d'erreur court (`QUOTA:HTTP_429`). Jamais la réponse complète du fournisseur.

### Canaux

| Canal    | État                                  | Détails                                                                                                                                                                                          |
| -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| In-app   | Opérationnel                          | Table `notifications` + événement temps réel `notification:new`                                                                                                                                  |
| E-mail   | Opérationnel si `EMAIL_PROVIDER=smtp` | nodemailer ; STARTTLS exigé hors TLS implicite ; accès fichier et URL désactivés ; `Message-ID` dérivé de la livraison. Texte et HTML échappé : titre, phrase générique, lien vers l'application |
| SMS      | Opérationnel si `SMS_PROVIDER=http`   | Passerelle HTTP générique : `POST { to, text, sender, reference }`, jeton Bearer, `Idempotency-Key`, redirections refusées. Un segment (160 caractères) : marque, titre, lien éventuel           |
| Push     | Interface seule, désactivé            | `PushProvider` (FCM / APNs) : contenu limité à la marque et au titre (écran verrouillé), données = identifiants publics ; jetons refusés invalidés                                               |
| WhatsApp | Interface seule, désactivé            | `WhatsAppProvider` pour l'API officielle WhatsApp Business (Cloud API) et des modèles préapprouvés uniquement ; aucun contournement non officiel                                                 |

Brancher un fournisseur : implémenter `ChannelProvider<…>` et le fournir sous le jeton `NOTIFICATION_PUSH_PROVIDER` ou `NOTIFICATION_WHATSAPP_PROVIDER` (voir `channel-registry.ts`). Le canal devient disponible dans la matrice des préférences. Les accusés de réception des fournisseurs (`DELIVERED`) ne sont pas encore traités : il faudra un webhook signé.

## Visites

`POST /api/v1/appointments` `{ listingId, scheduledAt, timezone?, durationMinutes?, notes? }` (permission `appointment:request`) :

- créneau à au moins `APPOINTMENT_MIN_NOTICE_MINUTES` et au plus `APPOINTMENT_MAX_DAYS_AHEAD` jours ; fuseau IANA (défaut `Africa/Abidjan`), instant stocké en UTC ;
- réutilise la conversation du client avec l'annonce, sinon en ouvre une (`VISIT_COORDINATION`), avec une demande `REQUEST_VISIT` ;
- une seule visite active par (annonce, client) : sinon 409 `APPOINTMENT_ALREADY_ACTIVE` ;
- statut `PENDING` : **une demande n'est jamais confirmée automatiquement**.

| Action                         | Qui                                                               | Depuis                                         | Vers                   |
| ------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------- | ---------------------- |
| `confirm`                      | côté annonce ; ou l'autre partie que l'auteur de la date proposée | `PENDING` ; `RESCHEDULE_REQUESTED`             | `CONFIRMED`            |
| `reschedule` `{ scheduledAt }` | les deux                                                          | `PENDING`, `CONFIRMED`, `RESCHEDULE_REQUESTED` | `RESCHEDULE_REQUESTED` |
| `cancel` `{ reason? }`         | les deux (motif codé, jamais de texte libre)                      | idem                                           | `CANCELLED`            |
| `complete`, `no-show`          | côté annonce, après l'heure prévue                                | `CONFIRMED`                                    | `COMPLETED`, `NO_SHOW` |

Chaque transition verrouille la ligne, revérifie l'état (mise à jour conditionnée au statut), ajoute un message système, notifie l'autre partie et écrit l'audit. La réponse indique les `actions` possibles pour l'appelant. `GET /appointments` (`scope=upcoming|past`) et `GET /appointments/:id` sont réservés aux parties (404 sinon).

**Rappels** : le worker envoie, une fois par minute au plus, les rappels des visites confirmées dans les `APPOINTMENT_REMINDER_HOURS` heures (`SKIP LOCKED`, `reminder_sent_at`), au client et aux gestionnaires, catégorie `APPOINTMENT_REMINDERS`. Le rappel expire à l'heure de la visite. Les notes de visite ne sont jamais transmises hors de l'application.

## Sécurité

- Expéditeur, participant et destinataires viennent toujours du jeton et de la base, jamais de la requête.
- Conversation, message, pièce jointe, visite, notification ou appareil d'autrui : 404, sans distinguer « inexistant » et « interdit ».
- Validation stricte (`forbidNonWhitelisted`), corps normalisé (caractères de contrôle et de direction retirés, 4000 caractères au plus).
- Aucun appel externe dans les contrôleurs : tout passe par la file de livraison.
- Journaux : identifiants publics, canal, code d'erreur. Jamais le corps d'un message, une adresse, un numéro, un jeton push ni une URL signée.
- Événements de domaine (`message.sent`, `conversation.created`, `conversation.closed`, `appointment.changed`) : identifiants publics et codes seulement.
- Audit : création et fermeture de conversation, envoi de pièce jointe, transitions de visite, préférences, appareils push. Sans contenu.

## Observabilité

Métriques Prometheus (`METRICS_ENABLED`) : conversations créées, messages envoyés et refusés (par motif), notifications créées (par catégorie), livraisons (canal × issue), reprises (canal × motif), latence de livraison, livraisons en attente, connexions temps réel et refus de connexion.

## Configuration

| Variable                               | Défaut | Rôle                                                                 |
| -------------------------------------- | ------ | -------------------------------------------------------------------- |
| `MESSAGING_MAX_CONVERSATIONS_PER_HOUR` | 20     | Nouvelles conversations par compte et par heure                      |
| `MESSAGING_MAX_MESSAGES_PER_MINUTE`    | 30     | Messages par compte et par minute                                    |
| `MESSAGING_REPEAT_LIMIT`               | 5      | Conversations recevant le même texte en 1 h avant refus              |
| `MESSAGING_MAX_ATTACHMENTS`            | 5      | Pièces jointes par message                                           |
| `MESSAGING_EXTERNAL_DELAY_SECONDS`     | 300    | Délai avant e-mail / SMS / push d'un message non lu                  |
| `MESSAGING_RATE_LIMIT`                 | 120    | Requêtes par minute et par IP                                        |
| `NOTIFICATION_WORKER_ENABLED`          | true   | Worker de livraison dans l'API                                       |
| `NOTIFICATION_WORKER_POLL_MS`          | 2000   | Intervalle d'interrogation                                           |
| `NOTIFICATION_WORKER_BATCH_SIZE`       | 20     | Livraisons par lot                                                   |
| `NOTIFICATION_MAX_ATTEMPTS`            | 5      | Essais par livraison                                                 |
| `NOTIFICATION_RETRY_BASE_SECONDS`      | 30     | Base du backoff                                                      |
| `NOTIFICATION_PROVIDER_TIMEOUT_MS`     | 10000  | Délai maximal d'un appel fournisseur                                 |
| `NOTIFICATION_FALLBACKS`               | vide   | Replis `CANAL>CANAL`, un seul niveau                                 |
| `EMAIL_PROVIDER`                       | none   | `none` ou `smtp` (`SMTP_*`, `EMAIL_FROM` requis)                     |
| `SMS_PROVIDER`                         | none   | `none` ou `http` (`SMS_HTTP_URL`, `SMS_HTTP_TOKEN`, `SMS_SENDER_ID`) |
| `PUSH_PROVIDER`, `WHATSAPP_PROVIDER`   | none   | Aucun adaptateur livré                                               |
| `REALTIME_ENABLED`                     | true   | Namespace `/realtime`                                                |
| `REALTIME_REVOCATION_CHECK_SECONDS`    | 60     | Revérification des sessions des sockets                              |
| `REALTIME_EVENT_RATE_LIMIT`            | 120    | Événements entrants par socket et par minute                         |
| `APPOINTMENT_REMINDER_HOURS`           | 24     | Rappel avant une visite confirmée (0 : aucun)                        |
| `APPOINTMENT_MIN_NOTICE_MINUTES`       | 60     | Préavis minimal                                                      |
| `APPOINTMENT_MAX_DAYS_AHEAD`           | 90     | Horizon maximal                                                      |
| `APPOINTMENT_RATE_LIMIT`               | 30     | Requêtes par minute et par IP                                        |
| `WEB_APP_URL`                          | —      | Lien vers l'application dans les e-mails et SMS                      |

Au démarrage, la configuration est validée (`packages/config`) : `smtp` sans hôte ni expéditeur, ou `http` sans URL, est refusé. Sans fournisseur, l'application démarre et les canaux restent indisponibles.

## Tests

- **Unitaires** (36 cas) :
  - `notification-domain.spec.ts` : préférences et verrous, planification, destinations vérifiées, backoff, décisions de livraison, replis (différé, chaînes, cycles), gabarits (échappement HTML, SMS court sans contenu, push d'écran verrouillé) ;
  - `providers.spec.ts` : classement des erreurs SMTP et HTTP, passerelle SMS et transport SMTP simulés (en-têtes, idempotence, délai, réponse non conservée) ;
  - `messaging-domain.spec.ts` : normalisation, statuts, regroupement, transitions et horaires de visite, fuseaux.
- **Intégration** (`test/communication/communication.db-spec.ts`, 33 cas, base `*_test`) : fournisseurs e-mail et SMS simulés (`FakeProvider`), serveur sur un port éphémère, client `socket.io-client`. Couverts :
  - contact, idempotence, cloisonnement (tiers, identifiant connu, ancien gestionnaire) ;
  - messages système non falsifiables ;
  - notifications sans contenu, e-mail annulé si le message est lu, reprises bornées ;
  - pièces jointes privées, anti-spam sans blocage, préférences verrouillées, appareils push ;
  - visites (confirmation, nouvelle date, fin), rappel avec repli SMS sur un seul niveau ;
  - signalement, extrait de modération et fermeture ;
  - temps réel (authentification, diffusion ciblée, accusés, révocation).

Aucun test ne contacte un vrai fournisseur.

## Limites connues

- Les codes OTP d'Identity passent encore par leurs propres fournisseurs de développement : ils ne sont pas branchés sur SMTP ni sur la passerelle SMS.
- Pas d'accusé de réception des fournisseurs (webhooks) : une livraison s'arrête à `SENT`.
- Push et WhatsApp : interfaces seulement.
- Pas de modification ni de suppression de message par l'utilisateur (colonnes prévues, non exposées).
- Pas d'événement `CONTACT_OWNER` dans `user_events` (table partitionnée, alimentée par un autre flux).
- Un compte supprimé définitivement laisse ses messages sans auteur (`author_id` nul, affiché « Compte supprimé ») ; une pièce jointe bloque la suppression physique de son auteur (`RESTRICT`) : l'effacement passera par l'anonymisation.
- Sans Redis, le temps réel ne relaie pas entre plusieurs instances ; le rattrapage REST reste correct.
- Pas d'interface d'administration ni d'écran web ou mobile : API seulement.
