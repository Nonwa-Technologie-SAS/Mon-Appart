# Rétention et notifications

Complète [messaging-and-notifications.md](./messaging-and-notifications.md), [push-notifications.md](./push-notifications.md) et [retention-and-loyalty-strategy.md](./retention-and-loyalty-strategy.md).

## Mécanismes disponibles

| Mécanisme                                                  | État                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| Recherches persistantes Nest                               | Livré (`/saved-searches`, UI profil + enregistrement depuis la recherche) |
| Alertes `NEW_PROPERTY`                                     | Livré (job SKIP LOCKED, digest, dédup)                                    |
| Favoris Nest                                               | Livré (API + page `/favoris` + alertes prix / indisponibilité)            |
| Préférences `SAVED_SEARCHES` / `PRICE_DROPS` / `MARKETING` | Policy + UI `/profil` + contrôle à l’envoi                                |
| Post-visite                                                | Livré (retour facultatif, note privée)                                    |
| Recommandations `/pour-vous`                               | Module reco existant, inchangé                                            |
| Messages / visites                                         | Notifications communication existantes                                    |

## Règles

- Pas de notifications fictives.
- Consentement / désabonnement / rate limits du module notifications.
- Une annonce hors budget n’est jamais présentée comme strictement compatible.
- Un projet n’est terminé que s’il est déclaré.
