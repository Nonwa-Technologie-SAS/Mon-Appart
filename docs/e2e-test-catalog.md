# Catalogue des parcours E2E

## Web (`apps/web` — Playwright)

Prérequis : Node 22, `pnpm install`, navigateur Playwright (`pnpm --filter @mon-appart/web exec playwright install chromium`).

Commande : `pnpm test:e2e:web`  
Base URL : `PLAYWRIGHT_BASE_URL` ou serveur Next démarré automatiquement sur `http://127.0.0.1:3000`.

| ID | Parcours | Statut | Fichier | Notes |
| --- | --- | --- | --- | --- |
| A1 | Accueil + marque + formulaire | Implémenté | `e2e/home.spec.ts` | Smoke |
| A2 | Recherche Cocody via URL | Implémenté | `e2e/home.spec.ts` | Dépend des données locales |
| A3 | Catalogue `/appartements-a-louer` | Implémenté | `e2e/home.spec.ts` | |
| A4 | `robots.txt` / `sitemap.xml` | Implémenté | `e2e/home.spec.ts` | |
| A5 | Ouverture fiche depuis résultats | Implémenté (skip si vide) | `e2e/listing-public.spec.ts` | |
| A6 | 404 annonce inexistante | Implémenté | `e2e/listing-public.spec.ts` | |
| B | Inscription + contact | À faire | — | Compte + OTP / Better Auth |
| C | Publication annonce | À faire | — | Auth propriétaire + médias |
| D | Recommandations UI | À faire | — | Si UI branchée API Nest |
| E | Monétisation UI | À faire | — | Mock billing côté API déjà testé en DB |
| F | Modération back-office | À faire | — | Cible `apps/admin` |

## API Nest (`apps/api`)

| ID | Parcours | Statut | Fichier |
| --- | --- | --- | --- |
| H1 | Health live / ready / meta | Implémenté et exécuté en CI | `test/health.e2e-spec.ts` |
| C1 | Contrat meta + non-fuite secrets | Implémenté | `test/contracts/api-meta.contract-spec.ts` |
| I* | Identity flux complets | Implémenté (job integration) | `test/identity/*.db-spec.ts` |
| L* | Catalog / listings | Implémenté (job integration) | `test/catalog/*.db-spec.ts` |
| S* | Search | Implémenté (job integration) | `test/search/search.db-spec.ts` |
| R* | Recommendation | Implémenté (job integration) | `test/recommendation/*.db-spec.ts` |
| P* | Billing mock + webhooks | Implémenté (job integration) | `test/billing/billing.db-spec.ts` |

Les suites `*.db-spec.ts` sont des **parcours API réels** (Supertest + Postgres), pas des E2E navigateur.

## Accessibilité

Non automatisée pour l’instant. Limite documentée : axe-core + revue manuelle clavier/contrastes requis avant certification WCAG.
