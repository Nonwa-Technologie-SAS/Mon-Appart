-- Pipeline commercial acquisition d'offre (SupplyLead).
-- Distinct du registre Partner ; aucun lead fictif en seed.

CREATE TYPE "supply_lead_segment" AS ENUM (
  'OWNER',
  'SMALL_AGENCY',
  'ESTABLISHED_AGENCY',
  'DEVELOPER',
  'PROPERTY_MANAGER',
  'LAND_SPECIALIST',
  'OTHER'
);

CREATE TYPE "supply_lead_stage" AS ENUM (
  'IDENTIFIED',
  'TO_CONTACT',
  'CONTACTED',
  'QUALIFIED',
  'DEMO',
  'REGISTERED',
  'LISTINGS_SUBMITTED',
  'VERIFICATION',
  'FIRST_PUBLISHED',
  'ACTIVATED',
  'NURTURE',
  'REFUSED',
  'CHURN_RISK'
);

CREATE TYPE "supply_lead_source" AS ENUM (
  'DIRECT',
  'REFERRAL',
  'DIRECTORY',
  'EVENT',
  'WEBSITE',
  'SOCIAL',
  'OTHER'
);

CREATE TYPE "supply_lead_interaction_kind" AS ENUM (
  'CALL',
  'WHATSAPP',
  'EMAIL',
  'VISIT',
  'DEMO',
  'NOTE',
  'STATUS_CHANGE'
);

CREATE TABLE "supply_leads" (
  "id" BIGSERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "segment" "supply_lead_segment" NOT NULL,
  "stage" "supply_lead_stage" NOT NULL DEFAULT 'IDENTIFIED',
  "display_name" VARCHAR(160) NOT NULL,
  "organization_name" VARCHAR(160),
  "phone" VARCHAR(32),
  "email" VARCHAR(255),
  "zone_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "property_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source" "supply_lead_source" NOT NULL DEFAULT 'DIRECT',
  "estimated_listings" SMALLINT,
  "submitted_listings" SMALLINT NOT NULL DEFAULT 0,
  "approved_listings" SMALLINT NOT NULL DEFAULT 0,
  "active_listings" SMALLINT NOT NULL DEFAULT 0,
  "next_action_at" TIMESTAMPTZ(6),
  "next_action" VARCHAR(255),
  "refusal_reason" VARCHAR(500),
  "notes" VARCHAR(2000),
  "partner_id" BIGINT,
  "created_by_id" BIGINT NOT NULL,
  "assignee_id" BIGINT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supply_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supply_leads_public_id_key" ON "supply_leads"("public_id");
CREATE INDEX "supply_leads_stage_next_action_at_idx" ON "supply_leads"("stage", "next_action_at");
CREATE INDEX "supply_leads_segment_stage_idx" ON "supply_leads"("segment", "stage");
CREATE INDEX "supply_leads_created_at_id_idx" ON "supply_leads"("created_at" DESC, "id" DESC);
CREATE INDEX "supply_leads_partner_id_idx" ON "supply_leads"("partner_id");

ALTER TABLE "supply_leads"
  ADD CONSTRAINT "supply_leads_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supply_leads"
  ADD CONSTRAINT "supply_leads_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supply_leads"
  ADD CONSTRAINT "supply_leads_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "supply_lead_interactions" (
  "id" BIGSERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" BIGINT NOT NULL,
  "kind" "supply_lead_interaction_kind" NOT NULL,
  "summary" VARCHAR(500) NOT NULL,
  "detail" VARCHAR(2000),
  "author_id" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supply_lead_interactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supply_lead_interactions_public_id_key" ON "supply_lead_interactions"("public_id");
CREATE INDEX "supply_lead_interactions_lead_id_created_at_idx" ON "supply_lead_interactions"("lead_id", "created_at" DESC);

ALTER TABLE "supply_lead_interactions"
  ADD CONSTRAINT "supply_lead_interactions_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "supply_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supply_lead_interactions"
  ADD CONSTRAINT "supply_lead_interactions_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
