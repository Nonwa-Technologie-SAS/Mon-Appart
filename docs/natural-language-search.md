# Recherche en langage naturel

## Critères pris en charge (extraction rules)

| Champ | Exemples |
| --- | --- |
| `listingTypes` | louer, location, acheter, vente, courte durée |
| `propertyTypes` | appartement, maison, villa, studio, terrain, duplex, bureau, boutique |
| `communes` / `neighborhoods` / `cities` | Cocody, Angré, Riviera, Zone 4, Abidjan, Bouaké… |
| `priceMin` / `priceMax` | 250 000, 250k, 1.5M, max / minimum |
| `pricePeriod` | MONTH (location), DAY (journalier), TOTAL (achat) |
| `bedroomsMin` / `bathroomsMin` | « 3 chambres », « 2 sdb » |
| `surfaceMin` / `surfaceMax` | « 80 m² » |
| `amenities` | parking, piscine, clim, jardin, wifi… |
| Soft prefs | calme, emménager vite, familial, commerces (hints non filtrants) |

## Clarifications

- Terrain sans opération → acheter ou louer ?
- Abidjan sans commune → préciser ou « Tout Abidjan »
- Location sans budget → préciser ou « Sans budget » / `forceSearch`
- Périodicité ambiguë (montant + achat **et** location) → clarification

## Mapping Search

Les critères stricts deviennent des query params Search (`listingType`, `commune`, `maxPrice`, `bedrooms`, `amenities` en mode AND, etc.). Les soft prefs ne forcent pas de filtre inventé.

## Fallback

Si Search échoue : mode `error` / `degraded`, critères et `searchParams` conservés, lien recherche classique côté UI.
