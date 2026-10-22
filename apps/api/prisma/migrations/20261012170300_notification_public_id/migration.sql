-- Notifications in-app exposées par l'API : identifiant public, jamais l'id séquentiel.
ALTER TABLE "notifications" ADD COLUMN "public_id" UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX "notifications_public_id_key" ON "notifications"("public_id");
