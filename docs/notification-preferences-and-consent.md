# Préférences et consentement

Source de vérité : `GET/PUT /api/v1/notification-preferences`. UI : `/profil`.

| Catégorie                        | Défaut                       | Verrou                |
| -------------------------------- | ---------------------------- | --------------------- |
| `ACCOUNT` in-app + e-mail        | on                           | oui (sécurité)        |
| `MESSAGES` / `VISITS`            | on (in-app, e-mail)          | in-app hors marketing |
| `SAVED_SEARCHES` / `PRICE_DROPS` | in-app (+ push si configuré) | non                   |
| `MARKETING`                      | **tout désactivé**           | non                   |

Le refus du marketing n’arrête pas les rappels de visite demandés. Les préférences sont relues **à l’envoi** (`isEnabled` + `planChannels`). Une désinscription marketing émet `marketing_unsubscribed`.
