-- Rétention : recherches persistantes, statut de projet, retours post-visite.
-- Distinct de l'historique `searches` et du pipeline commercial Inquiry.

CREATE TYPE "saved_search_frequency" AS ENUM ('DAILY', 'WEEKLY', 'PAUSED');
CREATE TYPE "user_project_status" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');
CREATE TYPE "visit_feedback_outcome" AS ENUM (
  'PENDING_DECISION',
  'STILL_INTERESTED',
  'NEED_INFO',
  'WANT_ANOTHER_VISIT',
  'NOT_A_FIT',
  'UNAVAILABLE',
  'PROJECT_ABANDONED',
  'PROJECT_COMPLETED'
);
CREATE TYPE "visit_feedback_reason" AS ENUM (
  'PRICE',
  'LOCATION',
  'SURFACE',
  'FEATURES',
  'UNAVAILABLE',
  'OTHER'
);

ALTER TABLE "user_preferences"
  ADD COLUMN "project_status" "user_project_status" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "project_completed_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_reactivation_at" TIMESTAMPTZ(6);

CREATE TABLE "saved_searches" (
  "id" BIGSERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" BIGINT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "params" JSONB NOT NULL,
  "listing_type" "listing_type",
  "min_price" DECIMAL(14, 2),
  "max_price" DECIMAL(14, 2),
  "currency" CHAR(3) NOT NULL DEFAULT 'XOF',
  "alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
  "frequency" "saved_search_frequency" NOT NULL DEFAULT 'DAILY',
  "last_checked_at" TIMESTAMPTZ(6),
  "last_alerted_at" TIMESTAMPTZ(6),
  "cursor_published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_searches_public_id_key" ON "saved_searches"("public_id");
CREATE INDEX "saved_searches_user_created_idx" ON "saved_searches"("user_id", "created_at");
CREATE INDEX "saved_searches_alert_due_idx" ON "saved_searches"("alerts_enabled", "frequency", "last_checked_at");

ALTER TABLE "saved_searches"
  ADD CONSTRAINT "saved_searches_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_searches"
  ADD CONSTRAINT "saved_searches_name_len_chk"
  CHECK (char_length(btrim("name")) BETWEEN 2 AND 80);

ALTER TABLE "saved_searches"
  ADD CONSTRAINT "saved_searches_price_range_chk"
  CHECK ("min_price" IS NULL OR "max_price" IS NULL OR "min_price" <= "max_price");

CREATE TABLE "visit_feedbacks" (
  "id" BIGSERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "appointment_id" BIGINT NOT NULL,
  "user_id" BIGINT NOT NULL,
  "listing_id" BIGINT NOT NULL,
  "property_id" BIGINT NOT NULL,
  "outcome" "visit_feedback_outcome" NOT NULL,
  "reason" "visit_feedback_reason",
  "private_note" VARCHAR(1000),
  "share_outcome_with_owner" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "visit_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visit_feedbacks_public_id_key" ON "visit_feedbacks"("public_id");
CREATE UNIQUE INDEX "visit_feedbacks_appointment_id_key" ON "visit_feedbacks"("appointment_id");
CREATE INDEX "visit_feedbacks_user_id_created_at_idx" ON "visit_feedbacks"("user_id", "created_at");
CREATE INDEX "visit_feedbacks_listing_id_idx" ON "visit_feedbacks"("listing_id");

ALTER TABLE "visit_feedbacks"
  ADD CONSTRAINT "visit_feedbacks_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visit_feedbacks"
  ADD CONSTRAINT "visit_feedbacks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visit_feedbacks"
  ADD CONSTRAINT "visit_feedbacks_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visit_feedbacks"
  ADD CONSTRAINT "visit_feedbacks_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
