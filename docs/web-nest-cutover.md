# Cutover web → Nest (terminé)

Le site Next.js (`apps/web`) parle **uniquement** à l’API Nest. La base `mon_appart_legacy` et better-auth ne sont plus utilisés par le parcours web.

## Architecture

```
Navigateur → apps/web (UI + blob upload)
                │
                ├─ rewrite /api/v1/*  →  apps/api Nest :4000
                └─ /api/blob/*       →  Vercel Blob (infra locale)
```

| Domaine                      | Chemin Nest                                                    |
| ---------------------------- | -------------------------------------------------------------- |
| Auth                         | `/api/v1/auth/*`, `/api/v1/auth/me`                            |
| Catalogue                    | `/api/v1/search`, `/api/v1/listings/*`                         |
| Publication                  | `/api/v1/properties` → `/listings` → `publish`                 |
| Favoris                      | `/api/v1/interactions/favorites/:listingId`                    |
| Visites                      | `/api/v1/appointments`                                         |
| Analytics / reco / assistant | `/api/v1/analytics/*`, `/recommendations/*`, `/ai-assistant/*` |

## Configuration (`apps/web/.env.local`)

```env
NEST_API_URL=http://localhost:4000
NEXT_PUBLIC_NEST_API_URL=same-origin
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Pas de `DATABASE_URL` web. `NEXT_PUBLIC_NEST_API_URL=off` désactive Nest (non supporté en usage normal).

## Auth

- Cookies Nest : `ma_refresh`, `ma_csrf`, plus `ma_access` (JWT court pour RSC).
- `/api/auth/*` (better-auth) répond **410 Gone**.
- Inscription web → `POST /auth/register` (CUSTOMER) ; rôles OWNER/AGENCY via admin Nest.

### Comptes démo

| Email                            | Mot de passe          | Rôle     |
| -------------------------------- | --------------------- | -------- |
| `owner@demo.mon-appart.local`    | `Demo-Password-2026!` | OWNER    |
| `customer@demo.mon-appart.local` | `Demo-Password-2026!` | CUSTOMER |
| `agent@demo.mon-appart.local`    | `Demo-Password-2026!` | AGENT    |

## Mobile

Expo n’est plus la cible. Flutter consommera Nest directement (hors périmètre web).

## Suivi

1. Pipeline media Nest à la place de Vercel Blob pour la publication.
2. Endpoint `register-publisher` (OWNER/AGENCY).
3. Retirer les dépendances npm `better-auth` / `@prisma/*` du package web quand plus aucun script local ne les référence.
4. Extinction Docker `mon_appart_legacy` quand plus aucune app ne l’utilise.
