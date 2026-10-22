# API

Écosystème partenaires (admin) : [partner-api-specification.md](./partner-api-specification.md), [partner-ecosystem-architecture.md](./partner-ecosystem-architecture.md).

Préfixe `/api`, version d'URL `v1`.

| Méthode | Chemin          | Rôle                                            |
| ------- | --------------- | ----------------------------------------------- |
| GET     | `/health/live`  | Processus vivant                                |
| GET     | `/health/ready` | PostgreSQL, PostGIS et Redis                    |
| GET     | `/health`       | Même contrôle que ready                         |
| GET     | `/api/v1/meta`  | Identité du service                             |
| GET     | `/docs`         | OpenAPI, local et development seulement         |
| GET     | `/metrics`      | Prometheus, seulement si `METRICS_ENABLED=true` |

Authentification : `/api/v1/auth/*`, décrite dans [identity.md](./identity.md). Toute route exige un access token (`Authorization: Bearer`) sauf celles marquées `@Public()` : health, métriques, `meta` et les endpoints publics d'auth. Les erreurs portent un champ `code` stable.

`/health/ready` répond 503 si une dépendance manque. Le processus démarre quand même : une dépendance optionnelle ou temporairement absente ne doit pas empêcher le boot. En production, l'orchestrateur utilisera `ready` pour le trafic.

Biens et annonces : `/api/v1/properties`, `/api/v1/listings`, `/api/v1/property-types`, `/api/v1/amenities`, décrits dans [property-listing.md](./property-listing.md). Les lectures publiques acceptent un jeton facultatif (`@OptionalAuth()`) : sans jeton, ou avec un jeton invalide, l'appelant est anonyme.

Recherche publique : `GET /api/v1/search` et `GET /api/v1/search/suggestions`, jeton facultatif, décrites dans [search.md](./search.md). `GET /listings` reste l'outil de gestion (scopes, modération) ; `/search` sert la découverte. Sonde dédiée `/health/search` (hors préfixe, hors Swagger) : 200 `ok`, 200 `degraded` si le repli PostgreSQL remplace OpenSearch, 503 si aucune recherche n'est possible.

Recommandations : `GET /api/v1/recommendations` et `GET /api/v1/recommendations/similar/:listingPublicId` (jeton facultatif ; générique et non persisté pour un visiteur), `POST /api/v1/recommendations/:recommendationId/feedback`, `GET` et `PUT /api/v1/recommendations/preferences` (authentifiés). Décrites dans [recommendation.md](./recommendation.md). La pagination y renvoie `{ items, pagination: { nextCursor, hasMore, limit }, meta }`.

Médias : `POST /api/v1/media/upload-sessions`, `GET /api/v1/media/upload-sessions/:sessionId`, `POST /api/v1/media/upload-sessions/:sessionId/complete` (authentifiés) ; `GET /api/v1/properties/:propertyId/media` (jeton facultatif), `PATCH .../media/order`, `PATCH .../media/:mediaId`, `DELETE .../media/:mediaId`, `GET .../media/:mediaId/download`. Le fichier est envoyé directement au stockage par une URL présignée, jamais via un champ JSON. Décrites dans [media-management.md](./media-management.md). Les routes `/api/v1/media/local/*` n'existent qu'avec le stockage local de développement (404 sinon, hors Swagger).

Confiance et vérification, décrites dans [trust-and-verification.md](./trust-and-verification.md) :

- dossiers du compte courant : `POST` et `GET /api/v1/trust/verifications`, `GET .../:verificationId`, `POST .../:verificationId/documents`, `DELETE .../:verificationId/documents/:documentId`, `POST .../:verificationId/submit`, `POST .../:verificationId/withdraw` ;
- signalements : `POST` et `GET /api/v1/trust/reports`, `GET .../:reportId` ;
- badges publics : `GET /api/v1/trust/users/:userId/badges`, `GET /api/v1/trust/listings/:listingId/badges` ;
- relecture (`/api/v1/admin/trust`) : file et détail des dossiers, téléchargement d'une pièce, `assign`, `request-information`, `escalate`, `approve`, `reject`, `revoke` ; file, détail, `assign` et `resolve` des signalements ; alertes (`signals`, `signals/:signalId/review`) ; score interne (`users/:userId/score`) ;
- signalement d'une conversation ou d'un message : `POST /api/v1/conversations/:conversationId/report`.

Aucune route du déclarant ne fixe l'issue d'un dossier.

Messagerie, visites et notifications, décrites dans [messaging-and-notifications.md](./messaging-and-notifications.md) :

- conversations : `POST` et `GET /api/v1/conversations`, `GET .../unread-count`, `GET .../:conversationId`, `GET` et `POST .../:conversationId/messages`, `POST .../:conversationId/read`, `PATCH .../:conversationId/archive`, `PATCH .../:conversationId/mute`, `POST .../:conversationId/attachments`, `GET .../:conversationId/messages/:messageId/attachments/:attachmentId` ;
- visites : `POST` et `GET /api/v1/appointments`, `GET .../:appointmentId`, `POST .../:appointmentId/confirm`, `reschedule`, `cancel`, `complete`, `no-show` ;
- notifications : `GET /api/v1/notifications`, `GET .../unread-count`, `PATCH .../:notificationId/read` (`POST` conservé, déprécié), `POST .../read-all` ; `GET` et `PUT /api/v1/notification-preferences` ; `GET`, `POST` et `DELETE /api/v1/push-devices` ;
- temps réel : Socket.IO, namespace `/realtime`, access token dans `auth.token`.

