import { GitCompare, ArrowRight, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";
import type { CompileDiffSession } from "../hooks/useBuilderSession";
import { diffFlows, summarizeDiff } from "../flowDiff";
import type { FlowNode } from "../types";

interface CompareCanvasProps {
  session: CompileDiffSession;
  onOpenInFlow: () => void;
  onDismiss: () => void;
}

function NodeChip({
  node,
  variant,
}: {
  node: FlowNode;
  variant: "added" | "removed" | "changed" | "unchanged";
}) {
  const cls =
    variant === "added"
      ? ab.diffAdded
      : variant === "removed"
        ? ab.diffRemoved
        : variant === "changed"
          ? ab.diffChanged
          : ab.diffUnchanged;

  const prefix =
    variant === "added" ? "+" : variant === "removed" ? "−" : variant === "changed" ? "~" : " ";

  return (
    <div className={cn("rounded-lg border px-2.5 py-1.5 text-[11px]", cls)}>
      <span className="font-mono font-semibold mr-1">{prefix}</span>
      <span className="font-medium">{node.label || node.type}</span>
      <span className="text-[10px] opacity-70 ml-1.5">{node.type}</span>
    </div>
  );
}

function Column({
  title,
  versionLabel,
  nodes,
  variant,
  emptyLabel,
}: {
  title: string;
  versionLabel?: string | null;
  nodes: Array<{ node: FlowNode; variant: "added" | "removed" | "changed" | "unchanged"; changedKeys?: string[] }>;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-col min-h-0 flex-1 rounded-xl border border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[hsl(35_15%_88%)] bg-[hsl(40_20%_97%)] shrink-0">
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        {versionLabel != null && (
          <p className="text-[10px] text-slate-400 mt-0.5">{versionLabel}</p>
        )}
      </div>
      <ScrollArea className="flex-1 max-h-[calc(100vh-280px)]">
        <div className="p-3 space-y-1.5">
          {nodes.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">{emptyLabel}</p>
          ) : (
            nodes.map(({ node, variant: v, changedKeys }) => (
              <div key={node.id}>
                <NodeChip node={node} variant={v} />
                {changedKeys && changedKeys.length > 0 && (
                  <p className="text-[10px] text-amber-700 mt-0.5 ml-2">
                    changed: {changedKeys.join(", ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function CompareCanvas({ session, onOpenInFlow, onDismiss }: CompareCanvasProps) {
  const diff = diffFlows(session.before, session.after);

  const beforeNodes = [
    ...diff.removed.map((node) => ({ node, variant: "removed" as const })),
    ...diff.changed.map(({ before, changedKeys }) => ({
      node: before,
      variant: "changed" as const,
      changedKeys,
    })),
    ...diff.unchanged.map((node) => ({ node, variant: "unchanged" as const })),
  ];

  const afterNodes = [
    ...diff.added.map((node) => ({ node, variant: "added" as const })),
    ...diff.changed.map(({ node, changedKeys }) => ({
      node,
      variant: "changed" as const,
      changedKeys,
    })),
    ...diff.unchanged.map((node) => ({ node, variant: "unchanged" as const })),
  ];

  const beforeVersion =
    session.previousVersion != null ? `Version ${session.previousVersion}` : "Previous state";
  const afterVersion =
    session.newVersion != null ? `Version ${session.newVersion}` : "Current";

  return (
    <div className="absolute inset-0 z-[2] flex flex-col overflow-hidden bg-[hsl(40_33%_97%/0.92)] backdrop-blur-sm">
      <div className="px-4 py-3 border-b border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] shrink-0 flex items-center gap-3">
        <GitCompare className="w-4 h-4 text-[hsl(18_52%_52%)] shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Compare changes</p>
          <p className="text-[11px] text-slate-500">{summarizeDiff(diff)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onOpenInFlow}>
            <LayoutGrid className="w-3 h-3" />
            View in Flow
          </Button>
          <Button size="sm" className={cn("h-8 text-xs", ab.accentBtn)} onClick={onDismiss}>
            Keep {session.newVersion != null ? `v${session.newVersion}` : "current"}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4 flex gap-3 items-stretch">
        <Column title="Before" versionLabel={beforeVersion} nodes={beforeNodes} emptyLabel="Empty workflow" />
        <div className="flex items-center shrink-0 text-slate-300">
          <ArrowRight className="w-5 h-5" />
        </div>
        <Column title="After" versionLabel={afterVersion} nodes={afterNodes} emptyLabel="Empty workflow" />
      </div>
    </div>
  );
}
