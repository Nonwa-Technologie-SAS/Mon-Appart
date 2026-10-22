# 0006 — Module Search & Discovery

Date : 2026-10-08

## Contexte

La recherche de l'ADR 0005 (`GET /listings`) filtrait par critères et par distance, sans texte libre, sans pertinence ni facettes, et servait aussi la gestion (scopes `mine`, modération). Il fallait une recherche publique de découverte : texte libre tolérant aux accents et aux fautes, tri par pertinence, facettes, autocomplétion, historique, tout en restant opérationnelle sur PostgreSQL seul et prête à basculer vers OpenSearch quand le volume le justifiera.

## Décision

1. **Module `search` séparé**, consommateur de Property/Listing (référentiel, confidentialité de position, événements). Il ne réimplémente aucune règle métier : les conditions de visibilité sont relues sur les tables métier à chaque requête.
2. **Projection PostgreSQL `listing_search_documents`** (une ligne par annonce non supprimée) : textes dénormalisés, `search_vector` tsvector **généré** et pondéré (A titre/type/lieu, B description, C équipements), `suggest_text` normalisé pour les trigrammes, `quality_score`. Index GIN sur les deux. Elle est alimentée par un indexeur réagissant aux événements `listing.*` et `property.*`, et reconstructible (`search:reindex`). Elle n'est jamais crue sur le statut.
3. **Configuration plein texte `mon_appart_fr`** (french + `unaccent`) et fonction IMMUTABLE `search_normalize()` : accents et casse ignorés identiquement à l'indexation et à la requête. Extensions `unaccent` et `pg_trgm`.
4. **Interface `SearchEngine`** (`search`, `suggest`, `health`) avec deux implémentations, Postgres et OpenSearch, choisies par `SEARCH_ENGINE`. Les moteurs renvoient des identifiants ; l'hydratation se fait toujours par Prisma depuis PostgreSQL, avec re-vérification de la visibilité.
5. **OpenSearch optionnel**, client officiel `@opensearch-project/opensearch`, sans service Docker par défaut. Mapping explicite (`dynamic: strict`), analyseur français avec `asciifolding`, synonymes configurables, alias `<prefix>_current` vers `<prefix>_vN`. Délai court, 1 à 2 relances, **repli contrôlé** sur PostgreSQL (`meta.degraded = true`, métrique `search_fallback_total`). Avec `OPENSEARCH_NODE` renseigné et `SEARCH_ENGINE=postgres`, l'index est alimenté sans être interrogé : bascule progressive.
6. **Requête validée en objet valeur** (`SearchQuery`) avant tout moteur. Jamais de DSL ni de SQL venant du client ; tout passe en paramètres liés (`Prisma.sql`), jamais `$queryRawUnsafe`. Le texte devient une liste de mots `[a-z0-9]` avant d'atteindre `to_tsquery` ou `multi_match`.
7. **Pagination par curseur keyset** signé par l'empreinte de la recherche (filtres + tri), porteur du moteur et de l'instant de référence (fraîcheur stable entre pages). Total exact plafonné à 1 000 en première page seulement.
8. **Score unique et centralisé** (`search-ranking.ts`) : texte 0,5, proximité 0,2, fraîcheur 0,15, qualité 0,15, renormalisé sur les composantes actives.
9. **Tolérance aux fautes en second passage** : seulement si le plein texte strict ne trouve rien en première page, par similarité de trigrammes mot à mot.
10. **Cache-aside Redis** à TTL court pour les recherches simples (pas de curseur, pas de géo, ≤ 3 mots), clé par empreinte canonique et compteur de génération incrémenté à chaque indexation.
11. **Autocomplétion sur index mémoire** reconstruit au plus toutes les 60 s : aucune requête SQL par frappe.
12. **Historique uniquement à la soumission** (`submit=true`, première page) dans la table existante `searches` ; l'événement `search.performed` ne contient pas le texte saisi.

Migration `20261008210000_search` : extensions `unaccent`, `pg_trgm`, fonction `search_normalize`, configuration `mon_appart_fr`, table `listing_search_documents` et ses index. Aucune table existante modifiée, aucune donnée supprimée.

## Alternatives écartées

- **Colonne tsvector sur `listings`** : mêle la recherche au modèle métier, et les textes viennent de plusieurs tables (bien, lieu, équipements) qu'une colonne générée ne peut pas joindre.
- **`ILIKE '%…%'`** : pas d'index utile, pas de pertinence, pas d'accents.
- **OpenSearch obligatoire** : dépendance d'infrastructure lourde pour le volume actuel ; le domaine ne doit pas en dépendre.
- **Client `@elastic/elasticsearch`** : incompatibilités avec OpenSearch selon les versions.
- **Pagination par offset** : coûteuse et instable quand l'inventaire change.
- **Tolérance aux fautes systématique** : bruit dans les résultats et coût CPU sur chaque requête.
- **Autocomplétion SQL par frappe** : charge proportionnelle à la saisie.

## Conséquences

- Cohérence à terme : un événement perdu (arrêt entre commit et publication) laisse la projection en retard. La visibilité reste correcte (re-vérifiée à la requête) ; le texte peut être périmé jusqu'au prochain événement ou `search:reindex`. L'outbox corrigera ce point.
- Les facettes sont calculées sur les résultats filtrés (non disjonctives) et sur un échantillon plafonné à 5 000.
- La recherche publique exclut les annonces dont `expires_at` est dépassé, même si le worker d'expiration ne les a pas encore basculées.
- `GET /listings` reste l'outil de gestion (scopes, modération) ; `/search` est la découverte publique.
- Disjoncteur (circuit breaker) OpenSearch et file de relance des indexations échouées : à ajouter avec le worker.
