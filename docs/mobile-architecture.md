# Architecture mobile — Mon Appart

## État réel (audit 2026-10-19)

| Client | Technologie | Emplacement | Rôle |
| --- | --- | --- | --- |
| Web + PWA | Next.js 16 | `apps/web` | SEO, recherche, publication, PWA |
| Mobile actuel | **Expo 57 / React Native** | `apps/mobile` | App smartphone branchée sur l’API prototype web |
| Backend | NestJS | `apps/api` | API `/api/v1` (cible produit) |
| Flutter | **Absent** | — | Reporté (ADR 0002) |

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

## Cible Flutter (phase ultérieure)

Structure proposée (à créer seulement quand le produit le décide) :

```
apps/flutter/
  lib/
    app/           # bootstrap, env
    core/          # http, erreurs, secure storage
    features/      # auth, search, listing, publish…
    shared/ui/
    design_system/
    routing/
```

- État : une seule solution (ex. Riverpod ou Bloc) — à choisir au kickoff.
- Auth mobile : Bearer + refresh Identity Nest ; stockage sécurisé OS ; jamais de secrets serveur dans le binaire.
- Pas de duplication des règles prix / reco / droits : tout côté Nest.
- Design : mêmes couleurs / formats prix XOF que le web, pas de partage de code React.

## Environnements

| Variable (exemples) | Usage |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Origine web / PWA |
| `EXPO_PUBLIC_API_URL` (mobile) | Base API Expo |
| Nest `WEB_APP_URL`, JWT secrets | Backend uniquement |

Ne jamais embarquer de clés privées push ou S3 dans les clients.
