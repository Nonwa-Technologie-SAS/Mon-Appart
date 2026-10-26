# Workflows de gestion des leads

## Prospect

1. Ouvre une fiche annonce.
2. Envoie un message (`POST /conversations`) ou demande une visite (`POST /appointments`).
3. Une Inquiry est créée, liée à l’annonce, au bien et au gestionnaire du moment.

## Responsable (propriétaire, agent, agence)

1. Consulte `/espace/demandes` (priorité, statut, annonce).
2. Ouvre la fiche : conversation, visites, notes internes, historique.
3. Répond dans la conversation (visible du prospect).
4. Qualifie : budget déclaré, zone, prochaine action, stage.
5. Attribue éventuellement à un autre gestionnaire **courant** du même bien (`assigneePublicId`).

## Notes internes

`POST /inquiries/:id/notes`. Jamais copiées dans `messages`. Le prospect qui appelle la fiche reçoit 404.

## Équipe d’agence

L’accès suit `PropertyOwnership.isCurrent`, pas un organigramme RH. Un agent sans rattachement courant au bien ne voit pas le lead.
