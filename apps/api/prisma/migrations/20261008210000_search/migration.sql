-- Search & Discovery : projection de recherche PostgreSQL.
-- Migration additive : aucune table existante n'est modifiée.

CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Normalisation commune à l'indexation et aux requêtes : minuscules, sans
-- accents (Rivière = Riviere). unaccent() n'est pas IMMUTABLE ; on fige le
-- dictionnaire pour pouvoir l'utiliser dans une colonne générée.
CREATE OR REPLACE FUNCTION search_normalize(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT lower(public.unaccent('public.unaccent'::regdictionary, value))
$$;

-- Configuration plein texte française insensible aux accents.
CREATE TEXT SEARCH CONFIGURATION public.mon_appart_fr (COPY = pg_catalog.french);
ALTER TEXT SEARCH CONFIGURATION public.mon_appart_fr
  ALTER MAPPING FOR hword, hword_part, word
  WITH public.unaccent, pg_catalog.french_stem;

-- Projection dénormalisée d'une annonce, alimentée par SearchIndexer.
-- Ce n'est pas une source de vérité : chaque requête revérifie le statut,
-- la suppression et le prix dans listings / properties / listing_prices.
CREATE TABLE "listing_search_documents" (
    "listing_id" BIGINT NOT NULL,
    "schema_version" SMALLINT NOT NULL DEFAULT 1,
    "title_text" TEXT NOT NULL DEFAULT '',
    "type_text" TEXT NOT NULL DEFAULT '',
    "location_text" TEXT NOT NULL DEFAULT '',
    "description_text" TEXT NOT NULL DEFAULT '',
    "amenities_text" TEXT NOT NULL DEFAULT '',
    "quality_score" REAL NOT NULL DEFAULT 0,
    "indexed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Pondération : titre, type et localisation (A) > description (B) > équipements (C).
    "search_vector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('public.mon_appart_fr'::regconfig, "title_text"), 'A')
        || setweight(to_tsvector('public.mon_appart_fr'::regconfig, "type_text"), 'A')
        || setweight(to_tsvector('public.mon_appart_fr'::regconfig, "location_text"), 'A')
        || setweight(to_tsvector('public.mon_appart_fr'::regconfig, "description_text"), 'B')
        || setweight(to_tsvector('public.mon_appart_fr'::regconfig, "amenities_text"), 'C')
    ) STORED,
    -- Texte court normalisé pour la tolérance aux fautes (trigrammes).
    "suggest_text" TEXT GENERATED ALWAYS AS (
        search_normalize("title_text" || ' ' || "type_text" || ' ' || "location_text")
    ) STORED,

    CONSTRAINT "listing_search_documents_pkey" PRIMARY KEY ("listing_id"),
    CONSTRAINT "listing_search_documents_quality_score_check"
        CHECK ("quality_score" >= 0 AND "quality_score" <= 1)
);

ALTER TABLE "listing_search_documents"
    ADD CONSTRAINT "listing_search_documents_listing_id_fkey"
    FOREIGN KEY ("listing_id") REFERENCES "listings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "listing_search_documents_vector_idx"
    ON "listing_search_documents" USING GIN ("search_vector");

CREATE INDEX "listing_search_documents_suggest_trgm_idx"
    ON "listing_search_documents" USING GIN ("suggest_text" gin_trgm_ops);
