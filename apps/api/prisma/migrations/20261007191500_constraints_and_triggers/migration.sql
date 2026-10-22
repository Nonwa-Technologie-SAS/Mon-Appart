-- Règles d'intégrité que Prisma ne sait pas exprimer dans schema.prisma.
-- Prisma ne lit ni les CHECK, ni les fonctions, ni les triggers : ils ne
-- provoquent pas de dérive et ne seront pas supprimés par une migration future.

-- ---------------------------------------------------------------------------
-- updated_at : un seul mécanisme, côté base, valable aussi pour le SQL brut.
-- Toute nouvelle table avec updated_at doit recevoir ce trigger dans sa migration
-- (un test de base de données le vérifie).
-- ---------------------------------------------------------------------------

CREATE FUNCTION "set_updated_at"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW."updated_at" := now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    target record;
BEGIN
    FOR target IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND c.column_name = 'updated_at'
          AND t.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION "set_updated_at"()',
            target.table_name || '_set_updated_at',
            target.table_name
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- audit_logs : append-only. La suppression reste possible pour la rétention.
-- ---------------------------------------------------------------------------

CREATE FUNCTION "reject_audit_log_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs est en ajout seul'
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "audit_logs_reject_update"
BEFORE UPDATE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION "reject_audit_log_update"();

-- ---------------------------------------------------------------------------
-- IDENTITY
-- ---------------------------------------------------------------------------

ALTER TABLE "users"
    ADD CONSTRAINT "users_contact_present_chk" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL),
    ADD CONSTRAINT "users_phone_e164_chk" CHECK ("phone" ~ '^\+[1-9][0-9]{7,14}$'),
    ADD CONSTRAINT "users_email_format_chk" CHECK ("email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

ALTER TABLE "roles"
    ADD CONSTRAINT "roles_code_format_chk" CHECK ("code" ~ '^[A-Z][A-Z_]*$');

ALTER TABLE "permissions"
    ADD CONSTRAINT "permissions_code_format_chk" CHECK ("code" ~ '^[a-z][a-z_]*:[a-z][a-z_]*$');

-- ---------------------------------------------------------------------------
-- LOCATION et référentiels
-- ---------------------------------------------------------------------------

ALTER TABLE "countries"
    ADD CONSTRAINT "countries_code_format_chk" CHECK ("code" ~ '^[A-Z]{2}$');
ALTER TABLE "districts"
    ADD CONSTRAINT "districts_code_format_chk" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_]*$');
ALTER TABLE "cities"
    ADD CONSTRAINT "cities_code_format_chk" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_]*$');
ALTER TABLE "communes"
    ADD CONSTRAINT "communes_code_format_chk" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_]*$');
ALTER TABLE "neighborhoods"
    ADD CONSTRAINT "neighborhoods_code_format_chk" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_]*$');
ALTER TABLE "property_types"
    ADD CONSTRAINT "property_types_code_format_chk" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE "amenities"
    ADD CONSTRAINT "amenities_code_format_chk" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$');

-- ---------------------------------------------------------------------------
-- PROPERTY
-- ---------------------------------------------------------------------------

ALTER TABLE "properties"
    ADD CONSTRAINT "properties_title_not_blank_chk" CHECK (btrim("title") <> ''),
    ADD CONSTRAINT "properties_surface_chk" CHECK ("surface" >= 0),
    ADD CONSTRAINT "properties_land_surface_chk" CHECK ("land_surface" >= 0),
    ADD CONSTRAINT "properties_bedrooms_chk" CHECK ("bedrooms" >= 0),
    ADD CONSTRAINT "properties_bathrooms_chk" CHECK ("bathrooms" >= 0),
    ADD CONSTRAINT "properties_rooms_chk" CHECK ("rooms" >= 0),
    ADD CONSTRAINT "properties_total_floors_chk" CHECK ("total_floors" >= 0),
    ADD CONSTRAINT "properties_floor_chk" CHECK ("floor" >= -5),
    ADD CONSTRAINT "properties_floor_within_building_chk" CHECK ("floor" IS NULL OR "total_floors" IS NULL OR "floor" <= "total_floors"),
    ADD CONSTRAINT "properties_year_built_chk" CHECK ("year_built" BETWEEN 1800 AND 2100),
    ADD CONSTRAINT "properties_latitude_chk" CHECK ("latitude" BETWEEN -90 AND 90),
    ADD CONSTRAINT "properties_longitude_chk" CHECK ("longitude" BETWEEN -180 AND 180),
    ADD CONSTRAINT "properties_coordinates_pair_chk" CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

