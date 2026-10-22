# Architecture de sécurité Mon Appart

Document technique. **Ne constitue pas une attestation de conformité ni un audit indépendant.**

## Cartographie des contrôles

| Couche | Responsable | Emplacement |
| --- | --- | --- |
| HTTP (Helmet, CORS, ValidationPipe, Throttler Redis) | Bootstrap API | `apps/api/src/configure-app.ts`, `app.module.ts` |
| Authentification JWT / sessions / CSRF cookies | Identity | `apps/api/src/modules/identity/` |
| RBAC (`@Roles`, `@Permissions`) | Identity + AdminAccessGuard | gardes globaux + `admin/` |
| Antifraude / signaux / score interne | Trust | `TrustSignal`, `risk-rules.ts`, `SignalService` |
| Médias & documents privés | Media | MIME, magic bytes, presign, buckets |
| Paiements & webhooks | Billing | signature HMAC, idempotence |
| Audit append-only | commun | `AuditLog`, services domaine |
| Métriques Prometheus | Observability | `GET /metrics` + `METRICS_SCRAPE_TOKEN` |
| Ancrage documentaire | Security | `apps/api/src/modules/security/` |

## Principes

1. **Default deny** : routes authentifiées sauf `@Public()`.
2. **Propriété serveur** : l’acteur et les droits sur une ressource sont relus en base ; jamais déduits d’un `userId` client.
3. **DTO / serializers** : pas d’entité Prisma brute ; hashes, secrets et notes internes exclus.
4. **Signal ≠ sanction** : un `TrustSignal` ouvre une revue ; les suspensions passent par Identity / Admin / Listing.
5. **Secrets hors dépôt** : `.env` gitignoré ; `.env.example` sans valeurs réelles.

## Flux typiques

### Publication d’annonce

Auth → permissions listing → ownership du bien → exigences Trust (si configurées) → médias prêts → éventuel signal `ACCOUNT_BURST_ACTIVITY` / `PRICE_CHANGE_ANOMALY` en asynchrone.

### Accès document de vérification

Auth → `verification:documents` (ou auteur) → URL présignée courte → audit → jamais bucket public.

### Webhook paiement

Corps brut → vérif signature + fenêtre temporelle → idempotence `PaymentEvent` → fulfillment serveur uniquement.

## MFA

Statut : **planifié** (`MFA_STATUS = planned`). Priorité staff. Voir `apps/api/src/modules/security/policies/mfa-roadmap.ts`. Aucun endpoint MFA actif.

## Frontends

- **Admin** : auth API Nest (Bearer mémoire + refresh cookie/CSRF) ; authz réelle côté API.
- **Web prototype** : better-auth sur base legacy ; headers CSP/HSTS ajoutés ; blobs annonces publics (hors API Media).

## Références

- [security.md](./security.md)
- [anti-fraud.md](./anti-fraud.md)
- [data-protection.md](./data-protection.md)
- [security-incident-response.md](./security-incident-response.md)
- [security-hardening-checklist.md](./security-hardening-checklist.md)
