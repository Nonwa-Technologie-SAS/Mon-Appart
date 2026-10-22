# Module Identity

Authentification, sessions, vérification du téléphone et de l'email, réinitialisation du mot de passe et contrôle d'accès (RBAC) de l'API. Décision d'architecture : [ADR 0004](./decisions/0004-identity-architecture.md). Tables : [database.md](./database.md).

## Organisation

`apps/api/src/modules/identity/`

| Couche           | Contenu                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `domain`         | Règles pures, sans Nest ni Prisma : codes d'erreur, normalisation email/téléphone, politique de mot de passe, statuts, OTP, événements |
| `application`    | Cas d'usage : `AuthService`, `SessionService`, `PasswordService`, `VerificationService`, `ProfileService`, `AccountAdminService`       |
| `infrastructure` | Prisma (repositories), HMAC, JWT, Redis (révocation, limites), fournisseurs email/SMS                                                  |
| `presentation`   | Contrôleurs, DTO, sérialiseurs, gardes, décorateurs, cookies                                                                           |

Pas d'interface « repository » abstraite : les services dépendent des classes Prisma, remplaçables dans les tests par `overrideProvider`. Les seuls ports sont `EmailProvider` et `SmsProvider`, parce que leur implémentation réelle changera.

`src/modules/identity/index.ts` est la seule entrée publique du module : `@Public()`, `@Roles()`, `@Permissions()`, `@CurrentUser()`, `@Client()`, les gardes et `AccountAdminService`.

## Endpoints

Préfixe `/api/v1/auth`. Swagger (`/docs` en local) décrit les corps, réponses et codes d'erreur.

| Méthode | Chemin                  | Accès       | Réponse                                              |
| ------- | ----------------------- | ----------- | ---------------------------------------------------- |
| POST    | `/register`             | public      | 201, session ouverte                                 |
| POST    | `/login`                | public      | 200, session ouverte                                 |
| POST    | `/refresh`              | public      | 200, nouveaux jetons                                 |
| POST    | `/logout`               | authentifié | 204, session courante révoquée                       |
| POST    | `/logout-all`           | authentifié | 200, `{ revokedSessions }`                           |
| GET     | `/me`                   | authentifié | profil                                               |
| PATCH   | `/me`                   | authentifié | profil (prénom, nom)                                 |
| POST    | `/change-password`      | authentifié | 200, les autres sessions sont révoquées              |
| POST    | `/forgot-password`      | public      | 202, réponse identique que le compte existe ou non   |
| POST    | `/reset-password`       | public      | 200, toutes les sessions sont révoquées              |
| POST    | `/email/verify/request` | authentifié | 202, `{ challengeId, expiresAt, resendAvailableAt }` |
| POST    | `/email/verify/confirm` | authentifié | 200, `{ verified, status }`                          |
| POST    | `/phone/verify/request` | authentifié | 202                                                  |
| POST    | `/phone/verify/confirm` | authentifié | 200                                                  |
| GET     | `/sessions`             | authentifié | sessions actives, `current` marque la courante       |
| DELETE  | `/sessions/:sessionId`  | authentifié | 204                                                  |

Les demandes de code n'ont pas de corps : la destination est toujours celle du compte. Un client ne peut pas faire envoyer un code à une adresse arbitraire.

Une erreur suit le format commun de l'API, avec un `code` stable (`INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `OTP_COOLDOWN`...) défini dans `domain/auth-errors.ts`. Les réponses 429 portent `Retry-After`. Aucune erreur ne contient de pile, de requête SQL ni de détail interne.

## Identifiants

- Email : minuscules, espaces retirés ; colonne `CITEXT`.
- Téléphone : `libphonenumber-js`, région par défaut `CI`. `0701020304`, `07 01 02 03 04` et `+2250701020304` désignent le même numéro, stocké en E.164.
- `login` et `forgot-password` acceptent un `identifier` qui est l'un ou l'autre.
- À l'inscription, l'email ou le téléphone est obligatoire (`CONTACT_REQUIRED`).

## Mots de passe

Argon2id (`@node-rs/argon2`), réglable par `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM` (défauts OWASP : 19 MiB, 2, 1).

Politique : 10 à 128 caractères, refus des mots de passe courants, des répétitions (`aaaaaaaaaa`) et de ceux qui contiennent l'email ou le téléphone. Pas de règle de composition forcée : une phrase de passe longue vaut mieux.

Quand l'identifiant est inconnu, un hash factice est vérifié pour que la durée de réponse ne révèle pas l'existence du compte.

## Jetons et sessions

