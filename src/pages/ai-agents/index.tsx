import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Play, MessageSquare, Clock, Search, Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BuilderAgentRunnerDialog } from "@/components/agents/BuilderAgentRunnerDialog";
import { BuilderAgentChatDialog } from "@/components/agents/BuilderAgentChatDialog";
import { getFlowCapabilities } from "@/pages/adminpanel/agent-builder/flowCapabilities";
import type { FlowJSON } from "@/pages/adminpanel/agent-builder/types";

interface WorkspaceAgent {
  id: string;
  name: string;
  description: string | null;
  current_version_id: string | null;
  updated_at: string;
  flow_json: FlowJSON | null;
}

type DialogMode = "report" | "chat" | null;

export default function AIAgentsPage() {
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<WorkspaceAgent | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["builder-agents", "workspace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents" as never)
        .select("id, name, description, current_version_id, updated_at")
        .eq("status", "published")
        .eq("visibility", "workspace")
        .order("updated_at", { ascending: false }) as { data: Omit<WorkspaceAgent, "flow_json">[] | null; error: unknown };
      if (error) throw error;

      const rows = data ?? [];
      const versionIds = rows
        .map((a) => a.current_version_id)
        .filter((id): id is string => Boolean(id));

      let flowByVersion = new Map<string, FlowJSON>();
      if (versionIds.length > 0) {
        const { data: versions } = await supabase
          .from("agent_versions" as never)
          .select("id, flow_json")
          .in("id", versionIds) as { data: { id: string; flow_json: FlowJSON }[] | null };

        flowByVersion = new Map(
          (versions ?? []).map((v) => [v.id, v.flow_json]),
        );
      }

      return rows.map((agent) => ({
        ...agent,
        flow_json: agent.current_version_id
          ? flowByVersion.get(agent.current_version_id) ?? null
          : null,
      }));
    },
  });

  const filtered = agents.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.description ?? "").toLowerCase().includes(q)
    );
  });

  const openDialog = (agent: WorkspaceAgent, mode: DialogMode) => {
    setSelectedAgent(agent);
    setDialogMode(mode);
  };

  const closeDialog = () => {
    setSelectedAgent(null);
    setDialogMode(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-600" />
            AI Agents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Published agents available to all workspace members.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-center gap-3 text-muted-foreground">
          <Inbox className="h-10 w-10 opacity-30" />
          <div>
            <p className="font-medium">
              {search ? "No agents match your search" : "No agents published yet"}
            </p>
            <p className="text-sm mt-1">
              {search
                ? "Try a different search term"
                : "Admins can publish agents with Workspace visibility in the Agent Builder"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onRunReport={() => openDialog(agent, "report")}
              onChat={() => openDialog(agent, "chat")}
            />
          ))}
        </div>
      )}

      {selectedAgent && dialogMode === "report" && (
        <BuilderAgentRunnerDialog
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
          versionId={selectedAgent.current_version_id}
          mode="report"
          onClose={closeDialog}
        />
      )}

      {selectedAgent && dialogMode === "chat" && (
        <BuilderAgentChatDialog
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
          versionId={selectedAgent.current_version_id}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onRunReport,
  onChat,
}: {
  agent: WorkspaceAgent;
  onRunReport: () => void;
  onChat: () => void;
}) {
  const hasVersion = Boolean(agent.current_version_id);
  const { hasChat, hasReport } = getFlowCapabilities(agent.flow_json);

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 shrink-0">
            <Bot className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{agent.name}</CardTitle>
            {agent.description && (
              <CardDescription className="mt-0.5 line-clamp-2">
                {agent.description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
            Workspace
          </Badge>
          {hasChat && (
            <Badge variant="outline" className="text-xs border-violet-200 text-violet-700 bg-violet-50">
              Chat
            </Badge>
          )}
          {hasReport && (
            <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700 bg-emerald-50">
              Report
            </Badge>
          )}
          {!hasVersion && (
            <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50">
              No version
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-auto">
          <Clock className="h-3 w-3" />
          Updated {new Date(agent.updated_at).toLocaleDateString()}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={onRunReport}
            disabled={!hasVersion}
            title={!hasVersion ? "No compiled version available yet" : undefined}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Run Report
          </Button>
          {hasChat && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onChat}
              disabled={!hasVersion}
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Chat
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
