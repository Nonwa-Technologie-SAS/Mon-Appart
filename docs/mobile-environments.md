# Environnements mobiles & PWA

## Web (`apps/web`)

| Variable | Obligatoire | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | prod | Canonical / OG / PWA scope logique |
| `DATABASE_URL` | oui | Base **legacy** prototype (pas Nest) |
| `BETTER_AUTH_SECRET` | oui | Auth web |

PWA : le SW ne dépend d’aucune variable secrète.

## Expo (`apps/mobile`)

Configurer l’URL API publique du prototype (ou Nest plus tard) via les variables Expo publiques documentées dans `apps/mobile/src/lib/config.ts`.

## Nest (`apps/api`)

Push, email, SMS : secrets uniquement serveur. Voir `.env.example` racine.

## Règle

Toute variable `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` est **publique**. Ne pas y mettre de JWT secret, clé S3, VAPID private, ni DSN avec droits d’écriture sensibles.