ALTER TABLE "property_ownerships"
    ADD CONSTRAINT "property_ownerships_period_chk" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at"),
    ADD CONSTRAINT "property_ownerships_current_consistent_chk" CHECK ("is_current" = ("ended_at" IS NULL));

-- ---------------------------------------------------------------------------
-- LISTING
-- ---------------------------------------------------------------------------

ALTER TABLE "listings"
    ADD CONSTRAINT "listings_title_not_blank_chk" CHECK (btrim("title") <> ''),
    ADD CONSTRAINT "listings_published_has_date_chk" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL),
    ADD CONSTRAINT "listings_expiry_after_publication_chk" CHECK ("expires_at" IS NULL OR "published_at" IS NULL OR "expires_at" > "published_at");

ALTER TABLE "listing_prices"
    ADD CONSTRAINT "listing_prices_amount_chk" CHECK ("amount" >= 0),
    ADD CONSTRAINT "listing_prices_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "listing_prices_validity_chk" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");

ALTER TABLE "listing_status_history"
    ADD CONSTRAINT "listing_status_history_changed_chk" CHECK ("old_status" IS DISTINCT FROM "new_status");

-- ---------------------------------------------------------------------------
-- MEDIA
-- ---------------------------------------------------------------------------

ALTER TABLE "media"
    ADD CONSTRAINT "media_file_size_chk" CHECK ("file_size" > 0),
    ADD CONSTRAINT "media_dimensions_chk" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)),
    ADD CONSTRAINT "media_duration_chk" CHECK ("duration_ms" >= 0),
    ADD CONSTRAINT "media_sort_order_chk" CHECK ("sort_order" >= 0);

-- ---------------------------------------------------------------------------
-- INTERACTION
-- Pas de CHECK coûteux sur property_views : table d'ingestion rapide.
-- ---------------------------------------------------------------------------

ALTER TABLE "property_views"
    ADD CONSTRAINT "property_views_duration_chk" CHECK ("duration_ms" >= 0);

ALTER TABLE "inquiries"
    ADD CONSTRAINT "inquiries_not_self_chk" CHECK ("user_id" <> "owner_id"),
    ADD CONSTRAINT "inquiries_message_length_chk" CHECK (char_length("message") <= 5000);

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_not_self_chk" CHECK ("user_id" <> "owner_id");

-- ---------------------------------------------------------------------------
-- SEARCH
-- ---------------------------------------------------------------------------

ALTER TABLE "searches"
    ADD CONSTRAINT "searches_price_chk" CHECK (("min_price" IS NULL OR "min_price" >= 0) AND ("max_price" IS NULL OR "max_price" >= 0)),
    ADD CONSTRAINT "searches_price_range_chk" CHECK ("min_price" IS NULL OR "max_price" IS NULL OR "min_price" <= "max_price"),
    ADD CONSTRAINT "searches_surface_chk" CHECK (("min_surface" IS NULL OR "min_surface" >= 0) AND ("max_surface" IS NULL OR "max_surface" >= 0)),
    ADD CONSTRAINT "searches_surface_range_chk" CHECK ("min_surface" IS NULL OR "max_surface" IS NULL OR "min_surface" <= "max_surface"),
    ADD CONSTRAINT "searches_rooms_chk" CHECK (("bedrooms" IS NULL OR "bedrooms" >= 0) AND ("bathrooms" IS NULL OR "bathrooms" >= 0)),
    ADD CONSTRAINT "searches_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "searches_coordinates_chk" CHECK (("latitude" IS NULL) = ("longitude" IS NULL) AND ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180))),
    ADD CONSTRAINT "searches_radius_chk" CHECK ("radius_m" IS NULL OR ("radius_m" BETWEEN 1 AND 100000 AND "latitude" IS NOT NULL)),
    ADD CONSTRAINT "searches_filters_object_chk" CHECK ("filters" IS NULL OR jsonb_typeof("filters") = 'object');

