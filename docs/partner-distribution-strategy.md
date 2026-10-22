# Stratégie de distribution et indicateurs

## Canaux

| Canal | État |
| ----- | ---- |
| Site + SEO | Existant |
| Liens partageables annonces | Existant (growth) |
| Webhooks sortants partenaires | Fondations V1 |
| Import CSV dry-run | Fondations V1 |
| API machine partenaires | Non |
| Diffusion portails externes | Non (droits requis) |

## Indicateurs (définitions)

| Indicateur | Définition |
| ---------- | ---------- |
| Partenaires enregistrés | Lignes `partners` |
| Commercialement actifs | `commercialStatus=ACTIVE` |
| Techniquement actifs | ≥1 intégration `status=ACTIVE` |
| Annonces reçues (CSV) | `acceptedRows` des lots |
| Taux erreur import | `rejectedRows / rowCount` |
| Livraisons réussies | `PartnerDelivery` DELIVERED |
| Contacts sur annonces partenaires | Via Analytics + `PartnerListingLink` (après application) |

Ne pas afficher de valeurs fictives. Mesurer dès qu’il existe des partenaires réels.

## Monétisation

Réutiliser Billing (abonnements / packs) — pas de PSP concurrent. Contenus sponsorisés : transparence obligatoire, sans altérer les critères utilisateurs.
