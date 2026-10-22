# Recommandations

Module `apps/api/src/modules/recommendation`. Décision d'architecture : [ADR 0007](decisions/0007-recommendation-architecture.md).

Le moteur est **déterministe, explicable et testable** : des règles pondérées, sans apprentissage. Il fonctionne avec PostgreSQL seul. Redis accélère (cache des listes), mais n'est pas requis. Le service Python `services/recommendation` est une option future, avec repli automatique sur les règles.

Extensions Prompt 20 : [recommendation-intelligence.md](recommendation-intelligence.md), [recommendation-events-and-features.md](recommendation-events-and-features.md), [recommendation-evaluation.md](recommendation-evaluation.md), module Interaction (`/api/v1/interactions`), UI web `/pour-vous`.

## Architecture

```text
GET /recommendations ─┐
GET /similar/:id ─────┤
                      ▼
            RecommendationService
   1. filtres stricts de la requête (codes vérifiés)
   2. préférences déclarées + profil de comportement + exclusions
   3. pool de candidats : ListingCandidateSource (module Search), une requête SQL
   4. classement : RecommendationRanker → moteur distant ou règles (repli)
   5. diversification (MMR, doublons, plafond par publieur)
   6. cache Redis de la liste classée (clé par utilisateur)
   7. page hydratée par SearchHydrator (visibilité revérifiée)
   8. persistance de la page servie (comptes connectés) → identifiants de retour
```

| Couche         | Fichiers                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domaine (pur)  | `budget.ts`, `scoring.ts`, `diversification.ts`, `behavior-profile.ts`, `recommendation-cursor.ts`, `recommendation-engine.ts`                             |
| Application    | `recommendation.service.ts`, `preference.service.ts`, `behavior-profile.service.ts`, `recommendation-ranker.ts`, `recommendation-invalidation.listener.ts` |
| Infrastructure | `preference.repository.ts`, `behavior.repository.ts`, `recommendation.repository.ts`, `recommendation-cache.ts`, `remote-recommendation.engine.ts`         |
| Présentation   | `recommendation.controller.ts`, `dto/*`                                                                                                                    |

Réutilisé, non dupliqué :

- **Search** : les conditions de visibilité publique (`publicConditions()`), le pool de candidats (`ListingCandidateSource`), l'hydratation des cartes (`SearchHydrator`, qui applique aussi la confidentialité de position) ;
- **Property** : le référentiel (`CatalogRepository`) ;
- **Identity** : l'acteur courant (`ActorService`) et les gardes.

## Éligibilité

Une annonce n'est jamais recommandée si :

- elle n'est pas visible publiquement : mêmes règles que la recherche, à savoir publiée, non supprimée, non expirée, bien actif, prix courant > 0 ;
- elle ne respecte pas un filtre strict de la requête (`listingType`, `propertyType`, `city`) ;
- son prix dépasse le budget maximum, plus la tolérance déclarée s'il y en a une ;
- son prix n'est pas comparable au budget (autre devise ou autre périodicité) ;
- elle a été publiée par l'utilisateur lui-même ;
- l'utilisateur l'a mise en favori, l'a ignorée (`PROPERTY_IGNORED`), l'a écartée par un retour négatif, l'a déjà contactée (demande) ou y a déjà pris rendez-vous.

Une annonce **consultée** dans les 30 derniers jours reste proposable, avec un score multiplié par 0,9.

La visibilité est vérifiée une seconde fois à l'hydratation : une annonce dépubliée entre-temps disparaît de la page, même si elle est servie depuis le cache.

## Score

Le score vaut 0..1 en interne et 0..100 (entier) dans l'API. C'est une moyenne pondérée **sur les seules dimensions disponibles** : sans budget déclaré, le poids du budget est redistribué. Un nouvel utilisateur n'est donc pas pénalisé.

Poids par défaut (`RECOMMENDATION_WEIGHTS`, somme 100, validés au démarrage) :

