# Réponse aux incidents Trust & Safety

Complète [incident-management.md](./incident-management.md) et [security-incident-response.md](./security-incident-response.md). Pas de canal automatique vers autorités, utilisateurs tiers ou presse.

## Quand ouvrir un incident (humain)

- Tentative crédible de vol d’identifiants (alerte harvest **confirmée** + contexte).
- Usurpation du support officiel.
- Demande de paiement associée à d’autres faits graves.
- Vague d’annonces suspectes (burst + médias croisés + signalements fondés).
- Compte professionnel probablement compromis (changements de contact + alertes).
- Accès non autorisé à des pièces ou suspicion de fuite.

Une alerte automatique **crée un TrustSignal**, pas un incident P1.

## Conduite

1. Créer / assigner le signalement ou l’alerte dans le back-office existant.
2. Préserver : ne pas supprimer l’annonce, les médias, les événements ; utiliser suspension Listing si besoin.
3. Responsable : TRUST_OFFICER (fraude métier) ou Admin sécu (accès / fuite).
4. Mesures préventives autorisées : `listing:suspend`, fermeture de conversation, révocation de sessions Identity, `NEEDS_MORE_INFORMATION`.
5. Notifier les équipes via le processus incident existant — pas un e-mail de masse aux utilisateurs sans validation.
6. Journaliser chaque action (audit + note interne).
7. Clôturer avec justification (`CONFIRMED`/`DISMISSED`, post-mortem si P1 sécu).

## Interdits

- Sanction irréversible automatique.
- Bannissement de masse sans revue.
- Contact autorités sans procédure autorisée.
- Publication des règles de détection dans une réponse utilisateur.
