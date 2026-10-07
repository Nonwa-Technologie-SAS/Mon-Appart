# Sécurité

## En place

- Helmet
- CORS limité à `CORS_ORIGINS` (liste explicite, credentials autorisés)
- Rate limiting
- Validation et rejet des champs inconnus
- Journaux structurés avec masquage des mots de passe, jetons, cookies et secrets
- `X-Request-ID` borné à un jeu de caractères sûr (pas de retour ligne dans l'en-tête)
- Hash de mot de passe Argon2id (`@node-rs/argon2`, mémoire 19 MiB, 2 itérations, parallélisme 1)
- Module JWT préparé (access + refresh) sans endpoints de connexion
- Décorateur `@Roles()` et `RolesGuard`, non globaux tant que l'identité n'existe pas
- Secrets uniquement via l'environnement, fichier `.env` ignoré par Git

## Pas encore en place

L'authentification, les sessions, le RBAC appliqué aux routes, l'audit persistant et la rotation des secrets ne sont pas implémentés. Les brancher sans table utilisateur créerait une fausse sécurité.

Les rôles prévus reprennent le vocabulaire du prototype : `VISITOR`, `TENANT`, `OWNER`, `AGENCY`, `ADMIN`, `SUPERADMIN`.

## Journaux

Un log peut contenir l'horodatage, le niveau, le service, `request_id`, `user_id` si un utilisateur est déjà attaché à la requête, la route, le statut et la durée (pino-http). Il ne contient pas le mot de passe, le JWT, le refresh token, ni le secret.

Les URL `postgresql://` et `redis://` sont retirées des messages d'erreur renvoyés aux logs de santé.

## Fichiers

Les images, vidéos et documents iront dans un stockage S3 compatible (R2 ou AWS). PostgreSQL ne stockera que les métadonnées.

## Swagger

Désactivé en staging et en production, sauf activation explicite.
