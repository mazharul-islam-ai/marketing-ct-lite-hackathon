import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, Sparkles, X, RotateCcw, Save, AlertTriangle, Check, Database, BarChart3, Target, FileText, Activity, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCalendarView } from "./ContentCalendarView";
import { formatDistanceToNow } from "date-fns";

interface ContentStrategistInlinePanelProps {
  brandId?: string;
  brandName?: string;
  onClose: () => void;
}

export function ContentStrategistInlinePanel({ brandId: propBrandId, brandName: propBrandName, onClose }: ContentStrategistInlinePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBrandId, setSelectedBrandId] = useState<string>(propBrandId || "");
  const [selectedLeader, setSelectedLeader] = useState<string>("");
  const [contentType, setContentType] = useState("all");
  const [runResult, setRunResult] = useState<any>(null);
  const [showRefinement, setShowRefinement] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [saved, setSaved] = useState(false);

  // Use selected brand or prop brand
  const brandId = selectedBrandId || propBrandId;
  const brandName = propBrandName || "";

  // Check for recent runs for THIS brand
  const { data: recentRun } = useQuery({
    queryKey: ["recent-agent-run", brandId, "content-strategist"],
    queryFn: async () => {
      const { data: agent } = await supabase
        .from("ai_agents")
        .select("id")
        .eq("slug", "content-strategist")
        .single();

      if (!agent) return null;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("ai_agent_runs")
        .select("id, created_at, execution_context")
        .eq("agent_id", agent.id)
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(10);

      // Filter to runs that include this brand
      const relevantRun = (data || []).find((run: any) => {
        const ctx = run.execution_context;
        if (!ctx) return false;
        return ctx.brand_id === brandId;
      });
      return relevantRun || null;
    },
  });

  // Fetch all brands
  const { data: brands = [], isLoading: isLoadingBrands } = useQuery({
    queryKey: ["brands-for-agent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Get selected brand name
  const selectedBrand = brands.find(b => b.id === brandId);

  // Fetch thought leaders for selected brand
  const { data: leaders = [] } = useQuery({
    queryKey: ["leaders-for-brand", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      if (!brandId) return [];
      const { data, error } = await (supabase as any)
        .from("thought_leaders")
        .select("id, name")
        .eq("brand_id", brandId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Direct call to content-strategist-agent edge function
  const runAgentMutation = useMutation({
    mutationFn: async (refinement?: string) => {
      const { data, error } = await supabase.functions.invoke("content-strategist-agent", {
        body: {
          brand_id: brandId,
          leader_id: selectedLeader && selectedLeader !== "all-leaders" ? selectedLeader : undefined,
          content_type: contentType !== "all" ? contentType : undefined,
          refinement_prompt: refinement || undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Content strategy generated", description: "Review the results below" });
      setRunResult(data);
      setShowRefinement(false);
      setRefinementPrompt("");
    },
    onError: (error) => {
      toast({
        title: "Failed to run agent",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleRun = () => {
    runAgentMutation.mutate(undefined);
  };

  const handleRunWithRefinement = () => {
    runAgentMutation.mutate(refinementPrompt);
  };

  const handleRerun = () => {
    setRunResult(null);
    setShowRefinement(false);
    setRefinementPrompt("");
  };

  const handleSave = async () => {
    if (!runResult?.run_id || saved) return;

    try {
      const { error } = await supabase
        .from("ai_agent_runs")
        .update({
          execution_context: {
            brand_id: brandId,
            brand_name: brandName,
            leader_id: selectedLeader || null,
            saved_at: new Date().toISOString(),
            saved_by_user: true,
          },
        })
        .eq("id", runResult.run_id);

      if (error) throw error;
      
      // Invalidate insights query so new data appears in Insights tab
      queryClient.invalidateQueries({ queryKey: ["brand-insights", brandId] });
      
      toast({ title: "Results saved", description: "View this analysis in the Insights tab" });
      setSaved(true);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Content Strategist</CardTitle>
              <CardDescription>
                Generate content ideas and hooks for {brandName}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Brand Selector - show if no brandId provided */}
        {!propBrandId && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <Label className="text-base font-semibold mb-3 block">Select Brand</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which brand you want to generate content for
            </p>
            {isLoadingBrands ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading brands...</span>
              </div>
            ) : (
              <Select value={selectedBrandId} onValueChange={(value) => {
                setSelectedBrandId(value);
                setSelectedLeader(""); // Reset leader when brand changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Show selected brand name */}
        {propBrandId && brandName && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">Generating for:</span>{" "}
              <strong className="text-foreground">{brandName}</strong>
            </p>
          </div>
        )}
        
        {selectedBrandId && selectedBrand && !propBrandId && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">Generating for:</span>{" "}
              <strong className="text-foreground">{selectedBrand.name}</strong>
            </p>
          </div>
        )}

        {runResult?.content_outputs ? (
          <div className="space-y-4">
            {/* Data Sources Used */}
            {runResult?.data_sources_used && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Data Sources Used</p>
                <div className="flex gap-2 flex-wrap">
                  {runResult.data_sources_used.knowledge_base && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Database className="h-3 w-3" />
                      Knowledge Base
                    </Badge>
                  )}
                  {runResult.data_sources_used.analytics && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Analytics
                    </Badge>
                  )}
                  {runResult.data_sources_used.kpis && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Target className="h-3 w-3" />
                      KPIs
                    </Badge>
                  )}
                  {runResult.data_sources_used.leader_uploads && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <FileText className="h-3 w-3" />
                      Leader Uploads
                    </Badge>
                  )}
                  {runResult.data_sources_used.performance_metrics && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Activity className="h-3 w-3" />
                      Performance
                    </Badge>
                  )}
                  {runResult.data_sources_used.brand_info && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Building2 className="h-3 w-3" />
                      Brand Info
                    </Badge>
                  )}
                </div>
                {/* Warnings for missing data */}
                {!runResult.data_sources_used.analytics && !runResult.data_sources_used.kpis && (
                  <Alert variant="default" className="mt-3 border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-xs">
                      No Analytics or KPIs found. Connect Google Analytics and add KPIs for more targeted content strategies.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex gap-2">
                {showRefinement ? (
                  <div className="flex-1 space-y-2 min-w-[300px]">
                    <Textarea
                      value={refinementPrompt}
                      onChange={(e) => setRefinementPrompt(e.target.value)}
                      placeholder="e.g., Focus more on LinkedIn posts, use a more casual tone..."
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowRefinement(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleRunWithRefinement} disabled={runAgentMutation.isPending}>
                        {runAgentMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        Run with Updates
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowRefinement(true)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Run Again
                    </Button>
                    {saved ? (
                      <Button variant="outline" size="sm" disabled className="text-green-600">
                        <Check className="mr-2 h-4 w-4" />
                        Saved
                      </Button>
                    ) : (
                      <Button variant="default" size="sm" onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Results
                      </Button>
                    )}
                  </>
                )}
              </div>
              {!showRefinement && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>

            <ContentCalendarView
              contentOutputs={runResult.content_outputs}
              brandId={brandId}
              onApprove={(selected) => {
                toast({ title: `Approved ${selected.length} assets` });
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recent run warning */}
            {recentRun && (
              <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm">
                  This agent was run {formatDistanceToNow(new Date(recentRun.created_at))} ago.
                  Running again may produce similar results.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {leaders.length > 0 && (
                <div className="space-y-2">
                  <Label>Thought Leader (optional)</Label>
                  <Select value={selectedLeader} onValueChange={setSelectedLeader}>
                    <SelectTrigger>
                      <SelectValue placeholder="All leaders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-leaders">All leaders</SelectItem>
                      {leaders.map((leader) => (
                        <SelectItem key={leader.id} value={leader.id}>
                          {leader.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="video_transcript">Video Transcript</SelectItem>
                    <SelectItem value="podcast">Podcast</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium mb-1">What this agent will do:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Analyze uploaded transcripts and documents</li>
                <li>Generate hook ideas with performance reasoning</li>
                <li>Create multi-channel repurpose assets</li>
                <li>Build a suggested content calendar</li>
              </ul>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleRun} disabled={runAgentMutation.isPending || !brandId}>
                {runAgentMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    {!brandId ? "Select a brand first" : "Generate Strategy"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
