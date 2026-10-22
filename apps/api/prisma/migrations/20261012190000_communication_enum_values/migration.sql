-- Messagerie et notifications (1/2) : nouvelles valeurs d'enum uniquement.
-- PostgreSQL interdit d'utiliser une valeur ajoutée dans la transaction qui
-- l'ajoute : les contraintes qui s'en servent sont dans la migration suivante.

ALTER TYPE "appointment_status" ADD VALUE 'RESCHEDULE_REQUESTED';

ALTER TYPE "media_purpose" ADD VALUE 'MESSAGE';

ALTER TYPE "report_target_type" ADD VALUE 'MESSAGE';
ALTER TYPE "report_target_type" ADD VALUE 'CONVERSATION';

ALTER TYPE "report_action" ADD VALUE 'CONVERSATION_CLOSED';
