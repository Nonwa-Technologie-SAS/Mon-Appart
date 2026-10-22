-- Analytics : `updated_at` maintenu par la base, comme pour les autres tables.
CREATE TRIGGER "analytics_checkpoints_set_updated_at" BEFORE UPDATE ON "analytics_checkpoints" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "analytics_consents_set_updated_at" BEFORE UPDATE ON "analytics_consents" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
