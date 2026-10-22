-- Les vérifications de coordonnées (Identity) sont créées directement en
-- attente, sans brouillon : leur date de soumission est celle de création.
-- Un brouillon Trust passe `submitted_at = NULL` explicitement.
ALTER TABLE "verifications" ALTER COLUMN "submitted_at" SET DEFAULT CURRENT_TIMESTAMP;
