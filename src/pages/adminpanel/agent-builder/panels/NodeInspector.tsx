import { useState, useEffect } from "react";
import { X, Play, Save, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getNodeDef, getCategoryDef } from "../types";
import type { FlowNode, ConfigField } from "../types";

interface NodeInspectorProps {
  node: FlowNode | null;
  onClose: () => void;
  onSave: (nodeId: string, updates: { label?: string; config?: Record<string, unknown> }) => void;
  onTestNode?: (node: FlowNode) => Promise<{ output: unknown; error?: string }>;
  runOutput?: Record<string, unknown>;
  runStatus?: string;
}

export function NodeInspector({
  node,
  onClose,
  onSave,
  onTestNode,
  runOutput,
  runStatus,
}: NodeInspectorProps) {
  const [label, setLabel] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ output?: unknown; error?: string } | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setConfig(node.config ?? {});
      setTestResult(null);
    }
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white border-l border-slate-200 p-4 text-center">
        <div className="text-3xl mb-3 opacity-20">◻</div>
        <p className="text-xs text-slate-400 font-medium">Click a node to inspect</p>
        <p className="text-[11px] text-slate-300 mt-1">View and edit node configuration</p>
      </div>
    );
  }

  const def = getNodeDef(node.type);
  const category = def ? getCategoryDef(def.category) : null;

  const handleSave = () => {
    onSave(node.id, { label, config });
  };

  const handleTest = async () => {
    if (!onTestNode) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTestNode({ ...node, label, config });
      setTestResult(result);
      setShowOutput(true);
    } finally {
      setIsTesting(false);
    }
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const renderField = (key: string, fieldDef: ConfigField) => {
    const value = config[key] ?? fieldDef.defaultValue ?? "";

    if (fieldDef.type === "select") {
      return (
        <Select
          value={String(value)}
          onValueChange={(v) => handleConfigChange(key, v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={`Select ${fieldDef.label}`} />
          </SelectTrigger>
          <SelectContent>
            {(fieldDef.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (fieldDef.type === "textarea") {
      return (
        <Textarea
          value={String(value)}
          onChange={(e) => handleConfigChange(key, e.target.value)}
          placeholder={fieldDef.placeholder}
          className="text-xs resize-none min-h-[72px] font-mono"
        />
      );
    }

    if (fieldDef.type === "number") {
      return (
        <Input
          type="number"
          value={Number(value)}
          onChange={(e) => handleConfigChange(key, Number(e.target.value))}
          className="h-8 text-xs"
        />
      );
    }

    if (fieldDef.type === "boolean") {
      return (
        <Select
          value={String(value)}
          onValueChange={(v) => handleConfigChange(key, v === "true")}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true" className="text-xs">True</SelectItem>
            <SelectItem value="false" className="text-xs">False</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        value={String(value)}
        onChange={(e) => handleConfigChange(key, e.target.value)}
        placeholder={fieldDef.placeholder}
        className="h-8 text-xs"
      />
    );
  };

  const configFields = def?.configSchema ? Object.entries(def.configSchema) : [];

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Header */}
      <div className={cn("px-3 py-2.5 border-b border-slate-100 flex items-center justify-between", category?.bgColor ?? "bg-slate-50")}>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{category?.icon ?? "⬜"}</span>
            <p className="text-xs font-semibold text-slate-700">Node Inspector</p>
          </div>
          <Badge variant="secondary" className="text-[10px] h-4 mt-0.5">
            {node.type}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-3 space-y-4">
          {/* Run status indicator */}
          {runStatus && runStatus !== "pending" && (
            <div className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium",
              runStatus === "completed" && "bg-green-50 text-green-700",
              runStatus === "running" && "bg-blue-50 text-blue-700",
              runStatus === "failed" && "bg-red-50 text-red-700",
            )}>
              <span>
                {runStatus === "completed" && "✓ Completed"}
                {runStatus === "running" && "⟳ Running…"}
                {runStatus === "failed" && "✗ Failed"}
              </span>
            </div>
          )}

          {/* Node label */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Name</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-8 text-xs"
              placeholder="Node label"
            />
          </div>

          {/* Config fields */}
          {configFields.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Configuration</p>
              {configFields.map(([key, fieldDef]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-slate-600">
                    {fieldDef.label}
                    {fieldDef.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  {renderField(key, fieldDef)}
                </div>
              ))}
            </div>
          )}

          {/* Input mapping hint */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Input Mapping</p>
            <p className="text-[11px] text-slate-400">
              Use <code className="bg-slate-100 px-1 rounded">{"{{variable}}"}</code> in prompts to reference outputs from previous nodes.
            </p>
          </div>

          {/* Run output */}
          {runOutput && (
            <div className="space-y-1">
              <button
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-full"
                onClick={() => setShowOutput(!showOutput)}
              >
                Last Output
                <ChevronDown className={cn("w-3 h-3 transition-transform ml-auto", showOutput && "rotate-180")} />
              </button>
              {showOutput && (
                <pre className="text-[10px] bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto max-h-32 text-slate-600 font-mono">
                  {JSON.stringify(runOutput, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Test Result</p>
              {testResult.error ? (
                <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600">
                  {testResult.error}
                </div>
              ) : (
                <pre className="text-[10px] bg-green-50 border border-green-200 rounded p-2 overflow-x-auto max-h-32 text-green-700 font-mono">
                  {JSON.stringify(testResult.output, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="px-3 py-3 border-t border-slate-100 flex gap-2">
        {onTestNode && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8 gap-1.5"
            onClick={handleTest}
            disabled={isTesting}
          >
            {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Test Node
          </Button>
        )}
        <Button
          size="sm"
          className="flex-1 text-xs h-8 gap-1.5"
          onClick={handleSave}
        >
          <Save className="w-3 h-3" />
          Save
        </Button>
      </div>
    </div>
  );
}
