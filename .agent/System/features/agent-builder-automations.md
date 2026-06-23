# Agent Builder & Automations

Last updated: 2026-06-23

## Overview

The **Agent Builder** (`/adminpanel/agent-builder`) is a visual workflow studio where super admins describe automations in natural language. The AI compiler (`compile-agent-flow`) produces validated `flow_json` graphs stored in `agent_versions`.

**Automations** (`/adminpanel/automations`) are published agents with active schedules in the `automations` table, executed by Trigger.dev (`automation-scheduler` + `execute-agent-run`).

## Architecture

```
User prompt → compile-agent-flow (integration-aware + SSE status)
           → agent_versions.flow_json
           → Publish → automations table (if cron_trigger)
           → automation-scheduler (every minute)
           → execute-agent-run → execute-flow-node per step
```

### Agents vs Automations

| Concept | Storage | Purpose |
|---------|---------|---------|
| Agent | `agents` + `agent_versions` | Workflow definition |
| Automation | `automations` | Schedule (cron) for a published agent |
| Run | `agent_runs` + `run_steps` | Execution history |

## Integration-Aware Compiler

Before generating flows, `compile-agent-flow`:

1. Loads `organization_integrations` where `is_active = true`
2. Builds allowed node list via `_shared/agent-builder-integrations.ts`
3. Pre-checks prompt keywords (Gmail, Slack, email delivery, etc.)
4. Returns `needs_clarification` if required integration is missing
5. Streams real compile phases to Builder Chat via SSE (`stream: true`)

### Data source clarifications (DB queries)

Before compiling flows that query the database, the compiler:

1. Loads `enabled_tables` from `organization_integrations` where `integration_type = 'agent_builder_data_sources'` (configured in Agent Builder → Settings → Data Sources)
2. If the prompt mentions database/db/table/query without naming a specific enabled table → returns `needs_clarification` listing enabled tables
3. If zero tables are enabled → asks user to enable data sources first
4. Post-compile validation: every `db_query` node `config.table` must be in `enabled_tables`; invalid tables surface as clarification errors

## Manual runs & switch routing

Manual runs from Studio or `/ai-agents` pass `input_context: { mode: "report" }` by default via `trigger-flow-run`. Chat runs pass `mode: "chat"` plus `message`.

For dual-mode report+chat agents:

- Switch nodes should use `input_variable: "mode"` with `cases: { "report": "report", "chat": "chat" }`
- Outgoing edges use `condition: "report"` or `condition: "chat"`
- If `mode` is missing on manual runs, the runtime defaults to `"report"`
- If no branch edge matches, `execute-agent-run` logs a warning and tries a fallback edge

## Run output location

| Where | What |
|-------|------|
| `agent_runs` + `run_steps` tables | Persistent run history |
| Studio **Runtime** tab | Step list + **Output** panel (markdown from `report_generate` or LLM `result`) |
| Studio **Logs** tab | Terminal lines per step; completed steps include `OUTPUT: <preview>` |
| `agent-outputs` storage bucket | Large outputs (when used) |

Runtime shows an amber banner if a run completes with &lt;3 steps and the last node is a `switch` (routing stopped early).

## Workspace agents (`/ai-agents`)

Published agents with `status = published` and `visibility = workspace` appear on `/ai-agents`.

- **Run Report** — triggers `trigger-flow-run` with `mode: "report"`
- **Chat** — shown when flow has a switch with a `chat` edge; opens `BuilderAgentChatDialog` which runs with `mode: "chat"` per message

### Chat branch requirements

Dual-mode flows must fetch data on the chat path, not only on report:

```
manual_trigger → switch(mode)
  → report: db_query → openai_llm → report_generate
  → chat:   db_query → openai_llm   (no report_generate)
```

**Compiler** (`compile-agent-flow`): auto-inserts `db_query` on chat branch if missing (cloned from report-path table); validates chat path shape; standardizes chat LLM templates (`{{message}}`, `{{rows}}`).

**Runtime** (`trigger/agent-flow/chat-context.ts`): before chat LLM execution, `ensureChatContext` normalizes `message`, sets aliases (`clients`, `data`, `first_client`), compacts rows for "first" queries, auto-prefetches from the flow's first `db_query` (with `order_by` default `created_at` for `clients`), and forces chat LLM templates at runtime.

**Chat UI** passes `input_context`: `{ mode: "chat", message, session_id, chat_history }`. Shows a diagnostic hint when the LLM reply indicates missing data.

**Deploy checklist:**

