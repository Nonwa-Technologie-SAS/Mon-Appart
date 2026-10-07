-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "PropertyVisit" ADD COLUMN "visitorWhatsapp" TEXT;
ALTER TABLE "PropertyVisit" ADD COLUMN "status" "VisitStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "PropertyVisit" SET "visitorWhatsapp" = '' WHERE "visitorWhatsapp" IS NULL;
UPDATE "PropertyVisit" SET "visitDate" = CURRENT_TIMESTAMP WHERE "visitDate" IS NULL;

ALTER TABLE "PropertyVisit" ALTER COLUMN "visitorWhatsapp" SET NOT NULL;
ALTER TABLE "PropertyVisit" ALTER COLUMN "visitDate" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PropertyVisit_status_idx" ON "PropertyVisit"("status");
