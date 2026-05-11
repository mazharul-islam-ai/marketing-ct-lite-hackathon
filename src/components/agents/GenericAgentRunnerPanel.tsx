import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRunAIAgent } from "@/hooks/useRunAIAgent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

interface GenericAgentRunnerPanelProps {
  slug: string;
}

export function GenericAgentRunnerPanel({ slug }: GenericAgentRunnerPanelProps) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [brandId, setBrandId] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<string | null>(null);

  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery({
    queryKey: ["ai-agent", "by-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, slug, description, category, config")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const isBrandAware = useMemo(() => {
    const cfg = (agent?.config ?? {}) as Record<string, unknown>;
    if (cfg.brand_aware === true || cfg.requires_brand === true) return true;
    // Heuristic for known brand-scoped agents
    return /brand|competitor|client|seo|social|newsletter/i.test(slug);
  }, [agent?.config, slug]);

  const { data: brands = [] } = useQuery({
    queryKey: ["brands", "for-agent-runner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isBrandAware,
  });

  const runAgent = useRunAIAgent();

  // Reset state when slug changes
  useEffect(() => {
    setInput("");
    setBrandId(undefined);
    setResult(null);
  }, [slug]);

  const handleRun = async () => {
    if (!agent) return;
    if (!input.trim()) {
      toast({
        title: "Input required",
        description: "Please describe what you want the agent to do.",
        variant: "destructive",
      });
      return;
    }
    if (isBrandAware && !brandId) {
      toast({
        title: "Brand required",
        description: "Select a brand for this agent before running.",
        variant: "destructive",
      });
      return;
    }

    setResult(null);
    try {
      const data = await runAgent.mutateAsync({
        agent_id: agent.id,
        execution_context: {
          user_id: user?.id ?? "",
          input,
          prompt: input,
          ...(brandId ? { brand_id: brandId } : {}),
        },
      });

      const summary =
        (data?.summary as string | undefined) ??
        (typeof data === "string" ? data : null) ??
        JSON.stringify(data, null, 2);
      setResult(summary);
      toast({ title: "Agent run complete" });
    } catch (err: any) {
      const msg = err?.message || "Agent run failed";
      const isPayment = /402|payment/i.test(msg);
      const isRate = /429|rate/i.test(msg);
      toast({
        title: isPayment
          ? "Credits exhausted"
          : isRate
          ? "Rate limited"
          : "Run failed",
        description: msg,
        variant: "destructive",
      });
    }
  };

  if (agentLoading) {
    return (
      <Card>
        <CardContent className="py-8 space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (agentError || !agent) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Agent "{slug}" was not found in the registry.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {agent.name}
          </CardTitle>
          {agent.description && (
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isBrandAware && (
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger id="brand">
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="input">Prompt / Input</Label>
            <Textarea
              id="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Describe what you want ${agent.name} to do...`}
              rows={6}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleRun} disabled={runAgent.isPending}>
              {runAgent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                "Run Agent"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GenericAgentRunnerPanel;