| Step | Command |
|------|---------|
| Compiler | `supabase functions deploy compile-agent-flow --project-ref <project-ref>` |
| Runtime | `npx trigger.dev@latest deploy` |
| Frontend | `npm run dev` or production rebuild |
| Agent (optional) | Recompile in studio so JSON shows chat `db_query` |

**Chat troubleshooting:**

| Symptom | Fix |
|---------|-----|
| "I don't have information about the first client" | Redeploy Trigger.dev; runtime prefetch + forced chat templates fix this for existing agents |
| Chat run has only 2–3 steps (no `db_query`) | Recompile agent or rely on runtime prefetch after Trigger.dev deploy |
| Empty `rows` in LLM step input | Enable table in Agent Builder → Settings → Data Sources; verify table has rows |
| Report works, chat does not | Report path runs `db_query` in flow; chat needs Trigger.dev deploy for prefetch back-compat |

**Deploy:** compiler changes → `supabase functions deploy compile-agent-flow`; runtime changes → Trigger.dev redeploy (`execute-agent-run`, `execute-flow-node`).

Studio Design chat is for **editing the flow**; workspace chat is for **end-user interaction** with published agents.

Draft agents do not appear on `/ai-agents` until published with Workspace visibility.

### Compile status phases

| Phase | User label |
|-------|------------|
| `checking_provider` | Checking AI provider… |
| `loading_integrations` | Checking configured tools… |
| `validating_tools` | Validating tool availability… |
| `loading_context` | Loading flow context… |
| `thinking` | Thinking… |
| `designing_flow` | Designing workflow… |
| `validating_flow` | Validating flow structure… |
| `saving_version` | Saving new version… |

## Node Types & Integrations

| Integration | Node types |
|-------------|------------|
| `gmail` | `gmail_fetch_unread` |
| `slack` | `slack_notify`, `slack_fetch_messages` |
| `sendgrid` / `resend` | `email_send`, `email_output` |
| `openai` | `openai_llm` |
| `google_gemini` | `gemini_llm` |
| `anthropic` | `anthropic_llm` |
| Always available | triggers, logic, `db_query`, `report_generate`, `db_write` |

## Unread Email Summary Flow

Canonical template: `src/pages/adminpanel/automations/unreadEmailSummaryFlow.ts`

```
cron_trigger (daily 8am)
  → gmail_fetch_unread
  → condition (count > 0)
    → YES: openai_llm summarize → email_output
    → NO: report_generate
```

**Required integrations:** Gmail, OpenAI (or Gemini), SendGrid or Resend

Demo agent ID: `9cc32d7c-f6ee-4512-aa97-630c007e6c22` — recompile via Agent Builder chat after configuring integrations.

## Gmail Integration

- Edge functions: `gmail-oauth-init`, `gmail-oauth-callback`, `gmail-inbox`
- Config stored in `organization_integrations` (`integration_type: gmail`)
- Configure at `/adminpanel/integrations` (Client ID, Secret, Refresh Token)

## Slack Integration

- Edge functions: `slack-oauth-init`, `slack-oauth-callback`, `slack-test`, `slack-messages`
- Config stored in `organization_integrations` (`integration_type: slack`, field `config.bot_token`)
- Configure at `/adminpanel/integrations` → **Meeting & Collaboration** → Slack → **Add to Slack** (OAuth v2)
- OAuth redirect URL: `https://{domain}/slack-oauth-callback` (local dev: `http://localhost:8080/slack-oauth-callback`)
- Supabase secrets: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
- Bot scopes: `chat:write`, `chat:write.public`, `channels:read`, `channels:history`, `groups:history`, `im:history`
- After scope changes, **Reinstall App** in the Slack app dashboard to grant new permissions
- **Send:** `slack_notify` nodes call Slack REST `chat.postMessage` using org bot token (per-node webhook URL still supported as fallback)
- **Receive (pull):** `slack_fetch_messages` nodes call `slack-messages` edge function → `conversations.history` (not Events API)
- Example flow: `cron_trigger → slack_fetch_messages(#general) → openai_llm → slack_notify`

## Scheduling

- **Publish** with `cron_trigger` in flow → upserts `automations` row
- **Archive** → sets `automations.is_active = false`
- **Trigger.dev** `automation-scheduler` runs every minute, triggers due automations

## UI Routes

| Route | Page |
|-------|------|
| `/adminpanel/agent-builder` | Design & compile flows |
| `/adminpanel/automations` | All published scheduled automations |
| `/adminpanel/automations/logs` | Scheduled automation run logs (`trigger_type = cron` only) |
| `/adminpanel/ai-control?tab=agents-logs` | Combined Agent Builder + legacy AI agent run history |

## UI Conventions

