-- Historiques des dossiers et des signalements : la suppression est refusée
-- comme la modification. Les dossiers eux-mêmes restent liés à leur historique
-- (clé étrangère RESTRICT) : une trace de décision ne disparaît pas.

CREATE FUNCTION "reject_history_delete"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% est en ajout seul', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "verification_events_reject_delete"
BEFORE DELETE ON "verification_events"
FOR EACH ROW EXECUTE FUNCTION "reject_history_delete"();

CREATE TRIGGER "report_events_reject_delete"
BEFORE DELETE ON "report_events"
FOR EACH ROW EXECUTE FUNCTION "reject_history_delete"();

CREATE TRIGGER "verification_events_reject_truncate"
BEFORE TRUNCATE ON "verification_events"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_history_delete"();

CREATE TRIGGER "report_events_reject_truncate"
BEFORE TRUNCATE ON "report_events"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_history_delete"();
