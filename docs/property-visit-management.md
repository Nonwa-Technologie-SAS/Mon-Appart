# Gestion des visites

API existante : `/api/v1/appointments`. UI responsable : `/espace/visites`. UI prospect : dialogue sur la fiche annonce.

## Cycle

1. Le prospect propose un créneau (`PENDING`). Fuseau par défaut `Africa/Abidjan`.
2. Le côté annonce confirme, refuse (annule) ou propose une autre date (`RESCHEDULE_REQUESTED`).
3. L’autre partie accepte la nouvelle date (`CONFIRM`) ou contre-propose.
4. Après l’heure prévue, le côté annonce peut marquer `COMPLETE` ou `NO_SHOW`.

Une visite n’est **jamais** confirmée automatiquement.

## Conflits

- Une seule visite active par (annonce, prospect) : `APPOINTMENT_ALREADY_ACTIVE`.
- Pas d’agenda de créneaux publiés : pas de détection d’overlap entre deux prospects distincts. C’est volontaire (pas de fausse disponibilité temps réel).

## Notifications

Réutilisent le module Notifications (outbox, déduplication `dedup_key`, préférences). Rappels : `AppointmentReminders`. Canaux SMS/WhatsApp uniquement s’ils sont réellement configurés.

## Lien CRM

Confirmation → stage `VISIT_PLANNED` si le lead n’est pas déjà plus avancé.  
Réalisation → `VISIT_DONE` depuis `VISIT_PLANNED`.
