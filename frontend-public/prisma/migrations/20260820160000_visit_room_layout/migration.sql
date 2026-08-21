-- CreateEnum
CREATE TYPE "VisitRoom" AS ENUM ('ENTRANCE', 'LIVING', 'KITCHEN', 'BEDROOM', 'BATHROOM', 'EXTERIOR', 'OTHER');

-- AlterTable
ALTER TABLE "PropertyMedia" ADD COLUMN "room" "VisitRoom" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "PropertyMedia" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "PropertyMedia_propertyId_sortOrder_idx" ON "PropertyMedia"("propertyId", "sortOrder");
