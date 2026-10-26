# Permissions Trust & Safety et audit

Réutilise Identity. Pas de matrice parallèle.

## Dépôt et lecture utilisateur

| Permission            | Effet                           |
| --------------------- | ------------------------------- |
| `report:create`       | Déposer un signalement (membre) |
| `verification:create` | Ouvrir un dossier               |

Le dossier d’un autre utilisateur répond 404.

## Instruction

| Permission                                   | Effet                                                 |
| -------------------------------------------- | ----------------------------------------------------- |
| `report:review`                              | File, détail, assignation, clôture des signalements   |
| `verification:read`                          | File et détail des dossiers                           |
| `verification:review`                        | Alertes de risque, notes d’instruction                |
| `verification:documents`                     | Télécharger une pièce (lien court audité)             |
| `verification:approve` / `reject` / `revoke` | Décisions TRUST_OFFICER                               |
| `listing:suspend`                            | Suspendre / republier via Listing, pas via Trust seul |
| `admin:access`                               | Entrer dans le back-office                            |

`ADMIN` technique n’a pas les pièces personnelles par défaut.

## Contrôles serveur

- Guard permissions sur chaque route Trust / Admin / Listing.
- Conflit d’intérêts : pas d’instruction de son bien, de sa conversation, de son signalement.
- IDOR : cibles résolues par UUID public, 404 si hors périmètre.
- Rate limit sur `POST /trust/reports`.
- Extraordinaire conversationnel : `ConversationModerationService.excerpt` seulement.

## Audit

Actions `TrustAuditAction` (création de signalement, décisions, revue d’alerte). Le texte libre du déclarant **n’est pas** recopié dans l’audit. Les consultations `user:pii` sont auditées côté Admin.

Les notes internes restent dans `report_events.internalNote` / événements de vérification, hors API déclarant.
