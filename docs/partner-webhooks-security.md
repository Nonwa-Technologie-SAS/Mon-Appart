# Sécurité des webhooks partenaires

## Sortants (implémentés)

- Signature HMAC-SHA256 horodatée (réutilise `billing/domain/webhook-signature.ts`).
- Secret généré une fois, chiffré AES-256-GCM (`PARTNERS_SECRETS_KEY`), empreinte SHA-256 pour diagnostic.
- Idempotence `(integrationId, eventId)`.
- Retries backoff sur 429/5xx/réseau ; échec définitif après 8 tentatives.
- Timeout 10 s ; panne partenaire ≠ panne publication.

## Entrants (prévus, non actifs)

Pour un futur `WEBHOOK_IN` :

- Vérifier signature (ne jamais faire confiance à l’URL seule).
- Anti-rejeu via horodatage + id d’événement.
- Traitement asynchrone ; validation schéma.
- Paiements : toujours via module Billing, jamais ici.

## Configuration

| Variable | Rôle |
| -------- | ---- |
| `PARTNERS_SECRETS_KEY` | 64 hex (32 octets) — requis pour créer/livrer webhooks |
| `PARTNERS_WORKER_INTERVAL_SECONDS` | Poll outbox (0 = manuel) |
