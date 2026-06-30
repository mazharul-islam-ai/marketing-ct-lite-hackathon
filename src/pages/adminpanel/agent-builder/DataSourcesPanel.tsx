import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown, ChevronRight, Database, ExternalLink, Loader2, Lock, Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ab } from "./agentBuilderTheme";
import {
  I420_TOUR_OPEN_DATA_SOURCES_SUBTAB,
  type I420DataSourcesSubTab,
} from "@/features/i420-tour/tourEvents";
import {
  DATA_TABLE_GROUPS,
  type DataSourceIntegrationConfig,
  type KbCollection,
  type KbIndexingStatus,
} from "./dataSourceConfig";
import { useKbCollections } from "./hooks/useKbCollections";

type DataSourceSubTab = I420DataSourcesSubTab;

const KB_GROUP_LABELS = {
  categories: "Company Categories",
  brands: "Brand Knowledge",
  projects: "Project Knowledge",
} as const;

function statusLabel(status: KbIndexingStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "indexing":
      return "Indexing…";
    case "empty":
      return "Not indexed";
    case "partial":
      return "Partially indexed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusClass(status: KbIndexingStatus): string {
  switch (status) {
    case "ready":
      return "bg-emerald-100 text-emerald-700";
    case "indexing":
      return "bg-blue-100 text-blue-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "partial":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

interface KbGroupProps {
  label: string;
  items: KbCollection[];
  expanded: boolean;
  onToggleExpand: () => void;
  enabledKb: Set<string>;
  onToggle: (key: string) => void;
}

function KbGroup({
  label,
  items,
  expanded,
  onToggleExpand,
  enabledKb,
  onToggle,
}: KbGroupProps) {
  const enabledCount = items.filter((item) => enabledKb.has(item.key)).length;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400 mt-1">No collections found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(40_20%_97%)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{label}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {enabledCount}/{items.length} enabled
          </span>
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-slate-400" />
          : <ChevronRight className="w-4 h-4 text-slate-400" />
        }
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const enabled = enabledKb.has(item.key);
            return (
              <div
                key={item.key}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-colors",
                  !enabled && "bg-[hsl(40_20%_97%)]/50",
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                  enabled ? cn(ab.accentMuted, ab.accentText) : "bg-[hsl(40_20%_96%)] text-[hsl(30_6%_45%)]",
                )}>
                  {enabled
                    ? <Unlock className="w-3 h-3" />
                    : <Lock className="w-3 h-3" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn(
                      "text-xs font-semibold",
                      enabled ? "text-slate-800" : "text-slate-400",
                    )}>
                      {item.name}
                    </p>
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      statusClass(item.status),
                    )}>
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {item.fileCount} {item.fileCount === 1 ? "file" : "files"}
                    {" · "}
                    {item.chunkCount} {item.chunkCount === 1 ? "chunk" : "chunks"}
                    {" · pgvector"}
                  </p>
                  {item.lastIndexed && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Last indexed: {formatDateTime(item.lastIndexed)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={item.manageUrl}
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors",
                      ab.accentSoft,
                      "hover:bg-[hsl(18_40%_92%)]",
                    )}
                  >
                    Manage <ExternalLink className="w-3 h-3" />
                  </Link>
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => onToggle(item.key)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DataSourcesPanel() {
  const [subTab, setSubTab] = useState<DataSourceSubTab>("tables");
  const [enabledTables, setEnabledTables] = useState<Set<string>>(new Set());
  const [enabledKb, setEnabledKb] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [expandedTableGroups, setExpandedTableGroups] = useState<Set<string>>(
    new Set(DATA_TABLE_GROUPS.map((g) => g.category)),
  );
  const [expandedKbGroups, setExpandedKbGroups] = useState<Set<string>>(
    new Set(["categories", "brands", "projects"]),
  );

  const { collections, isLoading: isLoadingKb, error: kbError, reload } = useKbCollections();

  const configRef = useRef({ tables: enabledTables, kb: enabledKb });
  useEffect(() => {
    configRef.current = { tables: enabledTables, kb: enabledKb };
  }, [enabledTables, enabledKb]);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from("organization_integrations" as never)
      .select("config")
      .eq("integration_type", "agent_builder_data_sources")
      .maybeSingle() as { data: { config: DataSourceIntegrationConfig } | null };

    if (data?.config?.enabled_tables) {
      setEnabledTables(new Set(data.config.enabled_tables));
    }
    if (data?.config?.enabled_kb) {
      setEnabledKb(new Set(data.config.enabled_kb));
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const handler = (event: Event) => {
      const subTab = (event as CustomEvent<{ subTab: DataSourceSubTab }>).detail?.subTab;
      if (subTab) setSubTab(subTab);
    };
    window.addEventListener(I420_TOUR_OPEN_DATA_SOURCES_SUBTAB, handler);
    return () => window.removeEventListener(I420_TOUR_OPEN_DATA_SOURCES_SUBTAB, handler);
  }, []);

  const saveConfig = useCallback(async (tables: Set<string>, kb: Set<string>) => {
    setIsSaving(true);
    try {
      const config: DataSourceIntegrationConfig = {
        enabled_tables: Array.from(tables),
        enabled_kb: Array.from(kb),
      };
      const { data: existing } = await supabase
        .from("organization_integrations" as never)
        .select("id")
        .eq("integration_type", "agent_builder_data_sources")
        .maybeSingle() as { data: { id: string } | null };

      if (existing?.id) {
        await supabase
          .from("organization_integrations" as never)
          .update({ config, is_active: true } as never)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("organization_integrations" as never)
          .insert({
            integration_type: "agent_builder_data_sources",
            config,
            is_active: true,
          } as never);
      }
    } catch {
      toast.error("Failed to save data source settings");
    } finally {
      setIsSaving(false);
    }
  }, []);

  function toggleTable(name: string) {
    setEnabledTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      saveConfig(next, configRef.current.kb);
      return next;
    });
  }

  function toggleKb(key: string) {
    setEnabledKb((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveConfig(configRef.current.tables, next);
      return next;
    });
  }

  function toggleTableGroup(category: string) {
    setExpandedTableGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function toggleKbGroup(groupKey: string) {
    setExpandedKbGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  const allTableNames = DATA_TABLE_GROUPS.flatMap((g) => g.tables.map((t) => t.name));
  const allKbKeys = [
    ...collections.categories,
    ...collections.brands,
    ...collections.projects,
  ].map((c) => c.key);

  return (
    <div className="max-w-3xl space-y-4" data-tour="i420-tour-data-sources">
      <p className="text-xs text-slate-500">
        Control what agents can access when building and running flows.
        {isSaving && (
          <span className="ml-2 text-slate-400 inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving…
          </span>
        )}
      </p>

      <div
        className="inline-flex items-center gap-1 p-1 rounded-lg bg-[hsl(40_20%_96%)] border border-[hsl(35_15%_88%)]"
        data-tour="i420-tour-data-sources-subtabs"
      >
        <button
          type="button"
          onClick={() => setSubTab("tables")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            subTab === "tables"
              ? "bg-white shadow-sm text-slate-800"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Data Tables
        </button>
        <button
          type="button"
          onClick={() => setSubTab("kb")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
            subTab === "kb"
              ? "bg-white shadow-sm text-slate-800"
              : "text-slate-500 hover:text-slate-700",
          )}
          data-tour="i420-tour-kb-sources"
        >
          <Database className="w-3 h-3" />
          KB
        </button>
      </div>

      {subTab === "tables" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs text-slate-500 max-w-xl">
              Enable SQL tables for db_query nodes. Disabled tables cannot be accessed
              even if an agent flow includes a DB Query node.
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  const all = new Set(allTableNames);
                  setEnabledTables(all);
                  saveConfig(all, configRef.current.kb);
                }}
              >
                Enable all
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setEnabledTables(new Set());
                  saveConfig(new Set(), configRef.current.kb);
                }}
              >
                Disable all
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {DATA_TABLE_GROUPS.map((group) => {
              const expanded = expandedTableGroups.has(group.category);
              const enabledCount = group.tables.filter((t) => enabledTables.has(t.name)).length;

              return (
                <div
                  key={group.category}
                  className="rounded-xl border border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] overflow-hidden shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleTableGroup(group.category)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(40_20%_97%)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{group.category}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {enabledCount}/{group.tables.length} enabled
                      </span>
                    </div>
                    {expanded
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronRight className="w-4 h-4 text-slate-400" />
                    }
                  </button>

                  {expanded && (
                    <div className="divide-y divide-slate-100">
                      {group.tables.map((table) => {
                        const enabled = enabledTables.has(table.name);
                        return (
                          <div
                            key={table.name}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 transition-colors",
                              !enabled && "bg-[hsl(40_20%_97%)]/50",
                            )}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                              enabled ? cn(ab.accentMuted, ab.accentText) : "bg-[hsl(40_20%_96%)] text-[hsl(30_6%_45%)]",
                            )}>
                              {enabled
                                ? <Unlock className="w-3 h-3" />
                                : <Lock className="w-3 h-3" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-xs font-mono font-semibold",
                                enabled ? "text-slate-800" : "text-slate-400",
                              )}>
                                {table.name}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{table.description}</p>
                            </div>
                            <Switch
                              checked={enabled}
                              onCheckedChange={() => toggleTable(table.name)}
                              className="shrink-0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === "kb" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs text-slate-500 max-w-xl">
              pgvector knowledge collections agents may search for RAG context.
              Runtime wiring is coming later — toggles are saved for future use.
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => reload()}
                disabled={isLoadingKb}
              >
                {isLoadingKb ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                disabled={allKbKeys.length === 0}
                onClick={() => {
                  const all = new Set(allKbKeys);
                  setEnabledKb(all);
                  saveConfig(configRef.current.tables, all);
                }}
              >
                Enable all
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setEnabledKb(new Set());
                  saveConfig(configRef.current.tables, new Set());
                }}
              >
                Disable all
              </Button>
            </div>
          </div>

          {kbError && (
            <p className="text-xs text-red-600">{kbError}</p>
          )}

          {isLoadingKb ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="space-y-3">
              <KbGroup
                label={KB_GROUP_LABELS.categories}
                items={collections.categories}
                expanded={expandedKbGroups.has("categories")}
                onToggleExpand={() => toggleKbGroup("categories")}
                enabledKb={enabledKb}
                onToggle={toggleKb}
              />
              <KbGroup
                label={KB_GROUP_LABELS.brands}
                items={collections.brands}
                expanded={expandedKbGroups.has("brands")}
                onToggleExpand={() => toggleKbGroup("brands")}
                enabledKb={enabledKb}
                onToggle={toggleKb}
              />
              <KbGroup
                label={KB_GROUP_LABELS.projects}
                items={collections.projects}
                expanded={expandedKbGroups.has("projects")}
                onToggleExpand={() => toggleKbGroup("projects")}
                enabledKb={enabledKb}
                onToggle={toggleKb}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
