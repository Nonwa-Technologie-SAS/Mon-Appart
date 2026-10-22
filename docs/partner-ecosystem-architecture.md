# Architecture de l’écosystème partenaires

Complète [property-listing.md](./property-listing.md), [billing-payments-monetization.md](./billing-payments-monetization.md), [trust-and-verification.md](./trust-and-verification.md).

## Principes

- Connecter les **bons** partenaires, pas le maximum de services.
- Statut **commercial** ≠ statut **technique**.
- Nest conserve les règles métier, Trust et Listing.
- Secrets jamais en clair (AES-GCM via `PARTNERS_SECRETS_KEY`).
- Aucun partenaire inventé en seed.

## Catégories (registre)

`AGENCY`, `DEVELOPER`, `PROPERTY_MANAGER`, `SERVICE_PROVIDER`, `PAYMENT`, `COMMUNICATION`, `GEOCODING`, `ANALYTICS`, `OTHER`.

Réutilisent les providers existants quand c’est le cas (PaymentProvider, ChannelRegistry) — le registre partenaires ne les remplace pas.

## Module Nest

`apps/api/src/modules/partners/` :

| Composant | Rôle |
| --------- | ---- |
| `Partner` / `PartnerIntegration` | Registre |
| `PartnerDelivery` | Outbox webhooks sortants HMAC |
| `PartnerListingLink` | Mapping ID externe (déduplication future) |
| `PartnerImportBatch` | Journal dry-run CSV |
| `CsvPropertyFeedAdapter` | Validation import |
| `PartnerDeliveryService` | Écoute `listing.*` → enqueue |
| `PartnerDeliveryRunner` | SKIP LOCKED + retries |

## Premier cas d’usage

**Webhooks sortants signés** sur publication / changement de statut d’annonce, pour un partenaire réellement enregistré en admin.

## Non réalisé en V1

API machine OAuth, import CSV appliqué en base, géocodage, scraping, multi-PSP, partage de revenus.