Aucune route d'administration ne donne accès aux conversations : la modération passe par les signalements.

Analytics, décrit dans [analytics-and-tracking.md](./analytics-and-tracking.md) :

- collecte : `POST /api/v1/analytics/events` (authentification facultative, 202, lots d'événements de navigation consentis) ;
- consentement : `GET` et `PUT /api/v1/analytics/consent` ;
- gestionnaires : `GET /api/v1/analytics/me/listings`, `GET /api/v1/analytics/listings/:listingId` ;
- administration (`analytics:admin`) : `GET /api/v1/admin/analytics/overview`, `funnel`, `search`, `recommendations`, `quality`.

Les statistiques ne contiennent que des agrégats, jamais d'événement brut ni d'identité de visiteur.

Back-office (`/api/v1/admin`, `admin:access` relu en base à chaque requête), décrit dans [admin-backoffice-moderation.md](./admin-backoffice-moderation.md) :

- session : `GET /me`, `GET /dashboard`, `GET /roles` ;
- comptes : `GET /users`, `GET /users/:userId`, `POST /users/:userId/suspend`, `ban`, `reactivate`, `revoke-sessions`, `roles`, `notes` ;
- annonces : `GET /listings`, `GET /listings/:listingId`, `POST /listings/:listingId/approve`, `request-changes`, `reject`, `suspend`, `restore`, `notes` ;
- motifs : `GET` et `POST /moderation-reasons`, `PATCH /moderation-reasons/:code` ;
- audit : `GET /audit-logs`.

Les décisions exigent le statut constaté (`expectedStatus`) et répondent 409 si l'état a changé.

Facturation des services de la plateforme, décrite dans [billing-payments-monetization.md](./billing-payments-monetization.md) (aucun prestataire réel intégré, simulateur en développement seulement) :

- catalogue : `GET /api/v1/billing/plans` (public) ;
- client : `GET /billing/me/entitlements`, `GET /billing/me/subscriptions`, `POST /billing/me/subscriptions/:id/cancel`, `POST` et `GET /billing/orders`, `GET /billing/orders/:id`, `GET /billing/orders/:id/receipt` (reçu non fiscal), `POST /billing/orders/:id/cancel`, `POST /billing/orders/:id/payments`, `GET /billing/payments/:id`, `POST /billing/payments/:id/refresh`, `POST /billing/payments/:id/refund-requests`, `GET /billing/me/refunds` ;
- simulateur : `POST /billing/mock/payments/:id/simulate` (404 hors développement) ;
- prestataire : `POST /billing/webhooks/:provider` (public, signature HMAC sur corps brut, absent de Swagger) ;
- back-office (`/api/v1/admin/billing`) : `GET summary`, `orders`, `orders/:id`, `payments`, `subscriptions`, `refunds`, `refunds/:id`, `incidents`, `webhook-events`, `catalog` (`billing:read`) ; `POST payments/:id/check`, `POST incidents/:id/resolve` (`billing:reconcile`) ; `POST payments/:id/refunds` (`billing:refund_request`) ; `POST refunds/:id/approve` et `reject` (`billing:refund`) ; `POST catalog/products`, `PATCH catalog/products/:code`, `POST catalog/products/:code/prices`, `POST catalog/prices/:priceId/archive` (`billing:catalog`).

Aucune route ne permet de déclarer un paiement réussi ni de fixer un montant depuis le client.

Les futures ressources suivront le même modèle, par exemple :

```
POST   /api/v1/properties/:id/favorite
```

Les DTO HTTP ne sont pas des entités de domaine. `ValidationPipe` est global : `whitelist`, `forbidNonWhitelisted`, `transform`. Un champ non déclaré est rejeté (protection contre le mass assignment).

Les listes utilisent la pagination par curseur opaque (`cursor`, `limit`, réponse `{ items, nextCursor }`), pas `OFFSET`.

Le rate limiting est de 120 requêtes par minute (recherche : `SEARCH_RATE_LIMIT`, autocomplétion : `SEARCH_SUGGEST_RATE_LIMIT`, recommandations : `RECOMMENDATION_RATE_LIMIT`, retours : `RECOMMENDATION_FEEDBACK_RATE_LIMIT`, envois de médias : `MEDIA_UPLOAD_RATE_LIMIT`, modifications de médias : `MEDIA_MUTATION_RATE_LIMIT`, signalements : `TRUST_REPORT_RATE_LIMIT`, actions Trust : `TRUST_MUTATION_RATE_LIMIT`, messagerie : `MESSAGING_RATE_LIMIT`, visites : `APPOINTMENT_RATE_LIMIT`, facturation : `BILLING_RATE_LIMIT`, webhooks de paiement : `BILLING_WEBHOOK_RATE_LIMIT`, actions du back-office : 30 par minute, fiches avec coordonnées : 20 par minute). Il s'appuie sur Redis et retombe sur la mémoire du processus si Redis est down. Les sondes `/health` ne sont pas comptées.
