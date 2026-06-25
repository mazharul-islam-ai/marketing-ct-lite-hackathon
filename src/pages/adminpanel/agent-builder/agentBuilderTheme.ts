/** Claude-inspired warm cream + terracotta palette for i420 (scoped, not global) */

export const ab = {
  page: "space-y-6",
  pageBg: "bg-[hsl(40_33%_97%)]",
  canvas: "bg-[hsl(40_33%_97%)]",
  surface: "bg-[hsl(40_25%_99%)] border-[hsl(35_15%_88%)]",
  surfaceElevated:
    "bg-[hsl(40_25%_99%)] border-[hsl(35_15%_88%)] shadow-[0_1px_3px_hsl(30_20%_20%/0.06)]",
  border: "border-[hsl(35_15%_88%)]",
  borderSoft: "border-[hsl(35_15%_88%)]",
  borderSubtle: "border-[hsl(40_12%_92%)]",
  input:
    "bg-[hsl(40_25%_99%)] border-[hsl(35_15%_88%)] focus-visible:ring-[hsl(18_52%_52%/0.25)] focus-visible:ring-offset-0",
  accentText: "text-[hsl(18_52%_52%)]",
  accentBg: "bg-[hsl(18_52%_52%)]",
  accentBtn: "bg-[hsl(18_52%_52%)] hover:bg-[hsl(18_52%_46%)] text-white border-0",
  accentSoft:
    "bg-[hsl(18_40%_94%)] text-[hsl(18_45%_38%)] border-[hsl(18_30%_88%)]",
  accentMuted: "bg-[hsl(18_35%_95%)]",
  userBubble: "bg-[hsl(35_30%_92%)] text-[hsl(30_8%_18%)] border border-[hsl(35_15%_88%)]",
  assistantBubble:
    "bg-[hsl(40_25%_99%)] text-[hsl(30_8%_18%)] border-[hsl(35_15%_88%)]",
  chip:
    "bg-[hsl(40_20%_96%)] border-[hsl(35_15%_88%)] text-[hsl(30_6%_45%)] hover:border-[hsl(18_30%_80%)] hover:text-[hsl(18_45%_38%)]",
  chipActive: "bg-[hsl(18_40%_94%)] text-[hsl(18_45%_38%)] border-[hsl(18_30%_88%)]",
  composer: "rounded-2xl border p-5",
  composerCompact: "rounded-2xl border p-3.5",
  promptBar: "rounded-xl border flex items-end gap-2 p-2",
  templateStrip:
    "flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] sm:[mask-image:none] sm:flex-wrap",
  templateChip: "text-[11px] px-2.5 py-1 rounded-lg border shrink-0 transition-all duration-150",
  chatPanel: "bg-[hsl(40_25%_99%)] border-[hsl(35_15%_88%)]",
  chatHeader: "bg-[hsl(40_20%_97%)] border-[hsl(35_15%_88%)]",
  agentCard:
    "bg-[hsl(40_25%_99%)] border-[hsl(35_15%_88%)] shadow-[0_1px_3px_hsl(30_20%_20%/0.05)] hover:border-[hsl(18_30%_80%)] hover:shadow-[0_2px_8px_hsl(30_20%_20%/0.08)]",
  studioShell:
    "flex flex-col h-screen min-h-0 bg-[hsl(40_33%_97%)] overflow-hidden",
  studioHeader:
    "flex items-center gap-2 px-4 h-12 border-b border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] shrink-0",
  studioTabs: "border-b border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] px-4 shrink-0",
  filterActive: "bg-[hsl(18_52%_52%)] text-white",
  filterInactive:
    "bg-[hsl(40_25%_99%)] border border-[hsl(35_15%_88%)] text-[hsl(30_6%_45%)] hover:border-[hsl(18_30%_80%)] hover:text-[hsl(18_45%_38%)]",
  emptyState: "border border-dashed border-[hsl(35_15%_88%)] rounded-xl",
  toolbar: "border-b border-[hsl(35_15%_88%)] bg-[hsl(40_20%_97%)]",
  logArea: "bg-[hsl(40_20%_96%)]",
  textMuted: "text-[hsl(30_6%_45%)]",
  textForeground: "text-[hsl(30_8%_18%)]",
  fontHeading: "font-['Source_Serif_4',serif]",
  fontBody: "font-['Inter',sans-serif]",
  navActive: "bg-[hsl(18_35%_95%)] text-[hsl(18_45%_38%)]",
  tabActive: "data-[state=active]:bg-[hsl(18_35%_95%)] data-[state=active]:text-[hsl(18_45%_38%)] data-[state=active]:shadow-none",
  focusRing: "focus-visible:ring-[hsl(18_52%_52%/0.25)]",

  // Chart colors (Recharts)
  chartGrid: "hsl(35, 15%, 88%)",
  chartAxis: "hsl(30, 6%, 45%)",
  chartLine: "hsl(18, 52%, 52%)",
  chartBar: "hsl(18, 52%, 52%)",

  // ── Card view tokens ──────────────────────────────────────────────────────

  /** Warm terracotta header band for agent cards */
  agentCardHeader: "bg-[hsl(18_45%_94%)] border-b border-[hsl(18_30%_88%)]",
  /** Warm stone header band for automation cards */
  automationCardHeader: "bg-[hsl(40_20%_96%)] border-b border-[hsl(35_15%_88%)]",
  /** Card shell — centered floating card on the canvas */
  cardShell:
    "bg-[hsl(40_25%_99%)] rounded-2xl border border-[hsl(35_15%_88%)] shadow-[0_8px_32px_hsl(30_20%_20%/0.08),0_2px_8px_hsl(30_20%_20%/0.04)]",
  /** Fixed pixel grid for agent/automation artifact cards */
  cardWidth: "w-full max-w-[520px]",
  cardHeader: "min-h-[76px] px-5 pt-5 pb-4",
  cardMetaStrip:
    "h-8 px-5 flex items-center border-b border-[hsl(35_15%_88%/0.6)] text-[11px] shrink-0",
  cardBody: "px-5 py-4 space-y-3",
  cardModelsRow: "min-h-[44px]",
  cardStatsRow: "min-h-[20px] text-[11px] text-slate-400",
  cardFooter:
    "h-14 px-5 flex items-center justify-between border-t border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] shrink-0",
  cardTypePill:
    "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[hsl(40_20%_96%)] border-[hsl(35_15%_88%)] text-[hsl(30_6%_45%)]",
  /** Running glow ring around card */
  cardRunningGlow:
    "ring-2 ring-offset-2 ring-[hsl(18_52%_52%)] shadow-[0_0_24px_hsl(18_52%_52%/0.25)]",
  /** Subtle compiling border — quiet "being edited" affordance (no ring pulse) */
  cardCompilingShimmer: "animate-[compile-border_2.5s_ease-in-out_infinite]",
  cardCompilingShimmerStatic: "shadow-[0_0_0_1px_hsl(18_52%_52%/0.25)]",
  cardCompilingShimmerAuto: "animate-[compile-border-auto_2.5s_ease-in-out_infinite]",
  cardCompilingShimmerAutoStatic: "shadow-[0_0_0_1px_hsl(18_45%_48%/0.22)]",
  /** Skeleton bars for stats row during compile */
  skeletonBar: "h-3 rounded bg-[hsl(35_15%_88%)] animate-pulse",
  /** Brief flash after successful compile */
  cardRevealFlash:
    "ring-2 ring-offset-2 ring-emerald-400 shadow-[0_0_20px_hsl(152_60%_45%/0.3)]",
  /** Running glow ring for automation */
  cardRunningGlowAuto:
    "ring-2 ring-offset-2 ring-[hsl(30_15%_55%)] shadow-[0_0_24px_hsl(30_15%_55%/0.2)]",
  /** Toolbar compile indicator */
  compileToolbarPill: "text-[10px] font-medium text-[hsl(18_52%_52%)]",
  /** Compare diff colors */
  diffAdded: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
  diffRemoved: "border-red-200 bg-red-50/80 text-red-800",
  diffChanged: "border-amber-200 bg-amber-50/80 text-amber-900",
  diffUnchanged: "border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] text-[hsl(30_6%_45%)]",
  /** Compile overlay on flow canvas */
  canvasCompilingOverlay:
    "absolute inset-0 pointer-events-none z-10 bg-[hsl(18_52%_52%/0.05)] animate-pulse",
  /** Subtle node type chip on card body */
  nodeChip:
    "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[hsl(40_20%_96%)] border-[hsl(35_15%_88%)] text-[hsl(30_6%_40%)]",
  /** 3D skeleton viewport inside agent/automation cards */
  cardSkeletonViewport: "h-[200px] min-h-[200px] w-full",
  /** Step strip — agent conversation path connectors */
  stepStripAgentConnector: "text-[hsl(18_52%_52%)]",
  /** Step strip — automation pipeline rail */
  stepStripAutoRail: "bg-[hsl(35_15%_88%)]",
  /** Step strip — overflow "+N more" chip */
  stepStripOverflowChip:
    "inline-flex items-center text-[10px] font-medium px-2 py-1 rounded-md border bg-[hsl(40_20%_96%)] border-[hsl(35_15%_88%)] text-[hsl(30_6%_45%)] shrink-0",
  /** Step strip — running highlight on agent chips */
  stepStripRunningAgent:
    "ring-2 ring-[hsl(18_52%_52%)] ring-offset-1 shadow-[0_0_8px_hsl(18_52%_52%/0.2)]",
  /** Step strip — automation progress dot (active) */
  stepStripRunningAutoActive: "bg-[hsl(30_15%_55%)]",
  /** Step strip — automation progress dot (done) */
  stepStripRunningAutoDone: "text-emerald-600",
  /** Step strip — automation progress dot (pending) */
  stepStripRunningAutoPending: "border border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)]",
  /** Model name chip on card */
  modelChip:
    "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border bg-[hsl(40_20%_96%)] border-[hsl(35_15%_88%)] text-[hsl(30_6%_40%)] font-mono",
  /** Canvas toolbar (view toggle bar above canvas) */
  canvasToolbar:
    "flex items-center gap-1 px-3 h-9 border-b border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] shrink-0",
  /** Active toggle button in canvas toolbar */
  viewToggleActive: "bg-[hsl(18_52%_52%)] text-white shadow-sm",
  /** Inactive toggle button in canvas toolbar */
  viewToggleInactive:
    "bg-transparent text-[hsl(30_6%_45%)] hover:bg-[hsl(40_20%_96%)] hover:text-[hsl(18_45%_38%)]",
  /** Canvas running overlay shimmer */
  canvasRunningOverlay:
    "absolute inset-0 pointer-events-none rounded-none bg-[hsl(18_52%_52%/0.03)] animate-pulse",
  /** Edit panel that slides in below the card */
  editPanel:
    "bg-[hsl(40_25%_99%)] rounded-2xl border border-[hsl(35_15%_88%)] shadow-[0_4px_16px_hsl(30_20%_20%/0.06)]",
  /** i420 wordmark pill */
  i420Badge:
    "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight bg-[hsl(18_52%_52%)] text-white",
  i420Wordmark:
    "text-lg font-bold tracking-tight text-[hsl(18_52%_52%)] font-['Source_Serif_4',serif]",

  // ── 3D depth tokens ───────────────────────────────────────────────────────

  elevation1: "shadow-[0_1px_3px_hsl(30_20%_20%/0.06)]",
  elevation2: "shadow-[0_4px_16px_hsl(30_20%_20%/0.08)]",
  elevation3: "shadow-[0_12px_40px_hsl(30_20%_20%/0.1)]",
  cardShell3d:
    "shadow-[0_20px_60px_hsl(30_20%_20%/0.12),0_4px_12px_hsl(30_20%_20%/0.06)]",
  cardHoverTilt:
    "transition-transform duration-300 hover:[transform:perspective(800px)_rotateX(2deg)_rotateY(-2deg)]",
  chip3dHover:
    "hover:border-[hsl(18_30%_80%)] hover:bg-[hsl(18_35%_95%)] hover:[transform:perspective(600px)_rotateX(1deg)_translateY(-1px)]",
  motionSlow: "transition-all duration-500 ease-out",
  motionSpring: "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
  listCard3d:
    "hover:shadow-[0_12px_32px_hsl(30_20%_20%/0.1)] hover:[transform:perspective(800px)_rotateX(1deg)_translateY(-2px)]",
};
