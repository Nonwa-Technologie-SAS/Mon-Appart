-- Back-office : motifs de modération administrables, notes internes en ajout
-- seul, recherche d'utilisateurs par nom. Aucune donnée existante modifiée.

-- CreateEnum
CREATE TYPE "moderation_action" AS ENUM ('REJECT', 'REQUEST_CHANGES', 'SUSPEND');

-- CreateTable
CREATE TABLE "moderation_reasons" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "action" "moderation_action" NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "owner_message" VARCHAR(500) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notes" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(20) NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "author_id" BIGINT,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "moderation_reasons_code_key" ON "moderation_reasons"("code");

-- CreateIndex
CREATE INDEX "moderation_reasons_action_is_active_sort_order_idx" ON "moderation_reasons"("action", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "admin_notes_public_id_key" ON "admin_notes"("public_id");

-- CreateIndex
CREATE INDEX "admin_notes_entity_type_entity_id_created_at_idx" ON "admin_notes"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "users_first_name_trgm_idx" ON "users" USING GIN ("first_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_last_name_trgm_idx" ON "users" USING GIN ("last_name" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Règles que Prisma ne sait pas exprimer.
-- ---------------------------------------------------------------------------

ALTER TABLE "moderation_reasons"
    ADD CONSTRAINT "moderation_reasons_code_format_chk" CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,63}$'),
    ADD CONSTRAINT "moderation_reasons_label_present_chk" CHECK (length(btrim("label")) > 0),
    ADD CONSTRAINT "moderation_reasons_message_present_chk" CHECK (length(btrim("owner_message")) > 0);

CREATE TRIGGER "moderation_reasons_set_updated_at" BEFORE UPDATE ON "moderation_reasons" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

ALTER TABLE "admin_notes"
    ADD CONSTRAINT "admin_notes_entity_type_chk" CHECK ("entity_type" IN ('user', 'listing')),
    ADD CONSTRAINT "admin_notes_body_present_chk" CHECK (length(btrim("body")) > 0);

-- Notes internes : en ajout seul, comme audit_logs.
CREATE FUNCTION "reject_admin_note_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'admin_notes est en ajout seul'
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "admin_notes_reject_update"
BEFORE UPDATE ON "admin_notes"
FOR EACH ROW EXECUTE FUNCTION "reject_admin_note_update"();
