import { tmpdir } from "node:os"
import { join } from "node:path"

import swc from "unplugin-swc"
import { defineConfig } from "vitest/config"

// Stockage local propre à l'exécution : jamais de compte cloud réel en test.
const MEDIA_ROOT = join(tmpdir(), `mon-appart-media-test-${Date.now()}`)

// Tests d'intégration contre une vraie base PostgreSQL/PostGIS (TEST_DATABASE_URL).
// Préparer la base avant : pnpm --filter @mon-appart/api db:test:migrate
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    include: [
      "test/database/**/*.db-spec.ts",
      "test/identity/**/*.db-spec.ts",
      "test/catalog/**/*.db-spec.ts",
      "test/search/**/*.db-spec.ts",
      "test/recommendation/**/*.db-spec.ts",
      "test/media/**/*.db-spec.ts",
      "test/trust/**/*.db-spec.ts",
      "test/communication/**/*.db-spec.ts",
      "test/analytics/**/*.db-spec.ts",
      "test/admin/**/*.db-spec.ts",
      "test/billing/**/*.db-spec.ts",
    ],
    setupFiles: ["./test/database/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      APP_ENV: "test",
      LOG_LEVEL: "silent",
      // Redis volontairement absent : repli mémoire déterministe par processus.
      REDIS_URL: "",
      METRICS_ENABLED: "false",
      SWAGGER_ENABLED: "false",
      AUTH_REGISTER_RATE_LIMIT: "1000",
      AUTH_LOGIN_RATE_LIMIT: "1000",
      AUTH_OTP_RATE_LIMIT: "1000",
      AUTH_RESET_RATE_LIMIT: "1000",
      SEARCH_RATE_LIMIT: "1000",
      SEARCH_SUGGEST_RATE_LIMIT: "1000",
      RECOMMENDATION_RATE_LIMIT: "1000",
      RECOMMENDATION_FEEDBACK_RATE_LIMIT: "1000",
      RECOMMENDATION_ENGINE: "rules",
      SEARCH_ENGINE: "postgres",
      OPENSEARCH_NODE: "",
      ARGON2_MEMORY_COST: "8192",
      ARGON2_TIME_COST: "1",
      AUTH_DEV_PRINT_CODES: "false",
      MEDIA_STORAGE_PROVIDER: "local",
      MEDIA_LOCAL_ROOT: MEDIA_ROOT,
      MEDIA_LOCAL_BASE_URL: "http://media.test",
      S3_PUBLIC_BUCKET: "",
      MEDIA_PUBLIC_BASE_URL: "",
      // Traitement déclenché explicitement par les tests (runOnce).
      MEDIA_WORKER_ENABLED: "false",
      MEDIA_UPLOAD_RATE_LIMIT: "1000",
      MEDIA_MUTATION_RATE_LIMIT: "1000",
      MEDIA_MAX_VIDEO_SECONDS: "180",
      MEDIA_JOB_MAX_ATTEMPTS: "3",
      TRUST_MUTATION_RATE_LIMIT: "1000",
      TRUST_REPORT_RATE_LIMIT: "1000",
      // Maintenance déclenchée explicitement par les tests.
      TRUST_MAINTENANCE_INTERVAL_MINUTES: "0",
      LISTING_PUBLICATION_REQUIREMENTS: "",
      // Livraisons déclenchées explicitement (runOnce), fournisseurs simulés.
      NOTIFICATION_WORKER_ENABLED: "false",
      EMAIL_PROVIDER: "none",
      SMS_PROVIDER: "none",
      NOTIFICATION_FALLBACKS: "",
      MESSAGING_RATE_LIMIT: "1000",
      APPOINTMENT_RATE_LIMIT: "1000",
      REALTIME_ENABLED: "true",
      // Agrégation et purge déclenchées explicitement par les tests.
      ANALYTICS_WORKER_INTERVAL_MINUTES: "0",
      ANALYTICS_RATE_LIMIT: "1000",
      // Simulateur de paiement uniquement ; secret de test sans valeur réelle.
      PAYMENT_PROVIDER: "mock",
      PAYMENT_ENVIRONMENT: "test",
      PAYMENT_MOCK_WEBHOOK_SECRET: "test-only-mock-webhook-secret-0123456789",
      // Réconciliation déclenchée explicitement par les tests.
      BILLING_WORKER_INTERVAL_MINUTES: "0",
      BILLING_RATE_LIMIT: "1000",
      BILLING_WEBHOOK_RATE_LIMIT: "10000",
    },
  },
})