Agent Builder uses a **scoped soft Lovable-inspired palette** via `src/pages/adminpanel/agent-builder/agentBuilderTheme.ts` (`ab` tokens). This is intentionally distinct from stark admin `bg-card` and the global `--primary` token used elsewhere in the admin panel.

**Palette traits:**
- Page canvas: warm blue-gray (`ab.canvas`), not pure white
- Cards/composer: elevated lavender-gray surfaces (`ab.surface`, `ab.surfaceElevated`) with soft shadow
- Inputs: filled soft gray-lavender (`ab.input`), not white boxes on white
- Accent: muted periwinkle (`ab.accentText`, `ab.accentBtn`, `ab.chipActive`) — not saturated platform primary
- Chat: soft panel (`ab.chatPanel`), periwinkle user bubbles (`ab.userBubble`), tinted assistant bubbles (`ab.assistantBubble`)

List and Settings pages follow the same Breadcrumb + header pattern as AI Control. The studio workspace bleeds into admin content padding with `ab.studioShell`. Do not change global `index.css` tokens when styling Agent Builder — extend `agentBuilderTheme.ts` instead.

**List page composer:** Prompt-first compact card (`composerCompact`, `promptBar`): unified input + Build bar, keyboard hint, short template labels with icons (`templateStrip` / `templateChip`); full prompt text applied on chip click. "Start from scratch" is an inline link in the card header.

**Studio compile:** `initialPrompt` from the list page is consumed **once** per navigation (`pendingInitialPrompt` cleared after first fire). Design tab uses `forceMount` so switching JSON/Logs tabs does not remount chat or re-trigger compile. `sendPrompt` uses a compile mutex to block concurrent runs.

**Draft auto-save:** Canvas/JSON edits debounce-save to `agent_versions.flow_json` on the current version (requires `agent_versions_update_admin` RLS). Header shows Saving / Draft saved status.

**Studio run state:** `useFlowRun` subscribes to `agent_runs` (realtime + 5s poll) so the header **Stop** button reverts to **Run** when status reaches `completed`, `failed`, or `cancelled`. Runtime tab uses the same `currentRun` prop from the hook.

## Intelligence Studio (Phase 6 — Future)

Planned runtime shift from rigid node walking to **agentic reasoning**:

- Observe live data (inbox, CRM, DB)
- Decide next action from configured tools only
- Act via same edge functions
- Log reasoning trace in Runtime/Logs tabs

Foundation patterns to reuse: `chief-of-staff-agent` + `agent-orchestrator.ts`.

## Key Files

| Area | Path |
|------|------|
| Compiler | `supabase/functions/compile-agent-flow/index.ts` |
| Integration mapping | `supabase/functions/_shared/agent-builder-integrations.ts` |
| Frontend mapping | `src/pages/adminpanel/agent-builder/integrationConfig.ts` |
| UI theme tokens | `src/pages/adminpanel/agent-builder/agentBuilderTheme.ts` |
| Run output helpers | `src/pages/adminpanel/agent-builder/runOutput.ts` |
| Flow capabilities | `src/pages/adminpanel/agent-builder/flowCapabilities.ts` |
| Chat context runtime | `trigger/agent-flow/chat-context.ts` |
| Workspace chat UI | `src/components/agents/BuilderAgentChatDialog.tsx` |
| Scheduler | `trigger/automation-scheduler.ts` |
| Node execution | `trigger/agent-flow/execute-node.ts` |
| Gmail inbox | `supabase/functions/gmail-inbox/index.ts` |
| Slack messages | `supabase/functions/slack-messages/index.ts` |
| Automation logs UI | `src/pages/adminpanel/automations/AutomationsLogs.tsx` |
| Agent logs UI | `src/components/ai-control/AgentRunsLogsSection.tsx` |

## MCP integration (external tools)

Agent Builder acts as an **MCP client**: registered servers expose tools that compile into `mcp_tool` flow nodes and execute at runtime via Trigger.dev.

| Component | Path |
|-----------|------|
| Registry UI | Agent Builder → Settings → **MCP Servers** |
| Edge function | `mcp-manage` (connect, sync tools, health) |
| Tables | `mcp_servers`, `mcp_server_tools` |
| Runtime | `trigger/agent-flow/mcp-client.ts` + `execute-node.ts` `mcp_tool` case |
| Compiler | Loads tool catalog into system prompt; validates `server_id` + `tool_name` |

**Setup:** Add server URL + optional auth → sync tools → describe automation using MCP tool names in Design chat.

**Deploy:** `supabase functions deploy mcp-manage`; `npx trigger.dev@latest deploy` for runtime execution.

**Node config:** `{ server_id, tool_name, arguments }` — arguments support `{{variable}}` templates from upstream steps.

