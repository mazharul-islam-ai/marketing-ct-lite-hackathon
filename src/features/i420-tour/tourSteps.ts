import type { DriveStep } from "driver.js";
import { I420_ROUTES } from "@/lib/i420Routes";
import {
  dispatchCanvasView,
  dispatchClosePublishModal,
  dispatchExpandChatPanel,
  dispatchOpenDataSourcesSubTab,
  dispatchOpenPublishModal,
  dispatchOpenSettingsTab,
  dispatchOpenStudioTab,
  dispatchSelectFirstNode,
  dispatchTourCleanup,
} from "./tourEvents";
import { tourSelector, waitForTourTarget } from "./waitForTourTarget";

export const I420_DEMO_AGENT_ID = "9cc32d7c-f6ee-4512-aa97-630c007e6c22";
export const I420_WORKSPACE_CHAT_AGENT_ID = "1a4ba421-f3cb-4501-9fe1-3fef53d10d84";

export type TourSection =
  | "full"
  | "dashboard"
  | "settings"
  | "studio"
  | "workspace"
  | "automations"
  | "debug";

export const TOUR_SECTION_START: Record<Exclude<TourSection, "full" | "debug">, number> = {
  dashboard: 0,
  settings: 5,
  studio: 11,
  workspace: 22,
  automations: 25,
};

const DEBUG_STEP_INDEX = 27;

export interface TourStepContext {
  navigate: (path: string) => void;
  markCompleted: () => void;
  prefersReducedMotion: boolean;
}

function popoverClass(): string {
  return "i420-tour-popover";
}

function baseConfig(ctx: TourStepContext) {
  return {
    animate: !ctx.prefersReducedMotion,
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    popoverClass: popoverClass(),
    allowClose: true,
    overlayColor: "hsl(30 8% 18%)",
    overlayOpacity: 0.45,
    stagePadding: 8,
    stageRadius: 8,
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Finish",
  };
}

async function goToSettings(ctx: TourStepContext, driver: { moveNext: () => void }) {
  ctx.navigate(I420_ROUTES.settings);
  try {
    await waitForTourTarget("i420-tour-settings-tabs");
  } catch {
    // continue
  }
  driver.moveNext();
}

async function goToStudio(ctx: TourStepContext, driver: { moveNext: () => void }) {
  ctx.navigate(I420_ROUTES.agent(I420_DEMO_AGENT_ID));
  try {
    await waitForTourTarget("i420-tour-builder-chat", { timeout: 12000 });
  } catch {
    ctx.navigate(I420_ROUTES.new);
    try {
      await waitForTourTarget("i420-tour-builder-chat", { timeout: 8000 });
    } catch {
      // studio may be empty
    }
  }
  dispatchOpenStudioTab("design");
  dispatchExpandChatPanel();
  driver.moveNext();
}

async function goToWorkspace(ctx: TourStepContext, driver: { moveNext: () => void }) {
  dispatchClosePublishModal();
  ctx.navigate("/ai-agents");
  try {
    await waitForTourTarget("i420-tour-workspace-agents", { timeout: 10000 });
  } catch {
    // empty list still has page anchor
  }
  driver.moveNext();
}

async function goToWorkspaceChat(ctx: TourStepContext, driver: { moveNext: () => void }) {
  ctx.navigate(`/ai-agents/${I420_WORKSPACE_CHAT_AGENT_ID}`);
  try {
    await waitForTourTarget("i420-tour-workspace-chat", { timeout: 12000 });
  } catch {
    // agent may not exist — tour continues with centered step if needed
  }
  driver.moveNext();
}

async function goToAutomations(ctx: TourStepContext, driver: { moveNext: () => void }) {
  ctx.navigate(I420_ROUTES.automations);
  try {
    await waitForTourTarget("i420-tour-automations-list");
  } catch {
    // continue
  }
  driver.moveNext();
}

async function openPublishModal(driver: { refresh: () => void; moveNext: () => void }) {
  dispatchOpenPublishModal();
  await new Promise((r) => window.setTimeout(r, 150));
  try {
    await waitForTourTarget("i420-tour-publish-visibility", { timeout: 5000 });
  } catch {
    try {
      await waitForTourTarget("i420-tour-publish-modal", { timeout: 3000 });
    } catch {
      // modal may not open without version — step still shows centered
    }
  }
  driver.refresh();
  driver.moveNext();
}

