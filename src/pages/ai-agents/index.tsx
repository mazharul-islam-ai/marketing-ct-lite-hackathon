import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Play, Clock, Search, Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BuilderAgentRunnerDialog } from "@/components/agents/BuilderAgentRunnerDialog";

interface WorkspaceAgent {
  id: string;
  name: string;
  description: string | null;
  current_version_id: string | null;
  updated_at: string;
}

export default function AIAgentsPage() {
  const [search, setSearch] = useState("");
  const [runnerAgent, setRunnerAgent] = useState<WorkspaceAgent | null>(null);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["builder-agents", "workspace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents" as never)
        .select("id, name, description, current_version_id, updated_at")
        .eq("status", "published")
        .eq("visibility", "workspace")
        .order("updated_at", { ascending: false }) as { data: WorkspaceAgent[] | null; error: unknown };
      if (error) throw error;
      return data ?? [];
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
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

      {/* Content */}
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
                : "Admins can publish agents for workspace users in the Agent Builder"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onRun={() => setRunnerAgent(agent)}
            />
          ))}
        </div>
      )}

      {runnerAgent && (
        <BuilderAgentRunnerDialog
          agentId={runnerAgent.id}
          agentName={runnerAgent.name}
          versionId={runnerAgent.current_version_id}
          onClose={() => setRunnerAgent(null)}
        />
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onRun,
}: {
  agent: WorkspaceAgent;
  onRun: () => void;
}) {
  const hasVersion = Boolean(agent.current_version_id);

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
        <Button
          size="sm"
          className="w-full"
          onClick={onRun}
          disabled={!hasVersion}
          title={!hasVersion ? "No compiled version available yet" : undefined}
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Run Agent
        </Button>
      </CardContent>
    </Card>
  );
}
