# Stratégie de tests CRM

## Unitaire (toujours exécutable)

`apps/api/src/modules/communication/inquiries/domain/inquiry-lead-stage.spec.ts`

- Transitions autorisées / interdites.
- Indices après première réponse et visite.
- Priorité HIGH (visite + sans réponse).
- Absence de scoring « solvabilité ».
- Action échue et budget proche du prix.

## Intégration DB (nécessite PostgreSQL de test)

`apps/api/test/communication/communication.db-spec.ts` — bloc « CRM Inquiry » :

- Le propriétaire voit la demande, le prospect et un autre owner non.
- `NEW → CONVERTED` refusé.
- Le prospect ne peut pas changer le stage ni lire/écrire une note.
- Dashboard basé sur des vraies inquiries.

Les tests messagerie / visites existants couvrent déjà `APPOINTMENT_ALREADY_ACTIVE`, notifications et IDOR conversations.

## E2E web

Non automatisé dans ce lot. Parcours manuel : `/espace`, `/espace/demandes`, `/espace/visites`, CTA message + visite sur une annonce.

## Sécurité à rejouer

- Sans session : 401 sur `/inquiries`.
- UUID d’un lead tiers : 404.
- Note interne absente des messages.
