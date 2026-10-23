-- CRM immobilier : pipeline commercial sur Inquiry (pas de second CRM).
-- Les notes internes sont séparées des messages de conversation.

CREATE TYPE "inquiry_lead_stage" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'VISIT_PLANNED',
  'VISIT_DONE',
  'FOLLOW_UP',
  'CONVERTED',
  'LOST',
  'ARCHIVED'
);

CREATE TYPE "inquiry_lost_reason" AS ENUM (
  'BUDGET',
  'LOCATION',
  'TIMING',
  'NO_RESPONSE',
  'PROPERTY_UNAVAILABLE',
  'OTHER'
);

ALTER TABLE "inquiries"
  ADD COLUMN "stage" "inquiry_lead_stage" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "assignee_id" BIGINT,
  ADD COLUMN "next_action_at" TIMESTAMPTZ(6),
  ADD COLUMN "next_action" VARCHAR(255),
  ADD COLUMN "budget_amount" BIGINT,
  ADD COLUMN "desired_zone" VARCHAR(120),
  ADD COLUMN "desired_move_at" TIMESTAMPTZ(6),
  ADD COLUMN "lost_reason" "inquiry_lost_reason",
  ADD COLUMN "first_responded_at" TIMESTAMPTZ(6),
  ADD COLUMN "qualified_at" TIMESTAMPTZ(6);

CREATE INDEX "inquiries_stage_next_action_at_idx" ON "inquiries"("stage", "next_action_at");
CREATE INDEX "inquiries_assignee_id_stage_idx" ON "inquiries"("assignee_id", "stage");

ALTER TABLE "inquiries"
  ADD CONSTRAINT "inquiries_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "inquiry_notes" (
  "id" BIGSERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inquiry_id" BIGINT NOT NULL,
  "author_id" BIGINT NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inquiry_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inquiry_notes_public_id_key" ON "inquiry_notes"("public_id");
CREATE INDEX "inquiry_notes_inquiry_id_created_at_idx" ON "inquiry_notes"("inquiry_id", "created_at" DESC);

ALTER TABLE "inquiry_notes"
  ADD CONSTRAINT "inquiry_notes_inquiry_id_fkey"
  FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inquiry_notes"
  ADD CONSTRAINT "inquiry_notes_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "inquiry_stage_history" (
  "id" BIGSERIAL NOT NULL,
  "inquiry_id" BIGINT NOT NULL,
  "from_stage" "inquiry_lead_stage",
  "to_stage" "inquiry_lead_stage" NOT NULL,
  "author_id" BIGINT NOT NULL,
  "reason" VARCHAR(200),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inquiry_stage_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiry_stage_history_inquiry_id_created_at_idx"
  ON "inquiry_stage_history"("inquiry_id", "created_at" DESC);

ALTER TABLE "inquiry_stage_history"
  ADD CONSTRAINT "inquiry_stage_history_inquiry_id_fkey"
  FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inquiry_stage_history"
  ADD CONSTRAINT "inquiry_stage_history_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
