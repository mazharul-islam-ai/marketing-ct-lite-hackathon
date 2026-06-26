# i420 Studio & Automations

Last updated: 2026-06-26

## Smart IDE architecture

i420 Design chat is a **platform-integrated Smart IDE** (Cursor/Lovable-style): it compiles natural language into `flow_json` using live workspace context from Settings and Integrations Hub.

### Compiler naming (`i420-compile-*`)

| Mode | Entry edge function | Execution |
|------|---------------------|-----------|
| **Router (default)** | `i420-compile` | Reads `agent_builder_compiler.mode` → dispatches below |
| **Single-stage** | `i420-compile-single` | One LLM call via `_shared/compiler/monolith.ts` |
| **Multi-stage (beta)** | `i420-compile-multi-start` | Trigger.dev pipeline `i420-compile-multi-run` → stages 01–06 |

Legacy alias: `compile-agent-flow` proxies to `i420-compile-single`.

### Runtime naming (`i420-run-*`)

| Role | New name | Legacy alias |
|------|----------|--------------|
| Start run (edge) | `i420-run-start` | `trigger-flow-run` |
| Execute flow (Trigger) | `i420-run-execute` | `execute-agent-run` |

```
Settings (persona, models, tools, MCP, data sources, compiler mode)
Integrations Hub (Slack, Gmail, …)
        ↓
i420-compile (router)
  ├── single → i420-compile-single (monolith LLM)
  └── multi_stage → i420-compile-multi-start → Trigger.dev:
        01 extract-intent → 02 plan-architecture → 03 decompose-tasks
        → 04 assemble-flow → 05 validate-flow → 06 repair-flow (loop)
        ↓
Design chat (user_message) + canvas (flow_json) + compile_artifacts
        ↓
i420-run-start → i420-run-execute (fail-fast on failed nodes)
```

### Persona vs kernel

| Layer | Source | Editable? |
|-------|--------|-----------|
| Persona / tone | Settings → System Prompt (`agent_builder_prompts`) | Yes — v2.1 persona-only prompt seeded in `20260625110000_i420_persona_v2_1.sql` |
| Node catalog, config guidelines, structural rules, compile protocol | `_shared/compiler/monolith.ts` + `_shared/agent-builder-integrations.ts` | Code only |
| Live workspace facts | Integrations, MCP catalog, enabled tables (always-on toolchain) | Settings tabs |

Legacy v1 system prompts that embed JSON-only structural rules are **stripped** by `sanitizePersonaPrompt()` before compile.

### Compiler kernel depth

The code-owned kernel (not the Settings prompt) injects v1-grade structural guidance:

- **`buildNodeCatalogBlock()`** — categorized Triggers / Logic / AI / Tools / Outputs, filtered to allowed workspace types
- **`buildConfigGuidelinesBlock()`** — per-type config examples with `{{variable}}` convention
- **`buildFlowShapeExampleBlock()`** — full Smart IDE wrapper example with id, label, config, position, edges
- **`buildActionModeBlock()`** — generate / improve / add_tool instructions wired to compile `action` param
- **Structural rules** — n1 trigger IDs, max 20 nodes, condition YES/NO edges, loop_back, canvas positions (x+=220)
- **`buildWorkspaceToolchainBlock()`** — integrations, enabled tables, MCP summary (always visible)

### Compile response protocol

The compiler LLM returns:

```json
{
  "user_message": "Natural language shown in Design chat",
  "clarification_needed": false,
  "flow": { "trigger": {}, "steps": [], "edges": [] }
}
```

- **Clarify:** `clarification_needed: true`, `flow: null`, one scoped question in `user_message`
- **Success:** `user_message` summarizes what was built + setup hints (e.g. invite Slack bot)
- **Legacy:** bare `{ trigger, steps, edges }` still accepted; server generates summary via `buildFlowSummaryMessage()`

Design chat message types: `clarification` | `success` | `error` | `hint` (see `ChatMessage.message_type`).

### Decision engine (when to ask vs build)

Implemented in `_shared/agent-builder-integrations.ts`:

