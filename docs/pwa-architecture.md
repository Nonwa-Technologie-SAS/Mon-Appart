# Architecture PWA — Mon Appart (`apps/web`)

Date : 2026-10-19.

## Objectif

Rendre le site public installable et plus résilient sur mobile, **sans** transformer le service worker en cache générique de données métier ou personnelles.

## Composants

| Élément | Emplacement |
| --- | --- |
| Manifeste | `apps/web/app/manifest.ts` → `/manifest.webmanifest` |
| Service worker | `apps/web/public/sw.js` |
| Page hors ligne | `apps/web/app/offline/page.tsx` |
| Enregistrement / install / update | `components/pwa/pwa-register.tsx` |
| Bandeau offline | `components/pwa/network-status.tsx` |
| Icônes | `public/icons/` (générées depuis `logo.png`) |

## Comportement

- SW enregistré **uniquement en production** (`NODE_ENV === "production"`).
- Installation via `beforeinstallprompt` : non bloquante, mémorisation du refus (`localStorage`).
- Mise à jour : bannière « Recharger » ; `SKIP_WAITING` uniquement sur action utilisateur.
- Mode standalone détecté pour ne pas reproposer l’install.

## Limites assumées

- Pas d’offline-first pour les listes d’annonces (risque de prix / disponibilité obsolètes).
- Pas de Web Push côté web dans ce lot (voir `docs/push-notifications.md`).
- iOS Safari : installation manuelle « Sur l’écran d’accueil » ; pas de `beforeinstallprompt`.
- Ne remplace pas une application native (Expo / futur Flutter).

## Commandes

```bash
pnpm --filter @mon-appart/web icons:pwa
pnpm --filter @mon-appart/web build
pnpm --filter @mon-appart/web test:e2e
```