| Dimension | Poids | Règle                                                                                                                                                         |
| --------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| budget    | 30    | 1 jusqu'à 85 % du maximum, puis de 1 à 0,7 jusqu'au maximum, puis de 0,7 à 0,2 dans la tolérance ; 0,6 sous le minimum.                                       |
| location  | 20    | quartier préféré 1, commune préférée 0,8, autre quartier de la commune d'un quartier préféré 0,5, même ville 0,2 ; point de référence : 1 − distance / rayon. |
| type      | 15    | type préféré 1, même catégorie 0,5.                                                                                                                           |
| size      | 10    | chambres, salles de bain, surface ; valeur inconnue : 0,3 (ni récompensée, ni éliminée).                                                                      |
| amenities | 10    | part des équipements souhaités présents.                                                                                                                      |
| behavior  | 10    | affinité avec le profil d'activité : lieu 50 %, type 30 %, équipements 20 %.                                                                                  |
| quality   | 5     | complétude 40 %, fraîcheur 40 % (demi-vie 30 j), popularité sur 30 j 20 %.                                                                                    |

Annonces similaires (`/similar`) : les mêmes poids s'appliquent à des dimensions de proximité avec l'annonce de référence :

- prix proche (0 au-delà de ±40 %) ;
- même quartier, même commune ou même ville ;
- même type ou même catégorie ;
- taille comparable ;
- équipements communs (Jaccard).

Le pool est limité au même type d'offre, à la même catégorie, à la même ville et à la même devise et périodicité, dans une fourchette de prix de ±40 %. Il est élargi (sans fourchette de prix) s'il compte moins de 5 annonces.

Ordre stable en cas d'égalité : score, puis publication la plus récente, puis identifiant.

### Budget

