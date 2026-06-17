#!/usr/bin/env bash
# Apply the full bundle to a fresh Supabase project.
#
# Usage:
#   export DATABASE_URL="postgresql://postgres.NEWREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
#   bash 14_apply_all.sh
#
# Stops at the first error (ON_ERROR_STOP=1).

set -e
: "${DATABASE_URL:?set DATABASE_URL to the new project's Postgres URL}"
cd "$(dirname "$0")"

run() {
  echo ""
  echo "==> $2"
  echo "    file: $1"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$1"
}

run 00_extensions.sql    "Enabling Postgres extensions (pgvector, etc.)"
run 01_tables.sql        "Creating tables in public schema"
run 02_constraints.sql   "Adding primary keys, foreign keys, unique & check constraints"
run 03_indexes.sql       "Creating non-constraint indexes"
run 09_sequences.sql     "Restoring sequences (setval)"
run 04_functions.sql     "Creating SQL/PLPGSQL functions (has_role, etc.)"
run 05_triggers.sql      "Creating triggers"
run 10_views.sql         "Creating views"
run 06_grants.sql        "Granting privileges to anon / authenticated / service_role"
run 07_rls_enable.sql    "Enabling Row-Level Security on every table"
run 08_policies.sql      "Creating RLS policies"

echo ""
echo "==> Loading data from CSVs (11_data/)"
bash 12_data_load.sh

echo ""
echo "================================================================"
echo "  Database migration complete."
echo ""
echo "  Next steps:"
echo "   1. Deploy edge functions from your repo:"
echo "        supabase link --project-ref <NEW_REF>"
echo "        supabase functions deploy"
echo "      (function names listed in 13_edge_functions.txt)"
echo ""
echo "   2. Set edge function secrets in the new project dashboard."
echo ""
echo "   3. Recreate Auth users (see README.md → Step 5)."
echo "================================================================"
