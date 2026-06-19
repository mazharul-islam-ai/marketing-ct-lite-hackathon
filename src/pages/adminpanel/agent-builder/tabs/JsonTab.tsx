import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlowJSON } from "../types";
import { ab } from "../agentBuilderTheme";

const VALID_NODE_TYPES = [
  "cron_trigger", "webhook_trigger", "manual_trigger", "db_trigger", "crm_event_trigger",
  "condition", "switch", "loop", "delay",
  "openai_llm", "gemini_llm", "anthropic_llm", "custom_llm",
  "db_query", "api_call", "email_send", "slack_notify", "crm_update", "mcp_tool", "gmail_fetch_unread",
  "dashboard_write", "email_output", "db_write", "report_generate",
];

interface JsonTabProps {
  flowJson: FlowJSON | null;
  onApply: (flow: FlowJSON) => void;
}

export function JsonTab({ flowJson, onApply }: JsonTabProps) {
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [copied, setCopied] = useState(false);

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
    } catch (e) {
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
      <div className={cn("flex items-center justify-between px-4 py-2", ab.toolbar)}>
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
        <div className="flex gap-2">
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

      {/* JSON editor */}
      <div className="flex-1 relative overflow-hidden">
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
      </div>

      {/* Valid node types hint */}
      <div className={cn("px-4 py-2 border-t", ab.toolbar)}>
        <p className={cn("text-[10px]", ab.textMuted)}>
          <span className="font-semibold">Valid node types:</span>{" "}
          {VALID_NODE_TYPES.join(", ")}
        </p>
      </div>
    </div>
  );
}