- Le budget déclaré n'est **jamais modifié**. Il est stocké tel que saisi : une période absente reste `null` et elle est déduite à la lecture (location → `MONTH`, vente → `TOTAL`, courte durée → `DAY`).
- Si la période ne peut pas être déduite (location et vente mélangées, ou aucun type d'offre), l'enregistrement est refusé avec `BUDGET_PERIOD_REQUIRED`.
- Le maximum est strict. Seule une tolérance explicite (`budgetTolerancePct`, 0 à 30 %) l'élargit.
- Le moteur ne convertit jamais de devise ni de période. Si la requête porte sur un type d'offre dont la périodicité diffère du budget (par exemple une vente avec un budget mensuel), le budget n'est pas appliqué du tout, ni comme filtre ni comme score.

### Raisons

Chaque recommandation porte au plus 3 raisons, issues des dimensions qui contribuent le plus (score de dimension ≥ 0,6). Codes et libellés : `RECOMMENDATION_REASON_LABELS` dans `@mon-appart/types`. Les scores par dimension restent internes : ils sont persistés dans `recommendations.reasons`, jamais exposés par l'API.

## Niveaux de personnalisation

| `meta.level`  | Situation                           | Données utilisées                         |
| ------------- | ----------------------------------- | ----------------------------------------- |
| `GENERIC`     | visiteur, ou compte sans historique | qualité, fraîcheur, popularité            |
| `PREFERENCES` | préférences déclarées               | + budget, lieu, type, taille, équipements |
| `BEHAVIOR`    | activité récente                    | + profil de comportement                  |

### Profil de comportement

Le profil est lu uniquement dans les tables existantes, sans nouvelle API de collecte :

| Signal                      | Source                                                                                                    | Poids |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| Favori                      | `favorites`                                                                                               | 5     |
| Demande                     | `inquiries` ; `user_events` CONTACT_OWNER, WHATSAPP_CLICKED, PHONE_CLICKED (table héritée, non alimentée) | 6     |
| Rendez-vous                 | `appointments`                                                                                            | 8     |
| Consultation                | `property_views` (× 2 si ≥ 30 s ; ignorée si < 2 s ; 3 par bien au plus)                                  | 1     |
| Recherche                   | `searches` (quartier, type)                                                                               | 2     |
| Retour CLICKED / INTERESTED | `recommendation_feedback`                                                                                 | 2 / 4 |

- **Décroissance** : chaque signal est pondéré par une décroissance exponentielle (demi-vie `RECOMMENDATION_BEHAVIOR_HALF_LIFE_DAYS`), sur une fenêtre de `RECOMMENDATION_BEHAVIOR_LOOKBACK_DAYS`.
- **Signaux écartés** : au plus 2 000 signaux sont lus, et sont ignorés les événements datés du futur ainsi que l'activité sur ses propres biens.
- **Agrégation** : le profil agrège des poids 0..1 par quartier, commune, type et équipement (20 entrées au plus par axe), sans aucune autre déduction. Aucune caractéristique sensible n'est inférée.
- **Stockage** : le profil est conservé dans `user_behavior_profiles` (`model_version = behavior-v1`).
- **Recalcul paresseux** : le profil est recalculé à la demande lorsqu'il est absent, plus vieux que `RECOMMENDATION_PROFILE_MAX_AGE_MINUTES`, ou marqué « à recalculer » après un retour. En cas d'échec, le profil stocké est utilisé.

## Diversification

Elle s'applique à une liste déjà filtrée, sans jamais retirer une annonce pour un autre motif :

1. un même bien n'apparaît qu'une fois ;
2. sélection gloutonne MMR : à chaque rang, on retient l'annonce qui maximise `score − λ × similarité maximale avec les annonces déjà retenues`, avec λ = `RECOMMENDATION_DIVERSITY` (0 = pertinence seule) ;
3. la similarité combine même publieur (0,5), même quartier (0,25), même type (0,15) et prix à ±10 % (0,1). Un quasi-doublon (même publieur, même quartier, même type, même nombre de chambres, prix à ±5 %) compte pour 1 ;
4. au-delà de `RECOMMENDATION_MAX_PER_OWNER` annonces d'un même publieur, les suivantes passent en fin de liste.

## API

Préfixe `/api/v1/recommendations`. Swagger : tag `recommendations`.

| Méthode | Route                         | Auth        | Débit / min                          |
| ------- | ----------------------------- | ----------- | ------------------------------------ |
| GET     | `/`                           | optionnelle | `RECOMMENDATION_RATE_LIMIT`          |
| GET     | `/similar/:listingPublicId`   | optionnelle | `RECOMMENDATION_RATE_LIMIT`          |
| POST    | `/:recommendationId/feedback` | requise     | `RECOMMENDATION_FEEDBACK_RATE_LIMIT` |
| GET     | `/preferences`                | requise     | `RECOMMENDATION_RATE_LIMIT`          |
| PUT     | `/preferences`                | requise     | `RECOMMENDATION_RATE_LIMIT`          |

Paramètres de `GET /` :

- `listingType`, `propertyType`, `city` : listes de codes séparés par des virgules. Ce sont des filtres stricts.
- `limit` : de 1 à 50.
- `cursor` : curseur opaque. Il est signé par l'empreinte de la requête et porte la date de calcul, ce qui garantit un classement stable d'une page à l'autre.

Pour un visiteur, la réponse est générique et rien n'est persisté : `id` vaut `null`. Pour un compte, chaque recommandation servie est enregistrée (`recommendations`) et reçoit un identifiant public (UUID), utilisé ensuite pour les retours.

```json
{
  "items": [
    {
      "id": "8f2b4c1e-3f7a-4d0e-9b8a-2c1d5e6f7a8b",
      "context": "PERSONALIZED",
      "score": 87,
      "reasons": [
        { "code": "BUDGET_MATCH", "label": "Dans votre budget" },
        {
          "code": "PREFERRED_NEIGHBORHOOD",
          "label": "Dans un quartier que vous recherchez"
        }
      ],
      "listing": {
        "listingId": "…",
        "title": "…",
        "price": { "amount": 200000, "currency": "XOF", "period": "MONTH" }
      },
      "generatedAt": "2026-10-09T12:00:00.000Z"
    }
  ],
  "pagination": { "nextCursor": "…", "hasMore": true, "limit": 20 },
  "meta": {
    "context": "PERSONALIZED",
    "level": "PREFERENCES",
    "algorithmVersion": "rules-v1",
    "degraded": false,
    "requestId": "uuid de la page servie"
  }
}
```

`listing` a le format d'une carte de résultat de recherche (`SearchResultItem`).

`meta.requestId` identifie la page servie : le client le renvoie dans `recommendations_viewed` et `recommended_listing_opened` pour relier génération, affichage et ouverture ([analytics-and-tracking.md](./analytics-and-tracking.md)).

**Retours** (`type`) : `DISPLAYED`, `CLICKED`, `INTERESTED`, `NOT_INTERESTED`, `IRRELEVANT`, `WRONG_BUDGET`, `WRONG_LOCATION`.

- La réponse est 204. Le retour est idempotent : un même type n'est enregistré qu'une fois par recommandation.
- Une recommandation qui n'appartient pas à l'utilisateur renvoie 404 (`RECOMMENDATION_NOT_FOUND`).
- Les retours négatifs écartent l'annonce des listes suivantes.
- Tout retour autre que `DISPLAYED` invalide le cache de l'utilisateur et marque son profil à recalculer.

**Préférences** : `PUT` remplace l'ensemble des préférences ; un champ absent est effacé. Le corps est plat ; la réponse est structurée (`budget`, `surface`, `point`) :

```json
{
  "listingTypes": ["RENT"],
  "minBudget": 150000,
  "maxBudget": 300000,
  "currency": "XOF",
  "budgetTolerancePct": 10,
  "propertyTypes": ["APARTMENT"],
  "communes": ["COCODY"],
  "neighborhoods": ["RIVIERA"],
  "amenities": ["PARKING"],
  "bedrooms": 2,
  "latitude": 5.3599,
  "longitude": -3.9875,
  "radiusKm": 5
}
```

Erreurs :

| Code                           | HTTP | Cas                                                                                              |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------------------ |
| `INVALID_RECOMMENDATION_QUERY` | 400  | `limit`, type d'offre, code de type ou de ville inconnu                                          |
| `INVALID_CURSOR`               | 400  | curseur illisible ou réutilisé avec d'autres paramètres                                          |
| `INVALID_PREFERENCES`          | 400  | min > max, tolérance sans maximum, code inconnu, point incomplet, rayon > `SEARCH_MAX_RADIUS_KM` |
| `BUDGET_PERIOD_REQUIRED`       | 400  | budget dont la périodicité ne se déduit pas                                                      |
| `LISTING_NOT_FOUND`            | 404  | annonce de référence inconnue, non publique ou identifiant invalide                              |
| `RECOMMENDATION_NOT_FOUND`     | 404  | recommandation inconnue ou appartenant à un autre utilisateur                                    |
| `RECOMMENDATIONS_UNAVAILABLE`  | 503  | lecture des candidats impossible                                                                 |

Aucun endpoint public ne déclenche de recalcul global. Le recalcul est paresseux, borné par le pool de candidats et limité en débit.

## Cache et invalidation

- **Clé** : `rec:list:v1:{context}:{u:<publicId>|guest}:g{génération}:v{version utilisateur}:{empreinte}`. L'empreinte couvre les filtres, la référence et l'utilisateur. Une liste personnalisée n'est jamais rangée sous une clé partagée ; seuls les visiteurs partagent les listes génériques.
- **Contenu** : la liste classée complète (au plus `RECOMMENDATION_MAX_RESULTS`), paginée ensuite, avec un TTL de `RECOMMENDATION_CACHE_TTL_SECONDS`. Une liste dégradée (repli) n'est pas mise en cache.
- **Invalidation globale** : les événements `listing.*` (création, mise à jour, publication, pause, expiration, vente, location, statut, prix, suppression) ainsi que `property.updated` et `property.deleted` incrémentent la génération globale. Une rafale d'événements est regroupée par un anti-rebond de 1 s.
- **Invalidation par utilisateur** : une modification des préférences ou un retour incrémente la version de l'utilisateur.
- **Sans Redis** : chaque requête recalcule. C'est le cas des tests d'intégration.

## Observabilité

Métriques Prometheus, sans identifiant ni libellé personnel :

- `recommendation_requests_total{context,level,cache}`
- `recommendation_latency_ms{context,cache}`
- `recommendation_candidates{context}`
- `recommendation_empty_total{context}`
- `recommendation_fallback_total{reason}`
- `recommendation_errors_total{code}`
- `recommendation_feedback_total{type}`
- `recommendation_profile_rebuilds_total{outcome}`

Le log structuré `recommendations` contient :

- le contexte et le niveau ;
- l'indicateur `authenticated` ;
- l'algorithme et l'indicateur `degraded` ;
- le statut du cache et la page ;
- la latence et le nombre de résultats.

Il ne contient ni identifiant d'utilisateur, ni préférence, ni lieu.

## Service ML (futur)

`RECOMMENDATION_ENGINE=remote` avec `RECOMMENDATION_SERVICE_URL` : l'API envoie `POST {url}/v1/rank` avec les éléments suivants :

- le mode ;
- les poids ;
- les préférences résolues (identifiants de référentiel) ;
- le profil d'activité ;
- les caractéristiques des candidats, identifiés par leur UUID public.

Elle n'envoie jamais d'identité d'utilisateur, d'identifiant interne ni de publieur.

Réponse attendue : `{ "items": [{ "listingId": "<uuid du pool>", "score": 0..1, "reasons": ["BUDGET_MATCH"] }] }`. Une réponse hors contrat déclenche le repli : statut en erreur, délai `RECOMMENDATION_SERVICE_TIMEOUT_MS` dépassé, annonce hors du pool ou score hors bornes. Le repli bascule sur les règles et produit `meta.degraded = true` ainsi que la métrique `recommendation_fallback_total`. Les codes de raison inconnus sont ignorés.

## Tests

| Fichier                                         | Couverture                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `domain/recommendation-domain.spec.ts`          | poids, configuration, budget, score, raisons, diversification, profil de comportement, curseur                                                                                                         |
| `application/recommendation-ranker.spec.ts`     | moteur distant (contrat, aucune donnée d'identité envoyée), replis                                                                                                                                     |
| `infrastructure/recommendation-cache.spec.ts`   | isolation des clés par utilisateur, invalidations, anti-rebond                                                                                                                                         |
| `test/recommendation/recommendation.db-spec.ts` | API complète sur PostgreSQL : visiteur, préférences, budget, tolérance, retours, propriété des recommandations, comportement, exclusions, similaires, pagination, identifiants, performance indicative |

Les tests d'intégration créent leur propre ville (codes uniques à chaque exécution) dans la base `*_test` pour obtenir des classements déterministes.

## Limites connues

- Un événement perdu (arrêt entre la validation et la publication) laisse une liste en cache jusqu'à la fin de son TTL. La visibilité, elle, reste revérifiée à l'hydratation.
- L'anti-rebond d'invalidation et le recalcul de profil vivent dans le processus ; avec plusieurs instances, chacune invalide via Redis (compteur partagé), mais un événement émis pendant un arrêt est perdu. BullMQ ou une outbox corrigeront ce point.
- Pas de rafraîchissement programmé des profils ni de purge des recommandations expirées (`expires_at`) : à confier au worker.
- Pas de graphe de voisinage entre communes : une commune limitrophe ne compte que comme « même ville » (0,2).
