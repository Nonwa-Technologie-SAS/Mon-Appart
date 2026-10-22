import { Module } from "@nestjs/common"

/**
 * Module transversal : ne remplace pas Identity, Trust, Media ni Billing.
 * Point d'ancrage documentaire pour les politiques partagées
 * (voir docs/security-architecture.md).
 *
 * Contrôles actifs ailleurs :
 * - Auth / sessions / RBAC → Identity
 * - Signaux antifraude / revue → Trust (`TrustSignal`)
 * - Uploads → Media
 * - Webhooks paiement → Billing
 * - Métriques scrape → Observability + METRICS_SCRAPE_TOKEN
 * - Purge artefacts auth → `pnpm --filter @mon-appart/api identity:purge-artifacts`
 */
@Module({})
export class SecurityModule {}