- **Workflow-type scoping** — Slack/Gmail flows never ask about DB tables
- **Always-on workspace toolchain** — integrations, enabled tables, and MCP tools are always injected (compact inventory); visibility does not force usage
- **Defaults** — dashboard for UI output; Asia/Dhaka 09:00 → cron `0 3 * * *` UTC
- **Exclusions** — "no DB" strips `db_query`/`db_write` via `normalizeFlowForIntent()` (tables stay visible in toolchain)
- **Hybrid prompts** — `workflowHints[]` collects all matching intents (e.g. slack + hubspot) so DB is not stripped incorrectly
- **Validation → human question** — `formatValidationAsQuestion()` instead of raw errors
- **Anti-hallucination** — LLM steps after fetch nodes get "never invent data" system prompt guard

### Runtime fail-fast

`i420-run-execute` aborts when any node returns `status: "failed"` (previously continued and allowed fake LLM output).

Structured Slack errors: `supabase/functions/_shared/runtime-errors.ts` + `trigger/agent-flow/runtime-errors.ts` map `not_in_channel` → actionable hint.

Runtime tab shows a red **Run failed** banner with step error before any output panel.

### Cron timezone

Automations scheduler (`computeNextRunAt`) interprets cron in **UTC**. Compiler maps Asia/Dhaka 09:00 → `0 3 * * *` and sets `config.timezone_label` on the trigger node for honest UI labels.

---

**i420 Studio** (`/i420`) is a first-class super-admin product for building agents and automations from natural language. It was formerly known as Agent Builder (`/adminpanel/agent-builder` — legacy URLs redirect to `/i420`).

The AI compiler (`i420-compile` / `i420-compile-single`) produces validated `flow_json` graphs stored in `agent_versions` with optional `compile_artifacts` (spec, blueprint, tasks).

**Automations** (`/i420/automations`) are published agents with active schedules in the `automations` table, executed by Trigger.dev (`automation-scheduler` + `i420-run-execute`).

## Architecture

```
User prompt → i420-compile (single or multi-stage + SSE status)
           → agent_versions.flow_json + compile_artifacts
           → Publish → automations table (if cron_trigger)
           → automation-scheduler (every minute)
           → i420-run-execute → execute-flow-node per step
```

### Agents vs Automations

| Concept | Storage | Purpose |
|---------|---------|---------|
| Agent | `agents` + `agent_versions` | Workflow definition |
| Automation | `automations` | Schedule (cron) for a published agent |
| Run | `agent_runs` + `run_steps` | Execution history |

## Integration-Aware Compiler

Before generating flows, `i420-compile-single` / multi-stage pipeline:

1. Loads `organization_integrations` where `is_active = true`
2. Builds allowed node list via `_shared/agent-builder-integrations.ts`
3. Injects CONFIGURED / NOT CONFIGURED integrations into the compiler kernel so the LLM can set `clarification_needed` when a flow truly requires a missing integration
4. Post-compile validation rejects invalid node types, tables, and MCP references
5. Streams real compile phases to Builder Chat via SSE (`stream: true`)

Missing integrations are **not** blocked by regex pre-checks on prompt keywords. The LLM decides when Slack/Gmail/ActiveCollab/etc. are actually required for the workflow (e.g. "ActiveCollab" in Slack message text does not require the ActiveCollab integration).

### Data source clarifications (DB queries)

Enabled tables from Settings → Data Sources are always listed in the **WORKSPACE TOOLCHAIN** block so the compiler can pick the right table (including hybrid flows like Slack + deals). Slack/Gmail-only flows still omit `db_query` via CLARIFICATION PRINCIPLES and `normalizeFlowForIntent()`. When the user says "no database", tables remain visible but RESOLVED CONTEXT forbids `db_query`/`db_write`.

When DB access is required:

1. Loads `enabled_tables` from `organization_integrations` where `integration_type = 'agent_builder_data_sources'`
2. Post-compile validation: every `db_query` node `config.table` must be in `enabled_tables`
3. Validation failures are rewritten as conversational questions via `formatValidationAsQuestion()`

## Unified Chat + Run execution model

