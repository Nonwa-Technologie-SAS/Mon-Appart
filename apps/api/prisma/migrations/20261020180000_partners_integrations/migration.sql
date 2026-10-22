-- Registre partenaires et outbox de livraison. Additif ; aucun partenaire seedé.

CREATE TYPE "partner_category" AS ENUM (
  'AGENCY', 'DEVELOPER', 'PROPERTY_MANAGER', 'SERVICE_PROVIDER',
  'PAYMENT', 'COMMUNICATION', 'GEOCODING', 'ANALYTICS', 'OTHER'
);

CREATE TYPE "partner_commercial_status" AS ENUM (
  'PROSPECT', 'ACTIVE', 'SUSPENDED', 'ENDED'
);

CREATE TYPE "partner_integration_kind" AS ENUM (
  'MANUAL', 'CSV_IMPORT', 'WEBHOOK_OUT', 'WEBHOOK_IN', 'API', 'SDK'
);

CREATE TYPE "partner_integration_status" AS ENUM (
  'PLANNED', 'INTEGRATING', 'ACTIVE', 'SUSPENDED', 'RETIRED'
);

CREATE TYPE "partner_delivery_status" AS ENUM (
  'PENDING', 'SENDING', 'DELIVERED', 'FAILED', 'CANCELLED'
);

CREATE TYPE "partner_import_status" AS ENUM (
  'VALIDATED', 'PARTIAL', 'REJECTED', 'APPLIED'
);

CREATE TABLE "partners" (
  "id" BIGSERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(64) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "category" "partner_category" NOT NULL,
  "description" VARCHAR(1000),
  "commercial_status" "partner_commercial_status" NOT NULL DEFAULT 'PROSPECT',
  "created_by_id" BIGINT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partners_public_id_key" ON "partners"("public_id");
CREATE UNIQUE INDEX "partners_code_key" ON "partners"("code");
CREATE INDEX "partners_category_commercial_status_idx"
  ON "partners"("category", "commercial_status");
CREATE INDEX "partners_created_at_id_idx"
  ON "partners"("created_at" DESC, "id" DESC);

ALTER TABLE "partners"
  ADD CONSTRAINT "partners_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "partner_integrations" (
  "id" BIGSERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "partner_id" BIGINT NOT NULL,
  "kind" "partner_integration_kind" NOT NULL,
  "status" "partner_integration_status" NOT NULL DEFAULT 'PLANNED',
  "contract_version" VARCHAR(32) NOT NULL DEFAULT '2026-10-v1',
  "webhook_url" VARCHAR(500),
  "webhook_secret_fp" VARCHAR(64),
  "webhook_secret_cipher" VARCHAR(500),
  "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "last_checked_at" TIMESTAMPTZ(6),
  "last_error" VARCHAR(255),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_integrations_public_id_key"
  ON "partner_integrations"("public_id");
CREATE INDEX "partner_integrations_partner_id_status_idx"
  ON "partner_integrations"("partner_id", "status");
CREATE INDEX "partner_integrations_kind_status_idx"
  ON "partner_integrations"("kind", "status");

ALTER TABLE "partner_integrations"
  ADD CONSTRAINT "partner_integrations_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "partner_deliveries" (
  "id" BIGSERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "partner_id" BIGINT NOT NULL,
  "integration_id" BIGINT NOT NULL,
  "event_name" VARCHAR(64) NOT NULL,
  "event_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "partner_delivery_status" NOT NULL DEFAULT 'PENDING',
  "attempts" SMALLINT NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" TIMESTAMPTZ(6),
  "last_error" VARCHAR(255),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_deliveries_public_id_key"
  ON "partner_deliveries"("public_id");
CREATE UNIQUE INDEX "partner_deliveries_integration_id_event_id_key"
  ON "partner_deliveries"("integration_id", "event_id");
CREATE INDEX "partner_deliveries_due_idx"
  ON "partner_deliveries"("status", "next_attempt_at");

ALTER TABLE "partner_deliveries"
  ADD CONSTRAINT "partner_deliveries_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "partner_deliveries"
  ADD CONSTRAINT "partner_deliveries_integration_id_fkey"
  FOREIGN KEY ("integration_id") REFERENCES "partner_integrations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "partner_listing_links" (
  "id" BIGSERIAL NOT NULL,
  "partner_id" BIGINT NOT NULL,
  "listing_public_id" UUID NOT NULL,
  "external_listing_id" VARCHAR(120) NOT NULL,
  "source_fingerprint" VARCHAR(64),
  "last_synced_at" TIMESTAMPTZ(6),
  "sync_status" VARCHAR(32) NOT NULL DEFAULT 'OK',
  "last_error" VARCHAR(255),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_listing_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_listing_links_partner_id_external_listing_id_key"
  ON "partner_listing_links"("partner_id", "external_listing_id");
CREATE UNIQUE INDEX "partner_listing_links_partner_id_listing_public_id_key"
  ON "partner_listing_links"("partner_id", "listing_public_id");
CREATE INDEX "partner_listing_links_listing_public_id_idx"
  ON "partner_listing_links"("listing_public_id");

ALTER TABLE "partner_listing_links"
  ADD CONSTRAINT "partner_listing_links_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "partner_import_batches" (
  "id" BIGSERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "partner_id" BIGINT NOT NULL,
  "status" "partner_import_status" NOT NULL DEFAULT 'VALIDATED',
  "filename" VARCHAR(255) NOT NULL,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "accepted_rows" INTEGER NOT NULL DEFAULT 0,
  "rejected_rows" INTEGER NOT NULL DEFAULT 0,
  "report" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_import_batches_public_id_key"
  ON "partner_import_batches"("public_id");
CREATE INDEX "partner_import_batches_partner_id_created_at_idx"
  ON "partner_import_batches"("partner_id", "created_at" DESC);

ALTER TABLE "partner_import_batches"
  ADD CONSTRAINT "partner_import_batches_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
