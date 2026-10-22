# Événements et features — recommandation

## Tables métier (source de vérité comportementale)

| Signal | Table | Écriture |
| --- | --- | --- |
| Favori | `favorites` | `POST /interactions/favorites` |
| Consultation | `property_views` | `POST /interactions/views` |
| Contact / RDV | `inquiries`, `appointments` | Messaging |
| Recherche | `searches` | Search `submit=true` |
| Feedback reco | `recommendation_feedback` | `POST /recommendations/:id/feedback` |
| Profil agrégé | `user_behavior_profile` | Rebuild paresseux |

## Analytics (catalogue `@mon-appart/analytics`)

| Événement | Origine | Notes |
| --- | --- | --- |
| `recommendations_requested` | server | Page servie ≠ exposition |
| `recommendations_viewed` | client | **Front non branché** (catalogue prêt) |
| `recommended_listing_opened` | client | Idem |
| `recommendation_feedback_submitted` / `dismissed` | server | Via feedback API |
| `listing_favorited` / `unfavorited` | server | **Instrumentés** via Interaction |
| `search_submitted` | server | Search |

Idempotence analytics : `deterministicEventId` sur faits métier.

## Features du score

Dimensions : budget, location, type, size, amenities, behavior, quality. Poids `RECOMMENDATION_WEIGHTS` (somme 100). Décroissance temporelle comportementale : demi-vie configurable.

## Ce qui n’est pas collecté

- Contenu des messages privés
- Caractéristiques sensibles (origine, religion, santé, opinions)
- Double comptage favori via `user_events` (tables dédiées prioritaires)
