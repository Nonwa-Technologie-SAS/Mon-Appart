# Modernisation UX / UI — `apps/web`

Date : 2026-10-16. Scope : frontend public uniquement (prototype legacy).

> Design system consolidé (tokens, composants, règles) : voir [`ux-ui-design-system.md`](./ux-ui-design-system.md) (2026-10-19).

## Mini-audit (avant)

**Forces**

- Parcours recherche → carte/liste → fiche déjà structuré.
- Sticky CTA visite sur fiche ; géolocalisation optionnelle.
- Tokens couleur déjà crédibles (bleu / ambre), Poppins, SEO URLs préservées.

**Frictions**

- Claims « annonces vérifiées » sans badge produit réel.
- Nav « Acheter » et favoris vers `/` (faux espoirs).
- Toggle « Mode famille » sans effet.
- Empty states trop secs ; prix pas assez dominant sur cartes compactes.
- Cibles tactiles parfois &lt; 44 px ; brand « Mon Appart » trop discret sur l’accueil.

## Décisions

1. Honest UX : retirer les promesses de vérification non fondées.
2. Prix en tête des cartes (signal principal CI).
3. Empty states avec actions (reset filtres, catégories, guide anti-arnaques).
4. Nav publique : Louer / Locations / Sécurité (guide).
5. Sticky fiche : prix + CTA sur mobile (`ListingContactBar`).
6. Publication : étapes visibles (infos → caractéristiques → photos).
7. Pas de branchement API Nest ; SEO inchangé.

## Écrans touchés

| Zone                  | Fichiers                                                                             |
| --------------------- | ------------------------------------------------------------------------------------ |
| Recherche / résultats | `search-results-layout.tsx`, `hero-search.tsx`, `property-card.tsx`                  |
| Fiche                 | `annonces/[segment]/page.tsx`, `listing-contact-bar.tsx`, `request-visit-dialog.tsx` |
| Partagés              | `empty-state.tsx`, `property-card-skeleton.tsx`, `globals.css`                       |
| Nav                   | `site-header.tsx`, `site-mobile-nav.tsx`                                             |
| Catalogues / guides   | `catalog-results.tsx`, `guide-article.tsx`                                           |
| Auth / publier        | `sign-in-form.tsx`, `auth-shell.tsx`, `publish-property-form.tsx`                    |

## Checklist manuelle

- [ ] Mobile ~390 px : chercher (quartier + budget) → ouvrir fiche → sticky prix + « Demander une visite »
- [ ] Retour navigateur : filtres URL conservés (`?q&type&maxPrice`)
- [ ] Empty state avec filtres impossibles : actions visibles
- [ ] Carte : bascule liste/carte sans perdre le tri
- [ ] Connexion : erreurs lisibles, champs `min-h-11`
- [ ] Publier : étapes 1–2–3 visibles
- [ ] Guide : CTA vers recherche
- [ ] Pas de régression `/annonces/...--uuid` ni métadonnées

## Dettes restantes

- Favoris réels (retiré le faux bouton cœur).
- Parcours « Acheter » quand le produit le permettra.
- Skeletons connectés au streaming Suspense (composant prêt, pas branché sur un loading.tsx global).
- Wizard multi-pages pour la publication (aujourd’hui sections sur une page).
- Tests e2e Playwright mobile (non ajoutés dans ce lot).
