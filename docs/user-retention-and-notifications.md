# Rétention et notifications

Complète [messaging-and-notifications.md](./messaging-and-notifications.md) et [push-notifications.md](./push-notifications.md).

## Mécanismes disponibles

| Mécanisme                                    | État                                         |
| -------------------------------------------- | -------------------------------------------- |
| Favoris web (`PropertyFavorite`)             | UI fiche + server actions                    |
| Favoris Nest `/interactions/favorites`       | API + analytics server ; auth Nest distincte |
| Recommandations `/pour-vous`                 | Module reco existant                         |
| Prefs notif `SAVED_SEARCHES` / `PRICE_DROPS` | Enums / policy ; **pas d’émetteur**          |
| Critères mémorisés localement                | Fondation ; aucune notif envoyée             |
| Messages / visites                           | Notifications communication existantes       |

## Règles

- Pas de notifications fictives pour simuler l’activité.
- Respect consentement / désabonnement / rate limits du module notifications.
- Alertes futures : uniquement sur changements réels (nouvelle annonce matching, baisse de prix confirmée).

## Prochaine étape rétention

Job asynchrone : lire critères sauvegardés (compte connecté, pas seulement localStorage) → matcher nouvelles annonces → emit `NEW_PROPERTY` via le module notifications existant.
