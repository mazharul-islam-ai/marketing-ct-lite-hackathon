#!/usr/bin/env bash
set -e
export PGPASSWORD='Nihad#10867'
export DATABASE_URL="postgresql://postgres.mqdztkwdivjhvwlbqlpt@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
cd "$(dirname "$0")"

run() {
  echo ""
  echo "==> $2"
  echo "    file: $1"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$1"
}

echo "==> Testing connection..."
psql "$DATABASE_URL" -c "SELECT current_database(), current_user;"

run 00_extensions.sql  "Enabling Postgres extensions"
run 01_tables.sql      "Creating tables"
run 02_constraints.sql "Adding constraints"
run 03_indexes.sql     "Creating indexes"
run 09_sequences.sql   "Restoring sequences"
run 04_functions.sql   "Creating functions"
run 05_triggers.sql    "Creating triggers"
run 10_views.sql       "Creating views"
run 06_grants.sql      "Granting privileges"
run 07_rls_enable.sql  "Enabling RLS"
run 08_policies.sql    "Creating RLS policies"

echo ""
echo "==> Loading CSV data..."
bash 12_data_load.sh

echo ""
echo "================================================================"
echo "  Database migration complete!"
echo "================================================================"