Chat and Run are **parallel execution modes** over the same toolchain — not separate agent types. Both modes support `db_query`, `mcp_tool`, `slack_fetch_messages`, `gmail_fetch_unread`, `api_call`, all LLM providers, and outputs like `dashboard_write`.

| Mode | Trigger | `input_context` | Typical output |
|------|---------|-----------------|----------------|
| **Report** | Run / Run Report | `{ mode: "report" }` | `report_generate`, dashboard panel |
| **Chat** | Chat (inline or dialog) | `{ mode: "chat", message, session_id, chat_history }` | Conversational LLM reply + optional dashboard |

**Capability detection** (`getExecutionCapabilities` in `flowCapabilities.ts`):

| Signal | `hasChat` | `hasReport` |
|--------|-----------|-------------|
| `switch` + edge `condition: "chat"` | yes | — |
| `manual_trigger` + LLM + no `report_generate` + no cron | yes (chat-only) | — |
| `switch` + edge `condition: "report"` or `report_generate` node | — | yes |
| `cron_trigger` | — | yes (Run only) |

## Manual runs & switch routing

Manual runs from Studio or `/ai-agents` pass `input_context: { mode: "report" }` via `trigger-flow-run`. Chat runs pass `mode: "chat"` plus `message`.

For dual-mode report+chat agents:

- Switch nodes should use `input_variable: "mode"` with `cases: { "report": "report", "chat": "chat" }`
- Outgoing edges use `condition: "report"` or `condition: "chat"`
- If `mode` is missing on manual runs, the runtime defaults to `"report"`
- If no branch edge matches, `execute-agent-run` logs a warning and tries a fallback edge

### Chat branch parity (all tool types)

Dual-mode flows must mirror fetch/tool nodes on the chat path — not only `db_query`:

```
manual_trigger → switch(mode)
  → report: [db_query | mcp_tool | slack | gmail | api] → LLM → report_generate
  → chat:   [same fetch/tool nodes] → LLM ({{message}} + upstream data) → optional dashboard_write
```

Chat-only agents use a linear flow (no mode switch): `manual_trigger → fetch/tools → LLM → dashboard_write`.

**Compiler** (`i420-compile-single` / `_shared/compiler/monolith.ts` → `normalizeChatBranch`): clones missing fetch/tool nodes from report branch onto chat branch for `db_query`, `mcp_tool`, `slack_fetch_messages`, `gmail_fetch_unread`, `api_call`; standardizes chat LLM templates when `{{message}}` is absent.

**Runtime** (`trigger/agent-flow/chat-context.ts`, `execute-node.ts`):

- Preserves configured LLM prompts in chat mode when they include `{{message}}` or node-scoped refs (`{{nX.result}}`)
- Falls back to legacy `CHAT_LLM_PROMPT` only for generic prompts
- `ensureDataInLlmPrompt` injects Slack, Gmail, DB rows, and MCP/API results into chat prompts
- `ensureChatContext` prefetches `db_query` when present; MCP/Slack/Gmail/API flows use merged execution context

### Studio inline chat preview

In i420 studio (`/i420/:agentId`), chat-capable agents show **Chat** on the agent card and header (not hardcoded Run):

| Capability | Card / header buttons |
|------------|----------------------|
| Chat-only | **Chat** (inline overlay on card) |
| Dual-mode | **Chat** + **Run Report** |
| Report-only / cron | **Run** |

Components: `AgentChatPanel` (shared), `useAgentChat`, `AgentCard` inline overlay, `AgentBuilderStudio` header mirrors card.

Design chat (left panel) is still for **compiling flows** — not agent execution.

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

- **Run Report** — when `hasReport`; triggers `trigger-flow-run` with `mode: "report"`
- **Chat** — when `hasChat`; opens `BuilderAgentChatDialog` (uses shared `AgentChatPanel`) with `mode: "chat"` per message
- Chat-only agents show **Chat** only; dual-mode shows both buttons

### Chat branch requirements

See **Unified Chat + Run execution model** above. Dual-mode flows must fetch data on the chat path using the same tool types as report — DB, MCP, Slack, Gmail, or API.

