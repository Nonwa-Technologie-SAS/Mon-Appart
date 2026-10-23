# Workflows de signalement et d’investigation

## Dépôt (utilisateur)

- Annonce : `POST /api/v1/trust/reports` (`targetType: LISTING`) depuis la fiche publique.
- Conversation / message : `POST /api/v1/conversations/:id/report` (participants seulement).
- Permission `report:create`, throttle `TRUST_REPORT_RATE_LIMIT`.
- Un seul signalement **ouvert** par déclarant et cible ; quota quotidien.
- Description facultative ≤ 1000 caractères, sans pièce jointe obligatoire.

Motifs réutilisés (enum Prisma, pas de nouvel enum) :

`SUSPECTED_SCAM`, `DUPLICATE_LISTING`, `INCORRECT_PRICE`, `PROPERTY_NOT_AVAILABLE`, `UNAUTHORIZED_LISTING`, `MISLEADING_INFORMATION`, `SUSPICIOUS_DOCUMENT`, `INAPPROPRIATE_CONTENT`, `OTHER`.

Le déclarant voit `OPEN` / `IN_REVIEW` / `RESOLVED` — jamais `CONFIRMED` vs `DISMISSED`.

## File (modérateur)

Back-office `apps/admin` → Signalements. Filtres statut, cible, priorité. Par défaut FIFO des dossiers ouverts. `REPORT_THRESHOLD` passe la priorité à `HIGH` (examen, pas de mise hors ligne).

## Fiche d’investigation

La vue détail ajoute, sans nouveau back-office :

- Signalement, cible, déclarants distincts.
- Historique append-only (`report_events`).
- Extrait de conversation **borné** (message visé ou derniers messages).
- Alertes `TrustSignal` ouvertes de l’annonce.
- Évaluation `listing-risk-v1` (recommandation).
- Actions existantes : assigner, confirmer / écarter, mesure `NONE` / `LISTING_SUSPENDED` / `VERIFICATION_REVIEW_REQUESTED` / `CONVERSATION_CLOSED`.

Les conversations privées ne sont pas ouvertes en entier. Les notes internes ne partent pas au déclarant.

## Statuts

| Statut    | Sens                                        |
| --------- | ------------------------------------------- |
| OPEN      | Nouveau / à examiner                        |
| IN_REVIEW | Pris en charge                              |
| CONFIRMED | Fondé **après** examen humain               |
| DISMISSED | Non confirmé / non fondé / clos sans mesure |

Pas de statuts supplémentaires : ils couvrent « informations complémentaires » via une note interne ou un dossier de vérification `NEEDS_MORE_INFORMATION`.

## Abus de signalement

- Déduplication par cible ouverte.
- Quota quotidien.
- Volume ≠ culpabilité de la cible.
- Identité du déclarant non exposée à la cible.
- Réexamen : nouvelle décision impossible sur un dossier clos ; un nouveau signalement peut être ouvert après clôture selon les règles existantes.

Un signalement reste une **allégation**.
