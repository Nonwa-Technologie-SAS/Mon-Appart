# Expérience post-visite

## Livré

Lorsqu’une visite passe à `COMPLETED` :

1. Notification transactionnelle au prospect (`VISITS` / `APPOINTMENT`) : invitation facultative à indiquer la suite.
2. Formulaire sur `/profil` : issue, motif optionnel, note privée, partage optionnel de **l’issue seulement**.
3. `POST /api/v1/appointments/:id/feedback` — prospect uniquement, une fois, visite réalisée.
4. L’annonceur voit `feedback.submitted` ; `outcome` seulement si `shareOutcomeWithOwner`.
5. `PROJECT_COMPLETED` met le projet en `COMPLETED` et met les alertes en pause.
6. `PROJECT_ABANDONED` met le projet en `PAUSED`.

Les issues (`VisitFeedbackOutcome`) sont distinctes du statut technique de la visite et du stage Inquiry.

## Confidentialité

La note privée n’entre pas dans les événements analytics, les logs ni le payload de notification.