-- ---------------------------------------------------------------------------
-- RECOMMENDATION
-- ---------------------------------------------------------------------------

ALTER TABLE "user_preferences"
    ADD CONSTRAINT "user_preferences_budget_chk" CHECK (("min_budget" IS NULL OR "min_budget" >= 0) AND ("max_budget" IS NULL OR "max_budget" >= 0)),
    ADD CONSTRAINT "user_preferences_budget_range_chk" CHECK ("min_budget" IS NULL OR "max_budget" IS NULL OR "min_budget" <= "max_budget"),
    ADD CONSTRAINT "user_preferences_bedrooms_chk" CHECK ("preferred_bedrooms" >= 0),
    ADD CONSTRAINT "user_preferences_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "user_behavior_profiles"
    ADD CONSTRAINT "user_behavior_profiles_budget_chk" CHECK (("preferred_budget_min" IS NULL OR "preferred_budget_min" >= 0) AND ("preferred_budget_max" IS NULL OR "preferred_budget_max" >= 0)),
    ADD CONSTRAINT "user_behavior_profiles_budget_range_chk" CHECK ("preferred_budget_min" IS NULL OR "preferred_budget_max" IS NULL OR "preferred_budget_min" <= "preferred_budget_max"),
    ADD CONSTRAINT "user_behavior_profiles_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "user_behavior_profiles_sensitivity_chk" CHECK (
        ("price_sensitivity" IS NULL OR "price_sensitivity" BETWEEN 0 AND 1)
        AND ("location_sensitivity" IS NULL OR "location_sensitivity" BETWEEN 0 AND 1)
        AND ("property_type_sensitivity" IS NULL OR "property_type_sensitivity" BETWEEN 0 AND 1)
    );

ALTER TABLE "recommendations"
    ADD CONSTRAINT "recommendations_score_chk" CHECK ("score" BETWEEN 0 AND 1),
    ADD CONSTRAINT "recommendations_expiry_chk" CHECK ("expires_at" > "generated_at"),
    ADD CONSTRAINT "recommendations_reason_object_chk" CHECK ("reason" IS NULL OR jsonb_typeof("reason") = 'object');

-- ---------------------------------------------------------------------------
-- TRUST
-- ---------------------------------------------------------------------------

ALTER TABLE "verifications"
    ADD CONSTRAINT "verifications_property_required_chk" CHECK ("type" <> 'PROPERTY_OWNERSHIP' OR "property_id" IS NOT NULL),
    ADD CONSTRAINT "verifications_verified_has_date_chk" CHECK ("status" <> 'VERIFIED' OR "verified_at" IS NOT NULL);

ALTER TABLE "trust_scores"
    ADD CONSTRAINT "trust_scores_range_chk" CHECK (
        "score" BETWEEN 0 AND 100
        AND "identity_score" BETWEEN 0 AND 100
        AND "property_score" BETWEEN 0 AND 100
        AND "behavior_score" BETWEEN 0 AND 100
        AND "transaction_score" BETWEEN 0 AND 100
    );

-- ---------------------------------------------------------------------------
-- COMMUNICATION et EVENTS
-- ---------------------------------------------------------------------------

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_data_object_chk" CHECK ("data" IS NULL OR jsonb_typeof("data") = 'object');

ALTER TABLE "user_events"
    ADD CONSTRAINT "user_events_metadata_object_chk" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object');
