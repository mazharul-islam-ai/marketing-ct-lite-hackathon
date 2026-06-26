import type { DriveStep } from "driver.js";
import { I420_ROUTES } from "@/lib/i420Routes";
import {
  dispatchOpenSettingsTab,
  dispatchOpenStudioTab,
} from "./tourEvents";
import { tourSelector, waitForTourTarget } from "./waitForTourTarget";

export const I420_DEMO_AGENT_ID = "9cc32d7c-f6ee-4512-aa97-630c007e6c22";

export const I420_TOUR_SET_CANVAS_VIEW = "i420-tour:set-canvas-view";

export type TourSection = "full" | "dashboard" | "settings" | "studio" | "automations" | "debug";

export const TOUR_SECTION_START: Record<Exclude<TourSection, "full" | "debug">, number> = {
  dashboard: 0,
  settings: 5,
  studio: 11,
  automations: 18,
};

const DEBUG_STEP_INDEX = 20;

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
    // continue — step may still render centered
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
      // studio may be empty — tour continues
    }
  }
  dispatchOpenStudioTab("design");
  driver.moveNext();
}

async function goToAutomations(ctx: TourStepContext, driver: { moveNext: () => void }) {
  ctx.navigate(I420_ROUTES.automations);
  try {
    await waitForTourTarget("i420-tour-automations-list");
  } catch {
    // empty list still has anchor on container
  }
  driver.moveNext();
}

function dispatchCanvasView(mode: "card" | "flow" | "compare") {
  window.dispatchEvent(
    new CustomEvent(I420_TOUR_SET_CANVAS_VIEW, { detail: { mode } }),
  );
}

export function buildTourSteps(ctx: TourStepContext): DriveStep[] {
  return [
    // ── Phase A: Dashboard ──
    {
      popover: {
        title: "Welcome to i420 Studio",
        description:
          "Build AI agents and scheduled automations from natural language. This guided tour walks through the dashboard, settings, studio editor, automations, and troubleshooting tips.",
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
          "Org-wide configuration for the compiler: AI models, integration tools, MCP servers, database tables, system prompt persona, and platform costs.",
        side: "bottom",
        popoverClass: popoverClass(),
      },
    },
    {
      element: tourSelector("i420-tour-data-sources"),
      onHighlightStarted: (_el, _step, { driver }) => {
        dispatchOpenSettingsTab("data");
        requestAnimationFrame(() => driver.refresh());
      },
      popover: {
        title: "Data sources",
        description:
          "Enable tables before db_query nodes can read data. Disabled tables are invisible to the compiler even if your prompt mentions them.",
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
      onHighlightStarted: () => dispatchOpenStudioTab("design"),
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
        title: "Canvas views",
        description:
          "Card shows a summary preview. Flow reveals the node graph. Compare highlights changes after a recompile.",
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
          "Nodes represent steps (fetch, LLM, send). Click a node to inspect or edit. Edges show execution order.",
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
        title: "Run and publish",
        description:
          "Run tests the flow manually. Publish exposes the agent on /ai-agents or activates a cron schedule for automations.",
        side: "bottom",
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
          "Need help anytime — click the Help button in the header.",
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
      dispatchOpenStudioTab("design");
      dispatchCanvasView("card");
    },
  };
}
