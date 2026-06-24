import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getNodeDef,
  NODE_TYPE_DEFS,
  type FlowJSON,
  type FlowNode,
  type ConfigField,
  type NodeCategory,
} from "../types";
import { ab } from "../agentBuilderTheme";

interface NodeEditTabsProps {
  flowJson: FlowJSON;
  onNodeSave: (nodeId: string, updates: { label?: string; config?: Record<string, unknown> }) => void;
  onClose: () => void;
}

type TabId = "general" | "trigger" | "ai" | "tools" | "output" | "mapping";

interface EditState {
  [nodeId: string]: {
    label: string;
    config: Record<string, unknown>;
  };
}

const CATEGORY_TO_TAB: Record<NodeCategory, TabId> = {
  trigger: "trigger",
  logic:   "tools",
  ai:      "ai",
  tool:    "tools",
  output:  "output",
};

const TAB_LABELS: Record<TabId, string> = {
  general: "General",
  trigger: "Trigger",
  ai:      "AI Config",
  tools:   "Tools",
  output:  "Output",
  mapping: "Mapping",
};

function renderField(
  key: string,
  fieldDef: ConfigField,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
) {
  const strVal = String(value ?? fieldDef.defaultValue ?? "");

  if (fieldDef.type === "select") {
    return (
      <Select value={strVal} onValueChange={(v) => onChange(key, v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={`Select ${fieldDef.label}`} />
        </SelectTrigger>
        <SelectContent>
          {(fieldDef.options ?? []).map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (fieldDef.type === "textarea") {
    return (
      <Textarea
        value={strVal}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={fieldDef.placeholder}
        className="text-xs resize-none min-h-[72px] font-mono"
      />
    );
  }

  if (fieldDef.type === "number") {
    return (
      <Input
        type="number"
        value={Number(value ?? fieldDef.defaultValue ?? 0)}
        onChange={(e) => onChange(key, Number(e.target.value))}
        className="h-8 text-xs"
      />
    );
  }

  if (fieldDef.type === "boolean") {
    return (
      <Select value={String(value)} onValueChange={(v) => onChange(key, v === "true")}>
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
      value={strVal}
      onChange={(e) => onChange(key, e.target.value)}
      placeholder={fieldDef.placeholder}
      className="h-8 text-xs"
    />
  );
}

export function NodeEditTabs({ flowJson, onNodeSave, onClose }: NodeEditTabsProps) {
  const allNodes: FlowNode[] = [
    ...(flowJson.trigger ? [flowJson.trigger] : []),
    ...flowJson.steps,
  ];

  // Build initial edit state from all nodes
  const [editState, setEditState] = useState<EditState>(() =>
    Object.fromEntries(
      allNodes.map((n) => [n.id, { label: n.label, config: { ...(n.config ?? {}) } }]),
    ),
  );

  // Sync when flowJson changes (e.g. AI compile)
  useEffect(() => {
    setEditState(
      Object.fromEntries(
        allNodes.map((n) => [n.id, { label: n.label, config: { ...(n.config ?? {}) } }]),
      ),
    );
  }, [flowJson]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine which tabs to show
  const presentCategories = new Set(
    allNodes.map((n) => {
      const def = NODE_TYPE_DEFS.find((d) => d.type === n.type);
      return def?.category as NodeCategory | undefined;
    }).filter(Boolean),
  ) as Set<NodeCategory>;

  const visibleTabs: TabId[] = ["general"];
  if (presentCategories.has("trigger")) visibleTabs.push("trigger");
  if (presentCategories.has("ai")) visibleTabs.push("ai");
  if (presentCategories.has("tool") || presentCategories.has("logic")) visibleTabs.push("tools");
  if (presentCategories.has("output")) visibleTabs.push("output");
  visibleTabs.push("mapping");

  const [activeTab, setActiveTab] = useState<TabId>("general");

  const handleFieldChange = (nodeId: string, key: string, value: unknown) => {
    setEditState((prev) => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        config: { ...prev[nodeId]?.config, [key]: value },
      },
    }));
  };

  const handleLabelChange = (nodeId: string, label: string) => {
    setEditState((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], label },
    }));
  };

  const handleSaveAll = () => {
    Object.entries(editState).forEach(([nodeId, updates]) => {
      onNodeSave(nodeId, updates);
    });
    onClose();
  };

  const renderNodeFields = (node: FlowNode) => {
    const def = getNodeDef(node.type);
    const fields = def?.configSchema ? Object.entries(def.configSchema) : [];
    const state = editState[node.id];
    if (!state) return null;

    return (
      <div key={node.id} className="space-y-3 pb-4 border-b border-[hsl(35_15%_88%)] last:border-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">{NODE_TYPE_DEFS.find(d => d.type === node.type) ? "" : ""}</span>
          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{state.label || node.type}</p>
          <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono">{node.type}</span>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Label</Label>
          <Input
            value={state.label}
            onChange={(e) => handleLabelChange(node.id, e.target.value)}
            className="h-8 text-xs"
            placeholder="Node label"
          />
        </div>
        {fields.map(([key, fieldDef]) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-slate-500">
              {fieldDef.label}
              {fieldDef.required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {renderField(key, fieldDef, state.config[key], (k, v) => handleFieldChange(node.id, k, v))}
          </div>
        ))}
      </div>
    );
  };

  const nodesForTab = (tab: TabId): FlowNode[] => {
    if (tab === "general" || tab === "mapping") return [];
    const catForTab = Object.entries(CATEGORY_TO_TAB)
      .filter(([, t]) => t === tab)
      .map(([c]) => c as NodeCategory);
    return allNodes.filter((n) => {
      const def = NODE_TYPE_DEFS.find((d) => d.type === n.type);
      return def && catForTab.includes(def.category);
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(35_15%_88%)] shrink-0">
        <p className="text-xs font-semibold text-slate-600">Edit Configuration</p>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="h-9 w-full justify-start bg-transparent px-4 border-b border-[hsl(35_15%_88%)] rounded-none gap-0.5 overflow-x-auto shrink-0">
          {visibleTabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className={cn(
                "text-[11px] h-8 px-3 rounded-md data-[state=active]:bg-[hsl(18_35%_95%)] data-[state=active]:text-[hsl(18_45%_38%)] data-[state=active]:shadow-none",
                ab.textMuted,
              )}
            >
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* General tab */}
        <TabsContent value="general" className="m-0 flex-1 min-h-0 data-[state=inactive]:hidden">
          <ScrollArea className="h-full max-h-[calc(100vh-12rem)]">
            <div className="px-4 py-3 space-y-3">
              <p className="text-[11px] text-slate-400">
                Edit node labels and names. Switch to specific tabs to configure node settings.
              </p>
              {allNodes.map((node) => {
                const state = editState[node.id];
                if (!state) return null;
                return (
                  <div key={node.id} className="flex items-center gap-2">
                    <Label className="text-[11px] text-slate-500 w-24 shrink-0 truncate">{node.type}</Label>
                    <Input
                      value={state.label}
                      onChange={(e) => handleLabelChange(node.id, e.target.value)}
                      className="h-7 text-xs flex-1"
                      placeholder="Node label"
                    />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Category tabs */}
        {(["trigger", "ai", "tools", "output"] as TabId[]).map((tab) => (
          visibleTabs.includes(tab) && (
            <TabsContent key={tab} value={tab} className="m-0 flex-1 min-h-0 data-[state=inactive]:hidden">
              <ScrollArea className="h-full max-h-[calc(100vh-12rem)]">
                <div className="px-4 py-3 space-y-4">
                  {nodesForTab(tab).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No {TAB_LABELS[tab]} nodes in this flow.</p>
                  ) : (
                    nodesForTab(tab).map(renderNodeFields)
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          )
        ))}

        {/* Mapping tab */}
        <TabsContent value="mapping" className="m-0 flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden">
          <div className="px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Input Mapping</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Use <code className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono", ab.chip)}>{"{{variable}}"}</code> in
              prompts and config fields to reference outputs from previous nodes.
            </p>
            <div className="mt-2 space-y-2">
              {allNodes.map((node) => {
                const def = getNodeDef(node.type);
                const fields = def?.outputFields ?? ["output"];
                return (
                  <div key={node.id} className="space-y-1 pb-2 border-b border-slate-100 last:border-0">
                    <span className="text-[10px] font-medium text-slate-500">
                      {editState[node.id]?.label || node.type}
                      <span className="ml-1 text-slate-300 font-normal font-mono">{node.id}</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {fields.map((field) => (
                        <code
                          key={field}
                          className={cn("px-1.5 py-0.5 rounded font-mono cursor-pointer", ab.chip)}
                        >
                          {`{{${node.id}.${field}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[hsl(35_15%_88%)] flex items-center justify-end gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className={cn("h-7 text-xs gap-1.5", ab.accentBtn)}
          onClick={handleSaveAll}
        >
          <Save className="w-3 h-3" />
          Save All
        </Button>
      </div>
    </div>
  );
}
