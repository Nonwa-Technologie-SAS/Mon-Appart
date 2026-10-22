# SEO, performance web et acquisition organique

Implémentation sur `apps/web` (Next.js 16, App Router). Le prototype conserve sa base `mon_appart_legacy` (ADR 0002) : ce document décrit le SEO du site public actuel, pas encore branché sur l’API Nest des listings.

**Aucun classement Google n’est promis.** Les fondations techniques et la mesurabilité sont l’objectif.

## Architecture des URL

| Type | Pattern | Indexation |
| --- | --- | --- |
| Accueil | `/` | oui (sans filtres) |
| Catalogue | `/locations`, `/appartements-a-louer`, `/maisons-a-louer`, `/studios-a-louer`, `/villas-a-louer`, `/terrains`, `/bureaux` | oui si annonces AVAILABLE |
| Locale | `/location/{slug}` | oui si ≥ 1 annonce avec ce libellé `location` |
| Annonce | `/annonces/{slug}--{uuid}` | oui si AVAILABLE |
| Legacy | `/biens/{uuid}` | redirection 308 vers l’URL canonique |
| Guides | `/guides/…` | oui |
| Auth / espace / admin | `/connexion`, `/inscription`, `/espace`, `/admin` | `noindex` + auth |
| Recherche filtrée | `/?q&type&maxPrice&lat&lng` | `noindex`, follow |

Le slug d’annonce est cosmétique : l’UUID résout la fiche. Un slug obsolète redirige vers le slug actuel (308).

## Métadonnées

Helpers : `apps/web/lib/seo/metadata.ts`.

- `metadataBase` = `NEXT_PUBLIC_SITE_URL` (sinon `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` / localhost).
- Titre, description, `alternates.canonical`, Open Graph, Twitter.
- Fiches : type, localisation, prix F CFA, extrait de description — sans inventer de champs manquants.
- Hors production : `robots: noindex` sauf `NEXT_PUBLIC_SEO_INDEXING=true`.

## Canonicalisation et filtres

Voir `decideHomeSearchIndexability` (`lib/seo/indexation.ts`) :

- Accueil propre → indexable, canonical `/`.
- `type` seul → non indexé, canonical vers la page catalogue.
- Autres combinaisons → non indexées, canonical `/`.

Les filtres restent utilisables dans l’UI ; le SEO ne les multiplie pas en pages.

## Sitemaps et robots

- `app/robots.ts` — disallow auth/espace/admin/api ; sitemap en production (ou si indexation forcée).
- `app/sitemap.ts` — accueil, à-propos, guides, catalogues peuplés, localisations réelles, annonces AVAILABLE (`lastmod` = `updatedAt`). Revalidate 1 h. Limite actuelle : 5 000 annonces par fichier (prévoir un index multi-fichiers si le volume dépasse ~45k).

## Données structurées

`lib/seo/json-ld.ts` + composant `JsonLd` :

- `Organization`, `WebSite` (+ SearchAction), `BreadcrumbList`, `RealEstateListing` + `Offer` (XOF) seulement si AVAILABLE.
- Sérialisation échappant `<` (`\u003c`).
- Pas de faux avis / notes.

## Cache et revalidation

- Fiches et catalogues : `revalidate` 120–300 s.
- Sitemap : 3600 s.
- Après changement de statut : `revalidatePath` sur `/`, `/locations`, `/annonces`, legacy `/biens/:id`.
- Pas de cache public de pages `/espace` ou `/admin`.

## Performance

Déjà en place ou renforcé :

- `next/font` Poppins avec `display: "swap"`.
- Images `next/image` (AVIF/WebP), `priority` seulement sur LCP (carte prioritaire / 1ʳᵉ photo).
- Carte Leaflet et visite virtuelle en `dynamic(..., { ssr: false })`.
- Objectifs CWV (à mesurer en labo puis field) : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.

**Non mesuré dans ce dépôt** : Lighthouse CI, RUM, Search Console. Ne pas déclarer de scores sans exécution.

## Contenu et maillage

- Guides informatifs sous `/guides/*` avec mention « non juridique ».
- Footer : liens catalogue + guides.
- Breadcrumbs sur fiches et catalogues.
- Pas de pages locales artificielles (Cocody, etc.) sans annonces portant ce libellé.

## Annonces pauvres / retirées

- Champs manquants : non inventés dans title/JSON-LD.
- Non AVAILABLE pour le public : 404 (pas d’indexation d’une fiche vide).
- Erreur backend temporaire : ne pas confondre avec 404 définitif (retry Prisma déjà présent).

## Mesure

Le package Analytics Nest n’est pas branché sur `apps/web`. À brancher plus tard :

| Événement (proposition) | Déclencheur |
| --- | --- |
| `acquisition_touch` + `page_viewed` | 1ʳᵉ attribution (UTM/referrer) + vue page publique |
| `listing_view` | Fiche AVAILABLE |
| `search_performed` | Soumission recherche (noms de filtres) |
| `visit_request_started` | Ouverture dialogue visite |

Pas de fingerprinting. Le référent HTTP n’est pas une preuve organique complète.

## Variables d’environnement

Voir `.env.example` :

- `NEXT_PUBLIC_SITE_URL` — domaine canonique HTTPS en production.
- `NEXT_PUBLIC_SEO_INDEXING` — `true` / `false` (override).
- `NEXT_PUBLIC_SEO_SITEMAP` — sitemap hors prod (tests).

## Checklist de lancement SEO

- [ ] `NEXT_PUBLIC_SITE_URL` = URL HTTPS de production (sans slash final).
- [ ] `NEXT_PUBLIC_SEO_INDEXING` non forcé à false en prod.
- [ ] Préproduction : noindex + accès restreint (basic auth / VPN).
- [ ] HTTPS et redirection www ↔ apex choisie (une seule variante canonique).
- [ ] Google Search Console : propriété domaine / préfixe URL.
- [ ] Soumission de `https://…/sitemap.xml`.
- [ ] Spot-check : title/description/canonical sur accueil, catalogue, 1 fiche, 1 guide.
- [ ] Spot-check JSON-LD (test résultats enrichis Google) sans inventer d’erreurs absentes.
- [ ] Vérifier 404 sur UUID inconnu et 308 `/biens/:id` → `/annonces/…`.
- [ ] Lighthouse mobile (labo) sur `/` et une fiche ; noter écarts, ne pas figer un score marketing.
- [ ] Brancher événements Analytics / consentement.
- [ ] Valider juridiquement les guides avant communication large.

## Tests

```bash
pnpm --filter @mon-appart/web test
pnpm --filter @mon-appart/web lint
pnpm --filter @mon-appart/web build
```

Tests unitaires : slug, indexation, JSON-LD (`lib/seo/*.test.ts`).

## Limites connues

- Prototype web ≠ API listings (publicId API, Location normalisée). Migration future requise pour unifier.
- Pas de pagination sitemap multi-fichiers au-delà de 5k.
- Pas de pages « vente » dédiées tant que le parcours produit reste « / mois ».
- Pas de mesures field CWV ni données Search Console dans ce dépôt.
