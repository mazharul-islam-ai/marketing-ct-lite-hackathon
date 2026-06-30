# System Settings Error Logs

## Overview

The System Settings workspace centralizes company configuration alongside automated diagnostics for Supabase Edge Functions.
It surfaces the latest failure for each monitored function, enriches the record with Codex remediation guidance, and logs an
issue so engineering and support teams retain a historical trail.

**Location:** [`/adminpanel/settings`](/adminpanel/settings)

**Required Role:** Super Admin access is recommended. The Codex integration requires a valid Supabase session with permissions
to invoke the `generate-codex-fix` Edge Function.

## Key Features

- **Edge Function selector** – Choose any function captured in the `integration_logs` table and instantly review its most recent
  error payload, including request/response metadata and stack traces when available.
- **Codex recommendations** – Trigger or regenerate suggested fixes powered by the `generate-codex-fix` Supabase Edge Function.
  The response is saved in the UI, downloadable as Markdown, and linked to the related issue entry.
- **Automatic issue logging** – Each new error is persisted in the existing `issues` table with metadata (`logId`,
  `functionName`, and `timestamp`) so repeated failures stay deduplicated.
- **Exportable guidance** – Download a ready-to-share text file that teams can paste into tickets, share with Codex, or attach to
  deployment workflows.

## Data Sources

- **`integration_logs`** – Source of truth for Supabase Edge Function executions and error payloads. The UI queries the latest
  record matching the selected `integration_type` and `status = 'error'`.
- **`issues`** – Receives new bug reports when Codex analyzes an unseen log entry. Metadata lookups prevent duplicate issue
  creation for the same failure.

## Related Edge Functions

- **`generate-codex-fix`** – Authenticates the current user, builds a diagnostic prompt, calls the Codex model defined via the
  `CODEX_MODEL` environment variable (defaults to `gpt-4o-mini`), and inserts issues when necessary. Responses include the
  Codex suggestion text, the `issueId`, and a `logged` boolean so the UI knows whether automatic logging succeeded.

## Usage Tips

1. Navigate to [`/adminpanel/settings`](/adminpanel/settings) from the Admin Panel sidebar or the Integration Manager alert.
2. Select the Supabase Edge Function you want to diagnose. The most recent error loads automatically when available.
3. Review the contextual payload and Codex fix suggestion. If a new failure occurs, the component auto-generates a fresh
   recommendation and logs it as an issue.
4. Click **Regenerate** to request updated guidance after code changes, or **Download fix** to save the Markdown report locally.
