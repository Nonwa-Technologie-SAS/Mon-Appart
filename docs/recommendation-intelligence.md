# Intelligence de recommandation

Complète `docs/recommendation.md` et l’ADR 0007. Date : 2026-10-20.

## Principe

Le moteur **existant** (`rules-v1`) reste la source de classement organique. Prompt 20 l’étend (signaux favoris/vues, raisons, évaluation hors ligne, UI) **sans second moteur** et **sans ML en production**.

## Pipeline (inchangé)

Filtres stricts → préférences + comportement + exclusions → pool Search → score pondéré → diversification MMR → cache → hydratation → persistance (comptes).

## Contraintes obligatoires

Budget, type d’offre, localisation filtrée, éligibilité publique : **exclus avant score**. Un score élevé ne réintroduit jamais une annonce hors plafond.

## Raisons (codes)

Voir `RECOMMENDATION_REASON_LABELS` dans `@mon-appart/types`. Alias Prompt 20 :

| Code Prompt 20 | Émis actuellement | Mapping |
| --- | --- | --- |
| `BUDGET_MATCH` | oui | — |
| `LOCATION_MATCH` | libellé réservé | `PREFERRED_NEIGHBORHOOD` / `PREFERRED_COMMUNE` |
| `PROPERTY_TYPE_MATCH` | oui | — |
| `FEATURES_MATCH` | libellé réservé | `AMENITIES_MATCH` |
| `USER_PREFERENCE_MATCH` | libellé réservé | `MATCHES_YOUR_ACTIVITY` |
| `RECENT_LISTING` | libellé réservé | `RECENTLY_PUBLISHED` |
| `DIVERSITY_ADJUSTMENT` | oui | MMR avance un item vs ordre score seul |

Les libellés réservés existent dans l’API types pour stabilité de contrat ; le moteur continue d’émettre les codes historiques pour ne pas saturer la limite de 3 raisons.

## Niveaux

`GENERIC` → `PREFERENCES` → `BEHAVIOR`. Démarrage à froid : qualité + fraîcheur, sans inventer de préférences.

## Interaction (nouveauté)

Module `apps/api/src/modules/interaction` :

- `POST/DELETE/GET /api/v1/interactions/favorites/:listingId`
- `POST /api/v1/interactions/views`

Écrit `favorites` / `property_views` lus par le profil comportemental. Invalidation cache reco via événements domaine.

## Effacer les inférences

`DELETE /api/v1/recommendations/behavior-profile` — profil inféré seulement ; préférences déclarées conservées.

## ML

**Non déployé.** Stub Python = health only. Réentraînement conditionné à un volume mesurable (voir `recommendation-ml-lifecycle.md`).
