# Indicateurs et funnels de croissance

Réutilise [bi-metrics-catalog.md](./bi-metrics-catalog.md) et `METRICS_CATALOG`. Les UIs ne recalculent pas les formules.

## Funnel chercheur (acteur-jour, consent)

Voir `funnel.actor_day` : 1_VISIT → … → 8_QUALIFIED_LEAD.

Interprétation :

- Somme multi-jours ≠ utilisateurs uniques période.
- `listing_contact_started` (client) ≠ contact soumis (server).
- Visites web legacy (`PropertyVisit`) ne sont pas encore `appointment_requested` Nest.

## Funnel annonceur

Inscription OWNER/AGENCY → publication → (vérification / modération) → annonce éligible.

Activation = `growth.activated_publisher` (≥1 publication), pas le seul compte créé.

## Métriques growth ajoutées

| ID | Calculable aujourd’hui ? |
| -- | ------------------------ |
| `growth.acquisition_by_channel` | Oui si client + consent + agrégation/raw events |
| `growth.activated_seeker` | Partiel (funnel / events client) |
| `growth.activated_publisher` | Oui côté server listings Nest ; web legacy séparé |

## Non calculables sans nouvelles données

- CAC / ROAS (pas de dépenses importées)
- Rétention cohorte 1/7/30 à volume significatif
- Favoris dans BI Nest si favoris uniquement web legacy
- Transaction immobilière conclue
