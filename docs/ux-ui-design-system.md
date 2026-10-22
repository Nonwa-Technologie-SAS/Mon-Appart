# Design system UX/UI — Mon Appart (`apps/web`)

Date : 2026-10-19. Scope : frontend public (prototype legacy Next.js).  
Complète `docs/web-ux-modernization.md`.

## Direction artistique

- **Positionnement** : marketplace immobilière professionnelle, chaleureuse et crédible pour la Côte d’Ivoire.
- **Valeurs** : confiance, simplicité, transparence, rapidité de recherche.
- **Palette** : bleu primaire `#1565C0` (confiance), ambre secondaire `#F5B400` (actions propriétaires), fonds neutres bleutés, texte `#1A2332`.
- **Typographie** : Poppins (Google Fonts, `display: swap`) — lisible en français sur mobile.
- **Principes** : photos et prix d’abord ; peu d’ombres ; pas de badges « vérifiés » sans backend Trust ; pas de stats fictives.

## Tokens (`app/globals.css`)

| Token                                                  | Rôle                             |
| ------------------------------------------------------ | -------------------------------- |
| `--primary` / `--primary-hover`                        | Actions principales, liens, prix |
| `--secondary` / `--secondary-hover`                    | CTA « Publier »                  |
| `--background` / `--card` / `--muted`                  | Surfaces                         |
| `--success` / `--warning` / `--destructive` / `--info` | Feedback                         |
| `--elevation-sm\|md\|lg`                               | Ombres sobres                    |
| `--content-max` (1400px)                               | Largeur de contenu               |
| `--motion-fast\|normal`                                | Transitions                      |
| `--surface-hero`                                       | Fond hero (dégradé léger)        |

Utilitaires : `.container-content`, `.surface-hero`, `.text-price`, `.touch-target`, `.skip-link`, `.elevation-*`.

Respect de `prefers-reduced-motion` pour entrées de page et animations de cartes.

## Composants partagés

### UI de base (`components/ui/`)

- `Button` — default, outline, secondary, ghost, destructive, link ; tailles touch-friendly (`icon` = 40–44 px).
- `Input` — hauteur min. 44 px, focus ring visible.
- `Badge` — default, secondary, muted, outline, success, warning, destructive, info.
- `Label`, `Field`, `NativeSelect`, `Textarea`, `Card`, `Dialog`.

### Métier (`components/site/`)

| Composant           | Usage                                              |
| ------------------- | -------------------------------------------------- |
| `PriceDisplay`      | Prix XOF + périodicité (`/ mois`, `/ jour`, total) |
| `PropertyCard`      | Carte grille ou compacte (carte)                   |
| `EmptyState`        | Aucun résultat + actions                           |
| `CategoryShortcuts` | Liens catalogues SEO                               |
| `TrustStrip`        | Arguments honnêtes (pas de fausse vérification)    |
| `PublisherCta`      | CTA propriétaires                                  |
| `HeroSearch`        | Recherche sync URL (`q`, `type`, `maxPrice`)       |
| `ListingContactBar` | Sticky prix + visite (mobile)                      |
| `SkipLink`          | Accès clavier au contenu                           |

## Règles d’affichage

### Prix

- Toujours via `formatPrice` → `N F CFA` (locale `fr-FR`).
- Location : période `/ mois` (défaut produit actuel).
- Ne jamais comparer des périodicités différentes sans libellé explicite.

### Badges

- Type de bien et date : OK.
- Distance : si géoloc disponible.
- Vérification identité / confiance : **uniquement** si le statut backend existe (absent du prototype web actuel).

### Cartes

- Prix en tête ; image ratio 16/10 ; specs chambres / sdb / surface ; focus visible ; hover léger (désactivé si reduced motion).

### États

- Chargement : skeletons (`PropertyCardSkeleton`) / messages carte.
- Vide : `EmptyState` avec reset filtres + catégories + guide anti-arnaques.
- Erreur réseau formulaires : message champ / formulaire, jamais succès anticipé.

## Navigation

Public : Louer · Locations · Sécurité (guide).  
Annonceur connecté : Annonces · Mon espace · Publier.  
Pas de faux liens « Acheter » / favoris tant que le produit ne les porte pas.

## Responsive

Points de contrôle : ~375, ~390, 768, 1024, 1440.  
Mobile : sticky CTA fiche, nav tiroir, cibles ≥ 44 px, `safe-area-inset`.

## Accessibilité (objectif WCAG 2.2 AA)

- Skip link « Aller au contenu ».
- Labels / `sr-only` sur la recherche.
- Focus ring (`ring` / `outline`).
- Hiérarchie `h1` → sections.
- Contrastes : texte primaire sur fonds clairs ; CTA ambre sur texte foncé.
- Non certifié : audit manuel clavier + axe encore partiels.

## Contribution

1. Réutiliser tokens CSS plutôt que hex locaux.
2. Composer avec `Badge`, `PriceDisplay`, `Button`, `EmptyState`.
3. Ne pas inventer de filtres ou badges non branchés.
4. Préserver SEO (`lib/seo`) et URLs `/annonces/...--uuid`.
5. Vérifier lint + `pnpm --filter @mon-appart/web test` + E2E smoke si UI critique.

## Hors scope actuel

- Favoris persistés, parcours Acheter, recommandations UI branchées Nest, design system admin (`apps/admin`), Storybook.