**Chat UI** passes `input_context`: `{ mode: "chat", message, session_id, chat_history }`. Tool-agnostic diagnostics in `agentChatDiagnostics.ts` hint when fetch steps fail or return empty data.

**Deploy checklist:**

| Step | Command |
|------|---------|
| Compiler | `supabase functions deploy i420-compile i420-compile-single i420-compile-multi-start` |
| Multi stages | `npx trigger.dev@latest deploy` |
| Runtime | `supabase functions deploy i420-run-start` + Trigger redeploy |
| Runtime | `npx trigger.dev@latest deploy` |
| Frontend | `npm run dev` or production rebuild |
| Agent (optional) | Recompile in studio so JSON shows chat `db_query` |

**Chat troubleshooting:**

| Symptom | Fix |
|---------|-----|
| "I don't have information about the first client" | Redeploy Trigger.dev; runtime prefetch + forced chat templates fix this for existing agents |
| Chat run has only 2–3 steps (no `db_query`) | Recompile agent or rely on runtime prefetch after Trigger.dev deploy |
| Empty `rows` in LLM step input | Enable table in i420 Studio → Settings → Data Sources; verify table has rows |
| Report works, chat does not | Report path runs `db_query` in flow; chat needs Trigger.dev deploy for prefetch back-compat |

**Deploy:** compiler → `supabase functions deploy i420-compile i420-compile-single i420-compile-multi-start`; multi-stage → `npx trigger.dev@latest deploy`; runtime → `i420-run-start` + `i420-run-execute`.

Studio Design chat is for **editing the flow**; workspace chat is for **end-user interaction** with published agents.

Draft agents do not appear on `/ai-agents` until published with Workspace visibility.

## Agent lifecycle (status transitions)

Workflow cards on `/i420` and the studio header 3-dot menu share **`useAgentLifecycle`** (`src/pages/adminpanel/agent-builder/hooks/useAgentLifecycle.ts`).

| Current status | Menu action | Effect |
|----------------|-------------|--------|
| **published** | Move to draft | Unpublish — hidden from `/ai-agents`, public link invalidated, scheduler paused |
| **draft** | Archive | Soft-hide — appears under Archived filter only |
| **archived** | Delete permanently | Hard delete (super admin RLS); cascades versions, runs, automations |

**Published cards show only “Move to draft”** (no direct Archive). Unpublish first, then archive from draft.

**Unpublish** sets `agents.status = draft`, `visibility = admin_only`, rotates `public_token` (column is NOT NULL), and sets `automations.is_active = false`. Public and workspace access are blocked by status/visibility even before token rotation.

**Archive** sets `agents.status = archived` and pauses automations.

**Delete** removes the `agents` row (CASCADE). Requires super admin per `agents_delete_admin` RLS.

Lifecycle actions invalidate React Query keys `builder-agents`, `ai-agents`, and `i420-dashboard-stats` so `/ai-agents` and the dashboard hero refresh without a full reload.

Confirm dialogs explain side effects before unpublish, archive, or delete. Archived agents cannot Run or Publish from the studio.

### Compile status phases

| Phase | User label |
|-------|------------|
| `checking_provider` | Checking AI provider… |
| `loading_integrations` | Checking configured tools… |
| `loading_context` | Loading flow context… |
| `extracting_intent` | Understanding requirements… (multi) |
| `planning_architecture` | Planning workflow structure… (multi) |
| `decomposing_tasks` | Breaking into steps… (multi) |
| `assembling_flow` | Building workflow… (multi) |
| `thinking` | Thinking… (single) |
| `designing_flow` | Designing workflow… (single) |
| `validating_flow` | Validating flow structure… |
| `repairing_flow` | Fixing validation issues… (multi) |
| `saving_version` | Saving new version… |

Multi-stage jobs also update `compile_jobs.current_stage` for realtime polling.

### Compiler mode toggle

Settings → AI Models → **Compiler pipeline** switch (`agent_builder_compiler` integration config).

Default: `single`. Enable `multi_stage` for staged Trigger.dev pipeline.

## Key Files

