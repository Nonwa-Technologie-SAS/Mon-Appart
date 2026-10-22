-- Monétisation : catalogue d'abonnements, commandes au montant figé,
-- transactions, notifications des prestataires, remboursements, périodes
-- payées et incidents. Purement additive ; aucune donnée existante modifiée.

-- CreateEnum
CREATE TYPE "billing_product_kind" AS ENUM ('SUBSCRIPTION_PLAN');

-- CreateEnum
CREATE TYPE "billing_product_status" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "billing_price_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "billing_order_kind" AS ENUM ('SUBSCRIPTION_START', 'SUBSCRIPTION_RENEWAL');

-- CreateEnum
CREATE TYPE "billing_order_status" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_environment" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "payment_event_outcome" AS ENUM ('RECEIVED', 'APPLIED', 'IGNORED', 'REJECTED');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('REQUESTED', 'REJECTED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "billing_incident_kind" AS ENUM ('AMOUNT_MISMATCH', 'UNKNOWN_REFERENCE', 'DUPLICATE_PAYMENT', 'LATE_SUCCESS', 'GRANT_CONFLICT', 'REFUND_FAILED');

-- CreateEnum
CREATE TYPE "billing_incident_status" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "billing_products" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "kind" "billing_product_kind" NOT NULL,
    "status" "billing_product_status" NOT NULL DEFAULT 'DRAFT',
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "max_active_listings" INTEGER,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_prices" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "interval_months" SMALLINT NOT NULL,
    "status" "billing_price_status" NOT NULL DEFAULT 'ACTIVE',
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "created_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_orders" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "buyer_id" BIGINT NOT NULL,
    "kind" "billing_order_kind" NOT NULL,
    "status" "billing_order_status" NOT NULL DEFAULT 'PENDING',
    "product_id" INTEGER NOT NULL,
    "price_id" INTEGER NOT NULL,
    "subscription_id" BIGINT,
    "product_code" VARCHAR(64) NOT NULL,
    "product_name" VARCHAR(120) NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "interval_months" SMALLINT NOT NULL,
    "max_active_listings" INTEGER,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "fulfilled_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "refunded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" BIGINT NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "environment" "payment_environment" NOT NULL,
    "provider_reference" VARCHAR(128),
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'CREATED',
    "redirect_url" VARCHAR(2048),
    "failure_code" VARCHAR(64),
    "refunded_amount" BIGINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "succeeded_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "last_checked_at" TIMESTAMPTZ(6),
    "check_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" BIGSERIAL NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "event_id" VARCHAR(128) NOT NULL,
    "payment_id" BIGINT,
    "signature_valid" BOOLEAN NOT NULL,
    "outcome" "payment_event_outcome" NOT NULL DEFAULT 'RECEIVED',
    "payload_sha256" CHAR(64) NOT NULL,
    "summary" JSONB,
    "error_code" VARCHAR(64),
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "refund_status" NOT NULL DEFAULT 'REQUESTED',
    "reason" VARCHAR(500) NOT NULL,
    "requested_by_id" BIGINT,
    "requested_by_customer" BOOLEAN NOT NULL DEFAULT false,
    "decided_by_id" BIGINT,
    "decided_at" TIMESTAMPTZ(6),
    "decision_note" VARCHAR(500),
    "provider_reference" VARCHAR(128),
    "failure_code" VARCHAR(64),
    "idempotency_key" VARCHAR(64) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "last_checked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" BIGINT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "max_active_listings" INTEGER,
    "interval_months" SMALLINT NOT NULL,
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "reminder_sent_for" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_periods" (
    "id" BIGSERIAL NOT NULL,
    "subscription_id" BIGINT NOT NULL,
    "order_id" BIGINT NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_incidents" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "billing_incident_kind" NOT NULL,
    "status" "billing_incident_status" NOT NULL DEFAULT 'OPEN',
    "payment_id" BIGINT,
    "order_id" BIGINT,
    "detail" JSONB,
    "resolved_by_id" BIGINT,
    "resolved_at" TIMESTAMPTZ(6),
    "resolution" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_products_public_id_key" ON "billing_products"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_products_code_key" ON "billing_products"("code");

-- CreateIndex
CREATE INDEX "billing_products_status_sort_order_idx" ON "billing_products"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "billing_products_one_default_key" ON "billing_products"("is_default") WHERE (is_default);

-- CreateIndex
CREATE UNIQUE INDEX "billing_prices_public_id_key" ON "billing_prices"("public_id");

