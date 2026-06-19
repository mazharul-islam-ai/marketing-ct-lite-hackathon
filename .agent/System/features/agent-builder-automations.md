# Agent Builder & Automations

Last updated: 2026-06-18

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
| `slack` | `slack_notify` |
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
| Scheduler | `trigger/automation-scheduler.ts` |
| Node execution | `trigger/agent-flow/execute-node.ts` |
| Gmail inbox | `supabase/functions/gmail-inbox/index.ts` |
| Automation logs UI | `src/pages/adminpanel/automations/AutomationsLogs.tsx` |
| Agent logs UI | `src/components/ai-control/AgentRunsLogsSection.tsx` |