**Access token.** JWT HS256 signé par `JWT_SECRET`, durée `JWT_ACCESS_TTL` (15 min). Claims : `sub` = `public_id` de l'utilisateur, `sessionId`, `roles`, `typ: "access"`, `iss: mon-appart-api`, `aud: mon-appart`. Aucun identifiant interne ni donnée personnelle. Un jeton sans `typ`, avec `alg: none`, une autre audience ou un rôle inconnu est refusé.

**Refresh token.** 32 octets aléatoires (base64url), opaque. La base ne garde que `HMAC-SHA256` (`auth_sessions.token_hash`). Durée `JWT_REFRESH_TTL` (30 j), glissante : chaque refresh repousse l'échéance.

**Session.** Une ligne `auth_sessions` par refresh token émis. `family_id` est la session logique : c'est le `sessionId` exposé et présent dans le JWT. Un refresh marque la ligne courante `ROTATED` et insère la suivante dans la même famille, dans une transaction.

**Réutilisation.** Présenter un refresh token déjà tourné signifie qu'il a été copié : toute la famille est révoquée (`REUSE_DETECTED`), un audit `REFRESH_TOKEN_REUSE_DETECTED` est écrit et la métrique `auth_refresh_reuse_detected_total` incrémentée. C'est volontairement strict : deux refresh simultanés avec le même token (deux onglets, une double requête réseau) se traduisent par une déconnexion. Le client doit sérialiser ses appels à `/refresh`.

