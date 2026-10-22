# Stratégie de mots-clés et d’intention — Mon Appart

Document de travail pour l’acquisition organique en Côte d’Ivoire. **Aucun volume de recherche n’est affirmé ici** : les volumes doivent être validés avec Search Console, un outil de mots-clés, ou des données internes une fois le trafic disponible.

Contexte technique : le site public actuel est `apps/web` (prototype Next.js). Les localisations sont des libellés texte saisis par les annonceurs, pas encore un référentiel commune/quartier structuré (contrairement au modèle Location de l’API Nest).

## Intentions de recherche

| Intention | Exemples de requêtes | Page cible actuelle | Besoin données |
| --- | --- | --- | --- |
| Transactionnelle location | « appartement à louer Cocody », « studio Abidjan » | `/appartements-a-louer`, `/studios-a-louer`, `/location/{slug}` si le libellé existe | Annonces AVAILABLE |
| Transactionnelle type | « maison à louer », « villa à louer », « terrain » | `/maisons-a-louer`, `/villas-a-louer`, `/terrains` | Idem |
| Navigation marque | « Mon Appart », « Mon Appart CI » | `/`, `/a-propos` | — |
| Informationnelle | « comment louer un logement », « arnaque location » | `/guides/…` | Contenu éditorial vérifié |
| Budget | « appartement moins de 150000 » | **Non indexé** (`/?maxPrice=`) → page catalogue + filtre UI | Ne pas créer une URL par budget sans volume prouvé |

## Catégories de pages

1. **Accueil** `/` — hub, indexable sans filtres.
2. **Catalogue opération / type** — `/locations`, `/appartements-a-louer`, etc. Indexables seulement si des annonces existent (sitemap).
3. **Localisation dérivée** — `/location/{slug}` uniquement pour des libellés `location` réellement présents en base.
4. **Fiche annonce** — `/annonces/{slug}--{uuid}`.
5. **Guides** — contenu evergreen, sans inventer de règles juridiques.
6. **Recherche filtrée** — `/?q=&type=&maxPrice=` : `noindex`, canonical vers une page catalogue quand le filtre type seul s’y prête.

## Mots-clés à étudier (hypothèses)

**Principaux (à valider)** : appartement à louer Abidjan ; maison à louer Cocody ; studio à louer Marcory ; villa à louer ; terrain à vendre Abidjan ; location meublée Abidjan.

**Secondaires** : loyer F CFA + commune ; nombre de chambres ; « proche » + point d’intérêt (seulement si données fiables).

Ne pas publier de pages « budget » ou « POI » tant que le catalogue et la géolocalisation ne le permettent pas proprement.

## Cannibalisation

- Éviter d’indexer à la fois `/?type=APARTMENT` et `/appartements-a-louer` : politique = catalogue canonique, filtre `noindex`.
- Ne pas créer une page locale par variante orthographique du même quartier.
- Les guides ne doivent pas reprendre le titre exact d’une page catalogue.

## Priorités de contenu

1. Qualité des fiches (titre, description, photos, localisation cohérente).
2. Pages catalogue peuplées.
3. Pages locales **uniquement** là où le volume d’annonces le justifie.
4. Guides informatifs (déjà amorcés) après validation métier/juridique.
5. Pages « vente » dédiées lorsque le produit et les données ventent réellement (le prototype est orienté location / mois).

## Hypothèses à valider

- Les internautes ivoiriens cherchent surtout par commune (Cocody, Yopougon…) plutôt que par « Abidjan » seul.
- Le format prix « F CFA » dans les snippets aide le CTR (à mesurer via Search Console).
- Les pages guides convertissent vers une recherche ou une demande de visite (événement Analytics).

## Instrumentation (quand le site consommera Analytics API)

Événements catalogue (ne pas inventer d’autres noms) : `acquisition_touch` (canal + referrer host), `page_viewed`, `listing_detail_viewed`, `listing_contact_started`, `search_submitted`. Le référent HTTP n’est pas une preuve d’origine organique complète.
