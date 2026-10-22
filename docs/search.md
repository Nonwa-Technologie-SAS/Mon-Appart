# Recherche & découverte

Module `apps/api/src/modules/search`. Décision d'architecture : [ADR 0006](./decisions/0006-search-architecture.md).

PostgreSQL est la source de vérité et suffit à faire fonctionner la recherche. OpenSearch est un index optionnel, activable sans changer l'API.

## Endpoints

| Méthode | Chemin                       | Accès                                                              |
| ------- | ---------------------------- | ------------------------------------------------------------------ |
| GET     | `/api/v1/search`             | Public (jeton facultatif, sert seulement à rattacher l'historique) |
| GET     | `/api/v1/search/suggestions` | Public                                                             |
| GET     | `/health/search`             | Public, hors Swagger (supervision)                                 |

### `GET /api/v1/search`

Tous les paramètres sont facultatifs. Les listes sont séparées par des virgules (20 valeurs au plus). Tout paramètre inconnu (`status`, `ownerId`…) est refusé en 400.

| Paramètre                              | Sens                                                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`                                    | Texte libre, 120 caractères, 8 mots utiles au plus. Accents, casse et espaces ignorés.                                                                                     |
| `listingType`                          | `RENT`, `SALE`… (liste)                                                                                                                                                    |
| `propertyType`                         | Codes du référentiel (`VILLA`, `APARTMENT`, `LAND`…)                                                                                                                       |
| `city`, `commune`, `neighborhood`      | Codes du référentiel, insensibles à la casse et aux accents (`Port-Bouët` = `PORT_BOUET`). Les niveaux se combinent (intersection). Un code inconnu renvoie 400.           |
| `lat`, `lng`, `radius`                 | Rayon en km (10 par défaut, `SEARCH_MAX_RADIUS_KM` au plus). `lat` et `lng` vont ensemble.                                                                                 |
| `minPrice`, `maxPrice`                 | Prix **courant** en XOF                                                                                                                                                    |
| `minSurface`, `maxSurface`             | Surface bâtie, ou surface de terrain à défaut                                                                                                                              |
| `minLandSurface`, `maxLandSurface`     | Surface de terrain                                                                                                                                                         |
| `bedrooms`, `maxBedrooms`, `bathrooms` | `bedrooms=3` signifie **au moins 3**                                                                                                                                       |
| `amenities`, `amenitiesMode`           | Codes d'équipements ; `AND` (défaut : tous) ou `OR` (au moins un)                                                                                                          |
| `sort`                                 | `RELEVANCE`, `NEWEST`, `PRICE_ASC`, `PRICE_DESC`, `SURFACE_ASC`, `SURFACE_DESC`, `DISTANCE`. Défaut : `RELEVANCE` si `q`, sinon `NEWEST`. `DISTANCE` exige `lat` et `lng`. |
| `cursor`                               | Curseur opaque renvoyé par la page précédente, avec **les mêmes filtres et le même tri**                                                                                   |
| `limit`                                | 1 à `SEARCH_MAX_LIMIT` (100), défaut `SEARCH_DEFAULT_LIMIT` (20)                                                                                                           |
| `facets`                               | `propertyTypes,listingTypes,cities,communes,neighborhoods,priceRanges,bedrooms,amenities`. Rien n'est calculé sans demande.                                                |
| `submit`                               | `true` quand l'utilisateur valide la recherche : seule cette requête est historisée                                                                                        |

Seules les annonces visibles du public sortent : `PUBLISHED`, non supprimées, non expirées (`expires_at`), sur un bien `ACTIVE` non supprimé. Ces conditions sont relues sur les tables métier à chaque requête, quel que soit le moteur.

Réponse (extrait) :

```json
{
  "items": [
    {
      "listingId": "…",
      "title": "Villa 4 chambres Cocody Riviera",
      "listingType": "RENT",
      "propertyType": { "code": "VILLA", "name": "Villa" },
      "price": { "amount": 1500000, "currency": "XOF", "period": "MONTH" },
      "location": {
        "city": { "code": "ABIDJAN", "name": "Abidjan" },
        "commune": { "code": "COCODY", "name": "Cocody" },
        "neighborhood": { "code": "RIVIERA", "name": "Riviera" },
        "latitude": 5.36,
        "longitude": -3.96,
        "precision": "APPROXIMATE"
      },
      "score": 0.7412,
      "distance": { "value": 0.4, "unit": "km" }
    }
  ],
  "pagination": { "nextCursor": "eyJ2Ijox…", "hasMore": true, "limit": 20 },
  "total": { "value": 42, "strategy": "exact" },
  "facets": {
    "communes": [{ "value": "COCODY", "label": "Cocody", "count": 12 }]
  },
  "meta": {
    "sort": "RELEVANCE",
    "engine": "postgres",
    "degraded": false,
    "fuzzy": false
  }
}
```

- `score` n'apparaît qu'en tri `RELEVANCE`, `distance` qu'en recherche géographique.
- La position est la position **publiée** du bien : exacte (`EXACT`), arrondie à environ 1 km (`APPROXIMATE`, par défaut) ou absente (`HIDDEN`). L'adresse n'est jamais renvoyée. Le filtre de rayon et la distance portent sur cette position publiée, pour qu'on ne puisse pas retrouver le point réel par rayons successifs.
- `total.strategy` : `exact` en première page sous 1 000 résultats ; `estimated` au-delà (`value` = 1 000, au moins) ; `not_available` sur les pages suivantes.
- `meta.degraded` : OpenSearch a échoué et PostgreSQL a répondu.
- `meta.fuzzy` : le plein texte strict ne trouvait rien, la tolérance aux fautes a été appliquée.

#### Zéro résultat

En première page sans résultat, `zeroResults` propose des assouplissements que le client peut appliquer (rien n'est relancé automatiquement) :

```json
"zeroResults": {
  "suggestions": ["Vérifiez l'orthographe", "Essayez des mots plus généraux"],
  "relaxedFilters": [
    { "filter": "maxPrice", "params": { "maxPrice": "120000" }, "label": "Augmenter le budget de 20 %" }
  ]
}
```

Règles, dans l'ordre : quartier → commune entière, rayon ×2 (plafonné), budget +20 %, retrait des équipements, une chambre de moins, tous types de biens. L'abstraction `SearchRelaxationStrategy` permet de remplacer ces règles.

### `GET /api/v1/search/suggestions`

`q` (2 à 64 caractères), `limit` (1 à 20, défaut 8). Types : `CITY`, `LOCATION` (commune), `NEIGHBORHOOD`, `PROPERTY_TYPE`, `QUERY` (« Villa à Cocody », issue de l'inventaire publié). Chaque suggestion porte les `params` à appliquer à `/search`.

L'index est en mémoire, reconstruit au plus toutes les 60 s (une requête SQL par minute, pas par frappe), et les réponses sont mises en cache Redis. Rien n'est historisé.

### Erreurs

| Code                        | HTTP | Cas                                                                             |
| --------------------------- | ---- | ------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`         | 400  | Paramètre inconnu ou trop long                                                  |
| `INVALID_SEARCH_QUERY`      | 400  | Tri, limite, facette, type ou code de lieu invalide                             |
| `INVALID_PRICE_RANGE`       | 400  | Prix négatif, non entier ou min > max                                           |
| `INVALID_SURFACE_RANGE`     | 400  | Surface invalide ou min > max                                                   |
| `INVALID_GEO_COORDINATES`   | 400  | Latitude/longitude hors bornes ou incomplètes                                   |
| `INVALID_RADIUS`            | 400  | Rayon ≤ 0 ou au-delà du maximum                                                 |
| `INVALID_CURSOR`            | 400  | Curseur illisible, falsifié, ou réutilisé avec d'autres filtres ou un autre tri |
| `RATE_LIMITED`              | 429  | Limite par client dépassée                                                      |
| `SEARCH_ENGINE_UNAVAILABLE` | 503  | OpenSearch en panne sans repli (`SEARCH_FALLBACK=none`)                         |
| `SEARCH_TIMEOUT`            | 503  | Délai OpenSearch dépassé sans repli                                             |

## Fonctionnement

### Projection PostgreSQL

`listing_search_documents` contient une ligne par annonce non supprimée : textes dénormalisés (titre, type, lieu, description, équipements), `search_vector` généré et pondéré, `suggest_text` (titre, type et lieu normalisés, pour les trigrammes), `quality_score`. Index GIN sur `search_vector` et sur `suggest_text` (`gin_trgm_ops`).

| Poids      | Champs                                               |
| ---------- | ---------------------------------------------------- |
| A (fort)   | Titre, type de bien, lieu (quartier, commune, ville) |
| B (moyen)  | Description (annonce, sinon bien)                    |
| C (faible) | Équipements                                          |

Requête : chaque mot devient un préfixe (`villa:* & cocody:*`) dans la configuration `mon_appart_fr` (français + `unaccent`). Si cette recherche stricte est vide en première page, un second passage compare chaque mot (≥ 3 lettres) aux trigrammes de `suggest_text` (`word_similarity` ≥ 0,6) : « apartement marcori » trouve « Appartement… Marcory ». Le curseur conserve ce mode.

### Score (`RELEVANCE`)

Défini dans `domain/search-ranking.ts`, seul endroit à modifier :

| Composante | Poids | Calcul                                                          |
| ---------- | ----- | --------------------------------------------------------------- |
| Texte      | 0,5   | `ts_rank_cd` normalisé (ou similarité en mode tolérant)         |
| Proximité  | 0,2   | `1 − distance / rayon`, seulement avec un point                 |
| Fraîcheur  | 0,15  | `1 / (1 + âge en jours / 30)`, âge figé par le curseur          |
| Qualité    | 0,15  | Description, photos, équipements, surface, position renseignées |

Les poids sont renormalisés sur les composantes actives (sans texte ni point, fraîcheur et qualité se partagent le score). Aucune personnalisation ni apprentissage.

### Pagination

Keyset sur `(clé de tri, id)`, sans offset. Le curseur (base64url) contient le tri, la dernière clé, le dernier identifiant, l'instant de référence, le moteur et une empreinte des filtres : le rejouer avec d'autres filtres ou un autre tri renvoie `INVALID_CURSOR`. Sa clé est validée strictement avant d'atteindre SQL. Les annonces sans prix ou sans surface passent en dernier.

### Facettes

Calculées à la demande, en une requête, sur les résultats filtrés (non disjonctives) et sur un échantillon plafonné à 5 000 annonces. Les tranches de prix viennent de `SEARCH_PRICE_FACET_BOUNDS`. Les prix mélangent loyers et ventes : filtrer `listingType` pour des tranches parlantes. Les chambres au-delà de 5 sont regroupées dans `5+`.

### Cache

Cache-aside Redis, TTL `SEARCH_CACHE_TTL_SECONDS` (60 s, 0 désactive). Clé `search:v1:{moteur}:{génération}:{sha256 de la requête canonique}` construite par `SearchCacheKeyBuilder` : deux URL équivalentes (ordre des paramètres, casse, accents) partagent la même entrée. Ne sont mises en cache que les premières pages sans géolocalisation, d'au plus 3 mots, non dégradées et de moins de 256 Ko. Chaque indexation incrémente `search:generation`, ce qui invalide tout le cache d'un coup. Redis indisponible : la recherche continue sans cache.

### Indexation

`SearchIndexer` écoute `listing.*` (création, mise à jour, publication, pause, statut, prix, suppression…) et `property.updated`/`property.deleted`. Pour chaque annonce concernée, il relit l'état courant en base (idempotent, une file par annonce) puis met à jour la projection et, si `OPENSEARCH_NODE` est renseigné, l'index OpenSearch. Un échec OpenSearch est journalisé et compté (`search_indexing_failures_total`) sans bloquer PostgreSQL ni l'action métier.

Cohérence à terme : sans outbox, un événement peut être perdu si le processus s'arrête après le commit. La visibilité reste juste (relue à chaque requête) ; seul le texte indexé peut être en retard. Remède : `search:reindex`.

### Historique

Avec `submit=true` (et sans curseur), une ligne est ajoutée dans `searches` : colonnes typées pour les filtres simples, instantané JSON complet dans `filters`, utilisateur s'il est authentifié. L'événement `search.performed` ne contient ni le texte saisi ni les coordonnées.

## OpenSearch

Aucun service OpenSearch n'est lancé par défaut. Pour l'activer :

1. Renseigner `OPENSEARCH_NODE` (et identifiants), garder `SEARCH_ENGINE=postgres` : les nouvelles indexations alimentent OpenSearch sans qu'il soit interrogé.
2. `pnpm --filter @mon-appart/api run search:reindex -- --target=opensearch` pour remplir l'index.
3. Vérifier `search:stats` puis `/health/search`.
4. Passer `SEARCH_ENGINE=opensearch`. Le repli `SEARCH_FALLBACK=postgres` reste actif.

Index : mapping explicite (`dynamic: strict`), analyseur `mon_appart_french` (minuscules, `asciifolding`, mots vides et racinisation français, synonymes `SEARCH_SYNONYMS` en `synonym_graph`), `location.point` en `geo_point`. Le texte utilisateur n'est jamais interprété comme DSL : il n'apparaît que comme valeur d'un `multi_match`.

Alias : les lectures et écritures passent par `<prefix>_current`. Le premier index est `<prefix>_v<SEARCH_INDEX_VERSION>`, créé automatiquement avant la première écriture. Une réindexation OpenSearch construit un nouvel index horodaté, bascule l'alias **seulement si aucun document n'a échoué**, et conserve l'ancien index (suppression manuelle après vérification). Changer le mapping : incrémenter `SEARCH_INDEX_VERSION` puis réindexer.

Résilience : délai `OPENSEARCH_TIMEOUT_MS`, `OPENSEARCH_MAX_RETRIES` relances (0 à 2), puis repli PostgreSQL (`meta.degraded`, `search_fallback_total`) ou 503 si `SEARCH_FALLBACK=none`. Un curseur produit par OpenSearch n'est jamais rejoué sur PostgreSQL (formats différents) : il échoue proprement, le client repart de la première page. Prévu plus tard : disjoncteur pour ne plus interroger un cluster en panne, file de relance (dead letter) des indexations échouées, portée par le worker.

## Commandes

Depuis la racine (`pnpm --filter @mon-appart/api run …`) ou depuis `apps/api` :

| Commande         | Effet                                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search:reindex` | Reconstruit la projection PostgreSQL et, si configuré, OpenSearch. Options : `--target=postgres\|opensearch\|all`, `--batch=500`, `--after=<id>` (reprise, PostgreSQL seulement). Affiche la progression. Non destructif : upsert, puis retrait des documents orphelins. |
| `search:health`  | État des moteurs                                                                                                                                                                                                                                                         |
| `search:stats`   | Annonces indexables, documents PostgreSQL et OpenSearch                                                                                                                                                                                                                  |

## Observabilité

Métriques Prometheus (`/metrics` si `METRICS_ENABLED=true`) : `search_requests_total{kind,engine}`, `search_errors_total{kind,code}`, `search_latency_ms{kind,engine}`, `search_zero_results_total`, `search_cache_hits_total`, `search_cache_misses_total`, `search_opensearch_errors_total{operation}`, `search_fallback_total`, `search_indexing_total{target,operation}`, `search_indexing_failures_total{target}`.

Log par recherche (JSON) : identifiant de requête, utilisateur (identifiant public), texte normalisé tronqué, **noms** des filtres (jamais leurs valeurs ni les coordonnées), tri, moteur, dégradé, tolérant, cache, page, latence, nombre de résultats. Les erreurs OpenSearch sont journalisées sans identifiants (URL expurgées) et jamais renvoyées au client.

Limites par client et par minute : `SEARCH_RATE_LIMIT` (60) pour la recherche, `SEARCH_SUGGEST_RATE_LIMIT` (240) pour l'autocomplétion.

## Contrats préparés (non exposés)

Types dans `packages/types/src/search.ts`, sans endpoint ni logique :

- `SearchMapMarker` pour `GET /search/map` (marqueurs, position publiée, pas de clustering) ;
- `SavedSearchContract` pour les recherches sauvegardées (sans alerte ni notification) ;
- recherches populaires et recherche sémantique : à concevoir, rien n'est implémenté (ni IA, ni embeddings, ni recommandation, ni classement personnalisé).

## Limites connues

- « Riviera 3 » et Grand-Bassam ne figurent pas au référentiel : une recherche texte les trouve via titres et descriptions, pas via les filtres de lieu.
- Facettes non disjonctives et échantillonnées.
- La performance a été mesurée sur un petit jeu de données de test (p95 < 500 ms en local) ; à remesurer avec un volume réaliste avant la production.
