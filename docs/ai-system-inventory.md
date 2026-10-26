# Inventaire des systèmes IA

Source de vérité code : `AI_SYSTEM_REGISTRY`. Le back-office `/ai` fusionne flags et versions runtime. Un stub n’est pas opérationnel.

| Id                 | Nom                             | Statut réel                    | Type                      | Risque | Version               |
| ------------------ | ------------------------------- | ------------------------------ | ------------------------- | ------ | --------------------- |
| search_intelligent | Recherche                       | opérationnel                   | règles                    | faible | postgres / opensearch |
| recommendation     | Reco personnalisée / similaires | opérationnel                   | règles `rules-v1`         | modéré | `algorithmVersion`    |
| assistant          | Assistant conversationnel       | opérationnel                   | NLU déterministe + Search | modéré | `assistant-reply-v1`  |
| lead_priority      | Priorisation des leads          | opérationnel                   | règles                    | modéré | inquiry-priority-v1   |
| trust_listing_risk | Signaux d’annonces à risque     | opérationnel                   | règles                    | élevé  | listing-risk-v1       |
| remote_ranker      | FastAPI `/v1/rank`              | **stub** (`/health` seulement) | remote optionnel          | modéré | `remote-v1` non servi |

## Non présents (ne pas inventer)

- Embeddings / recherche vectorielle en production
- Modèle ML entraîné
- Modération 100 % automatique par LLM
- Génération d’annonces
- Accès LLM à la base ou aux secrets

Propriétaires techniques : modules Nest correspondants. Produit : Découverte / Leads / Confiance.
