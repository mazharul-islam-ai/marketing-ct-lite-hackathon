import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil, Play, PowerOff, Search, ShieldCheck, Eye, Bot, Lock, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRunAIAgent } from "@/hooks/useRunAIAgent";
import { useLatestAIAgentRun } from "@/hooks/useLatestAIAgentRun";
import { AgentConfigRouter } from "./AgentConfigRouter";
import { AgentResultsPanel } from "./AgentResultsPanel";
import { BuilderAgentRunnerDialog } from "@/components/agents/BuilderAgentRunnerDialog";

interface BuilderAgent {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  current_version_id: string | null;
  updated_at: string;
}

function BuilderAgentsSection() {
  const [runnerAgent, setRunnerAgent] = useState<BuilderAgent | null>(null);

  const { data: builderAgents = [], isLoading } = useQuery({
    queryKey: ["builder-agents", "admin-only"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents" as never)
        .select("id, name, description, visibility, current_version_id, updated_at")
        .eq("status", "published")
        .eq("visibility", "admin_only")
        .order("updated_at", { ascending: false }) as { data: BuilderAgent[] | null; error: unknown };
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return (
    <div className="flex h-24 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (builderAgents.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-amber-600" />
        <h3 className="text-base font-semibold">Builder Agents — Admin Only</h3>
        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
          {builderAgents.length} published
        </Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {builderAgents.map((agent) => (
          <Card key={agent.id} className="flex flex-col border-amber-100">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    {agent.description && (
                      <CardDescription className="mt-0.5">{agent.description}</CardDescription>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 shrink-0">
                  Admin Only
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="text-xs text-muted-foreground">
                Updated {new Date(agent.updated_at).toLocaleDateString()}
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setRunnerAgent(agent)}
                  disabled={!agent.current_version_id}
                  title={!agent.current_version_id ? "No compiled version available" : undefined}
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Run
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={`/adminpanel/agent-builder/${agent.id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open Builder
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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

interface AIAgentsSectionProps {
  userId: string;
  canManage: boolean;
}

interface AIAgentRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  created_at: string;
  knowledge_collections?: string[] | null;
  config?: Record<string, unknown> | null;
}

const parseKnowledgeCollections = (agent: AIAgentRecord) => {
  if (Array.isArray(agent.knowledge_collections)) {
    return agent.knowledge_collections.filter((value): value is string => typeof value === "string");
  }

  const raw = agent.config as Record<string, unknown> | null;
  const collections = Array.isArray(raw?.knowledge_collections)
    ? (raw?.knowledge_collections as unknown[]).filter((value): value is string => typeof value === "string")
    : [];
  return collections;
};

export const AIAgentsSection = ({ userId, canManage }: AIAgentsSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const runAgentMutation = useRunAIAgent();

  const [search, setSearch] = useState("");
  const [runDialogAgent, setRunDialogAgent] = useState<AIAgentRecord | null>(null);
  const [configDialogAgent, setConfigDialogAgent] = useState<AIAgentRecord | null>(null);
  const [resultsDialogAgent, setResultsDialogAgent] = useState<AIAgentRecord | null>(null);
  const [prompt, setPrompt] = useState("");

  // Fetch latest run for the currently selected results agent
  const latestRunQuery = useLatestAIAgentRun(resultsDialogAgent?.id ?? "");

  const agentsQuery = useQuery({
    queryKey: ["ai-control", "agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, slug, description, category, is_enabled, created_at, system_prompt, data_sources, schedule_config, output_actions")
        .order("name");

      if (error) throw error;
      return (data ?? []) as AIAgentRecord[];
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (agent: AIAgentRecord) => {
      const { error } = await supabase
        .from("ai_agents")
        .update({ is_enabled: !agent.is_enabled })
        .eq("id", agent.id);

      if (error) throw error;
      return !agent.is_enabled;
    },
    onSuccess: (_, agent) => {
      toast({
        title: agent.is_enabled ? "Agent deactivated" : "Agent reactivated",
        description: `${agent.name} has been ${agent.is_enabled ? "disabled" : "enabled"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["ai-control", "agents"] });
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["internal-agents"] }); // Also refresh /my-agents page
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to update agent",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const filteredAgents = useMemo(() => {
    const list = agentsQuery.data ?? [];
    if (!search.trim()) return list;
    const query = search.toLowerCase();
    return list.filter((agent) =>
      [agent.name, agent.description ?? "", agent.category]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [agentsQuery.data, search]);

  const handleRunAgentClick = (agent: AIAgentRecord) => {
    if (!agent.is_enabled) return;
    
    // Navigate to admin agent run page
    navigate(`/adminpanel/ai-control/run/${agent.slug}`);
  };

  const handleRunAgent = () => {
    if (!runDialogAgent) return;
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Add context so the agent knows what to do.",
        variant: "destructive",
      });
      return;
    }

    const agentToRun = runDialogAgent;

    runAgentMutation.mutate(
      {
        agent_id: runDialogAgent.id,
        execution_context: {
          user_id: userId,
          prompt,
          context: "Control panel run",
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Agent run completed",
            description: `${agentToRun.name} finished processing. Click "View Results" to see the analysis.`,
          });
          setPrompt("");
          setRunDialogAgent(null);
          // Invalidate to refresh latest run data
          queryClient.invalidateQueries({ queryKey: ["ai-agent-run", agentToRun.id] });
          // Auto-open results dialog
          setResultsDialogAgent(agentToRun);
        },
        onError: (error) => {
          toast({
            title: "Agent run failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Registered Agents</h2>
          <p className="text-sm text-muted-foreground">
            Launch an agent run, review configuration, or adjust activation status.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-80">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agents"
            className="w-full"
          />
        </div>
      </div>

      {agentsQuery.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((agent) => {
            const knowledgeCollections = parseKnowledgeCollections(agent);
            return (
              <Card key={agent.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription>{agent.description}</CardDescription>
                    </div>
                    <Badge variant={agent.is_enabled ? "default" : "secondary"} className="capitalize">
                      {agent.is_enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-muted-foreground">Category</p>
                    <p className="font-semibold text-foreground capitalize">{agent.category}</p>
                  </div>
                  {knowledgeCollections.length > 0 && (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-muted-foreground">Knowledge Collections</p>
                      <div className="flex flex-wrap gap-2">
                        {knowledgeCollections.map((collection) => (
                          <Badge key={collection} variant="outline">
                            {collection}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => handleRunAgentClick(agent)} disabled={!agent.is_enabled}>
                      <Play className="mr-2 h-4 w-4" /> Run Agent
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setResultsDialogAgent(agent)}
                    >
                      <Eye className="mr-2 h-4 w-4" /> View Results
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfigDialogAgent(agent)}
                      disabled={!canManage}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Configure
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deactivateMutation.mutate(agent)}
                      disabled={!canManage}
                    >
                      <PowerOff className="mr-2 h-4 w-4" />
                      {agent.is_enabled ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredAgents.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No agents found</h3>
                  <p className="text-sm text-muted-foreground">
                    Adjust your filters or add new agents via the integration manager.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Builder Agents (Admin Only) — shown below the ai_agents grid */}
      {canManage && (
        <div className="pt-4 border-t border-slate-100">
          <BuilderAgentsSection />
        </div>
      )}

      {/* Run Agent Dialog */}
      <Dialog open={Boolean(runDialogAgent)} onOpenChange={(open) => (!open ? setRunDialogAgent(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run {runDialogAgent?.name}</DialogTitle>
            <DialogDescription>
              Provide a prompt or context for this agent run. Company knowledge will be appended automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What should the agent do?"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogAgent(null)}>
              Cancel
            </Button>
            <Button onClick={handleRunAgent} disabled={runAgentMutation.isPending}>
              {runAgentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Agent
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Agent Dialog */}
      <Dialog open={Boolean(configDialogAgent)} onOpenChange={(open) => (!open ? setConfigDialogAgent(null) : null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure {configDialogAgent?.name}</DialogTitle>
            <DialogDescription>
              Manage agent-specific settings, prompts, and knowledge sources.
            </DialogDescription>
          </DialogHeader>
          {configDialogAgent && <AgentConfigRouter agent={configDialogAgent} onClose={() => setConfigDialogAgent(null)} />}
        </DialogContent>
      </Dialog>

      {/* View Results Dialog */}
      <Dialog open={Boolean(resultsDialogAgent)} onOpenChange={(open) => (!open ? setResultsDialogAgent(null) : null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{resultsDialogAgent?.name} - Latest Results</DialogTitle>
            <DialogDescription>
              View the most recent analysis from this agent.
            </DialogDescription>
          </DialogHeader>
          {latestRunQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : latestRunQuery.data ? (
            <AgentResultsPanel run={latestRunQuery.data} agentName={resultsDialogAgent?.name} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No completed runs found for this agent.</p>
              <p className="text-sm text-muted-foreground mt-1">Run the agent to generate analysis results.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIAgentsSection;
