/** Scoped soft Lovable-inspired palette for Agent Builder (not global platform tokens) */

export const ab = {
  page: "space-y-5",
  canvas: "bg-[hsl(250_33%_98%)]",
  surface: "bg-[hsl(250_28%_96%)] border-[hsl(250_18%_90%)]",
  surfaceElevated:
    "bg-[hsl(250_32%_97.5%)] border-[hsl(250_18%_90%)] shadow-[0_1px_3px_hsl(250_30%_50%/0.06)]",
  borderSoft: "border-[hsl(250_18%_90%)]",
  input:
    "bg-[hsl(250_22%_93%)] border-[hsl(250_18%_88%)] focus-visible:ring-[hsl(248_45%_70%/0.35)] focus-visible:ring-offset-0",
  accentText: "text-[hsl(248_55%_58%)]",
  accentBtn: "bg-[hsl(248_50%_62%)] hover:bg-[hsl(248_50%_58%)] text-white border-0",
  accentSoft:
    "bg-[hsl(248_45%_94%)] text-[hsl(248_45%_42%)] border-[hsl(248_35%_88%)]",
  accentMuted: "bg-[hsl(248_40%_96%)]",
  userBubble: "bg-[hsl(248_50%_62%)] text-white",
  assistantBubble: "bg-[hsl(250_25%_94%)] text-[hsl(240_10%_25%)] border-[hsl(250_18%_90%)]",
  chip:
    "bg-[hsl(250_25%_94%)] border-[hsl(250_18%_90%)] text-[hsl(240_8%_40%)] hover:border-[hsl(248_35%_82%)] hover:text-[hsl(248_45%_42%)]",
  chipActive: "bg-[hsl(248_45%_94%)] text-[hsl(248_45%_42%)] border-[hsl(248_35%_88%)]",
  composer: "rounded-2xl border p-5",
  composerCompact: "rounded-2xl border p-3.5",
  promptBar: "rounded-xl border flex items-end gap-2 p-2",
  templateStrip:
    "flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] sm:[mask-image:none] sm:flex-wrap",
  templateChip: "text-[11px] px-2.5 py-1 rounded-lg border shrink-0 transition-all duration-150",
  chatPanel: "bg-[hsl(250_32%_97.5%)] border-[hsl(250_18%_90%)]",
  chatHeader: "bg-[hsl(250_25%_95%)] border-[hsl(250_18%_90%)]",
  agentCard:
    "bg-[hsl(250_28%_96%)] border-[hsl(250_18%_90%)] shadow-[0_1px_3px_hsl(250_30%_50%/0.05)] hover:border-[hsl(248_35%_82%)] hover:shadow-[0_2px_8px_hsl(250_30%_50%/0.08)]",
  studioShell:
    "flex flex-col h-screen min-h-0 bg-[hsl(250_33%_98%)] overflow-hidden",
  studioHeader:
    "flex items-center gap-2 px-4 h-12 border-b border-[hsl(250_18%_90%)] bg-[hsl(250_28%_96%)] shrink-0",
  studioTabs: "border-b border-[hsl(250_18%_90%)] bg-[hsl(250_32%_97.5%)] px-4 shrink-0",
  filterActive: "bg-[hsl(248_50%_62%)] text-white",
  filterInactive:
    "bg-[hsl(250_28%_96%)] border border-[hsl(250_18%_90%)] text-[hsl(240_8%_40%)] hover:border-[hsl(248_35%_82%)] hover:text-[hsl(248_45%_42%)]",
  emptyState: "border border-dashed border-[hsl(250_18%_90%)] rounded-xl",
  toolbar: "border-b border-[hsl(250_18%_90%)] bg-[hsl(250_25%_95%)]",
  logArea: "bg-[hsl(250_22%_93%)]",
  textMuted: "text-[hsl(240_8%_40%)]",
  textForeground: "text-[hsl(240_10%_20%)]",

  // ── Card view tokens ──────────────────────────────────────────────────────

  /** Indigo→violet gradient header for agent cards */
  agentCardHeader:
    "bg-gradient-to-br from-[hsl(248_60%_56%)] via-[hsl(258_55%_52%)] to-[hsl(270_50%_48%)]",
  /** Teal→emerald gradient header for automation cards */
  automationCardHeader:
    "bg-gradient-to-br from-[hsl(172_60%_42%)] via-[hsl(160_55%_40%)] to-[hsl(148_50%_38%)]",
  /** Card shell — centered floating card on the canvas */
  cardShell:
    "bg-white rounded-2xl border border-[hsl(250_18%_88%)] shadow-[0_8px_32px_hsl(250_30%_50%/0.12),0_2px_8px_hsl(250_30%_50%/0.06)]",
  /** Running glow ring around card */
  cardRunningGlow:
    "ring-2 ring-offset-2 ring-[hsl(248_60%_62%)] shadow-[0_0_24px_hsl(248_60%_62%/0.35)]",
  /** Running glow ring for automation (teal) */
  cardRunningGlowAuto:
    "ring-2 ring-offset-2 ring-[hsl(160_55%_45%)] shadow-[0_0_24px_hsl(160_55%_45%/0.35)]",
  /** Subtle node type chip on card body */
  nodeChip:
    "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[hsl(250_25%_96%)] border-[hsl(250_18%_90%)] text-[hsl(240_8%_35%)]",
  /** Canvas toolbar (view toggle bar above canvas) */
  canvasToolbar:
    "flex items-center gap-1 px-3 h-9 border-b border-[hsl(250_18%_90%)] bg-[hsl(250_28%_96%)] shrink-0",
  /** Active toggle button in canvas toolbar */
  viewToggleActive:
    "bg-[hsl(248_50%_62%)] text-white shadow-sm",
  /** Inactive toggle button in canvas toolbar */
  viewToggleInactive:
    "bg-transparent text-[hsl(240_8%_40%)] hover:bg-[hsl(250_25%_94%)] hover:text-[hsl(248_45%_42%)]",
  /** Canvas running overlay shimmer */
  canvasRunningOverlay:
    "absolute inset-0 pointer-events-none rounded-none bg-[hsl(248_60%_62%/0.03)] animate-pulse",
  /** Edit panel that slides in below the card */
  editPanel:
    "bg-white rounded-2xl border border-[hsl(250_18%_88%)] shadow-[0_4px_16px_hsl(250_30%_50%/0.08)]",
  /** i420 wordmark pill */
  i420Badge:
    "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight bg-[hsl(248_50%_62%)] text-white",
  i420Wordmark:
    "text-lg font-bold tracking-tight bg-gradient-to-r from-[hsl(248_55%_58%)] to-[hsl(270_50%_48%)] bg-clip-text text-transparent",

  // ── 3D depth tokens ───────────────────────────────────────────────────────

  elevation1: "shadow-[0_1px_3px_hsl(250_30%_50%/0.06)]",
  elevation2: "shadow-[0_4px_16px_hsl(250_30%_50%/0.08)]",
  elevation3: "shadow-[0_12px_40px_hsl(248_50%_40%/0.12)]",
  cardShell3d:
    "shadow-[0_20px_60px_hsl(248_50%_40%/0.15),0_4px_12px_hsl(250_30%_50%/0.08)]",
  cardHoverTilt:
    "transition-transform duration-300 hover:[transform:perspective(800px)_rotateX(2deg)_rotateY(-2deg)]",
  chip3dHover:
    "hover:border-[hsl(248_35%_82%)] hover:bg-[hsl(248_40%_96%)] hover:[transform:perspective(600px)_rotateX(1deg)_translateY(-1px)]",
  motionSlow: "transition-all duration-500 ease-out",
  motionSpring: "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
  listCard3d:
    "hover:shadow-[0_12px_32px_hsl(248_50%_40%/0.12)] hover:[transform:perspective(800px)_rotateX(1deg)_translateY(-2px)]",
};
