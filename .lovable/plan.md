## Goal

Replace the "Agent ... is not available yet" placeholder with a working **generic agent runner** so every agent registered in the `ai_agents` table (including `brand-voice-analyst` and ~10 others) can be opened and executed from AI Control.

## Approach

Build one reusable React panel — `GenericAgentRunnerPanel` — that:

1. Loads the agent record from `ai_agents` by slug (name, description, system_prompt, config).
2. Shows the agent name + description as a header.
3. Provides:
   - A textarea for the user's input/prompt.
   - Optional brand selector (only shown if the agent's config flags it as brand-aware — e.g. `brand-voice-analyst`).
   - A "Run Agent" button.
4. Calls the existing `run-ai-agent` edge function with `{ agent_id, input, brand_id? }`.
5. Streams or displays the result with markdown rendering (`react-markdown`, already used elsewhere).
6. Shows loading, error, and empty states. Surfaces 402/429 errors as toasts.
7. Logs the run to `ai_agent_runs` (already handled inside `run-ai-agent`).

## Wiring

- `AdminAgentRunPage.tsx`: replace the fallback `<Card>` block with `<GenericAgentRunnerPanel slug={effectiveAgentSlug} />`. Keep the existing custom panels for the 12 mapped agents — they stay specialized.
- No DB changes. No edge function changes (the `run-ai-agent` schema fix from the previous step already landed).

## Files

- **New**: `src/components/agents/GenericAgentRunnerPanel.tsx`
- **Edit**: `src/pages/adminpanel/ai-control/AdminAgentRunPage.tsx` — swap the fallback card for the new panel.

## Out of scope

- Custom inputs per agent (e.g. dedicated competitor URL field for `competitor-research`). Generic textarea handles all cases for now; specialized panels can be added later one by one.
- Hiding agents from the listing — every agent is now runnable, so nothing to hide.
