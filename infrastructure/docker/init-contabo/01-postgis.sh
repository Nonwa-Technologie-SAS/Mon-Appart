#!/bin/sh
# Init PostgreSQL Contabo / staging VPS : PostGIS uniquement sur la base métier.
# Ne crée pas mon_appart_test ni mon_appart_legacy.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;"
