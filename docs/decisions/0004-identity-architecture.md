# 0004 — Architecture du module Identity

Date : 2026-10-07

Numérotation : le brief demandait « 0002 », déjà pris par [0002-preserve-existing-applications](./0002-preserve-existing-applications.md). Les ADR existants ne sont pas renumérotés ; celui-ci prend le numéro libre suivant.

## Contexte

Le modèle de données (ADR 0003) contenait `users`, `roles`, `permissions`, mais l'API n'avait ni connexion, ni session, ni RBAC appliqué : seuls un `TokenService` JWT et un `RolesGuard` non globaux existaient. Il fallait une authentification par mot de passe et OTP pour des clients web et mobiles en Côte d'Ivoire (téléphone souvent seul identifiant), sans tiers d'identité pour l'instant.

## Décision

1. **Module unique `modules/identity`** en quatre couches (domain, application, infrastructure, presentation), sans interfaces de repository : seuls l'email et le SMS sont des ports. Le `SecurityModule`, le `TokenService` et l'ancien `RolesGuard` sont remplacés ; `PasswordHasher` (Argon2id) est conservé et rendu configurable.
2. **JWT d'accès court (15 min) + refresh token opaque rotatif.** Le refresh token n'est pas un JWT : il n'a de sens que confronté à la base, qui n'en garde qu'un HMAC.
3. **Une ligne `auth_sessions` par refresh token, regroupées par `family_id`.** La famille est la session visible par l'utilisateur. La rotation laisse une trace (`ROTATED`) qui permet de détecter la réutilisation et de révoquer toute la famille.
4. **HMAC-SHA256 plutôt qu'Argon2 pour les jetons et codes.** Ils ont une forte entropie (refresh, reset) ou une durée et un nombre d'essais très limités (OTP) ; un HMAC à clé permet la recherche par égalité indexée et résiste à une fuite de la base sans la clé. La clé est dérivée de `JWT_REFRESH_SECRET`, séparée par usage.
5. **Révocation immédiate des access tokens par liste Redis des familles révoquées**, avec TTL égal à la durée de vie du jeton. PostgreSQL reste la source de vérité pour le refresh et les opérations sensibles.
6. **Web par cookie HttpOnly + double soumission CSRF, mobile par corps JSON**, choisi par l'en-tête `X-Auth-Transport`. L'access token n'est jamais en cookie.
7. **Limites par paliers dans Redis** (IP, identifiant, utilisateur), blocage temporaire, jamais de verrouillage permanent, clés hachées.
8. **RBAC par gardes globaux** : tout est authentifié sauf `@Public()`. Permissions déduites des rôles en base.
9. **Erreurs à code stable** ajoutées au format existant, messages génériques pour l'authentification.
10. **Audit synchrone dans la transaction** des opérations qui modifient l'état ; événements en mémoire après validation.

## Alternatives écartées

- **Sessions serveur seules (cookie de session)** : ne convient pas aux applications mobiles et impose une lecture en base à chaque requête.
- **JWT longs sans refresh** : impossible à révoquer.
- **Refresh token JWT** : signature inutile puisqu'il est toujours vérifié en base, et plus long à stocker.
- **Argon2 pour les refresh tokens** : empêche la recherche indexée, coûteux à chaque refresh, sans gain face à 256 bits d'entropie.
- **Vérification en base à chaque requête** : charge proportionnelle au trafic ; la liste Redis donne la même révocation pour les cas qui comptent.
- **Passport** : abstraction supplémentaire pour deux stratégies simples ; les gardes Nest suffisent. Google et Apple pourront être ajoutés sans lui.
- **Verrouillage du compte après N échecs** : permet à un tiers de bloquer n'importe quel compte.
- **Masquer l'existence du compte à l'inscription** : impose une confirmation par message avant tout usage ; reporté (voir identity.md).

## Conséquences

- Deux refresh simultanés avec le même token déconnectent l'utilisateur ; les clients doivent sérialiser `/refresh`.
- Un changement de rôle prend effet au prochain refresh (≤ 15 min).
- Sans Redis, la révocation immédiate ne vaut que pour l'instance qui l'a prononcée.
- Changer `JWT_REFRESH_SECRET` invalide toutes les sessions, codes et liens.
- Toute nouvelle route est protégée par défaut ; une route publique doit être marquée `@Public()`.
- Migration `20261007200817_identity_auth` : `auth_sessions`, `password_reset_tokens`, `otp_challenges`, enums `otp_channel` et `otp_purpose`.