| Area | Path |
|------|------|
| Compile router | `supabase/functions/i420-compile/index.ts` |
| Single compile | `supabase/functions/i420-compile-single/index.ts` |
| Multi compile entry | `supabase/functions/i420-compile-multi-start/index.ts` |
| Shared compiler | `supabase/functions/_shared/compiler/*` |
| Multi Trigger tasks | `trigger/i420-compile/multi-*.ts` |
| Legacy compile alias | `supabase/functions/compile-agent-flow/index.ts` (proxy) |
| Run start | `supabase/functions/i420-run-start/index.ts` |
| Run execute | `trigger/agent-flow/execute-agent-run.ts` (`i420-run-execute`) |

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

Demo agent ID: `9cc32d7c-f6ee-4512-aa97-630c007e6c22` — recompile via i420 Studio chat after configuring integrations.

## Gmail Integration

- Edge functions: `gmail-oauth-init`, `gmail-oauth-callback`, `gmail-inbox`
- Config stored in `organization_integrations` (`integration_type: gmail`)
- Configure at `/adminpanel/integrations` (Client ID, Secret, Refresh Token)

## Slack Integration

- Edge functions: `slack-oauth-init`, `slack-oauth-callback`, `slack-test`, `slack-messages`
- Config stored in `organization_integrations` (`integration_type: slack`): `client_id`, `client_secret`, and after OAuth `bot_token`
- Configure at `/adminpanel/integrations` → **Meeting & Collaboration** → Slack:
  1. Enter **Client ID** and **Client Secret** from your Slack app (Basic Information)
  2. Click **Save Credentials**
  3. Click **Add to Slack** to complete OAuth v2 install
- OAuth redirect URL: `https://{domain}/slack-oauth-callback` (local dev: `http://localhost:8080/slack-oauth-callback`)
- Optional ops fallback: Supabase secrets `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` (used only if UI credentials are not saved)
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
| `/i420` | Agent list + prompt composer + 3D canvas |
| `/i420/new` | Studio editor (new workflow) |
| `/i420/:agentId` | Studio editor |
| `/i420/settings` | Models, tools, MCP, data sources, system prompt, **platform costs** |
| `/i420/automations` | All published scheduled automations |
| `/i420/automations/logs` | Scheduled automation run logs (`trigger_type = cron` only) |
| `/adminpanel/ai-control?tab=agents-logs` | Combined i420 Studio + legacy AI agent run history |

Legacy `/adminpanel/agent-builder/*` and `/adminpanel/automations/*` URLs redirect to the matching `/i420/*` path.

Super admins also reach i420 Studio from the root sidebar (**i420 Studio** button above Admin Panel) and the dashboard hero on `/`.

## UI Conventions

i420 Studio uses a **Claude-inspired warm cream + terracotta palette** via `src/pages/adminpanel/agent-builder/agentBuilderTheme.ts` (`ab` tokens). Brand copy lives in `i420Brand.ts`; route constants in `src/lib/i420Routes.ts`. Layout chrome is `src/layouts/I420StudioLayout.tsx` (standalone, not AdminLayout). Headings use **Source Serif 4** scoped to the i420 layout; body text uses Inter.

**Palette traits:**
- Page canvas: warm cream (`ab.pageBg` / `ab.canvas`, ~`hsl(40 33% 97%)`), not cold lavender-gray
- Cards/composer: warm white surfaces (`ab.surface`, `ab.surfaceElevated`) with soft stone borders and neutral shadows
- Inputs: white fill with stone border (`ab.input`) and terracotta focus ring
- Accent: terracotta (`ab.accentText`, `ab.accentBtn`, `ab.chipActive`, ~`hsl(18 52% 52%)`) — minimal gradients
- Chat: warm panel (`ab.chatPanel`), tan user bubbles (`ab.userBubble`), white assistant cards (`ab.assistantBubble`)
- 3D/canvas: aligned via `three/i4203dTheme.ts` and warm React Flow node colors in `AgentFlowCanvas.tsx`