**Révocation des access tokens.** Le JWT est vérifié localement, puis la famille est cherchée dans Redis (`mon-appart:auth:revoked-session:{familyId}`, TTL = durée de l'access token + 5 s). Logout, logout-all, changement ou réinitialisation de mot de passe, suspension et réutilisation y publient les familles révoquées : l'access token cesse de fonctionner immédiatement, sans attendre son expiration. Sans Redis, une liste en mémoire prend le relais (valable pour une seule instance).

PostgreSQL reste la source de vérité : le refresh est toujours validé en base, et les opérations sensibles (changement de mot de passe, logout-all, liste et révocation des sessions) vérifient que la session est active en base. Si Redis perd une entrée, un access token révoqué reste utilisable au plus 15 minutes sur les routes ordinaires, jamais pour un refresh.

**Rôles.** Ils sont copiés dans l'access token. Un changement de rôle prend effet au prochain refresh ou login, donc au plus après 15 minutes. Une suspension, elle, révoque les sessions immédiatement.

## Clients web et mobiles

| Client | Signal                             | Refresh token                                                                                                    |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Mobile | par défaut                         | dans le corps JSON (`refreshToken`), à stocker dans le trousseau sécurisé                                        |
| Web    | en-tête `X-Auth-Transport: cookie` | cookie `ma_refresh` HttpOnly, `SameSite=Strict`, `Path=/api/v1/auth`, `Secure` hors local/test ; absent du corps |

En mode cookie, l'API pose aussi `ma_csrf`, lisible par le front (`Path=/`). Un refresh par cookie exige l'en-tête `X-CSRF-Token` égal à ce cookie (double soumission) ; sinon 403 `CSRF_INVALID`. L'access token reste dans la mémoire du front et circule en `Authorization: Bearer`, jamais en cookie : les autres routes ne sont donc pas exposées au CSRF.

Les cookies sont posés sans attribut `Domain`, donc sur l'hôte de l'API. En local (`localhost:3000` et `localhost:4000`), le front lit `ma_csrf` car les cookies ne tiennent pas compte du port. En production, le front ne peut lire ce cookie que si l'API est servie sur le même hôte (reverse proxy `monappart.ci/api`). Avec des sous-domaines distincts (`app.` et `api.`), il faudra ajouter une variable `COOKIE_DOMAIN` ou renvoyer le jeton CSRF dans la réponse ; ce n'est pas encore fait.

CORS : liste explicite `CORS_ORIGINS` + `WEB_APP_URL` + `ADMIN_APP_URL`, `*` ignoré, credentials autorisés, en-têtes `X-CSRF-Token` et `X-Auth-Transport` acceptés, `Retry-After` exposé.

## Statuts de compte

| Statut      | Connexion et refresh                                  |
| ----------- | ----------------------------------------------------- |
| `PENDING`   | autorisés ; passe `ACTIVE` à la première vérification |
| `ACTIVE`    | autorisés                                             |
| `SUSPENDED` | 403 `ACCOUNT_SUSPENDED`, sessions révoquées           |
| `BANNED`    | 403 `ACCOUNT_BANNED`, sessions révoquées              |
| `INACTIVE`  | 403 `ACCOUNT_INACTIVE`                                |
| supprimé    | traité comme inexistant (401)                         |

Le statut n'est révélé qu'après un mot de passe correct. Avec un mauvais mot de passe, la réponse reste `INVALID_CREDENTIALS`.

## OTP

Code de `OTP_LENGTH` chiffres (6) tiré par `crypto.randomInt`, valable `OTP_TTL` (5 min), `OTP_MAX_ATTEMPTS` essais (5), nouvel envoi après `OTP_RESEND_COOLDOWN` secondes (60).

- Stocké sous forme `HMAC(publicId du challenge : code)` : deux challenges avec le même code n'ont pas la même empreinte.
- La destination est aussi hachée (`destination_hash`) : changer d'email ou de téléphone invalide le code.
- Un nouvel envoi consomme les challenges encore ouverts du même usage.
- Les essais sont comptés par un `UPDATE ... WHERE attempts < max_attempts` atomique : des requêtes parallèles ne dépassent pas la limite.
- Un code consommé, expiré ou épuisé ne sert plus.
- L'usage `LOGIN` (connexion par code seul) est prévu dans l'enum mais n'a pas d'endpoint.

## Réinitialisation du mot de passe

`forgot-password` répond toujours 202 avec le même corps, que le compte existe, soit banni ou que l'identifiant soit invalide. Pour un compte éligible, un jeton opaque de 32 octets est envoyé par email (lien `WEB_APP_URL/reset-password?token=...`) ou par SMS, valable `PASSWORD_RESET_TTL` (30 min). Une nouvelle demande remplace les jetons précédents.

`reset-password` consomme le jeton, change le mot de passe, invalide les autres jetons et révoque toutes les sessions, dans une transaction.

## Énumération des comptes

Login, forgot-password et les durées de réponse ne révèlent pas l'existence d'un compte. L'inscription, elle, répond 409 `EMAIL_ALREADY_USED` ou `PHONE_ALREADY_USED` : masquer ce cas obligerait à confirmer l'inscription par un message, ce qui dégrade le parcours sur mobile. Le risque est contenu par la limite d'inscriptions par IP. Si le besoin change, l'inscription pourra répondre 202 et envoyer un code, sans changer le modèle.

## Limites de débit

Compteurs Redis (`INCR` + `EXPIRE NX`, Redis 7) avec repli en mémoire. Les clés sont des empreintes HMAC : aucun email, téléphone ni IP en clair dans Redis.

| Palier                               | Clé                 | Limite par défaut                                                    | Dépassement                                  |
| ------------------------------------ | ------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| Inscription                          | IP                  | `AUTH_REGISTER_RATE_LIMIT` / `AUTH_RATE_LIMIT_WINDOW` (5 / 60 s)     | 429 `RATE_LIMITED`                           |
| Connexion                            | IP                  | `AUTH_LOGIN_RATE_LIMIT` (10 / 60 s)                                  | 429 `RATE_LIMITED`                           |
| Échecs de connexion                  | identifiant         | `AUTH_MAX_LOGIN_ATTEMPTS` / `AUTH_LOGIN_FAILURE_WINDOW` (5 / 15 min) | 429 `TOO_MANY_ATTEMPTS`                      |
| Échecs de changement de mot de passe | utilisateur         | idem                                                                 | 429 `TOO_MANY_ATTEMPTS`                      |
| Demande de réinitialisation          | IP / identifiant    | `AUTH_RESET_RATE_LIMIT` (5 / 60 s)                                   | IP : 429 ; identifiant : ignoré sans le dire |
| Confirmation de réinitialisation     | IP                  | 2 × `AUTH_RESET_RATE_LIMIT`                                          | 429 `RATE_LIMITED`                           |
| Demande de code                      | utilisateur / IP    | `AUTH_OTP_RATE_LIMIT` (5), 4 × par IP                                | 429 `RATE_LIMITED`                           |
| Délai entre deux codes               | utilisateur + usage | `OTP_RESEND_COOLDOWN` (60 s)                                         | 429 `OTP_COOLDOWN`                           |

Il n'y a jamais de verrouillage permanent : le blocage par identifiant expire avec sa fenêtre et un login réussi le remet à zéro. Le `ThrottlerGuard` global reste en place en plus de ces paliers.

Derrière un reverse proxy, régler `TRUST_PROXY` (par exemple `1`), sinon toutes les requêtes semblent venir du proxy et partagent la même limite par IP. Ne jamais l'activer sans proxy : `X-Forwarded-For` serait alors falsifiable.

## RBAC

Gardes globaux, dans l'ordre : `ThrottlerGuard`, `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`. Toute route est authentifiée sauf `@Public()` (health, métriques, racine et endpoints publics d'auth).

