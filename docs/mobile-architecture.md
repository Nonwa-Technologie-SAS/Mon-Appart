# Architecture mobile — Mon Appart

## État réel (audit 2026-10-19)

| Client        | Technologie                | Emplacement     | Rôle                                            |
| ------------- | -------------------------- | --------------- | ----------------------------------------------- |
| Web + PWA     | Next.js 16                 | `apps/web`      | SEO, recherche, publication, PWA                |
| Mobile actuel | **Expo 57 / React Native** | `apps/mobile`   | App smartphone branchée sur l’API prototype web |
| Backend       | NestJS                     | `apps/api`      | API `/api/v1` (cible produit)                   |
| Flutter       | **Socle initial**          | `apps/flutter/` | Client Nest `/api/v1` (ADR 0016), Expo conservé |

**Décision ADR 0002** : ne pas remplacer Expo par un squelette Flutter. Flutter pourra arriver **à côté** plus tard, en consommant NestJS.

## Expo (`apps/mobile`) aujourd’hui

- Auth : token en SecureStore (natif) / localStorage (web Expo) — à migrer vers les cookies / Identity Nest lors de la bascule API.
- Réseau : `src/lib/api.ts` vers l’API du prototype (`/api/properties`, etc.).
- Médias : upload blob + image picker.
- Thème : `src/constants/theme.ts`.

Évolutions recommandées (sans réécriture) :

1. Pointer progressivement vers Nest `/api/v1`.
2. Aligner tokens design avec `docs/ux-ui-design-system.md`.
3. Réutiliser les contrats OpenAPI / packages `@mon-appart/types` quand stables.

## Flutter (`apps/flutter/`) — socle (ADR 0016)

Créé à côté d’Expo, sans le remplacer. Détail : [apps/flutter/README.md](../apps/flutter/README.md).

```
apps/flutter/
  lib/
    app/           # bootstrap, env, thème, router
    core/          # http, erreurs, secure storage, widgets
    features/      # splash, accueil (GET /health/live), placeholders
```

- État : Riverpod 3. Navigation : go_router. HTTP : Dio derrière `ApiClient`.
- Auth : Bearer Identity ; refresh **non branché** dans le premier lot ; stockage Keystore/Keychain.
- Design : tokens du site (`#1565C0`, `#F5B400`).
- Config : `--dart-define` (`API_BASE_URL` obligatoire).

## Environnements

| Variable (exemples)                   | Usage                                 |
| ------------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                | Origine web / PWA                     |
| `EXPO_PUBLIC_API_URL` (mobile)        | Base API Expo                         |
| `API_BASE_URL` (Flutter, dart-define) | Base Nest, ex. `http://10.0.2.2:4000` |
| Nest `WEB_APP_URL`, JWT secrets       | Backend uniquement                    |

Ne jamais embarquer de clés privées push ou S3 dans les clients.
