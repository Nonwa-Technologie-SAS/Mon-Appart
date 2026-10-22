-- Analytics : événements versionnés, agrégats journaliers recalculables,
-- statistiques d'ingestion, checkpoints et consentement analytique.
-- Ajout pur : aucune table existante n'est modifiée (user_events reste en place).

-- CreateEnum
CREATE TYPE "analytics_source" AS ENUM ('WEB', 'MOBILE', 'BACKEND');

-- CreateEnum
CREATE TYPE "analytics_basis" AS ENUM ('CONSENT', 'LEGITIMATE_INTEREST');

-- CreateEnum
CREATE TYPE "analytics_consent_status" AS ENUM ('GRANTED', 'DENIED');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "schema_version" SMALLINT NOT NULL,
    "source" "analytics_source" NOT NULL,
    "basis" "analytics_basis" NOT NULL,
    "policy_version" VARCHAR(32),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT,
    "anonymous_id" UUID,
    "session_id" UUID,
    "listing_id" BIGINT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "request_id" VARCHAR(128),
    "app_version" VARCHAR(32),

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily_metrics" (
    "day" DATE NOT NULL,
    "metric" VARCHAR(64) NOT NULL,
    "dimension" VARCHAR(32) NOT NULL DEFAULT '',
    "value" VARCHAR(64) NOT NULL DEFAULT '',
    "count" BIGINT NOT NULL DEFAULT 0,
    "actors" BIGINT NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_daily_metrics_pkey" PRIMARY KEY ("day","metric","dimension","value")
);

-- CreateTable
CREATE TABLE "analytics_listing_daily" (
    "listing_id" BIGINT NOT NULL,
    "day" DATE NOT NULL,
    "detail_views" INTEGER NOT NULL DEFAULT 0,
    "unique_viewers" INTEGER NOT NULL DEFAULT 0,
    "card_impressions" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "contacts_started" INTEGER NOT NULL DEFAULT 0,
    "contacts_submitted" INTEGER NOT NULL DEFAULT 0,
    "appointments_requested" INTEGER NOT NULL DEFAULT 0,
    "appointments_confirmed" INTEGER NOT NULL DEFAULT 0,
    "appointments_completed" INTEGER NOT NULL DEFAULT 0,
    "qualified_leads" INTEGER NOT NULL DEFAULT 0,
    "recommendation_impressions" INTEGER NOT NULL DEFAULT 0,
    "recommendation_opens" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_listing_daily_pkey" PRIMARY KEY ("listing_id","day")
);

-- CreateTable
CREATE TABLE "analytics_ingestion_stats" (
    "day" DATE NOT NULL,
    "source" "analytics_source" NOT NULL,
    "outcome" VARCHAR(16) NOT NULL,
    "reason" VARCHAR(32) NOT NULL DEFAULT '',
    "count" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_ingestion_stats_pkey" PRIMARY KEY ("day","source","outcome","reason")
);

-- CreateTable
CREATE TABLE "analytics_checkpoints" (
    "job" VARCHAR(64) NOT NULL,
    "completed_day" DATE,
    "last_run_at" TIMESTAMPTZ(6),
    "last_success_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(255),
    "duration_ms" INTEGER,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_checkpoints_pkey" PRIMARY KEY ("job")
);

-- CreateTable
CREATE TABLE "analytics_consents" (
    "user_id" BIGINT NOT NULL,
    "status" "analytics_consent_status" NOT NULL,
    "policy_version" VARCHAR(32) NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_consents_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_event_id_key" ON "analytics_events"("event_id");

-- CreateIndex
CREATE INDEX "analytics_events_name_occurred_at_idx" ON "analytics_events"("name", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_listing_occurred_idx" ON "analytics_events"("listing_id", "occurred_at") WHERE (listing_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "analytics_events_user_occurred_idx" ON "analytics_events"("user_id", "occurred_at") WHERE (user_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "analytics_events_anonymous_idx" ON "analytics_events"("anonymous_id") WHERE (anonymous_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "analytics_events_occurred_brin_idx" ON "analytics_events" USING BRIN ("occurred_at" timestamptz_minmax_ops);

-- CreateIndex
CREATE INDEX "analytics_daily_metrics_metric_day_idx" ON "analytics_daily_metrics"("metric", "day");

-- CreateIndex
CREATE INDEX "analytics_listing_daily_day_idx" ON "analytics_listing_daily"("day");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_listing_daily" ADD CONSTRAINT "analytics_listing_daily_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_consents" ADD CONSTRAINT "analytics_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Défense en profondeur : le catalogue applicatif reste la règle principale.
ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_name_check" CHECK ("name" ~ '^[a-z]+(_[a-z]+)*$'),
  ADD CONSTRAINT "analytics_events_schema_version_check" CHECK ("schema_version" BETWEEN 1 AND 100),
  ADD CONSTRAINT "analytics_events_properties_check"
    CHECK (jsonb_typeof("properties") = 'object' AND octet_length("properties"::text) <= 4096),
  -- Le consentement doit être tracé avec sa version de politique.
  ADD CONSTRAINT "analytics_events_basis_check"
    CHECK ("basis" <> 'CONSENT' OR "policy_version" IS NOT NULL),
  -- Pas d'identifiant pseudonyme client sans consentement.
  ADD CONSTRAINT "analytics_events_anonymous_consent_check"
    CHECK ("anonymous_id" IS NULL OR "basis" = 'CONSENT');

ALTER TABLE "analytics_daily_metrics"
  ADD CONSTRAINT "analytics_daily_metrics_counts_check" CHECK ("count" >= 0 AND "actors" >= 0);

ALTER TABLE "analytics_listing_daily"
  ADD CONSTRAINT "analytics_listing_daily_counts_check" CHECK (
    "detail_views" >= 0 AND "unique_viewers" >= 0 AND "card_impressions" >= 0
    AND "shares" >= 0 AND "contacts_started" >= 0 AND "contacts_submitted" >= 0
    AND "appointments_requested" >= 0 AND "appointments_confirmed" >= 0
    AND "appointments_completed" >= 0 AND "qualified_leads" >= 0
    AND "recommendation_impressions" >= 0 AND "recommendation_opens" >= 0
  );

ALTER TABLE "analytics_ingestion_stats"
  ADD CONSTRAINT "analytics_ingestion_stats_outcome_check"
    CHECK ("outcome" IN ('accepted', 'duplicate', 'rejected', 'ignored')),
  ADD CONSTRAINT "analytics_ingestion_stats_count_check" CHECK ("count" >= 0);

ALTER TABLE "analytics_consents"
  ADD CONSTRAINT "analytics_consents_source_check" CHECK ("source" IN ('web', 'mobile', 'api'));
