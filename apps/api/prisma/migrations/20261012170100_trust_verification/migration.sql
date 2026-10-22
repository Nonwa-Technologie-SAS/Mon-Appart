-- Trust & Verification (2/2) : dossiers de vérification, justificatifs (via
-- Media), historiques append-only, signalements, alertes de risque, score
-- explicable. Additive : `verifications`, `trust_scores` et `media` sont
-- complétées, pas recréées ; aucune donnée supprimée.

CREATE TYPE "media_purpose" AS ENUM ('PROPERTY', 'VERIFICATION');

CREATE TYPE "verification_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

CREATE TYPE "verification_document_type" AS ENUM (
  'NATIONAL_ID', 'PASSPORT', 'RESIDENCE_PERMIT', 'CONSULAR_CARD',
  'TITLE_DEED', 'CONCESSION_DECREE', 'ALLOCATION_LETTER', 'LAND_CERTIFICATE',
  'SALE_DEED', 'BUILDING_PERMIT', 'UTILITY_BILL', 'RESIDENCE_CERTIFICATE',
  'MANDATE', 'POWER_OF_ATTORNEY', 'COMPANY_REGISTRATION', 'PROFESSIONAL_CARD',
  'OTHER'
);

CREATE TYPE "verification_document_status" AS ENUM ('ATTACHED', 'ACCEPTED', 'REJECTED', 'REMOVED');

CREATE TYPE "trust_actor_kind" AS ENUM ('USER', 'REVIEWER', 'SYSTEM');

CREATE TYPE "report_target_type" AS ENUM ('LISTING', 'USER');

CREATE TYPE "report_reason" AS ENUM (
  'SUSPECTED_SCAM', 'DUPLICATE_LISTING', 'INCORRECT_PRICE', 'PROPERTY_NOT_AVAILABLE',
  'UNAUTHORIZED_LISTING', 'MISLEADING_INFORMATION', 'SUSPICIOUS_DOCUMENT',
  'INAPPROPRIATE_CONTENT', 'OTHER'
);

CREATE TYPE "report_status" AS ENUM ('OPEN', 'IN_REVIEW', 'CONFIRMED', 'DISMISSED');

CREATE TYPE "report_action" AS ENUM ('NONE', 'LISTING_SUSPENDED', 'VERIFICATION_REVIEW_REQUESTED');

CREATE TYPE "trust_signal_severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TYPE "trust_signal_status" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED');

-- ---------------------------------------------------------------------------
-- media : justificatifs de vérification sans bien, empreinte de contenu.
-- ---------------------------------------------------------------------------

ALTER TABLE "media"
  ADD COLUMN "purpose" "media_purpose" NOT NULL DEFAULT 'PROPERTY',
  ADD COLUMN "content_sha256" CHAR(64),
  ALTER COLUMN "property_id" DROP NOT NULL;

ALTER TABLE "media"
  ADD CONSTRAINT "media_purpose_property_chk" CHECK (("purpose" = 'PROPERTY') = ("property_id" IS NOT NULL)),
  ADD CONSTRAINT "media_verification_document_chk" CHECK ("purpose" <> 'VERIFICATION' OR ("type" = 'DOCUMENT' AND "visibility" = 'PRIVATE')),
  ADD CONSTRAINT "media_content_sha256_chk" CHECK ("content_sha256" IS NULL OR "content_sha256" ~ '^[0-9a-f]{64}$');

CREATE INDEX "media_content_sha256_idx" ON "media"("content_sha256") WHERE (content_sha256 IS NOT NULL);

-- ---------------------------------------------------------------------------
-- verifications : workflow complet.
-- ---------------------------------------------------------------------------

ALTER TABLE "verifications"
  ADD COLUMN "listing_id" BIGINT,
  ADD COLUMN "claimed_relation" "ownership_type",
  ADD COLUMN "priority" "verification_priority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "assigned_to_id" BIGINT,
  ADD COLUMN "reason_code" VARCHAR(50),
  ADD COLUMN "declaration" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "prechecks" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "attested_at" TIMESTAMPTZ(6),
  ADD COLUMN "submitted_at" TIMESTAMPTZ(6),
  ADD COLUMN "decided_at" TIMESTAMPTZ(6);

-- Dossiers existants : considérés soumis à leur création, décidés à leur vérification.
UPDATE "verifications" SET "submitted_at" = "created_at" WHERE "submitted_at" IS NULL;
UPDATE "verifications"
SET "decided_at" = COALESCE("verified_at", "updated_at")
WHERE "status" IN ('VERIFIED', 'REJECTED', 'EXPIRED') AND "decided_at" IS NULL;

