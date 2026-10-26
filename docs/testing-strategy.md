# Stratégie de tests — Mon Appart

Document de référence pour la pyramide de tests, l’outillage et les priorités de couverture. État au 16 octobre 2026 (audit Prompt 15).

## Pyramide retenue

| Niveau         | Outil                     | Emplacement                                                                                                | Exécution                                      |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Unitaire       | Vitest                    | `apps/api/src/**/*.spec.ts`, packages, `apps/web/lib/seo/**/*.test.ts`, `services/recommendation` (pytest) | `pnpm test` / CI `verify`                      |
| Contrats smoke | Vitest + Supertest        | `apps/api/test/contracts/`                                                                                 | inclus dans `pnpm test` et `test:e2e` API      |
| API / health   | Vitest + Supertest        | `apps/api/test/*.e2e-spec.ts`                                                                              | `pnpm test:e2e`                                |
| Intégration DB | Vitest + Postgres/PostGIS | `apps/api/test/**/*.db-spec.ts`                                                                            | `pnpm test:db` (CI job `integration`)          |
| E2E web        | Playwright                | `apps/web/e2e/`                                                                                            | `pnpm test:e2e:web` (local ; pas encore en CI) |
| Charge         | k6 (non installé)         | —                                                                                                          | environnement dédié uniquement, hors prod      |

Jest n’est **pas** utilisé. OpenSearch n’est **pas** requis pour la suite standard (`SEARCH_ENGINE=postgres` en tests DB).

## Modules et couverture (cartographie)

| Module                | Critiques                                       | Tests existants                                          | Manques / risques              | Priorité            |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------- | ------------------------------ | ------------------- |
| Identity              | register/login, sessions, OTP, RBAC, rate-limit | unit + `test/identity/*.db-spec.ts`                      | MFA absent (produit)           | Haute — déjà solide |
| Properties / Listings | transitions, prix XOF, publication              | domain specs + `catalog/*.db-spec.ts`                    | concurrence fine multi-clients | Haute               |
| Search                | filtres, geo, pagination                        | domain + `search.db-spec.ts`                             | OpenSearch réel = futur        | Haute               |
| Recommendation        | budget strict, diversité, score                 | domain + `recommendation.db-spec.ts` + pytest Python     | eval offline prod              | Haute               |
| Media                 | upload local, variants                          | domain + `media.db-spec.ts`                              | R2/S3 réel hors CI             | Moyenne             |
| Trust                 | transitions, badges                             | domain + `trust.db-spec.ts`                              | —                              | Moyenne             |
| Communication         | messages, RDV, notifs mock                      | domain + `communication.db-spec.ts`                      | WebSocket CI                   | Moyenne             |
| Billing               | mock provider, webhooks                         | domain + `billing.db-spec.ts`                            | jamais de PSP réel en CI       | Haute               |
| Config / secrets      | boot Zod, `.env` non suivi                      | `packages/config` env.test + `pnpm secrets:check`        | Gitleaks historique            | Haute               |
| Events / Outbox       | atomicité TX, SKIP LOCKED, inbox                | unit `event-schema.spec.ts` + `test/events/*.db-spec.ts` | Kafka non applicable           | Haute               |
| Admin / antifraude    | RBAC admin                                      | domain + `admin.db-spec.ts`                              | fuzz règles                    | Moyenne             |
| Web public            | recherche, SEO                                  | node:test SEO + Playwright smoke                         | parcours auth/publication E2E  | Haute UX            |

## Protections environnement

- `TEST_DATABASE_URL` **doit** finir par `_test` (`test/database/setup.ts`, `prisma/scripts/test-database.ts`).
- Refus si `NODE_ENV`/`APP_ENV` production-like.
- Redis volontairement vide en DB tests → cache mémoire.
- `PAYMENT_PROVIDER=mock`, `EMAIL_PROVIDER=none`, `SMS_PROVIDER=none`, stockage média `local`.

## Objectifs de couverture

- Priorité : assertions métier (transitions, budget, webhooks idempotents), pas un seuil unique fichier par fichier.
- `pnpm test:coverage` génère `apps/api/coverage/` (v8, hors `src/generated`).
- Mesure initiale (unitaires + health/contrats, 2026-10-19) : ~40 % lignes / ~84 % branches globales — les domaines critiques (listing, billing, recommendation, trust, identity) sont nettement au-dessus ; les contrôleurs/services d’infra restent plus bas sans `test:db` dans le rapport de couverture.
- Les `*.db-spec.ts` exercent l’API réelle mais ne sont pas fusionnés dans ce rapport par défaut (processus séparé).
- Cible indicative : ~80 % des **règles métier critiques**, pas 80 % de chaque fichier.
- Seuils CI progressifs à fixer après stabilisation ; ne pas masquer les manques par des exclusions arbitraires hors code généré.

## Anti-patterns interdits

- Faux tests (`expect(true).toBe(true)`).
- `sleep` arbitraires pour attendre des workers (utiliser `runOnce` / polling borné).
- Connexion accidentelle à une base non `*_test`.
- Paiements, SMS ou e-mails réels dans la suite standard.

## CI

Voir `.github/workflows/ci.yml` :

1. **verify** — lint, typecheck, unitaires monorepo, health/contrats API, build.
2. **integration** — Postgres PostGIS service, `db:test:migrate`, `test:db`.
3. **recommendation** — pytest Python.

Playwright web et k6 restent **hors CI** tant que la stabilité et le temps de job ne sont pas validés.

## Prochaines étapes recommandées

1. Brancher Playwright web en job CI optionnel (`workflow_dispatch` ou nightly).
2. Générer un client OpenAPI et un contrôle de divergence contrats.
3. Ajouter axe-core sur 2–3 pages critiques Playwright.
4. Scénarios k6 smoke sur staging uniquement.
