# Spécification API partenaires (admin)

Base : `/api/v1`. Auth JWT admin + permissions `partner:read` / `partner:manage`.

## Endpoints

| Méthode | Chemin | Permission | Description |
| ------- | ------ | ---------- | ----------- |
| GET | `/admin/partners` | partner:read | Liste paginée |
| GET | `/admin/partners/:id` | partner:read | Détail |
| POST | `/admin/partners` | partner:manage | Créer fiche (≠ accord signé) |
| PATCH | `/admin/partners/:id` | partner:manage | Statut commercial / nom |
| POST | `/admin/partners/:id/integrations/webhook-out` | partner:manage | Webhook HMAC out |
| POST | `/admin/partners/:id/integrations` | partner:manage | Stub CSV/API/… |
| PATCH | `/admin/partners/integrations/:id/status` | partner:manage | Activer / suspendre |
| POST | `/admin/partners/:id/imports/csv/validate` | partner:manage | Dry-run CSV |
| POST | `/admin/partners/deliveries/run` | partner:manage | Traiter outbox |

## Webhook outbound (contrat v1)

- Méthode `POST` vers `webhookUrl` HTTPS.
- En-tête `Mon-Appart-Signature: t=<unix>,v1=<hex>` (HMAC-SHA256 de `<t>.<body>`).
- En-tête `Idempotency-Key` = `eventId`.
- Corps JSON minimal : `event`, `eventId`, `occurredAt`, `listingId`, `status`, `partnerCode`, `contractVersion`.
- Pas de PII, pas de secrets.

## API machine partenaire (création d’annonces)

**Non livrée en V1.** Les agences utilisent les APIs Listing/Property existantes avec comptes AGENCY. Une API key / OAuth client-credentials sera ajoutée lorsqu’un partenaire réel le nécessitera.
