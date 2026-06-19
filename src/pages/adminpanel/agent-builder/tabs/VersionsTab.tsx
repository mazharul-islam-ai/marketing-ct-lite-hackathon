import { useEffect, useState } from "react";
import { RotateCcw, ChevronDown, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AgentVersion, FlowJSON } from "../types";
import { ab } from "../agentBuilderTheme";

interface VersionsTabProps {
  agentId: string;
  currentVersionId: string | null;
  onRollback: (version: AgentVersion) => void;
}

export function VersionsTab({ agentId, currentVersionId, onRollback }: VersionsTabProps) {
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadVersions() {
    setIsLoading(true);
    const { data } = await supabase
      .from("agent_versions" as never)
      .select("*")
      .eq("agent_id", agentId)
      .order("version", { ascending: false }) as { data: AgentVersion[] | null };

    if (data) setVersions(data);
    setIsLoading(false);
  }

  async function handleRollback(version: AgentVersion) {
    setRollingBack(version.id);
    try {
      // Set agent's current_version_id to this version
      const { error } = await supabase
        .from("agents" as never)
        .update({ current_version_id: version.id, updated_at: new Date().toISOString() })
        .eq("id", agentId);

      if (error) throw error;

      onRollback(version);
      toast.success(`Rolled back to v${version.version}`);
      await loadVersions();
    } catch (err) {
      toast.error("Rollback failed");
      console.error(err);
    } finally {
      setRollingBack(null);
    }
  }

  return (
    <div className={cn("flex flex-col h-full", ab.canvas)}>
      <div className={cn("px-4 py-2.5 flex items-center gap-2", ab.toolbar)}>
        <GitBranch className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">Version History</span>
        <span className="ml-auto text-[10px] text-slate-400">{versions.length} versions</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-2">
          {isLoading && <p className="text-xs text-slate-400">Loading versions…</p>}

          {!isLoading && versions.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium">No versions yet</p>
              <p className="text-[11px] mt-1">Generate a flow to create version 1</p>
            </div>
          )}

          {versions.map((v) => {
            const isCurrent = v.id === currentVersionId;
            const nodeCount = (v.flow_json?.steps?.length ?? 0) + (v.flow_json?.trigger ? 1 : 0);
            const isExpanded = expandedId === v.id;

            return (
              <div
                key={v.id}
                className={cn(
                  "rounded-lg border text-xs transition-colors",
                  isCurrent ? "border-[hsl(248_35%_82%)] bg-[hsl(248_40%_96%)]" : "border-[hsl(250_18%_90%)] hover:border-[hsl(248_35%_82%)]",
                )}
              >
                {/* Version row */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {/* Version number */}
                  <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0",
                    isCurrent ? ab.accentBtn : "bg-[hsl(250_25%_94%)] text-[hsl(240_8%_40%)]",
                  )}>
                    v{v.version}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isCurrent && (
                        <span className={cn("text-[10px] font-semibold", ab.accentText)}>● current</span>
                      )}
                      <span className="text-slate-600 font-medium">{nodeCount} nodes</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(v.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] gap-1 px-2"
                        onClick={() => handleRollback(v)}
                        disabled={!!rollingBack}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        Rollback
                      </Button>
                    )}
                    <button
                      className="p-1 text-slate-400 hover:text-slate-600"
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    >
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isExpanded && "rotate-180")} />
                    </button>
                  </div>
                </div>

                {/* Expanded flow JSON preview */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-[hsl(250_18%_90%)]">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 mt-2">
                      Flow snapshot
                    </p>
                    <pre className={cn("text-[10px] rounded p-2.5 overflow-x-auto max-h-36 font-mono border", ab.logArea, ab.borderSoft, ab.textForeground)}>
                      {JSON.stringify(v.flow_json, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
