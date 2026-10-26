# Guide d’exploitation CRM

## Migration

`apps/api/prisma/migrations/20261023100000_inquiry_crm/migration.sql`

Colonnes Inquiry + tables `inquiry_notes` et `inquiry_stage_history`. Additive, sans suppression.

```
pnpm --filter @mon-appart/api db:migrate
pnpm --filter @mon-appart/api db:generate
```

## Jobs

Rappels de visite : `AppointmentReminders` (existant). Idempotents via `dedup_key`.  
Pas de worker CRM dédié. PostgreSQL reste la source de vérité ; Redis n’héberge pas les leads.

## Automatisations livrées

- Première réponse → `firstRespondedAt` + stage CONTACTED si NEW.
- Confirmation / réalisation de visite → indices de stage.
- Notifications de visite / message via l’outbox existante.

## Automatisations non livrées

- Relance e-mail si aucune réponse sous 24 h (éviterait un second canal sans préférence explicite dédiée).
- Campagnes WhatsApp.

## Incidents

Si `/inquiries` renvoie 500 après déploiement : vérifier que la migration et `prisma generate` ont été appliqués, puis redémarrer l’API.