ALTER TABLE "verifications"
  ADD CONSTRAINT "verifications_property_scope_chk" CHECK ("type" NOT IN ('OWNER_AUTHORIZATION', 'PROPERTY_DOCUMENT', 'LISTING_CONSISTENCY') OR "property_id" IS NOT NULL),
  ADD CONSTRAINT "verifications_listing_required_chk" CHECK ("type" <> 'LISTING_CONSISTENCY' OR "listing_id" IS NOT NULL),
  ADD CONSTRAINT "verifications_submitted_chk" CHECK ("status" = 'DRAFT' OR "submitted_at" IS NOT NULL),
  ADD CONSTRAINT "verifications_reason_chk" CHECK ("status" NOT IN ('NEEDS_MORE_INFORMATION', 'REVOKED') OR "reason_code" IS NOT NULL),
  ADD CONSTRAINT "verifications_rejection_reason_chk" CHECK ("status" <> 'REJECTED' OR "reason_code" IS NOT NULL OR "rejection_reason" IS NOT NULL),
  ADD CONSTRAINT "verifications_expiry_chk" CHECK ("expires_at" IS NULL OR "verified_at" IS NULL OR "expires_at" > "verified_at"),
  ADD CONSTRAINT "verifications_declaration_object_chk" CHECK (jsonb_typeof("declaration") = 'object'),
  ADD CONSTRAINT "verifications_prechecks_object_chk" CHECK (jsonb_typeof("prechecks") = 'object');

CREATE INDEX "verifications_listing_idx" ON "verifications"("listing_id", "property_id") WHERE (listing_id IS NOT NULL);
CREATE INDEX "verifications_review_queue_idx" ON "verifications"("status", "priority", "submitted_at");
CREATE INDEX "verifications_assigned_idx" ON "verifications"("assigned_to_id", "status") WHERE (assigned_to_id IS NOT NULL);

