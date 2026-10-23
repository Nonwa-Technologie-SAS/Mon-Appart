# Permissions CRM et protection des données

## Authentification

Toutes les routes `/api/v1/inquiries*` exigent une session. L’appartenance est revérifiée **à chaque requête** (`isCurrentManager`). Les identifiants owner/agence envoyés par le client ne sont pas utilisés.

## Autorisation

| Acteur                                    | Liste / fiche / notes | Conversation   | Visite          |
| ----------------------------------------- | --------------------- | -------------- | --------------- |
| Prospect                                  | 404                   | côté REQUESTER | ses visites     |
| Gestionnaire courant                      | oui                   | LISTING_SIDE   | actions listing |
| Autre propriétaire                        | 404                   | 404            | 404             |
| Ancien gestionnaire (`isCurrent = false`) | 404                   | 404            | 404             |

Les notes internes ne sont jamais sérialisées dans `GET /conversations/:id/messages`.

Profil prospect côté CRM : prénom + initiale, pas d’e-mail ni de téléphone dans l’API Inquiry.

## Minimisation

Budget, zone et délai uniquement s’ils sont fournis. Journal d’audit : codes et identifiants publics, pas le corps des notes.

## Rate limiting

Écritures Inquiry : même plafond que la messagerie. Contact et visites : plafonds communication existants.
