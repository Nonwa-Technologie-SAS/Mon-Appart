# 0016 — Socle Flutter à côté d’Expo

Date : 2026-10-28

## Contexte

Le dépôt contient déjà `apps/mobile` (Expo 57 / React Native), branché sur l’API prototype Next (`/api/properties`, Better Auth). L’ADR [0002](./0002-preserve-existing-applications.md) interdit de remplacer cette application par un squelette Flutter.

Le backend cible (`apps/api`, Nest `/api/v1`, Identity JWT + refresh opaque) est en place. Le site public a une identité visuelle (bleu `#1565C0`, ambre `#F5B400`).

## Décision

1. Créer `apps/flutter/` comme client Android/iOS dédié à Nest, **sans modifier ni supprimer** `apps/mobile`.
2. Riverpod 3, go_router, Dio derrière une interface `ApiClient`, `flutter_secure_storage`.
3. Configuration par `--dart-define` (`API_BASE_URL`, `APP_ENV`, `ENABLE_NETWORK_LOGS`). Aucun secret, aucun `.env` embarqué.
4. Auth mobile : Bearer JSON (pas `X-Auth-Transport: cookie`). Refresh Identity documenté mais **non implémenté** dans le premier lot (rotation stricte).
5. Sonde de connectivité : `GET /health/live` (contrat vérifié), pas d’endpoint inventé.

## Raisons

- Conserver Expo évite une perte de métier déjà écrit.
- Flutter parle à Nest `/api/v1`, alors qu’Expo parle encore au prototype web.
- Une seule bibliothèque par rôle (état, nav, HTTP, stockage).

## Conséquences

- Deux clients mobiles coexistent jusqu’à une bascule produit explicite.
- `pnpm-workspace` ne déclare pas Flutter (projet Dart).
- La CI ajoute un job Flutter distinct (format, analyze, test, APK debug). Le build iOS reste hors Windows.

## Alternatives rejetées

- Remplacer `apps/mobile` : contraire à l’ADR 0002.
- Générer un client OpenAPI : pas de spec figée dans le dépôt (Swagger runtime `/docs` seulement).
- Implémenter le refresh tout de suite : risque de révocation de famille si deux appels concurrents.
