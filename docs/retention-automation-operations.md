# Exploitation des automatisations

Worker in-process `DeliveryRunner` (déjà utilisé pour les livraisons et rappels de visite).

| Tâche                        | Intervalle                    | Idempotence                                                    |
| ---------------------------- | ----------------------------- | -------------------------------------------------------------- |
| Rappels visite               | 60 s                          | `reminder_sent_at` + `dedupKey`                                |
| Alertes recherches / favoris | 120 s                         | `FOR UPDATE SKIP LOCKED`, `last_checked_at`, `dedupKey` digest |
| Livraisons e-mail/SMS        | `NOTIFICATION_WORKER_POLL_MS` | outbox, max tentatives, annulation si préférence changée       |

Erreurs temporaires : backoff existant. Erreurs permanentes : `FAILED` / `CANCELLED`, pas de boucle.

Variables : `SAVED_SEARCH_ALERT_BATCH`, `SAVED_SEARCH_DAILY_MIN_HOURS`, `SAVED_SEARCH_WEEKLY_MIN_DAYS`, `REACTIVATION_IDLE_DAYS`, `REACTIVATION_COOLDOWN_DAYS`, `SAVED_SEARCH_DIGEST_MAX`, `SEARCH_MAX_SAVED_SEARCHES`.

Aucun envoi réel n’est déclenché par la documentation. SMTP / SMS restent optionnels.