ALTER TABLE "verifications" ADD CONSTRAINT "verifications_listing_id_property_id_fkey" FOREIGN KEY ("listing_id", "property_id") REFERENCES "listings"("id", "property_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Justificatifs d'un dossier (référence Media, aucune copie).
-- ---------------------------------------------------------------------------

CREATE TABLE "verification_documents" (
    "id" BIGINT GENERATED BY DEFAULT AS IDENTITY,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "verification_id" BIGINT NOT NULL,
    "media_id" BIGINT NOT NULL,
    "document_type" "verification_document_type" NOT NULL,
    "status" "verification_document_status" NOT NULL DEFAULT 'ATTACHED',
    "added_by_id" BIGINT,
    "reviewed_at" TIMESTAMPTZ(6),
    "removed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "verification_documents_removed_chk" CHECK (("status" = 'REMOVED') = ("removed_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "verification_documents_public_id_key" ON "verification_documents"("public_id");
CREATE UNIQUE INDEX "verification_documents_media_id_key" ON "verification_documents"("media_id");
CREATE INDEX "verification_documents_verification_id_idx" ON "verification_documents"("verification_id");
CREATE INDEX "verification_documents_added_by_id_idx" ON "verification_documents"("added_by_id");

ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Historique des dossiers (append-only).
-- ---------------------------------------------------------------------------

CREATE TABLE "verification_events" (
    "id" BIGINT GENERATED BY DEFAULT AS IDENTITY,
    "verification_id" BIGINT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "from_status" "verification_status",
    "to_status" "verification_status" NOT NULL,
    "actor_id" BIGINT,
    "actor_kind" "trust_actor_kind" NOT NULL,
    "reason_code" VARCHAR(50),
    "user_message" VARCHAR(1000),
    "internal_note" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verification_events_verification_id_created_at_idx" ON "verification_events"("verification_id", "created_at");
CREATE INDEX "verification_events_actor_id_idx" ON "verification_events"("actor_id");

ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Signalements.
-- ---------------------------------------------------------------------------

CREATE TABLE "reports" (
    "id" BIGINT GENERATED BY DEFAULT AS IDENTITY,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" BIGINT,
    "target_type" "report_target_type" NOT NULL,
    "listing_id" BIGINT,
    "target_user_id" BIGINT,
    "reason" "report_reason" NOT NULL,
    "description" VARCHAR(1000),
    "status" "report_status" NOT NULL DEFAULT 'OPEN',
    "priority" "verification_priority" NOT NULL DEFAULT 'NORMAL',
    "assigned_to_id" BIGINT,
    "action" "report_action",
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_id" BIGINT,
    "resolution_note" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reports_target_chk" CHECK (
      ("target_type" = 'LISTING' AND "listing_id" IS NOT NULL AND "target_user_id" IS NULL)
      OR ("target_type" = 'USER' AND "target_user_id" IS NOT NULL AND "listing_id" IS NULL)
    ),
    CONSTRAINT "reports_not_self_chk" CHECK ("reporter_id" IS NULL OR "target_user_id" IS NULL OR "reporter_id" <> "target_user_id"),
    CONSTRAINT "reports_resolved_chk" CHECK (("status" IN ('CONFIRMED', 'DISMISSED')) = ("resolved_at" IS NOT NULL)),
    CONSTRAINT "reports_action_chk" CHECK ("action" IS NULL OR "status" IN ('CONFIRMED', 'DISMISSED'))
);

CREATE UNIQUE INDEX "reports_public_id_key" ON "reports"("public_id");
CREATE INDEX "reports_queue_idx" ON "reports"("status", "priority", "created_at");
CREATE INDEX "reports_listing_idx" ON "reports"("listing_id", "status") WHERE (listing_id IS NOT NULL);
CREATE INDEX "reports_target_user_idx" ON "reports"("target_user_id", "status") WHERE (target_user_id IS NOT NULL);
CREATE INDEX "reports_reporter_idx" ON "reports"("reporter_id", "created_at") WHERE (reporter_id IS NOT NULL);
CREATE INDEX "reports_assigned_to_id_idx" ON "reports"("assigned_to_id");
CREATE INDEX "reports_resolved_by_id_idx" ON "reports"("resolved_by_id");

ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "report_events" (
    "id" BIGINT GENERATED BY DEFAULT AS IDENTITY,
    "report_id" BIGINT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "from_status" "report_status",
    "to_status" "report_status" NOT NULL,
    "actor_id" BIGINT,
    "actor_kind" "trust_actor_kind" NOT NULL,
    "internal_note" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_events_report_id_created_at_idx" ON "report_events"("report_id", "created_at");
CREATE INDEX "report_events_actor_id_idx" ON "report_events"("actor_id");

ALTER TABLE "report_events" ADD CONSTRAINT "report_events_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Alertes des règles de risque.
-- ---------------------------------------------------------------------------

CREATE TABLE "trust_signals" (
    "id" BIGINT GENERATED BY DEFAULT AS IDENTITY,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_code" VARCHAR(60) NOT NULL,
    "severity" "trust_signal_severity" NOT NULL,
    "status" "trust_signal_status" NOT NULL DEFAULT 'OPEN',
    "user_id" BIGINT,
    "listing_id" BIGINT,
    "verification_id" BIGINT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "dedup_key" VARCHAR(200) NOT NULL,
    "reviewed_by_id" BIGINT,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_signals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trust_signals_subject_chk" CHECK ("user_id" IS NOT NULL OR "listing_id" IS NOT NULL OR "verification_id" IS NOT NULL),
    CONSTRAINT "trust_signals_reviewed_chk" CHECK (("status" = 'OPEN') = ("reviewed_at" IS NULL)),
    CONSTRAINT "trust_signals_details_object_chk" CHECK (jsonb_typeof("details") = 'object')
);

CREATE UNIQUE INDEX "trust_signals_public_id_key" ON "trust_signals"("public_id");
CREATE UNIQUE INDEX "trust_signals_open_dedup_key" ON "trust_signals"("dedup_key") WHERE (status = 'OPEN');
CREATE INDEX "trust_signals_queue_idx" ON "trust_signals"("status", "severity", "created_at");
CREATE INDEX "trust_signals_user_idx" ON "trust_signals"("user_id") WHERE (user_id IS NOT NULL);
CREATE INDEX "trust_signals_listing_idx" ON "trust_signals"("listing_id") WHERE (listing_id IS NOT NULL);
CREATE INDEX "trust_signals_verification_idx" ON "trust_signals"("verification_id") WHERE (verification_id IS NOT NULL);
CREATE INDEX "trust_signals_reviewed_by_id_idx" ON "trust_signals"("reviewed_by_id");

ALTER TABLE "trust_signals" ADD CONSTRAINT "trust_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trust_signals" ADD CONSTRAINT "trust_signals_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trust_signals" ADD CONSTRAINT "trust_signals_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trust_signals" ADD CONSTRAINT "trust_signals_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- trust_scores : explicabilité, état « données insuffisantes ».
-- ---------------------------------------------------------------------------

ALTER TABLE "trust_scores"
  ADD COLUMN "factors" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "is_complete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "score" DROP NOT NULL;

-- Un score déjà calculé reste valable : il est marqué complet.
UPDATE "trust_scores" SET "is_complete" = true WHERE "score" IS NOT NULL;

ALTER TABLE "trust_scores"
  ADD CONSTRAINT "trust_scores_complete_chk" CHECK ("is_complete" = ("score" IS NOT NULL)),
  ADD CONSTRAINT "trust_scores_factors_object_chk" CHECK (jsonb_typeof("factors") = 'object');

-- ---------------------------------------------------------------------------
-- Historiques en ajout seul. Seule exception : l'anonymisation d'un acteur
-- supprimé (`actor_id` passé à NULL par la clé étrangère), rien d'autre.
-- ---------------------------------------------------------------------------

CREATE FUNCTION "reject_history_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."actor_id" IS NULL AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION '% est en ajout seul', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "verification_events_reject_update"
BEFORE UPDATE ON "verification_events"
FOR EACH ROW EXECUTE FUNCTION "reject_history_update"();

CREATE TRIGGER "report_events_reject_update"
BEFORE UPDATE ON "report_events"
FOR EACH ROW EXECUTE FUNCTION "reject_history_update"();

CREATE TRIGGER "verification_documents_set_updated_at" BEFORE UPDATE ON "verification_documents" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "reports_set_updated_at" BEFORE UPDATE ON "reports" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "trust_signals_set_updated_at" BEFORE UPDATE ON "trust_signals" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