List and Settings pages use breadcrumb + header inside `I420StudioLayout`. The studio editor (`/i420/new`, `/i420/:agentId`) renders full-screen without layout chrome. Do not change global `index.css` tokens when styling i420 Studio — extend `agentBuilderTheme.ts` instead.

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
| Compiler | `supabase/functions/i420-compile-single/index.ts` + `_shared/compiler/monolith.ts` |
| Integration mapping | `supabase/functions/_shared/agent-builder-integrations.ts` |
| Frontend mapping | `src/pages/adminpanel/agent-builder/integrationConfig.ts` |
| UI theme tokens | `src/pages/adminpanel/agent-builder/agentBuilderTheme.ts` |
| Lifecycle mutations | `src/pages/adminpanel/agent-builder/hooks/useAgentLifecycle.ts` |
| Run output helpers | `src/pages/adminpanel/agent-builder/runOutput.ts` |
| Flow capabilities | `src/pages/adminpanel/agent-builder/flowCapabilities.ts` |
| Chat context runtime | `trigger/agent-flow/chat-context.ts` |
| Agent chat panel (shared) | `src/components/agents/AgentChatPanel.tsx` |
| Agent chat hook | `src/components/agents/useAgentChat.ts` |
| Chat diagnostics | `src/components/agents/agentChatDiagnostics.ts` |
| Workspace chat dialog | `src/components/agents/BuilderAgentChatDialog.tsx` |
| Scheduler | `trigger/automation-scheduler.ts` |
| Node execution | `trigger/agent-flow/execute-node.ts` |
| Gmail inbox | `supabase/functions/gmail-inbox/index.ts` |
| Slack messages | `supabase/functions/slack-messages/index.ts` |
| Automation logs UI | `src/pages/adminpanel/automations/AutomationsLogs.tsx` |
| Agent logs UI | `src/components/ai-control/AgentRunsLogsSection.tsx` |

## MCP integration (external tools)

i420 Studio acts as an **MCP client**: registered servers expose tools that compile into `mcp_tool` flow nodes and execute at runtime via Trigger.dev.

| Component | Path |
|-----------|------|
| Registry UI | i420 Studio → Settings → **MCP Servers** |
| Edge function | `mcp-manage` (connect, sync tools, health) |
| Tables | `mcp_servers`, `mcp_server_tools` |
| Runtime | `trigger/agent-flow/mcp-client.ts` + `execute-node.ts` `mcp_tool` case |
| Compiler | Loads tool catalog into system prompt; validates `server_id` + `tool_name` |

**Setup:** Add server URL + optional auth → sync tools → describe automation using MCP tool names in Design chat.

**Deploy:** `supabase functions deploy mcp-manage`; `npx trigger.dev@latest deploy` for runtime execution.

**Secrets:** MCP server auth tokens are encrypted when saved via `mcp-manage` and decrypted at runtime in Trigger.dev. Set `ENCRYPTION_KEY` in **both** places with the **same value**:
- Supabase Dashboard → Edge Functions → Secrets (`ENCRYPTION_KEY`)
- Trigger.dev project `proj_mqhzfjulsoqmhdykfkdm` → Environment Variables → Production (and Staging)
- Local: add `ENCRYPTION_KEY` to `.env`, then `npx trigger.dev@latest deploy` (synced via `syncEnvVars` in `trigger.config.ts`)

If you rotate the key, re-save MCP server credentials in i420 Settings → MCP Servers.

**Node config:** `{ server_id, tool_name, arguments }` — arguments support `{{variable}}` templates from upstream steps.

**Test server:** Free Cloudflare Worker at `examples/mcp-test-server/` (authless, tools `echo` + `get_client_sample`). Deploy with `npm run deploy` in that folder, then use **Test connection** in MCP Servers settings before **Connect & sync tools**.

## Platform costs vs execution costs

Two separate cost surfaces:

| Cost type | What it tracks | Where to view |
|-----------|----------------|---------------|
| **Platform** | Design chat / `i420-compile` LLM usage (+ future Settings AI) | `/i420/settings` → **Costs** tab |
| **Execution** | Agent runs and cron automations (`agent_runs`, `run_steps`) | Agent list badges, Runtime, Logs, Automations logs |

Platform usage is stored in `i420_platform_usage` (logged by `i420-compile-single` and multi-stage tasks using `cost-calculator.ts`). Execution costs are **not** duplicated on the Costs tab.

