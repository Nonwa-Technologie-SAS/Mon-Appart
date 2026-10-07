#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
SELECT 'CREATE DATABASE mon_appart_legacy'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mon_appart_legacy')\gexec
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname mon_appart_legacy \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;"
