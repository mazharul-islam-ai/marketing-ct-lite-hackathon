import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { cn } from "@/lib/utils";
import { NODE_CATEGORIES, NODE_TYPE_DEFS, type NodeType } from "../types";

export interface FlowNodeData {
  label: string;
  type: NodeType;
  config: Record<string, unknown>;
  runStatus?: "pending" | "running" | "completed" | "failed" | "skipped";
  isSelected?: boolean;
}

const STATUS_RING: Record<string, string> = {
  running:   "ring-2 ring-blue-400 ring-offset-1 animate-pulse",
  completed: "ring-2 ring-green-400 ring-offset-1",
  failed:    "ring-2 ring-red-400 ring-offset-1",
  pending:   "",
  skipped:   "ring-2 ring-gray-300 ring-offset-1 opacity-60",
};

const STATUS_ICON: Record<string, string> = {
  running:   "⟳",
  completed: "✓",
  failed:    "✗",
  skipped:   "–",
};

export const FlowNodeComponent = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  const def = NODE_TYPE_DEFS.find((d) => d.type === data.type);
  const category = NODE_CATEGORIES.find((c) => c.id === def?.category);

  const bgColor = category?.bgColor ?? "bg-gray-50 border-gray-200";
  const textColor = category?.color ?? "text-gray-700";
  const icon = category?.icon ?? "⬜";

  const statusRing = STATUS_RING[data.runStatus ?? "pending"] ?? "";
  const statusIcon = data.runStatus && data.runStatus !== "pending"
    ? STATUS_ICON[data.runStatus]
    : null;

  const isTrigger = def?.category === "trigger";

  return (
    <div
      className={cn(
        "relative min-w-[140px] max-w-[180px] rounded-lg border-2 px-3 py-2 cursor-pointer transition-all duration-200",
        bgColor,
        statusRing,
        selected && "border-primary -translate-y-px shadow-[0_8px_24px_hsl(18_52%_40%/0.12),0_2px_8px_hsl(30_20%_20%/0.08)]",
        !selected && "shadow-[0_2px_8px_hsl(30_20%_20%/0.06)]",
        data.runStatus === "running" && "ring-2 ring-[hsl(18_52%_52%)] ring-offset-1",
      )}
    >
      {/* Incoming handle — not for trigger nodes */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-400 !border-white !border-2"
        />
      )}

      {/* Node content */}
      <div className="flex items-center gap-1.5">
        <span className="text-base leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-semibold truncate", textColor)}>
            {data.label}
          </p>
          <p className="text-[10px] text-gray-400 truncate mt-0.5">
            {def?.description ?? data.type}
          </p>
        </div>

        {/* Status badge */}
        {statusIcon && (
          <span
            className={cn(
              "text-xs font-bold ml-1",
              data.runStatus === "completed" && "text-green-600",
              data.runStatus === "failed" && "text-red-600",
              data.runStatus === "running" && "text-blue-600",
            )}
          >
            {statusIcon}
          </span>
        )}
      </div>

      {/* Outgoing handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-white !border-2"
      />
    </div>
  );
});

FlowNodeComponent.displayName = "FlowNodeComponent";

// ── Map from node type string to React Flow node component ───────────────────
export const nodeTypes = {
  cron_trigger:      FlowNodeComponent,
  webhook_trigger:   FlowNodeComponent,
  manual_trigger:    FlowNodeComponent,
  db_trigger:        FlowNodeComponent,
  crm_event_trigger: FlowNodeComponent,
  condition:         FlowNodeComponent,
  switch:            FlowNodeComponent,
  loop:              FlowNodeComponent,
  delay:             FlowNodeComponent,
  openai_llm:        FlowNodeComponent,
  gemini_llm:        FlowNodeComponent,
  anthropic_llm:     FlowNodeComponent,
  custom_llm:        FlowNodeComponent,
  db_query:          FlowNodeComponent,
  api_call:          FlowNodeComponent,
  email_send:        FlowNodeComponent,
  slack_notify:      FlowNodeComponent,
  slack_fetch_messages: FlowNodeComponent,
  crm_update:        FlowNodeComponent,
  mcp_tool:          FlowNodeComponent,
  gmail_fetch_unread: FlowNodeComponent,
  dashboard_write:   FlowNodeComponent,
  email_output:      FlowNodeComponent,
  db_write:          FlowNodeComponent,
  report_generate:   FlowNodeComponent,
};
