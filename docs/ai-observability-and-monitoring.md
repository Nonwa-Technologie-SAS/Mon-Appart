# Observabilité des systèmes IA

Réutilise Prometheus (`MetricsService`), logs JSON bornés, Analytics. Pas de nouvelle stack Grafana/OTel.

## Reco

- `recommendation_requests_total{context,level,cache}`
- `recommendation_latency_ms`
- `recommendation_empty_total`
- `recommendation_fallback_total{reason}`
- `recommendation_shadow_total{outcome=agree\|disagree\|error}`
- événements `recommendations_requested` (serveur), `recommendations_viewed` / `recommended_listing_opened` (client, si consentement)

Labels : contextes et codes, **pas d’userId**.

## Assistant

- `assistant_requests_total{mode,provider}`
- `assistant_latency_ms{mode}`
- `assistant_empty_total`
- `assistant_fallback_total{reason}`
- `assistant_injection_suspected_total`
- `assistant_feedback_total{rating}`
- événements `assistant_turn_completed`, `assistant_feedback_submitted` (sans texte)

## Dérive

Aucune détection statistique automatique n’est déployée. Surveiller manuellement : taux vides, fallbacks, distribution `algorithmVersion` (admin Analytics Reco). Une dérive d’entrée ≠ modèle cassé.

Métriques catalogue : `reco.empty_rate`, `assistant.fallback_rate` (formules, pas de chiffres fictifs).
