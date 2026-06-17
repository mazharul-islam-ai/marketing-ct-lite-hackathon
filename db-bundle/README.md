# DB Bundle — Migrate to a New Supabase Project

This bundle contains your full database export (schema + data + RLS) from the source Supabase project, ready to apply to a fresh Supabase project.

---

## Step 1 — Download `db-bundle.zip`

In the Lovable chat, the file `db-bundle.zip` appears as an artifact (paperclip / download icon). Click it to download to your computer.

Then unzip it:

```bash
unzip db-bundle.zip
cd db-bundle
```

You should see files `00_extensions.sql` … `14_apply_all.sh`, plus a `11_data/` folder full of CSVs.

---

## Step 2 — Prerequisites

You need:

1. **`psql` CLI** installed locally
   - macOS: `brew install libpq && brew link --force libpq`
   - Ubuntu/Debian: `sudo apt-get install postgresql-client`
   - Windows: install PostgreSQL from postgresql.org

2. **Your new Supabase project's Postgres connection string**, in the form:
   ```
   postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
   ```
   Find it in: **New Supabase project → Project Settings → Database → Connection string → URI** (use the *Session* pooler or direct connection, NOT the transaction pooler — `\copy` needs a session connection).

> Tip: URL-encode special characters in the password (`@` → `%40`, etc.).

---

## Step 3 — Run the apply script

From inside the unzipped `db-bundle/` folder:

```bash
chmod +x 14_apply_all.sh 12_data_load.sh

export DATABASE_URL="postgresql://postgres.NEWREF:YOURPASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"

bash 14_apply_all.sh
```

That's it. The script runs everything in order and stops on the first error (`ON_ERROR_STOP=1`).

### What the script does, in order
1. `00_extensions.sql` — enable required Postgres extensions (pgvector, etc.)
2. `01_tables.sql` — create all `public` tables
3. `02_constraints.sql` — primary keys, foreign keys, uniques, checks
4. `03_indexes.sql` — non-constraint indexes
5. `09_sequences.sql` — sequences + `setval` (empty if none)
6. `04_functions.sql` — `has_role`, `user_has_brand_access`, triggers' functions
7. `05_triggers.sql` — table triggers
8. `10_views.sql` — views (empty if none)
9. `06_grants.sql` — GRANTs for `anon` / `authenticated` / `service_role`
10. `07_rls_enable.sql` — enable Row-Level Security
11. `08_policies.sql` — all RLS policies
12. `12_data_load.sh` — load CSV data into every table (42 tables)

---

## Step 4 — Deploy edge functions

The edge function source code lives in your Lovable repo under `supabase/functions/`. The names you need are listed in `13_edge_functions.txt`.

From your project repo (NOT the db-bundle folder):

```bash
supabase link --project-ref <NEW_PROJECT_REF>
supabase functions deploy
```

This deploys all functions in `supabase/functions/`. You can also deploy them one at a time: `supabase functions deploy <name>`.

Then set the edge function secrets in the **new** project (Project Settings → Edge Functions → Secrets): `LOVABLE_API_KEY`, `OPENAI_KEY`, ActiveCollab creds, Google credentials, etc. (full list is in the source project's secrets — re-add the same names).

---

## Step 5 — Recreate Auth users

Auth users are NOT exported (they live in Supabase's managed `auth` schema). Recreate them via:

- **Dashboard:** Authentication → Users → Add user, OR
- **Demo seed:** invoke the `seed-demo-users` / equivalent edge function if you ship one
- **Manual:** use Supabase Admin API with the service role key

Make sure the new users' UUIDs match the rows in `user_roles.csv` / `profiles.csv` — otherwise role lookups will fail. Easiest path: re-insert into `user_roles` after creating the new auth users.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `psql: command not found` | Install `postgresql-client` (see Step 2) |
| `permission denied for schema public` | You used the wrong connection string — must be the `postgres` user, not `anon` |
| `extension "vector" does not exist` | In the new project: Dashboard → Database → Extensions → enable `vector` first, then re-run |
| `\copy: ... could not open file` | You're not inside the unzipped `db-bundle/` folder. `cd` into it before running |
| Foreign key violation on data load | Re-run — the script disables triggers via `session_replication_role = replica` inside `12_data_load.sh`. If it persists, check that all source CSVs are present |
| `relation "x" already exists` | The target DB isn't empty. Either drop the public schema first (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`) or use a fresh project |

---

## Caveats

- `auth`, `storage`, `vault` schemas excluded — Supabase manages them.
- Source project had **0 storage buckets**, so nothing to migrate there.
- Auth users not exported (see Step 5).
- Grants were generated from policy roles: `authenticated` + `service_role` get full CRUD on every table; `anon` gets `SELECT` only where a policy targets `anon`.
