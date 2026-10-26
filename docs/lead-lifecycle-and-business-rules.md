# Cycle de vie des leads (Inquiry)

Source de vérité : `apps/api/src/modules/communication/inquiries/domain/inquiry-lead-stage.ts`.

## Statuts

`NEW` → `CONTACTED` → `QUALIFIED` → `VISIT_PLANNED` → `VISIT_DONE` → `FOLLOW_UP` → `CONVERTED`  
Sorties : `LOST` (motif obligatoire), `ARCHIVED`.

`CONVERTED` est une **déclaration** du responsable. Ce n’est pas une location ou une vente vérifiée.

## Transitions automatiques (indices, pas de forçage métier)

| Événement                     | Condition                                       | Stage suggéré                    |
| ----------------------------- | ----------------------------------------------- | -------------------------------- |
| Première réponse listing-side | stage = `NEW`                                   | `CONTACTED` + `firstRespondedAt` |
| Visite confirmée              | `NEW` / `CONTACTED` / `QUALIFIED` / `FOLLOW_UP` | `VISIT_PLANNED`                  |
| Visite réalisée               | `VISIT_PLANNED`                                 | `VISIT_DONE`                     |

Les autres changements passent par `PATCH /inquiries/:id` et sont historisés (`inquiry_stage_history`).

## Déduplication

- Une conversation par couple (annonce, prospect). Un second message réutilise la conversation (`created: false`).
- Une visite **active** (PENDING / CONFIRMED / RESCHEDULE_REQUESTED) par couple (annonce, prospect). Conflit `APPOINTMENT_ALREADY_ACTIVE`.
- Deux demandes sur **deux annonces** restent deux leads.

## Motifs de perte

`BUDGET`, `LOCATION`, `TIMING`, `NO_RESPONSE`, `PROPERTY_UNAVAILABLE`, `OTHER`.
