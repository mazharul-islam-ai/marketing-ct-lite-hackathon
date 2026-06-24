import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, AlertCircle, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { FlowJSON, FlowNode, FlowEdge } from "../types";
import { ab } from "../agentBuilderTheme";

const VALID_NODE_TYPES = [
  "cron_trigger", "webhook_trigger", "manual_trigger", "db_trigger", "crm_event_trigger",
  "condition", "switch", "loop", "delay",
  "openai_llm", "gemini_llm", "anthropic_llm", "custom_llm",
  "db_query", "api_call", "email_send", "slack_notify", "slack_fetch_messages", "crm_update", "mcp_tool", "gmail_fetch_unread",
  "dashboard_write", "email_output", "db_write", "report_generate",
];

interface JsonTabProps {
  flowJson: FlowJSON | null;
  onApply: (flow: FlowJSON) => void;
}

type ViewMode = "tree" | "raw";

function JsonTreeNode({
  label,
  value,
  defaultOpen = false,
  forceOpen,
}: {
  label: string;
  value: unknown;
  defaultOpen?: boolean;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen !== undefined ? forceOpen : open;

  if (value === null || value === undefined) {
    return (
      <div className="pl-4 py-0.5 text-[11px] font-mono">
        <span className={ab.textMuted}>{label}: </span>
        <span className="text-amber-600">null</span>
      </div>
    );
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    const display = typeof value === "string" ? `"${value}"` : JSON.stringify(value);
    return (
      <div className="pl-4 py-0.5 text-[11px] font-mono break-all">
        <span className={ab.textMuted}>{label}: </span>
        <span className={ab.textForeground}>{display}</span>
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} className="pl-2">
      <CollapsibleTrigger className={cn("flex items-center gap-1 py-0.5 text-[11px] font-mono w-full text-left hover:bg-[hsl(40_20%_96%)] rounded px-1", ab.textForeground)}>
        {isOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <span className="font-semibold">{label}</span>
        <span className={cn("text-[10px]", ab.textMuted)}>{`{${entries.length}}`}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-3 border-l border-[hsl(35_15%_88%)] ml-1.5">
        {entries.map(([k, v]) => (
          <JsonTreeNode key={k} label={k} value={v} defaultOpen={false} forceOpen={forceOpen} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FlowTreeView({ flow, expandAll }: { flow: FlowJSON; expandAll: boolean }) {
  return (
    <div className="p-3 space-y-1 overflow-auto h-full">
      <JsonTreeNode label="trigger" value={flow.trigger} defaultOpen forceOpen={expandAll ? true : undefined} />
      <div className="pt-1">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wide px-1 mb-1", ab.textMuted)}>
          steps ({flow.steps.length})
        </p>
        {flow.steps.map((step: FlowNode, i: number) => (
          <JsonTreeNode
            key={step.id ?? i}
            label={`${i + 1}. ${step.label ?? step.type}`}
            value={step}
            defaultOpen={i === 0}
            forceOpen={expandAll ? true : undefined}
          />
        ))}
      </div>
      <div className="pt-1">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wide px-1 mb-1", ab.textMuted)}>
          edges ({flow.edges.length})
        </p>
        {flow.edges.map((edge: FlowEdge, i: number) => (
          <JsonTreeNode
            key={edge.id ?? i}
            label={edge.id ?? `edge-${i}`}
            value={edge}
            forceOpen={expandAll ? true : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function JsonTab({ flowJson, onApply }: JsonTabProps) {
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [expandAll, setExpandAll] = useState(false);

  const parsedFlow = useMemo(() => {
    if (flowJson) return flowJson;
    try {
      return JSON.parse(text) as FlowJSON;
    } catch {
      return null;
    }
  }, [flowJson, text]);

  useEffect(() => {
    if (flowJson) {
      setText(JSON.stringify(flowJson, null, 2));
      setValidationError(null);
      setIsValid(true);
    }
  }, [flowJson]);

  const validate = (raw: string): FlowJSON | null => {
    try {
      const parsed = JSON.parse(raw) as FlowJSON;

      if (!Array.isArray(parsed.steps)) throw new Error("steps must be an array");
      if (!Array.isArray(parsed.edges)) throw new Error("edges must be an array");

      const allNodes = [...(parsed.trigger ? [parsed.trigger] : []), ...parsed.steps];

      if (allNodes.length > 20) throw new Error("Flow exceeds 20 nodes");

      const nodeIds = new Set(allNodes.map((n) => n.id));

      for (const node of allNodes) {
        if (!VALID_NODE_TYPES.includes(node.type)) {
          throw new Error(`Invalid node type: "${node.type}"`);
        }
        if (!node.id) throw new Error("Node missing id");
        if (!node.label) throw new Error(`Node ${node.id} missing label`);
      }

      for (const edge of parsed.edges) {
        if (!nodeIds.has(edge.source)) throw new Error(`Edge source "${edge.source}" not found`);
        if (!nodeIds.has(edge.target)) throw new Error(`Edge target "${edge.target}" not found`);
      }

      return parsed;
    } catch {
      return null;
    }
  };

  const handleChange = (val: string) => {
    setText(val);
    try {
      const parsed = JSON.parse(val) as FlowJSON;
      const allNodes = [...(parsed.trigger ? [parsed.trigger] : []), ...parsed.steps];

      if (!Array.isArray(parsed.steps) || !Array.isArray(parsed.edges)) {
        setValidationError("steps and edges must be arrays");
        setIsValid(false);
        return;
      }

      for (const node of allNodes) {
        if (!VALID_NODE_TYPES.includes(node.type)) {
          setValidationError(`Invalid node type: "${node.type}"`);
          setIsValid(false);
          return;
        }
      }

      setValidationError(null);
      setIsValid(true);
    } catch {
      setValidationError("Invalid JSON syntax");
      setIsValid(false);
    }
  };

  const handleApply = () => {
    const parsed = validate(text);
    if (parsed) {
      onApply(parsed);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("flex flex-col h-full", ab.canvas)}>
      <div className={cn("flex items-center justify-between px-4 py-2 gap-2 flex-wrap", ab.toolbar)}>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold", ab.textForeground)}>Flow JSON</span>
          {isValid && !validationError && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-[10px]">Valid</span>
            </div>
          )}
          {validationError && (
            <div className="flex items-center gap-1 text-red-500">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="text-[10px]">{validationError}</span>
            </div>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <div className={cn("flex rounded-md border overflow-hidden", ab.borderSoft)}>
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={cn("px-2.5 py-1 text-[10px] font-medium", viewMode === "tree" ? ab.chipActive : ab.chip)}
            >
              Tree
            </button>
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              className={cn("px-2.5 py-1 text-[10px] font-medium", viewMode === "raw" ? ab.chipActive : ab.chip)}
            >
              Raw
            </button>
          </div>
          {viewMode === "tree" && (
            <>
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setExpandAll(true)}>
                Expand all
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setExpandAll(false)}>
                Collapse all
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleApply}
            disabled={!!validationError || !isValid}
          >
            Validate & Apply
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden min-h-0">
        {viewMode === "tree" && parsedFlow ? (
          <FlowTreeView key={expandAll ? "expanded" : "collapsed"} flow={parsedFlow} expandAll={expandAll} />
        ) : (
          <textarea
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            className={cn(
              "w-full h-full resize-none font-mono text-xs p-4 outline-none leading-relaxed",
              ab.logArea,
              ab.textForeground,
              validationError && "border-l-2 border-red-500",
            )}
            spellCheck={false}
            placeholder='{"trigger": null, "steps": [], "edges": []}'
          />
        )}
      </div>

      <div className={cn("px-4 py-2 border-t", ab.toolbar)}>
        <p className={cn("text-[10px]", ab.textMuted)}>
          <span className="font-semibold">Valid node types:</span>{" "}
          {VALID_NODE_TYPES.join(", ")}
        </p>
      </div>
    </div>
  );
}
