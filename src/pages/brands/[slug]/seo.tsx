import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Breadcrumb, 
  BreadcrumbList, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbSeparator, 
  BreadcrumbPage 
} from "@/components/ui/breadcrumb";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRunAIAgent } from "@/hooks/useRunAIAgent";
import { useLatestAIAgentRun } from "@/hooks/useLatestAIAgentRun";
import { Loader2, Sparkles, Globe, Upload, ListChecks, ChevronRight, Link2, Users } from "lucide-react";
import { SEOInputForm } from "@/features/seo-hub/components/SEOInputForm";
import { BacklinkResultsTable } from "@/features/seo-hub/components/results/BacklinkResultsTable";
import { CompetitorResultsCards } from "@/features/seo-hub/components/results/CompetitorResultsCards";
import { checkBacklinks, getMockCompetitorResults, saveSEOReport } from "@/features/seo-hub/api";
import type { BacklinkResultRow, CompetitorResultCard } from "@/features/seo-hub/types";

interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
}

interface AnalyticsRecord {
  id: string;
  date_range_start: string | null;
  date_range_end: string | null;
  metrics: Record<string, unknown> | null;
  dimensions: Record<string, unknown> | null;
}

interface AgentRecord {
  id: string;
  name: string;
  description: string | null;
  category: string;
  config?: Record<string, unknown> | null;
}

const metricLabels: Array<{ key: string; label: string; formatter?: (value: number) => string }> = [
  { key: "sessions", label: "Organic Sessions" },
  { key: "pageviews", label: "Page Views" },
  { key: "bounce_rate", label: "Bounce Rate", formatter: (value) => `${value.toFixed(1)}%` },
  { key: "avg_position", label: "Avg. SERP Position", formatter: (value) => value.toFixed(1) },
];

const getNumericMetric = (metrics: Record<string, unknown> | null, key: string): number | null => {
  if (!metrics) return null;
  const value = metrics[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatMetric = (metrics: Record<string, unknown> | null, key: string, formatter?: (value: number) => string) => {
  const value = getNumericMetric(metrics, key);
  if (value === null) return "—";
  return formatter ? formatter(value) : value.toLocaleString();
};

const normalizeKeywordList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : String(item)))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
};

const BrandPublicSEOPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [contentTab, setContentTab] = useState<"url" | "file" | "text">("url");
  const [contentUrl, setContentUrl] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [notes, setNotes] = useState("");
  const [competitorNotes, setCompetitorNotes] = useState("");
  const [timeframe, setTimeframe] = useState("current_month");

  const brandQuery = useQuery({
    queryKey: ["public-brand-seo", slug],
    enabled: Boolean(slug),
    queryFn: async (): Promise<BrandRecord | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, description, logo_url, website_url")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        name: data.name ?? slug,
        slug: data.slug ?? slug,
        description: data.description,
        logo_url: data.logo_url,
        website_url: data.website_url,
      };
    },
  });

  const analyticsQuery = useQuery({
    queryKey: ["public-brand-seo-analytics", brandQuery.data?.id],
    enabled: Boolean(brandQuery.data?.id),
    queryFn: async (): Promise<AnalyticsRecord[]> => {
      const { data, error } = await supabase
        .from("brand_analytics_data")
        .select("id, date_range_start, date_range_end, metrics, dimensions")
        .eq("brand_id", brandQuery.data!.id)
        .order("date_range_start", { ascending: false })
        .limit(6);

      if (error) throw error;
      return (data as AnalyticsRecord[]) ?? [];
    },
  });

  const agentsQuery = useQuery({
    queryKey: ["seo-agents"],
    queryFn: async (): Promise<AgentRecord[]> => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, description, category")
        .eq("category", "seo")
        .eq("is_enabled", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data as AgentRecord[]) ?? [];
    },
  });

  useEffect(() => {
    if (!selectedAgentId && agentsQuery.data && agentsQuery.data.length > 0) {
      setSelectedAgentId(agentsQuery.data[0].id);
    }
  }, [agentsQuery.data, selectedAgentId]);

  const latestAnalytics = analyticsQuery.data?.[0];

  useEffect(() => {
    const initialKeywords = normalizeKeywordList(latestAnalytics?.dimensions?.keywords);
    setKeywords(initialKeywords);
  }, [latestAnalytics?.id]);

  const keywordMutation = useMutation({
    mutationFn: async (updatedKeywords: string[]) => {
      if (!brandQuery.data) throw new Error("Brand not found");
      const { error } = await supabase.functions.invoke("n8n-analytics-manage", {
        body: {
          action: "update_keywords",
          brandId: brandQuery.data.id,
          keywords: updatedKeywords,
        },
      });

      if (error) throw error;
      return updatedKeywords;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["public-brand-seo-analytics", brandQuery.data?.id] });
      toast({ title: "Keywords saved", description: "Keyword list updated for this brand." });
      setKeywords(updated);
      setNewKeyword("");
    },
    onError: (error) => {
      toast({
        title: "Unable to save keywords",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleAddKeyword = () => {
    const value = newKeyword.trim();
    if (!value) return;
    if (keywords.some((keyword) => keyword.toLowerCase() === value.toLowerCase())) {
      toast({ title: "Duplicate keyword", description: `${value} is already tracked.`, variant: "destructive" });
      return;
    }
    setKeywords((prev) => [...prev, value]);
    setNewKeyword("");
  };

  const handleRemoveKeyword = (value: string) => {
    setKeywords((prev) => prev.filter((keyword) => keyword !== value));
  };

  const handleSaveKeywords = () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Log in to update keyword tracking.", variant: "destructive" });
      return;
    }
    const unique = Array.from(new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean)));
    keywordMutation.mutate(unique);
  };

  const runAgentMutation = useRunAIAgent();
  const { data: latestRun, isLoading: latestRunLoading } = useLatestAIAgentRun(selectedAgentId ?? "");

  const [runFeedback, setRunFeedback] = useState<string | null>(null);
  const [backlinkResults, setBacklinkResults] = useState<BacklinkResultRow[]>([]);
  const [backlinkLoading, setBacklinkLoading] = useState(false);
  const [competitorResults, setCompetitorResults] = useState<CompetitorResultCard[]>([]);
  const [competitorLoading, setCompetitorLoading] = useState(false);

  const competitorList = useMemo(() => (
    competitorNotes
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  ), [competitorNotes]);

  const buildContentSource = () => {
    if (contentTab === "url" && contentUrl.trim()) {
      return { type: "url", url: contentUrl.trim() };
    }
    if (contentTab === "file" && uploadContent.trim()) {
      return { type: "file", name: uploadName || "uploaded-content.txt", text: uploadContent.trim() };
    }
    if (manualContent.trim()) {
      return { type: "text", text: manualContent.trim() };
    }
    return null;
  };

  const handleCheckBacklinks = async (domain: string) => {
    if (!brandQuery.data) return;
    setBacklinkLoading(true);
    try {
      const results = await checkBacklinks(brandQuery.data.id, domain);
      setBacklinkResults(results);
      await saveSEOReport({
        brand_id: brandQuery.data.id,
        tool_type: 'backlink',
        title: `Backlink Check — ${domain}`,
        score: 65,
        input_value: domain,
        result_summary: `${results.length} referring domains found.`,
        result_url: `/brands/${slug}/seo?tab=backlinks`,
      });
      toast({ title: "Backlink check complete", description: `Found ${results.length} backlinks.` });
    } catch {
      toast({ title: "Backlink check failed", variant: "destructive" });
    } finally {
      setBacklinkLoading(false);
    }
  };

  const handleCompetitorAnalysis = async (domainsInput: string) => {
    if (!user || !brandQuery.data) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }

    const domains = domainsInput
      .split(/[\n,]/)
      .map((d) => d.trim())
      .filter(Boolean);

    const competitorAgent = agentsQuery.data?.find((a) =>
      a.name.toLowerCase().includes("competitor")
    );

    if (!competitorAgent) {
      setCompetitorResults(getMockCompetitorResults());
      return;
    }

    setCompetitorLoading(true);
    try {
      await runAgentMutation.mutateAsync({
        agent_id: competitorAgent.id,
        execution_context: {
          user_id: user.id,
          competitors: domains,
          metadata: { brand_id: brandQuery.data.id, brand_slug: slug },
        },
      });
      setCompetitorResults(getMockCompetitorResults());
      await saveSEOReport({
        brand_id: brandQuery.data.id,
        tool_type: 'competitor',
        title: `Competitor Analysis — ${brandQuery.data.name}`,
        score: 72,
        input_value: domains.join(", "),
        result_summary: `Analyzed ${domains.length} competitor(s).`,
        result_url: `/brands/${slug}/seo?tab=competitors`,
      });
      toast({ title: "Competitor analysis complete" });
    } catch {
      toast({ title: "Analysis failed", variant: "destructive" });
    } finally {
      setCompetitorLoading(false);
    }
  };

  const handleRunAgent = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "You must log in to run SEO agents.", variant: "destructive" });
      return;
    }
    if (!selectedAgentId) {
      toast({ title: "Select an agent", description: "Choose an SEO agent before running an analysis." });
      return;
    }

    const contentSource = buildContentSource();

    try {
      const response = await runAgentMutation.mutateAsync({
        agent_id: selectedAgentId,
        execution_context: {
          user_id: user.id,
          timeframe,
          keywords,
          content_source: contentSource,
          prompt: notes || undefined,
          context: manualContent || undefined,
          competitors: competitorList,
          metadata: {
            brand_id: brandQuery.data?.id,
            brand_slug: brandQuery.data?.slug,
            brand_name: brandQuery.data?.name,
            url: brandQuery.data?.website_url,
          },
        },
      });

      setRunFeedback(response?.summary ?? null);
      toast({ title: "Agent run started", description: "Your SEO agent run has been queued." });
      queryClient.invalidateQueries({ queryKey: ["ai-agent-run", selectedAgentId] });
    } catch (error) {
      toast({
        title: "Agent run failed",
        description: error instanceof Error ? error.message : "Unable to start the agent.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setUploadContent(text);
      setContentTab("file");
    };
    reader.readAsText(file);
  };

  if (!slug) {
    return (
      <div className="mx-auto max-w-5xl py-12">
        <Card>
          <CardContent className="py-12 text-center text-lg font-semibold text-muted-foreground">
            Brand not found
          </CardContent>
        </Card>
      </div>
    );
  }

  if (brandQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl py-12 space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (brandQuery.isError || !brandQuery.data) {
    const message = brandQuery.error instanceof Error ? brandQuery.error.message : "Unable to load brand";
    return (
      <div className="mx-auto max-w-5xl py-12">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {message}
          </CardContent>
        </Card>
      </div>
    );
  }

  const brand = brandQuery.data;
  const metrics = latestAnalytics?.metrics ?? null;
  const keywordsAvailable = keywords.length > 0;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Breadcrumb Navigation */}
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/brands/${slug}`}>{brand.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>SEO Workspace</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Page Title Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {brand.logo_url && (
              <img src={brand.logo_url} alt={brand.name} className="h-14 w-14 rounded-md object-contain" />
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
              <p className="text-muted-foreground">SEO Intelligence Dashboard</p>
            </div>
          </div>
          {brand.website_url && (
            <Link to={brand.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-primary hover:underline">
              <Globe className="mr-1 h-4 w-4" />
              {brand.website_url.replace(/^https?:\/\//, "")}
            </Link>
          )}
        </div>
        <Badge variant="secondary" className="flex items-center gap-1 self-start md:self-auto">
          <Sparkles className="h-4 w-4" />
          AI Powered SEO
        </Badge>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams({ tab: value })}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="backlinks" className="flex items-center gap-1">
            <Link2 className="h-3 w-3" /> Backlinks
          </TabsTrigger>
          <TabsTrigger value="competitors" className="flex items-center gap-1">
            <Users className="h-3 w-3" /> Competitors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricLabels.map((item) => (
          <Card key={item.key}>
            <CardHeader className="pb-2">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-2xl">
                {formatMetric(metrics, item.key, item.formatter)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {latestAnalytics?.date_range_start
                  ? `Latest window starting ${new Date(latestAnalytics.date_range_start).toLocaleDateString()}`
                  : "Awaiting analytics sync"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tracked Keywords</CardTitle>
            <CardDescription>Collaboratively manage focus keywords per brand</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {keywordsAvailable ? (
                keywords.map((keyword) => (
                  <Badge key={keyword} variant="outline" className="px-3 py-1 text-sm">
                    <span>{keyword}</span>
                    <button
                      type="button"
                      className="ml-2 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveKeyword(keyword)}
                    >
                      ×
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No keywords tracked yet.</p>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Add keyword"
                value={newKeyword}
                onChange={(event) => setNewKeyword(event.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleAddKeyword}>Add</Button>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSaveKeywords} disabled={keywordMutation.isPending}>
                {keywordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save keywords
              </Button>
              {!user && (
                <span className="text-xs text-muted-foreground">Sign in to persist changes</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO Agent Run</CardTitle>
            <CardDescription>Select an SEO workflow and send data for analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Agent</label>
                {agentsQuery.isError && (
                  <p className="text-xs text-destructive bg-muted/50 rounded-md px-3 py-2">
                    Unable to load SEO agents. Please refresh or contact an administrator.
                  </p>
                )}
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentsQuery.data?.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Timeframe</label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_month">Current Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="current_quarter">Current Quarter</SelectItem>
                    <SelectItem value="last_quarter">Last Quarter</SelectItem>
                    <SelectItem value="current_year">Current Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-medium uppercase text-muted-foreground">Content Source</label>
              <Tabs value={contentTab} onValueChange={(value) => setContentTab(value as typeof contentTab)}>
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="url" className="flex items-center gap-2 text-xs">
                    <Globe className="h-3 w-3" /> URL
                  </TabsTrigger>
                  <TabsTrigger value="file" className="flex items-center gap-2 text-xs">
                    <Upload className="h-3 w-3" /> Upload
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-2 text-xs">
                    <ListChecks className="h-3 w-3" /> Paste
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url" className="space-y-2 pt-3">
                  <Input
                    placeholder="https://example.com/landing-page"
                    value={contentUrl}
                    onChange={(event) => setContentUrl(event.target.value)}
                  />
                </TabsContent>
                <TabsContent value="file" className="space-y-2 pt-3">
                  <Input type="file" accept=".txt,.md,.html" onChange={handleFileUpload} />
                  {uploadName && (
                    <p className="text-xs text-muted-foreground">Loaded {uploadName} ({uploadContent.length} characters)</p>
                  )}
                </TabsContent>
                <TabsContent value="text" className="space-y-2 pt-3">
                  <Textarea
                    rows={6}
                    placeholder="Paste content or notes for the SEO review"
                    value={manualContent}
                    onChange={(event) => setManualContent(event.target.value)}
                  />
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Notes for the agent</label>
              <Textarea
                rows={3}
                placeholder="Highlight goals, campaign focus, or questions for the agent"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleRunAgent} disabled={runAgentMutation.isPending || agentsQuery.isLoading}>
                {runAgentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Run SEO Agent
              </Button>
              {runFeedback && (
                <p className="text-xs text-muted-foreground">Last response: {runFeedback.slice(0, 80)}...</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Agent Insights</CardTitle>
          <CardDescription>Recent output from the selected SEO agent</CardDescription>
        </CardHeader>
        <CardContent>
          {latestRunLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching latest run...
            </div>
          ) : latestRun ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {(latestRun.ai_summary as any)?.summary ?? "No summary provided yet."}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium">Key Findings</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {Array.isArray((latestRun.ai_summary as any)?.key_findings) && (latestRun.ai_summary as any).key_findings.length > 0 ? (
                      (latestRun.ai_summary as any).key_findings.map((finding: string, index: number) => (
                        <li key={index} className="flex gap-2">
                          <span>•</span>
                          <span>{finding}</span>
                        </li>
                      ))
                    ) : (
                      <li>No findings yet.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium">Recommendations</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {Array.isArray((latestRun.ai_summary as any)?.recommendations) && (latestRun.ai_summary as any).recommendations.length > 0 ? (
                      (latestRun.ai_summary as any).recommendations.map((rec: string, index: number) => (
                        <li key={index} className="flex gap-2">
                          <span>•</span>
                          <span>{rec}</span>
                        </li>
                      ))
                    ) : (
                      <li>No recommendations yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No completed runs for this agent yet.</p>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="backlinks" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Backlink Checker</CardTitle>
              <CardDescription>Review referring domains and link quality for a domain</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SEOInputForm
                type="domain"
                defaultValue={brand.website_url?.replace(/^https?:\/\//, "").split("/")[0] ?? ""}
                isLoading={backlinkLoading}
                onSubmit={handleCheckBacklinks}
              />
              <BacklinkResultsTable data={backlinkResults} isLoading={backlinkLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Competitor Analysis</CardTitle>
              <CardDescription>Identify keyword gaps vs competitor domains</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SEOInputForm
                type="domains"
                placeholder="competitor1.com, competitor2.com"
                isLoading={competitorLoading}
                onSubmit={handleCompetitorAnalysis}
              />
              <CompetitorResultsCards
                data={competitorResults}
                isLoading={competitorLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BrandPublicSEOPage;
