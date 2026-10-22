-- Trust & Verification (1/2) : nouvelles valeurs d'enum uniquement.
-- PostgreSQL interdit d'utiliser une valeur ajoutée dans la transaction qui
-- l'ajoute : les contraintes qui s'en servent sont dans la migration suivante.

ALTER TYPE "verification_type" ADD VALUE 'OWNER_AUTHORIZATION';
ALTER TYPE "verification_type" ADD VALUE 'PROPERTY_DOCUMENT';
ALTER TYPE "verification_type" ADD VALUE 'AGENCY';
ALTER TYPE "verification_type" ADD VALUE 'LISTING_CONSISTENCY';

ALTER TYPE "verification_status" ADD VALUE 'DRAFT';
ALTER TYPE "verification_status" ADD VALUE 'IN_REVIEW';
ALTER TYPE "verification_status" ADD VALUE 'NEEDS_MORE_INFORMATION';
ALTER TYPE "verification_status" ADD VALUE 'REVOKED';
ALTER TYPE "verification_status" ADD VALUE 'WITHDRAWN';

ALTER TYPE "notification_type" ADD VALUE 'REPORT';