-- CreateIndex
CREATE INDEX "billing_prices_product_id_status_valid_from_idx" ON "billing_prices"("product_id", "status", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "billing_orders_public_id_key" ON "billing_orders"("public_id");

-- CreateIndex
CREATE INDEX "billing_orders_buyer_id_created_at_idx" ON "billing_orders"("buyer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "billing_orders_status_expires_at_idx" ON "billing_orders"("status", "expires_at");

-- CreateIndex
CREATE INDEX "billing_orders_created_at_id_idx" ON "billing_orders"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_orders_buyer_id_idempotency_key_key" ON "billing_orders"("buyer_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_orders_one_pending_per_buyer_key" ON "billing_orders"("buyer_id") WHERE (status = 'PENDING'::billing_order_status);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_public_id_key" ON "payment_transactions"("public_id");

-- CreateIndex
CREATE INDEX "payment_transactions_open_idx" ON "payment_transactions"("status", "last_checked_at") WHERE (status = ANY (ARRAY['CREATED'::payment_status, 'PENDING'::payment_status]));

-- CreateIndex
CREATE INDEX "payment_transactions_created_at_id_idx" ON "payment_transactions"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_provider_provider_reference_key" ON "payment_transactions"("provider", "provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_one_open_per_order_key" ON "payment_transactions"("order_id") WHERE (status = ANY (ARRAY['CREATED'::payment_status, 'PENDING'::payment_status]));

-- CreateIndex
CREATE INDEX "payment_events_payment_id_received_at_idx" ON "payment_events"("payment_id", "received_at");

-- CreateIndex
CREATE INDEX "payment_events_received_at_id_idx" ON "payment_events"("received_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_event_id_key" ON "payment_events"("provider", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_public_id_key" ON "payment_refunds"("public_id");

-- CreateIndex
CREATE INDEX "payment_refunds_status_created_at_idx" ON "payment_refunds"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_refunds_created_at_id_idx" ON "payment_refunds"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_payment_id_idempotency_key_key" ON "payment_refunds"("payment_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_public_id_key" ON "subscriptions"("public_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

-- CreateIndex
CREATE INDEX "subscriptions_created_at_id_idx" ON "subscriptions"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_one_current_per_user_key" ON "subscriptions"("user_id") WHERE (status = ANY (ARRAY['ACTIVE'::subscription_status, 'PAST_DUE'::subscription_status]));

-- CreateIndex
CREATE UNIQUE INDEX "subscription_periods_order_id_key" ON "subscription_periods"("order_id");

-- CreateIndex
CREATE INDEX "subscription_periods_subscription_id_period_end_idx" ON "subscription_periods"("subscription_id", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "billing_incidents_public_id_key" ON "billing_incidents"("public_id");

-- CreateIndex
CREATE INDEX "billing_incidents_status_created_at_idx" ON "billing_incidents"("status", "created_at");

-- CreateIndex
CREATE INDEX "billing_incidents_created_at_id_idx" ON "billing_incidents"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_incidents_one_open_key" ON "billing_incidents"("kind", "payment_id") WHERE (status = 'OPEN'::billing_incident_status);

-- AddForeignKey
ALTER TABLE "billing_prices" ADD CONSTRAINT "billing_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "billing_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_prices" ADD CONSTRAINT "billing_prices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "billing_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "billing_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "billing_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "billing_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "billing_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_incidents" ADD CONSTRAINT "billing_incidents_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_incidents" ADD CONSTRAINT "billing_incidents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "billing_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_incidents" ADD CONSTRAINT "billing_incidents_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Règles que Prisma ne sait pas exprimer.
-- Montants : entiers dans l'unité de la devise, plafonnés à 10^12.
-- ---------------------------------------------------------------------------

ALTER TABLE "billing_products"
    ADD CONSTRAINT "billing_products_code_format_chk" CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,63}$'),
    ADD CONSTRAINT "billing_products_name_present_chk" CHECK (length(btrim("name")) > 0),
    ADD CONSTRAINT "billing_products_max_listings_chk" CHECK ("max_active_listings" IS NULL OR "max_active_listings" >= 0);

ALTER TABLE "billing_prices"
    ADD CONSTRAINT "billing_prices_amount_chk" CHECK ("amount" > 0 AND "amount" <= 1000000000000),
    ADD CONSTRAINT "billing_prices_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "billing_prices_interval_chk" CHECK ("interval_months" BETWEEN 1 AND 24),
    ADD CONSTRAINT "billing_prices_validity_chk" CHECK ("valid_until" IS NULL OR "valid_until" > "valid_from");

ALTER TABLE "billing_orders"
    ADD CONSTRAINT "billing_orders_amount_chk" CHECK ("amount" > 0 AND "amount" <= 1000000000000),
    ADD CONSTRAINT "billing_orders_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "billing_orders_interval_chk" CHECK ("interval_months" BETWEEN 1 AND 24),
    ADD CONSTRAINT "billing_orders_max_listings_chk" CHECK ("max_active_listings" IS NULL OR "max_active_listings" >= 0),
    ADD CONSTRAINT "billing_orders_idempotency_key_chk" CHECK ("idempotency_key" ~ '^[A-Za-z0-9_-]{8,64}$'),
    ADD CONSTRAINT "billing_orders_renewal_target_chk" CHECK (("kind" = 'SUBSCRIPTION_RENEWAL') = ("subscription_id" IS NOT NULL));

ALTER TABLE "payment_transactions"
    ADD CONSTRAINT "payment_transactions_amount_chk" CHECK ("amount" > 0 AND "amount" <= 1000000000000),
    ADD CONSTRAINT "payment_transactions_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "payment_transactions_provider_chk" CHECK ("provider" ~ '^[a-z][a-z0-9_]{1,31}$'),
    ADD CONSTRAINT "payment_transactions_refunded_chk" CHECK ("refunded_amount" >= 0 AND "refunded_amount" <= "amount"),
    ADD CONSTRAINT "payment_transactions_check_attempts_chk" CHECK ("check_attempts" >= 0);

ALTER TABLE "payment_events"
    ADD CONSTRAINT "payment_events_attempts_chk" CHECK ("attempts" >= 1),
    ADD CONSTRAINT "payment_events_sha256_chk" CHECK ("payload_sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "payment_refunds"
    ADD CONSTRAINT "payment_refunds_amount_chk" CHECK ("amount" > 0 AND "amount" <= 1000000000000),
    ADD CONSTRAINT "payment_refunds_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "payment_refunds_reason_present_chk" CHECK (length(btrim("reason")) > 0),
    ADD CONSTRAINT "payment_refunds_idempotency_key_chk" CHECK ("idempotency_key" ~ '^[A-Za-z0-9_-]{8,64}$');

ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_period_chk" CHECK ("current_period_end" > "current_period_start"),
    ADD CONSTRAINT "subscriptions_interval_chk" CHECK ("interval_months" BETWEEN 1 AND 24),
    ADD CONSTRAINT "subscriptions_max_listings_chk" CHECK ("max_active_listings" IS NULL OR "max_active_listings" >= 0);

ALTER TABLE "subscription_periods"
    ADD CONSTRAINT "subscription_periods_range_chk" CHECK ("period_end" > "period_start");

CREATE TRIGGER "billing_products_set_updated_at" BEFORE UPDATE ON "billing_products" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "billing_orders_set_updated_at" BEFORE UPDATE ON "billing_orders" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "payment_transactions_set_updated_at" BEFORE UPDATE ON "payment_transactions" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "payment_refunds_set_updated_at" BEFORE UPDATE ON "payment_refunds" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "subscriptions_set_updated_at" BEFORE UPDATE ON "subscriptions" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "billing_incidents_set_updated_at" BEFORE UPDATE ON "billing_incidents" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

-- Historique financier : aucune suppression, même par l'application.
CREATE FUNCTION "reject_billing_delete"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% : suppression interdite (historique financier)', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "billing_prices_reject_delete" BEFORE DELETE ON "billing_prices" FOR EACH ROW EXECUTE FUNCTION "reject_billing_delete"();
CREATE TRIGGER "billing_orders_reject_delete" BEFORE DELETE ON "billing_orders" FOR EACH ROW EXECUTE FUNCTION "reject_billing_delete"();
CREATE TRIGGER "payment_transactions_reject_delete" BEFORE DELETE ON "payment_transactions" FOR EACH ROW EXECUTE FUNCTION "reject_billing_delete"();
CREATE TRIGGER "payment_events_reject_delete" BEFORE DELETE ON "payment_events" FOR EACH ROW EXECUTE FUNCTION "reject_billing_delete"();
CREATE TRIGGER "payment_refunds_reject_delete" BEFORE DELETE ON "payment_refunds" FOR EACH ROW EXECUTE FUNCTION "reject_billing_delete"();
CREATE TRIGGER "subscriptions_reject_delete" BEFORE DELETE ON "subscriptions" FOR EACH ROW EXECUTE FUNCTION "reject_billing_delete"();
CREATE TRIGGER "subscription_periods_reject_delete" BEFORE DELETE ON "subscription_periods" FOR EACH ROW EXECUTE FUNCTION "reject_billing_delete"();
CREATE TRIGGER "billing_incidents_reject_delete" BEFORE DELETE ON "billing_incidents" FOR EACH ROW EXECUTE FUNCTION "reject_billing_delete"();

-- Un prix publié ne change plus : seuls son statut et sa fin de validité évoluent.
CREATE FUNCTION "billing_prices_guard_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."product_id" IS DISTINCT FROM OLD."product_id"
       OR NEW."amount" IS DISTINCT FROM OLD."amount"
       OR NEW."currency" IS DISTINCT FROM OLD."currency"
       OR NEW."interval_months" IS DISTINCT FROM OLD."interval_months"
       OR NEW."valid_from" IS DISTINCT FROM OLD."valid_from"
       OR NEW."public_id" IS DISTINCT FROM OLD."public_id" THEN
        RAISE EXCEPTION 'billing_prices : montant, devise, période et début de validité sont immuables'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "billing_prices_guard_update" BEFORE UPDATE ON "billing_prices" FOR EACH ROW EXECUTE FUNCTION "billing_prices_guard_update"();

-- Le prix convenu et les droits achetés sont figés à la création de la commande.
CREATE FUNCTION "billing_orders_guard_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."buyer_id" IS DISTINCT FROM OLD."buyer_id"
       OR NEW."kind" IS DISTINCT FROM OLD."kind"
       OR NEW."product_id" IS DISTINCT FROM OLD."product_id"
       OR NEW."price_id" IS DISTINCT FROM OLD."price_id"
       OR NEW."subscription_id" IS DISTINCT FROM OLD."subscription_id"
       OR NEW."product_code" IS DISTINCT FROM OLD."product_code"
       OR NEW."product_name" IS DISTINCT FROM OLD."product_name"
       OR NEW."amount" IS DISTINCT FROM OLD."amount"
       OR NEW."currency" IS DISTINCT FROM OLD."currency"
       OR NEW."interval_months" IS DISTINCT FROM OLD."interval_months"
       OR NEW."max_active_listings" IS DISTINCT FROM OLD."max_active_listings"
       OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
       OR NEW."public_id" IS DISTINCT FROM OLD."public_id" THEN
        RAISE EXCEPTION 'billing_orders : le contenu et le montant d''une commande sont immuables'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "billing_orders_guard_update" BEFORE UPDATE ON "billing_orders" FOR EACH ROW EXECUTE FUNCTION "billing_orders_guard_update"();

-- Montant, devise, prestataire et référence d'une transaction ne changent pas.
CREATE FUNCTION "payment_transactions_guard_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."order_id" IS DISTINCT FROM OLD."order_id"
       OR NEW."provider" IS DISTINCT FROM OLD."provider"
       OR NEW."environment" IS DISTINCT FROM OLD."environment"
       OR NEW."amount" IS DISTINCT FROM OLD."amount"
       OR NEW."currency" IS DISTINCT FROM OLD."currency"
       OR NEW."public_id" IS DISTINCT FROM OLD."public_id"
       OR (OLD."provider_reference" IS NOT NULL
           AND NEW."provider_reference" IS DISTINCT FROM OLD."provider_reference") THEN
        RAISE EXCEPTION 'payment_transactions : montant, devise, prestataire et référence sont immuables'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "payment_transactions_guard_update" BEFORE UPDATE ON "payment_transactions" FOR EACH ROW EXECUTE FUNCTION "payment_transactions_guard_update"();

CREATE FUNCTION "payment_refunds_guard_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."payment_id" IS DISTINCT FROM OLD."payment_id"
       OR NEW."amount" IS DISTINCT FROM OLD."amount"
       OR NEW."currency" IS DISTINCT FROM OLD."currency"
       OR NEW."reason" IS DISTINCT FROM OLD."reason"
       OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
       OR NEW."public_id" IS DISTINCT FROM OLD."public_id" THEN
        RAISE EXCEPTION 'payment_refunds : montant, motif et transaction d''origine sont immuables'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "payment_refunds_guard_update" BEFORE UPDATE ON "payment_refunds" FOR EACH ROW EXECUTE FUNCTION "payment_refunds_guard_update"();

-- Une période payée ne peut qu'être révoquée (remboursement intégral), une fois.
CREATE FUNCTION "subscription_periods_guard_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."subscription_id" IS DISTINCT FROM OLD."subscription_id"
       OR NEW."order_id" IS DISTINCT FROM OLD."order_id"
       OR NEW."period_start" IS DISTINCT FROM OLD."period_start"
       OR NEW."period_end" IS DISTINCT FROM OLD."period_end"
       OR (OLD."revoked_at" IS NOT NULL
           AND NEW."revoked_at" IS DISTINCT FROM OLD."revoked_at") THEN
        RAISE EXCEPTION 'subscription_periods : seule la révocation d''une période est permise'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "subscription_periods_guard_update" BEFORE UPDATE ON "subscription_periods" FOR EACH ROW EXECUTE FUNCTION "subscription_periods_guard_update"();