- `@Roles("MODERATOR", "ADMIN")` : l'un des rôles suffit (403 `INSUFFICIENT_ROLE`).
- `@Permissions("user:suspend")` : toutes les permissions sont exigées (403 `INSUFFICIENT_PERMISSION`). Elles sont déduites des rôles par `role_permissions`, avec un cache de 60 s.
- `SUPER_ADMIN` passe les deux gardes.

`AccountAdminService` (changement de rôle, suspension, bannissement, réactivation) est prêt pour le back-office mais n'a pas encore d'endpoint. Chaque opération écrit son audit dans la même transaction ; une suspension révoque aussi toutes les sessions.

## Audit, événements, observabilité

`audit_logs` reçoit : inscription, connexion réussie ou échouée (sans acteur quand le compte n'est pas prouvé), déconnexion, révocation de session, réutilisation de refresh token, changement et réinitialisation de mot de passe, vérification email et téléphone, changement de rôle et de statut. Les valeurs auditées ne contiennent jamais de secret.

Les événements `identity.*` (`identity.user.registered`, `identity.session.revoked`...) sont émis en mémoire après la transaction. Ils ne sont pas encore durables : un outbox transactionnel sera nécessaire quand un consommateur externe (workers, notifications) en dépendra.

Métriques Prometheus : `auth_login_success_total`, `auth_login_failure_total{reason}`, `auth_refresh_total{outcome}`, `auth_refresh_reuse_detected_total`, `auth_otp_sent_total{channel}`, `auth_otp_failure_total{reason}`, `auth_password_reset_requested_total`.

Les journaux masquent `password`, `currentPassword`, `newPassword`, `refreshToken`, `token`, `code`, `otp`, `Authorization`, `Cookie`, `Set-Cookie`, `X-CSRF-Token` et `?token=`. Ils ne contiennent ni OTP, ni jeton, ni mot de passe.

## Fournisseurs email et SMS

`DevNotificationProvider` est le seul fournisseur. Il garde les derniers messages en mémoire (lus par les tests) et ne les affiche sur la console que si `AUTH_DEV_PRINT_CODES=true`, option refusée par la configuration hors `APP_ENV=local`. En staging et en production, un avertissement est journalisé au démarrage : aucun message ne part réellement. Brancher un vrai fournisseur consiste à implémenter `EmailProvider` / `SmsProvider` et à remplacer `useExisting` dans `identity.module.ts`.

## Clés et secrets

| Variable             | Usage                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`         | signature des access tokens                                                                                                                        |
| `JWT_REFRESH_SECRET` | dérive la clé HMAC (`HMAC(secret, "mon-appart:identity:hmac:v1")`), séparée par usage : refresh token, réinitialisation, OTP, destination, limites |

Changer `JWT_SECRET` déconnecte tout le monde au bout de 15 minutes. Changer `JWT_REFRESH_SECRET` invalide immédiatement toutes les sessions, codes et liens en cours. La rotation sans coupure (deux clés acceptées pendant une période) n'est pas implémentée.

## Tests

| Commande                                | Contenu                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm --filter @mon-appart/api test`    | unitaires : domaine, HMAC, JWT, rotation et réutilisation des sessions, gardes                   |
| `pnpm --filter @mon-appart/api test:db` | intégration sur `mon_appart_test` : parcours complets, sécurité, RBAC, limites (`test/identity`) |

Les tests d'intégration démarrent l'application complète. `test/database/setup.ts` refuse toute base dont le nom ne finit pas par `_test` et force `DATABASE_URL` sur elle. Redis y est désactivé (repli mémoire) et les limites par IP relevées, sauf dans `rate-limit.db-spec.ts`.

## Étapes suivantes

- **Changement d'email ou de téléphone** : `POST /me/email` et `/me/phone` avec code envoyé à la nouvelle adresse (usage `PHONE_CHANGE` déjà dans l'enum), changement effectif après confirmation, notification à l'ancienne adresse, révocation des autres sessions.
- **Google et Apple** : table `user_identities (provider, subject)` liée à `users`, vérification du jeton d'identité côté serveur, ouverture de session par `SessionService.open`. `password_hash` est déjà nullable.
- **MFA** : TOTP avec secret chiffré (clé hors base) et codes de secours hachés ; étape intermédiaire entre mot de passe et émission des jetons.
- **Connexion par code seul** : endpoint s'appuyant sur l'usage `LOGIN`.
- **Fournisseurs réels** email et SMS, et outbox transactionnel pour les événements.
- **Purge** des lignes expirées de `auth_sessions`, `otp_challenges` et `password_reset_tokens` par un job worker.
- **Rotation des clés** JWT et HMAC avec identifiant de clé (`kid`).
