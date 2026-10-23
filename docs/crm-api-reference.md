# Référence API CRM (Inquiry)

Base : `/api/v1`. Authentification Bearer / cookies `ma_*`.

## `GET /inquiries`

Filtres : `cursor`, `listingId`, `stage`, `status`, `assignee` (`me` \| `unassigned` \| `all`), `q` (titre d’annonce), `take` (1–50).  
Pagination curseur (createdAt, id). Les listes n’incluent pas notes ni historique.

## `GET /inquiries/dashboard`

Agrégats du gestionnaire courant. Voir [owner-agency-dashboard.md](./owner-agency-dashboard.md).

## `GET /inquiries/:inquiryId`

Fiche : qualification, notes internes (50), historique de stages (50), visites récentes.

## `PATCH /inquiries/:inquiryId`

Corps optionnel : `stage`, `nextAction`, `nextActionAt`, `budgetAmount` (XOF entier), `desiredZone`, `desiredMoveAt`, `lostReason`, `assigneePublicId`.  
422 si transition interdite ou motif de perte manquant.

## `POST /inquiries/:inquiryId/notes`

`{ body }` 2–2000 caractères. 201 + fiche mise à jour.

## Visites (inchangées)

`POST /appointments`, `GET /appointments?scope=upcoming|past|all`,  
`POST /appointments/:id/confirm|reschedule|cancel|complete|no-show`.

## Contact

`POST /conversations` `{ listingId, message }` crée ou réutilise la conversation et l’Inquiry `MESSAGE`.
