# Back-office, administration et modération

Le back-office est l'application `apps/admin` (Next.js, port 3001) adossée au module API `apps/api/src/modules/admin`. Il orchestre les modules métier et ne possède aucune source de vérité propre : comptes et rôles restent dans Identity, annonces et machine à états dans Listing, vérifications, signalements et alertes dans Trust, notifications dans Communication, indicateurs dans Analytics. Le module Admin n'ajoute que deux tables : `moderation_reasons` et `admin_notes`.

Décision d'architecture : [ADR 0012](./decisions/0012-admin-backoffice.md).

## Accès

- Une URL connue ou un compte vérifié ne donne aucun droit. Toute route `/api/v1/admin/*` du module passe par `AdminAccessGuard`, qui relit en base à chaque requête le compte (refusé s'il est suspendu, banni ou inactif), ses rôles et ses permissions, puis exige `admin:access` et la permission de la route. Un rôle retiré ou un compte suspendu perd l'accès à la requête suivante, sans attendre l'expiration du jeton.
- Les routes Trust (`/api/v1/admin/trust/*`) et Analytics (`/api/v1/admin/analytics/*`) gardent leurs propres contrôles (permissions et relecture de l'acteur).
- Masquer un bouton n'est pas un contrôle : l'interface filtre sa navigation et ses actions d'après `GET /admin/me` et les `actions` renvoyées par chaque fiche, mais l'API refait chaque contrôle.

## Rôles et permissions

Codes `ressource:action` existants conservés ; les rôles `SUPPORT` et `ANALYST` et les permissions manquantes sont ajoutés par le seed `reference` (ajout seulement, aucun retrait).

| Permission             | Effet                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| `admin:access`         | Entrer dans le back-office                                          |
| `user:read`            | Rechercher des comptes, consulter une fiche (coordonnées masquées)  |
| `user:pii`             | Voir e-mail et téléphone complets ; chaque consultation est auditée |
| `user:suspend`         | Suspendre un compte                                                 |
| `user:ban`             | Bannir un compte                                                    |
| `user:reactivate`      | Réactiver un compte suspendu ou banni                               |
| `user:revoke_sessions` | Déconnecter un compte de tous ses appareils                         |
| `role:read`            | Consulter la matrice des rôles                                      |
| `role:manage`          | Attribuer ou retirer un rôle                                        |
| `admin_note:create`    | Ajouter une note interne                                            |
| `audit_log:read`       | Consulter le journal d'audit                                        |
| `settings:manage`      | Créer, modifier, désactiver un motif de modération                  |
| `listing:moderate`     | Valider, refuser, demander des corrections                          |
| `listing:suspend`      | Suspendre, republier                                                |
| `analytics:admin`      | Indicateurs globaux                                                 |

Matrice par défaut :

| Rôle            | Périmètre                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `MODERATOR`     | Annonces (modération, suspension), signalements, instruction des vérifications et pièces, fiches sans coordonnées, notes |
| `TRUST_OFFICER` | Décisions de vérification, signalements, score interne, coordonnées, notes                                               |
| `SUPPORT`       | Fiches et coordonnées, déconnexion des appareils, notes ; ni rôle, ni statut, ni identifiant de connexion                |
| `ANALYST`       | Indicateurs agrégés seulement                                                                                            |
| `ADMIN`         | Toutes les permissions sauf `verification:documents` (pièces personnelles)                                               |
| `SUPER_ADMIN`   | Toutes ; seul à gérer les comptes `ADMIN` et `SUPER_ADMIN`                                                               |

Garde-fous sur les comptes (Identity, `AccountAdminService`, et politique Admin) :

- nul n'agit sur son propre compte ni ne modifie ses propres rôles ;
- `ADMIN` et `SUPER_ADMIN` ne s'attribuent, ne se retirent, ne se suspendent qu'avec le rôle `SUPER_ADMIN` ; un compte de l'équipe (modération, confiance, support, analyse) n'est administré qu'avec `role:manage` ;
- le dernier `SUPER_ADMIN` actif ne peut être ni rétrogradé, ni suspendu, ni banni. Le contrôle se fait sous un verrou consultatif PostgreSQL (`identity:super_admin_guard`) pris avant le verrou de ligne : deux super administrateurs qui se bannissent mutuellement en même temps ne peuvent pas tous deux réussir ;
- un retrait de rôle, une suspension ou un bannissement révoquent les sessions du compte ;
- chaque changement de rôle est audité (`ROLE_CHANGED`, avec opération, rôle et justification).

## Endpoints

Préfixe `/api/v1/admin`. Erreurs au format commun `{ statusCode, code, message, details?, requestId, timestamp, path }`.

| Méthode | Chemin                                 | Permission                              |
| ------- | -------------------------------------- | --------------------------------------- |
| GET     | `/me`                                  | `admin:access`                          |
| GET     | `/dashboard`                           | `admin:access` (files selon droits)     |
| GET     | `/roles`                               | `role:read`                             |
| GET     | `/users`                               | `user:read`                             |
| GET     | `/users/:userId`                       | `user:read` (+ `user:pii`)              |
| POST    | `/users/:userId/suspend`               | `user:suspend`                          |
| POST    | `/users/:userId/ban`                   | `user:ban`                              |
| POST    | `/users/:userId/reactivate`            | `user:reactivate`                       |
| POST    | `/users/:userId/revoke-sessions`       | `user:revoke_sessions`                  |
| POST    | `/users/:userId/roles`                 | `role:manage`                           |
| POST    | `/users/:userId/notes`                 | `admin_note:create`                     |
| GET     | `/listings`                            | `listing:moderate` ou `listing:suspend` |
| GET     | `/listings/:listingId`                 | `listing:moderate` ou `listing:suspend` |
| POST    | `/listings/:listingId/approve`         | `listing:moderate`                      |
| POST    | `/listings/:listingId/request-changes` | `listing:moderate`                      |
| POST    | `/listings/:listingId/reject`          | `listing:moderate`                      |
| POST    | `/listings/:listingId/suspend`         | `listing:suspend`                       |
| POST    | `/listings/:listingId/restore`         | `listing:suspend`                       |
| POST    | `/listings/:listingId/notes`           | `admin_note:create`                     |
| GET     | `/moderation-reasons`                  | `admin:access`                          |
| POST    | `/moderation-reasons`                  | `settings:manage`                       |
| PATCH   | `/moderation-reasons/:code`            | `settings:manage`                       |
| GET     | `/audit-logs`                          | `audit_log:read`                        |

Vérifications, signalements, alertes et score : `/api/v1/admin/trust/*` ([trust-and-verification.md](./trust-and-verification.md)). Indicateurs : `/api/v1/admin/analytics/*` ([analytics-and-tracking.md](./analytics-and-tracking.md)).

Pagination par curseur partout (`cursor`, `limit` ≤ 50, ≤ 100 pour l'audit, réponse `{ items, nextCursor }`) ; aucune liste n'est chargée entièrement en mémoire. Aucun export de masse n'existe.

## Workflows

### Comptes

`suspend`, `ban` et `reactivate` exigent une justification (`reason`, 3 à 500 caractères) et le statut constaté (`expectedStatus`) : si le statut a changé entre l'affichage et l'action, l'API répond 409 `ACCOUNT_STATUS_CHANGED` (verrou optimiste, ligne verrouillée en transaction). La réactivation remet `ACTIVE` si une coordonnée est vérifiée, sinon `PENDING`, et notifie le titulaire. Il n'existe pas de levée automatique : une suspension se lève à la main.

La liste masque toujours e-mail et téléphone. La recherche par e-mail ou téléphone exige `user:pii` ; la recherche par nom utilise des index trigrammes.

### Annonces

Le back-office ne possède pas de machine à états : chaque décision est une transition de `transitionActors` (module Listing) appliquée par `ListingService.changeStatus` avec `expectedStatus`. Un test vérifie que chaque décision y est autorisée au modérateur avec la même permission.

| Décision          | Depuis                | Vers        | Motif (table)     | Justification interne |
| ----------------- | --------------------- | ----------- | ----------------- | --------------------- |
| `APPROVE`         | `PENDING_REVIEW`      | `PUBLISHED` | —                 | facultative           |
| `REQUEST_CHANGES` | `PENDING_REVIEW`      | `DRAFT`     | `REQUEST_CHANGES` | facultative           |
| `REJECT`          | `PENDING_REVIEW`      | `DRAFT`     | `REJECT`          | facultative           |
| `SUSPEND`         | `PUBLISHED`, `PAUSED` | `SUSPENDED` | `SUSPEND`         | facultative           |
| `RESTORE`         | `SUSPENDED`           | `PUBLISHED` | —                 | obligatoire           |

Dans une même transaction : changement de statut et historique (code du motif et précision destinée à l'annonceur), note interne éventuelle, audit `LISTING_MODERATED`, notification à l'annonceur (message du motif, jamais la note interne). Nul ne modère sa propre annonce. Un conflit de statut renvoie 409 `LISTING_STATUS_CHANGED`.

La fiche présente des contrôles de cohérence calculés (prix, photos, description, bien actif, signalements et alertes ouverts, identité de l'annonceur, prix au m² comparé à la médiane des annonces comparables). Ce sont des aides à la décision (`PASS`, `WARN`, `UNKNOWN`), jamais des preuves ni des sanctions.

### Motifs

Huit motifs de référence sont semés (`INCOMPLETE_INFORMATION`, `PHOTOS_QUALITY`, `PRICE_INCONSISTENT`, `PROHIBITED_CONTENT`, `DUPLICATE_LISTING`, `MISLEADING_LISTING`, `UNDER_INVESTIGATION`, `POLICY_VIOLATION`). Le code et le type sont immuables ; un motif se désactive, il ne se supprime pas (l'historique le cite). Un motif inactif est refusé (422). Le message est transmis à l'annonceur : aucun détail interne ni antifraude. Création et modification auditées.

### Signalements, vérifications, alertes

Délégués à Trust. Un signalement est une allégation : sa clôture comme fondé peut suspendre l'annonce (en passant par la machine à états Listing, avec `listing:suspend`), demander un réexamen de vérification ou fermer une conversation, jamais suspendre un compte. Les alertes de risque se confirment ou s'écartent sans effet automatique. Le score interne n'est affiché que sur demande explicite (consultation auditée) et n'est jamais présenté comme une preuve.

Les pièces de vérification ne sont accessibles qu'avec `verification:documents`, par un lien présigné court demandé à chaque consultation (audité), ouvert puis oublié par l'interface.

### Notes internes

`admin_notes` (cible `user` ou `listing`) : ajout seul (trigger contre `UPDATE`), jamais renvoyées au titulaire ni incluses dans une notification. 50 dernières affichées.

## Tableau de bord

Chaque file est comptée en direct en base, avec sa définition, la date du calcul et l'ancienneté du plus vieil élément ; une file n'apparaît qu'avec la permission correspondante. Les indicateurs analytiques (`analytics:admin`) viennent des agrégats d'Analytics, avec leur période et la date de la dernière agrégation ; tant qu'aucune agrégation n'a tourné, un état vide explicite remplace les chiffres. Un taux sans dénominateur s'affiche « — ».

## Journal d'audit

`audit_logs` (ajout seul) reste distinct d'Analytics. Actions du back-office : `ACCOUNT_SUSPENDED`, `ACCOUNT_BANNED`, `ACCOUNT_REACTIVATED`, `ROLE_CHANGED`, `SESSION_REVOKED`, `USER_CONTACT_VIEWED`, `LISTING_MODERATED`, `ADMIN_NOTE_ADDED`, `MODERATION_REASON_CREATED`, `MODERATION_REASON_UPDATED`, plus celles de Trust. La lecture filtre par type et identifiant d'entité, action, acteur et période ; les valeurs sont expurgées à la lecture (clés de secrets, jetons, mots de passe, codes). Aucun mot de passe, jeton, code OTP, document ni contenu de note n'y est écrit.

## Notifications

Une décision notifie l'annonceur ou le titulaire par le module Communication. Les canaux externes ne sont planifiés que s'ils sont configurés : rien n'est présenté comme envoyé sans fournisseur fonctionnel. La notification de réactivation est créée après la validation de la transaction (non atomique avec elle).

## Limites de débit

Actions d'écriture : 30 par minute (`adminMutationRateLimit`). Fiches avec coordonnées : 20 par minute (`adminContactRevealRateLimit`). Actions Trust : `TRUST_MUTATION_RATE_LIMIT`.

## Frontend (`apps/admin`)

- `next.config.ts` relaie `/api/*` vers `ADMIN_API_URL` (défaut `http://localhost:4000`). Le navigateur reste sur la même origine : le refresh token est le cookie HttpOnly `ma_refresh` posé par l'API (connexion avec `X-Auth-Transport: cookie`), la rotation exige `X-CSRF-Token` égal au cookie `ma_csrf`. Le jeton d'accès vit en mémoire seulement (ni `localStorage` ni `sessionStorage`) ; un 401 déclenche une seule rotation mutualisée puis un nouvel essai.
- En-têtes : `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` ; pages `noindex`.
- Pages : connexion, tableau de bord, utilisateurs (liste, fiche), annonces (file, fiche), signalements et alertes, vérifications (file, dossier), journal d'audit, rôles (lecture), motifs de modération. Chaque vue gère chargement, vide, erreur, 403 et conflit 409.
- Toute action sensible passe par un formulaire de confirmation avec justification ; aucun bouton sans effet réel.

Les rewrites sont calculés au `next build` : `ADMIN_API_URL` doit être présent au moment du build, pas seulement au démarrage. Un build lancé par `turbo` en mode d'environnement strict ne transmet que les variables déclarées : `ADMIN_API_URL` n'est pas encore déclarée dans `turbo.json` (à ajouter à la tâche `build` après vérification de la documentation de la version installée) ; sans elle, le relais vise `http://localhost:4000`.

Derrière ce relais, l'API voit l'IP du serveur Next : `TRUST_PROXY` doit refléter le nombre réel de proxys (par exemple `loopback` quand Next et l'API sont sur la même machine) pour que les limites par IP et les IP d'audit restent justes. En local, `ma_refresh` est commun à `localhost:3000` et `localhost:3001` (les cookies ne distinguent pas les ports) : se connecter au back-office remplace la session du site sur le même navigateur.

## Commandes

```
pnpm --filter @mon-appart/api db:migrate             # migrate deploy
SEED_PROFILE=reference pnpm --filter @mon-appart/api db:seed
pnpm --filter @mon-appart/api exec vitest run src/modules/admin
pnpm --filter @mon-appart/api exec vitest run --config vitest.db.config.ts test/admin
pnpm --filter @mon-appart/admin dev | typecheck | lint | test | build
```

## Non fait (volontairement ou à venir)

- Export CSV ou export de masse ; levée automatique des suspensions.
- Réauthentification récente avant une action sensible, MFA du personnel.
- Expiration manuelle d'une annonce (réservée au système), transfert d'une annonce vers une vérification depuis la fiche.
- Gestion de paramètres système ou de secrets depuis l'interface (hors périmètre par principe).
- Suppression physique d'un compte auteur de notes : `admin_notes.author_id` (comme `audit_logs.actor_id`) passe à `NULL` à la suppression, ce que le trigger d'ajout seul refuse. Les comptes sont supprimés logiquement (`deleted_at`) ; une anonymisation tolérée par le trigger, comme pour les historiques Trust, sera nécessaire avant toute purge physique.
