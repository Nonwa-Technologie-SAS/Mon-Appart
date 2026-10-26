-- Outbox transactionnelle des événements de domaine + inbox de déduplication.
-- Distincte des files métier déjà présentes (notification_deliveries, partner_deliveries).

CREATE TYPE "outbox_event_status" AS ENUM (
  'PENDING',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED',
  'DEAD'
);

CREATE TYPE "inbox_event_status" AS ENUM ('PROCESSED', 'FAILED');

CREATE TABLE "outbox_events" (
  "id" BIGSERIAL NOT NULL,
  "event_id" UUID NOT NULL,
  "event_type" VARCHAR(120) NOT NULL,
  "event_version" SMALLINT NOT NULL DEFAULT 1,
  "producer" VARCHAR(80) NOT NULL,
  "aggregate_type" VARCHAR(80) NOT NULL,
  "aggregate_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "published_at" TIMESTAMPTZ(6),
  "status" "outbox_event_status" NOT NULL DEFAULT 'PENDING',
  "attempt_count" SMALLINT NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "last_error" VARCHAR(200),
  "correlation_id" UUID,
  "causation_id" UUID,
  "trace_id" VARCHAR(64),

  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events" ("event_id");

CREATE INDEX "outbox_events_dispatch_idx"
  ON "outbox_events" ("next_attempt_at", "id")
  WHERE status = ANY (ARRAY['PENDING'::outbox_event_status, 'PUBLISHING'::outbox_event_status]);

CREATE INDEX "outbox_events_aggregate_idx"
  ON "outbox_events" ("aggregate_type", "aggregate_id", "id");

CREATE INDEX "outbox_events_published_idx"
  ON "outbox_events" ("published_at")
  WHERE status = 'PUBLISHED'::outbox_event_status;

CREATE TABLE "inbox_events" (
  "id" BIGSERIAL NOT NULL,
  "consumer_name" VARCHAR(80) NOT NULL,
  "event_id" UUID NOT NULL,
  "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "status" "inbox_event_status" NOT NULL DEFAULT 'PROCESSED',
  "attempt_count" SMALLINT NOT NULL DEFAULT 1,
  "last_error" VARCHAR(200),

  CONSTRAINT "inbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inbox_events_consumer_event_uidx"
  ON "inbox_events" ("consumer_name", "event_id");
