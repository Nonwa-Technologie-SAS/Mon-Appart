-- Module Property & Listing : ajouts uniquement, aucune donnée supprimée.

-- CreateEnum
CREATE TYPE "amenity_category" AS ENUM ('SECURITY', 'COMFORT', 'OUTDOOR', 'ENERGY', 'WATER', 'ACCESSIBILITY', 'CONNECTIVITY', 'FURNITURE');

-- CreateEnum
CREATE TYPE "location_visibility" AS ENUM ('EXACT', 'APPROXIMATE', 'HIDDEN');

-- AlterEnum : relations de représentation (mandat), sans droit réel.
-- Les nouvelles valeurs ne sont pas utilisées dans cette migration.
ALTER TYPE "ownership_type" ADD VALUE 'AGENT';
ALTER TYPE "ownership_type" ADD VALUE 'MANAGER';

-- AlterTable
ALTER TABLE "amenities" ADD COLUMN     "category" "amenity_category" NOT NULL DEFAULT 'COMFORT';

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "attributes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "location_visibility" "location_visibility" NOT NULL DEFAULT 'APPROXIMATE';

-- AlterTable
ALTER TABLE "property_types" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "listing_prices_current_amount_idx" ON "listing_prices"("amount") WHERE (valid_to IS NULL);

-- CreateIndex
CREATE INDEX "listings_published_recent_idx" ON "listings"("published_at" DESC, "id" DESC) WHERE (status = 'PUBLISHED' AND deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "listings_expiry_idx" ON "listings"("expires_at") WHERE (status = 'PUBLISHED' AND expires_at IS NOT NULL AND deleted_at IS NULL);

-- Contraintes hors Prisma
ALTER TABLE "properties"
    ADD CONSTRAINT "properties_attributes_object_chk" CHECK (jsonb_typeof("attributes") = 'object');

-- Un prix publié est strictement positif. Aucune ligne existante n'est à 0 :
-- le seed et l'application ont toujours exigé un montant positif.
ALTER TABLE "listing_prices"
    DROP CONSTRAINT "listing_prices_amount_chk",
    ADD CONSTRAINT "listing_prices_amount_positive_chk" CHECK ("amount" > 0);

-- Catégories des équipements de référence déjà présents.
UPDATE "amenities" SET "category" = 'SECURITY' WHERE "code" IN ('SECURITY');
UPDATE "amenities" SET "category" = 'OUTDOOR' WHERE "code" IN ('PARKING', 'SWIMMING_POOL', 'GARDEN', 'BALCONY');
UPDATE "amenities" SET "category" = 'ENERGY' WHERE "code" IN ('GENERATOR');
UPDATE "amenities" SET "category" = 'WATER' WHERE "code" IN ('WATER_TANK');
UPDATE "amenities" SET "category" = 'ACCESSIBILITY' WHERE "code" IN ('ELEVATOR');
UPDATE "amenities" SET "category" = 'CONNECTIVITY' WHERE "code" IN ('WIFI');
UPDATE "amenities" SET "category" = 'FURNITURE' WHERE "code" IN ('FURNISHED', 'FITTED_KITCHEN');