export function buildTourSteps(ctx: TourStepContext): DriveStep[] {
  return [
    // ── Phase A: Dashboard ──
    {
      popover: {
        title: "Welcome to i420 Studio",
        description:
          "Build AI agents and scheduled automations from natural language. This guided tour walks through the dashboard, settings, studio editor, workspace, automations, and troubleshooting tips.",
        popoverClass: popoverClass(),
        showButtons: ["next", "close"],
        side: "over" as const,
        align: "center" as const,
      },
    },
    {
      element: tourSelector("i420-tour-composer"),
      popover: {
        title: "Describe your workflow",
        description:
          "Type what you want in plain English — e.g. “Daily email digest at 8am” — then press Enter or Build. i420 compiles it into a runnable flow.",
        side: "bottom",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-templates"),
      popover: {
        title: "Quick-start templates",
        description:
          "Click a template chip to pre-fill the composer with proven patterns: CRM → Slack, brand mentions, client summaries, and more.",
        side: "top",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-agent-grid"),
      popover: {
        title: "Your workflows",
        description:
          "Each card opens the studio editor. Use Run for report-mode agents, Chat for conversational agents, or the menu to clone, archive, or delete.",
        side: "top",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-header-nav"),
      popover: {
        title: "Navigate i420",
        description:
          "Automations lists scheduled jobs. Settings configures models, tools, data sources, and MCP servers. New workflow opens a blank studio.",
        side: "bottom",
        popoverClass: popoverClass(),
        onNextClick: (_el, _step, { driver }) => {
          void goToSettings(ctx, driver);
        },
      },
    },

    // ── Phase B: Settings ──
    {
      element: tourSelector("i420-tour-settings-tabs"),
      onHighlightStarted: () => dispatchOpenSettingsTab("models"),
      popover: {
        title: "i420 Settings",
        description:
          "Org-wide configuration for the compiler: AI models, integration tools, MCP servers, SQL tables, vector knowledge bases, system prompt persona, and platform costs.",
        side: "bottom",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-data-sources"),
      onHighlightStarted: (_el, _step, { driver }) => {
        dispatchOpenSettingsTab("data");
        dispatchOpenDataSourcesSubTab("tables");
        requestAnimationFrame(() => driver.refresh());
      },
      popover: {
        title: "Data tables",
        description:
          "Enable SQL tables before db_query nodes can read data. Disabled tables are invisible to the compiler even if your prompt mentions them.",
        side: "top",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-kb-sources"),
      onHighlightStarted: (_el, _step, { driver }) => {
        dispatchOpenSettingsTab("data");
        dispatchOpenDataSourcesSubTab("kb");
        requestAnimationFrame(() => driver.refresh());
      },
      popover: {
        title: "Knowledge bases (KB)",
        description:
          "Vector collections backed by pgvector for semantic search. Enable company categories, brand docs, or project knowledge for future RAG nodes.",
        side: "top",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-mcp"),
      onHighlightStarted: (_el, _step, { driver }) => {
        dispatchOpenSettingsTab("mcp");
        requestAnimationFrame(() => driver.refresh());
      },
      popover: {
        title: "MCP servers",
        description:
          "Register Model Context Protocol servers so flows can call external tools via mcp_tool nodes. Keep servers active and tools synced.",
        side: "top",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-system-prompt"),
      onHighlightStarted: (_el, _step, { driver }) => {
        dispatchOpenSettingsTab("system_prompt");
        requestAnimationFrame(() => driver.refresh());
      },
      popover: {
        title: "System prompt",
        description:
          "Sets persona and tone for Design chat only — how the IDE assistant speaks while you build. Does not change compiled flow logic.",
        side: "top",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-costs"),
      onHighlightStarted: (_el, _step, { driver }) => {
        dispatchOpenSettingsTab("costs");
        requestAnimationFrame(() => driver.refresh());
      },
      popover: {
        title: "Platform costs",
        description:
          "Tracks compile-time LLM usage from i420-compile. Execution costs appear per agent run in the studio Logs tab.",
        side: "top",
        popoverClass: popoverClass(),
        onNextClick: (_el, _step, { driver }) => {
          void goToStudio(ctx, driver);
        },
      },
    },

    // ── Phase C: Studio ──
    {
      element: tourSelector("i420-tour-builder-chat"),
      onHighlightStarted: () => {
        dispatchOpenStudioTab("design");
        dispatchExpandChatPanel();
      },
      popover: {
        title: "Design chat",
        description:
          "Build mode compiles or updates flow_json from your prompts. Ask mode answers questions about your workspace without changing the canvas.",
        side: "right",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-compiler-mode"),
      popover: {
        title: "Compiler mode",
        description:
          "Single compiles in one LLM call. Multi runs intent → architecture → tasks → assembly (beta). Visible in Build mode only.",
        side: "top",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-canvas-toolbar"),
      onHighlightStarted: () => dispatchCanvasView("card"),
      popover: {
        title: "Card view",
        description:
          "The Card view shows a live preview of your agent — status, node count, and quick actions. Switch views from this toolbar.",
        side: "bottom",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-agent-card"),
      onHighlightStarted: () => {
        dispatchCanvasView("card");
        dispatchExpandChatPanel();
      },
      popover: {
        title: "Agent card preview",
        description:
          "The card summarizes your workflow: type badge, publish status, pipeline strip, and model chips. This is what teammates see at a glance.",
        side: "left",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-card-actions"),
      onHighlightStarted: () => dispatchCanvasView("card"),
      popover: {
        title: "Edit, Chat, and Run",
        description:
          "Edit opens the node editor drawer on the card. Chat launches an inline chat preview for conversational agents. Run executes report mode and shows output in the Runtime tab.",
        side: "top",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-canvas-flow"),
      onHighlightStarted: (_el, _step, { driver }) => {
        dispatchCanvasView("flow");
        requestAnimationFrame(() => driver.refresh());
      },
      popover: {
        title: "Flow view",
        description:
          "Switch to Flow to see the full node graph — triggers, fetch steps, LLM calls, and outputs connected by execution edges.",
        side: "bottom",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-flow-canvas"),
      onHighlightStarted: (_el, _step, { driver }) => {
        dispatchCanvasView("flow");
        requestAnimationFrame(() => driver.refresh());
      },
      popover: {
        title: "Flow canvas",
        description:
          "Each node is a step in your automation. Click any node to open the inspector on the right. Drag to pan; scroll to zoom.",
        side: "left",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-node-inspector"),
      onHighlightStarted: (_el, _step, { driver }) => {
        dispatchCanvasView("flow");
        dispatchSelectFirstNode();
        requestAnimationFrame(() => driver.refresh());
      },
      popover: {
        title: "Edit a node",
        description:
          "The inspector lets you rename nodes and edit config fields (prompts, filters, channels). Save applies changes to the current draft. Test runs a single node when supported.",
        side: "left",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-studio-tabs"),
      popover: {
        title: "Studio tabs",
        description:
          "Design — build and edit. Runtime — live run output. Logs — run history. Versions — rollback. JSON — raw flow_json.",
        side: "bottom",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-run-publish"),
      popover: {
        title: "Run and Publish",
        description:
          "Run tests the flow manually (output in Runtime). Publish makes the agent available to your team — click Publish to choose who can access it.",
        side: "bottom",
        popoverClass: popoverClass(),
        onNextClick: (_el, _step, { driver }) => {
          void openPublishModal(driver);
        },
      },
    },
    {
      element: tourSelector("i420-tour-publish-visibility"),
      popover: {
        title: "Publish access levels",
        description:
          "Workspace Users — appears on /ai-agents for all members.\n\nAdmin Only — visible in AI Control for admins/managers.\n\nPublic — generates a shareable link with no login required.",
        side: "left",
        popoverClass: popoverClass(),
        disableActiveInteraction: false,
        onNextClick: (_el, _step, { driver }) => {
          dispatchClosePublishModal();
          void goToWorkspace(ctx, driver);
        },
      },
    },

    // ── Phase F: Workspace ──
    {
      element: tourSelector("i420-tour-workspace-agents"),
      popover: {
        title: "AI Agents workspace",
        description:
          "Agents published with Workspace visibility appear here for every authenticated team member — not just i420 admins.",
        side: "bottom",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-workspace-agent-card"),
      popover: {
        title: "Workspace agent cards",
        description:
          "Each card shows Chat and Run Report actions based on the agent's capabilities. Chat opens a dedicated conversation page.",
        side: "top",
        popoverClass: popoverClass(),
        onNextClick: (_el, _step, { driver }) => {
          void goToWorkspaceChat(ctx, driver);
        },
      },
    },
    {
      element: tourSelector("i420-tour-workspace-chat"),
      popover: {
        title: "Chat with your agent",
        description:
          "This is the end-user chat experience. Use starter prompts or type freely — the agent runs its chat branch (fetch + LLM) on each message.",
        side: "top",
        popoverClass: popoverClass(),
        onNextClick: (_el, _step, { driver }) => {
          void goToAutomations(ctx, driver);
        },
      },
    },

    // ── Phase D: Automations ──
    {
      element: tourSelector("i420-tour-automations-list"),
      popover: {
        title: "Scheduled automations",
        description:
          "Published agents with cron triggers appear here. Pause, resume, or quick-run without opening the studio.",
        side: "top",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-automation-logs"),
      popover: {
        title: "Automation logs",
        description:
          "View scheduled run history (cron triggers only). For all runs including manual tests, use the studio Logs tab.",
        side: "left",
        popoverClass: popoverClass(),
      },
    },

    // ── Phase E: Debug guide ──
    {
      popover: {
        title: "Troubleshooting guide",
        description: [
          "Compile issues — check Settings → integrations, data sources, and MCP sync.",
          "Empty chat replies — recompile with fetch nodes; enable tables in Settings.",
          "MCP failures — Settings → MCP Servers; verify ENCRYPTION_KEY in Trigger.dev.",
          "Run failures — studio Logs + Runtime tabs for step-by-step errors.",
          "Need help anytime — click the Help button in the i420 header.",
        ].join("\n\n"),
        side: "over" as const,
        align: "center" as const,
        popoverClass: popoverClass(),
        doneBtnText: "Got it",
        onDoneClick: (_el, _step, { driver }) => {
          ctx.markCompleted();
          driver.destroy();
        },
      },
    },
  ];
}

export function getTourStartIndex(section: TourSection): number {
  if (section === "debug") return DEBUG_STEP_INDEX;
  if (section === "full" || section === "dashboard") return 0;
  return TOUR_SECTION_START[section];
}

export function getTourConfig(ctx: TourStepContext) {
  return {
    ...baseConfig(ctx),
    steps: buildTourSteps(ctx),
    onDestroyed: () => {
      dispatchTourCleanup();
    },
  };
}
