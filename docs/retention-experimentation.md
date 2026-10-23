# Expérimentation rétention

Pas de plateforme d’A/B ajoutée. Configuration simple :

- `SAVED_SEARCH_DAILY_MIN_HOURS`, `SAVED_SEARCH_WEEKLY_MIN_DAYS`
- `REACTIVATION_IDLE_DAYS`, `REACTIVATION_COOLDOWN_DAYS`
- `SAVED_SEARCH_DIGEST_MAX`

Toute expérience future doit fixer : hypothèse, segment, métrique principale (reprise utile), garde-fous (désinscription, plaintes, fréquence, pertinence `exact` vs `near_budget`), durée d’arrêt. Ne pas retenir la variante qui maximise les clics si elle dégrade la qualité des demandes.
