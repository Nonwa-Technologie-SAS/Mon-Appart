# Analytics de conversion des contacts

Pas de seconde infrastructure d’événements. Catalogue : `packages/analytics/src/catalog.ts`. Listener : `business-event.listener.ts`.

## Événements

| Événement                              | Déclencheur                                    | Déduplication                  |
| -------------------------------------- | ---------------------------------------------- | ------------------------------ |
| `listing_contact_started`              | Ouverture du formulaire (client)               | Intention, pas un lead         |
| `listing_contact_submitted`            | Conversation `PROPERTY_INQUIRY` créée          | `conversationId`               |
| `message_reply_received`               | Première réponse listing-side                  | `conversationId`               |
| `appointment_requested`                | Appointment PENDING                            | `appointmentId`                |
| `appointment_confirmed`                | Confirmation (discriminant `confirmedAt`)      | par confirmation               |
| `appointment_cancelled` / `_completed` | Transition                                     | `appointmentId`                |
| `qualified_lead_recorded`              | 1re réponse **ou** 1re visite selon `leadRule` | 1 par conversation             |
| `inquiry.stage_changed`                | Communication interne Nest                     | audit + CRM, pas un KPI growth |

Les indicateurs du tableau de bord CRM (`/inquiries/dashboard`) sont des agrégats PostgreSQL, distincts des KPI growth agrégés.

## Interprétations interdites

- Visite réalisée ≠ location / vente.
- `CONVERTED` CRM ≠ `qualified_lead_recorded`.
- Comparer des cohortes de maturité différente sans fenêtre explicite.
