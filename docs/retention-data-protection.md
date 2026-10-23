# Protection des données (rétention)

Cadre : minimisation et finalité pour un service immobilier en Côte d’Ivoire. Pas d’importation automatique d’un régime étranger.

- Notes post-visite privées : colonne `private_note`, jamais dans analytics, notifications, CRM Inquiry.
- Recherches et favoris : visibles uniquement du titulaire du compte (`userId` côté serveur).
- Pas de profils sensibles (origine, religion, etc.) à partir des critères.
- Projet `COMPLETED` : conservation des recherches en pause, plus d’alertes.
- Tâches asynchrones : identifiants publics et codes seulement dans les logs.

Les propriétaires ne voient pas l’activité privée d’un prospect (favoris, recherches, notes) hors de ce que le prospect envoie explicitement (message, demande, issue partagée).
