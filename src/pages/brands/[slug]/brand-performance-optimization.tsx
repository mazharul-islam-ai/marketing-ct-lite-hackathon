import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRunAIAgent } from '@/hooks/useRunAIAgent';
import { useLatestAIAgentRun } from '@/hooks/useLatestAIAgentRun';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ChevronRight, 
  TrendingUp, 
  Loader2, 
  Sparkles, 
  CheckCircle, 
  AlertCircle,
  BarChart3,
  Target,
  Lightbulb,
  BookmarkPlus,
  Check,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Clock,
  Users,
  Zap,
  ListChecks
} from 'lucide-react';
import { toast } from 'sonner';
import Unauthorized from '@/pages/Unauthorized';

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
}

interface AIAgent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  system_prompt: string;
}

interface AnalysisMeta {
  provider?: string;
  model?: string;
  response_time_ms?: number;
  total_tokens?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  brand_context_used?: {
    has_knowledge: boolean;
    has_analytics: boolean;
    has_kpis: boolean;
    has_info: boolean;
    knowledge_snippets?: number;
    knowledge_files?: number;
    knowledge_chars?: number;
    used_embeddings?: boolean;
    used_file_summaries?: boolean;
    analytics_chars?: number;
    kpis_chars?: number;
  };
  warnings?: string[];
  executed_at?: string;
}

interface KeyFinding {
  title: string;
  description: string;
  impact: string;
  category: string;
}

interface Recommendation {
  title: string;
  description: string;
  rationale: string;
  expected_outcome: string;
  timeline: string;
  priority: string;
}

interface ActionItem {
  type: string;
  title: string;
  description: string;
  steps: string[];
  priority: string;
  expected_impact: string;
  effort: string;
  owner_suggestion: string;
  deadline_suggestion: string;
  confidence: number;
  success_metrics: string[];
}

interface Opportunity {
  title: string;
  description: string;
  potential_value: string;
  required_investment: string;
  risk_level: string;
}

interface Risk {
  title: string;
  description: string;
  severity: string;
  likelihood: string;
  mitigation: string;
}

interface AIAnalysisResponse {
  summary?: string;
  keyFindings?: (string | KeyFinding)[];
  key_findings?: (string | KeyFinding)[];
  recommendations?: (string | Recommendation)[];
  actionItems?: ActionItem[];
  action_items?: ActionItem[];
  opportunities?: Opportunity[];
  risks?: Risk[];
  metrics?: Record<string, string | number>;
  data_sources_used?: string[];
  confidence_score?: number;
  analysis_depth?: string;
  _meta?: AnalysisMeta;
  _parse_error?: string;
}

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', provider: 'openai' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'claude' },
  { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', provider: 'claude' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'claude' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
];

// Predefined prompts for the agent
const PREDEFINED_PROMPTS = [
  {
    label: 'Full Performance Audit',
    prompt: 'Perform a comprehensive performance audit including website analytics, content effectiveness, and ROI analysis.'
  },
  {
    label: 'Content Strategy Review',
    prompt: 'Analyze our content performance and suggest improvements for engagement and conversions.'
  },
  {
    label: 'Conversion Optimization',
    prompt: 'Focus on identifying conversion bottlenecks and provide actionable recommendations to improve conversion rates.'
  },
  {
    label: 'Competitive Analysis',
    prompt: 'Compare our brand performance against industry benchmarks and suggest competitive advantages.'
  },
  {
    label: 'Growth Opportunities',
    prompt: 'Identify untapped growth opportunities based on our current data and market trends.'
  }
];

export default function BrandPerformanceOptimizationPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBrandSlug, setSelectedBrandSlug] = useState(slug || '');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [prompt, setPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const mutation = useRunAIAgent();

  // Use selected brand slug or URL slug
  const effectiveSlug = selectedBrandSlug || slug;

  // Load all brands for selection (when no slug in URL - admin context)
  const { data: allBrands, isLoading: brandsLoading } = useQuery({
    queryKey: ['all-brands', user?.role],
    enabled: !slug && !!user,
    queryFn: async () => {
      // For admins, load all brands
      if (user?.role === 'super_admin' || user?.role === 'manager') {
        const { data, error } = await supabase
          .from('brands')
          .select('id, name, slug, description, logo_url')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        return data;
      }
      return [];
    },
  });

  // Fetch brand (either from URL slug or selected slug)
  const { data: brand, isLoading: brandLoading } = useQuery<Brand | null>({
    queryKey: ['brand-for-optimization', effectiveSlug],
    enabled: Boolean(effectiveSlug && user),
    queryFn: async () => {
      if (!effectiveSlug) return null;
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, slug, description, logo_url')
        .eq('slug', effectiveSlug)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch the agent
  const { data: agent, isLoading: agentLoading } = useQuery<AIAgent | null>({
    queryKey: ['brand-performance-agent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, slug, description, category, system_prompt')
        .eq('slug', 'brand-performance-optimization')
        .eq('is_enabled', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch latest run for this agent AND this brand
  const { data: latestRun, refetch: refetchRun } = useQuery({
    queryKey: ['brand-performance-run', agent?.id, brand?.id],
    enabled: Boolean(agent?.id && brand?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_runs')
        .select('*')
        .eq('agent_id', agent!.id)
        .contains('execution_context', { brandId: brand!.id })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Save to insights mutation
  const saveToInsightsMutation = useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke('convert-insight-to-knowledge', {
        body: { insight_id: runId, brand_id: brand!.id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Analysis saved to Brand Insights!');
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to save insight');
    }
  });

  const handleRunAgent = async (customPrompt?: string) => {
    if (!agent || !user || !brand) {
      toast.error('Missing required information');
      return;
    }

    const finalPrompt = customPrompt || prompt || `Analyze the performance of ${brand.name} and provide optimization recommendations based on all available brand data, knowledge base, analytics, and KPIs.`;

    try {
      setShowResults(true);
      await mutation.mutateAsync({
        agent_id: agent.id,
        execution_context: {
          user_id: user.id,
          brandId: brand.id,
          brandName: brand.name,
          timeframe: '30d',
          prompt: finalPrompt,
          model: selectedModel,
        },
      });
      refetchRun();
    } catch (error) {
      toast.error('Failed to run analysis');
    }
  };

  const handleQuickPrompt = (quickPrompt: string) => {
    setPrompt(quickPrompt);
    handleRunAgent(quickPrompt);
  };

  const handleSaveToInsights = async () => {
    if (!latestRun?.id) return;
    setIsSaving(true);
    try {
      await saveToInsightsMutation.mutateAsync(latestRun.id);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return <Unauthorized />;
  }

  // Always allow rendering - show loading states in UI if needed
  if (agentLoading || (slug && brandLoading)) {
    return (
      <div className="container max-w-4xl mx-auto py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container max-w-4xl mx-auto py-12">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Agent not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const analysisResult = latestRun?.ai_summary as AIAnalysisResponse | undefined;
  
  // Normalize the response (handle both camelCase and snake_case, and both string and object formats)
  const rawKeyFindings = analysisResult?.keyFindings || analysisResult?.key_findings || [];
  const keyFindings: KeyFinding[] = rawKeyFindings.map((f) => 
    typeof f === 'string' 
      ? { title: f, description: '', impact: 'medium', category: 'general' }
      : f
  );
  
  const rawRecommendations = analysisResult?.recommendations || [];
  const recommendations: Recommendation[] = rawRecommendations.map((r) =>
    typeof r === 'string'
      ? { title: r, description: '', rationale: '', expected_outcome: '', timeline: 'medium-term', priority: 'medium' }
      : r
  );
  
  const rawActionItems = analysisResult?.actionItems || analysisResult?.action_items || [];
  const actionItems: ActionItem[] = rawActionItems.map((item) => ({
    type: item.type || 'task',
    title: item.title || item.description,
    description: item.description || '',
    steps: item.steps || [],
    priority: item.priority || 'medium',
    expected_impact: item.expected_impact || '',
    effort: item.effort || 'medium',
    owner_suggestion: item.owner_suggestion || '',
    deadline_suggestion: item.deadline_suggestion || '',
    confidence: item.confidence || 0.8,
    success_metrics: item.success_metrics || [],
  }));
  
  const opportunities = analysisResult?.opportunities || [];
  const risks = analysisResult?.risks || [];

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      {/* Breadcrumb - only show if coming from brand page */}
      {slug && brand && (
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
                <Link to="/brands">Brands</Link>
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
              <BreadcrumbPage>{agent.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Header - always show */}
      <Card className="border-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{agent.name}</CardTitle>
              <CardDescription className="mt-1">
                {agent.description || 'Analyze brand performance using your knowledge base, analytics, and KPIs to get optimization recommendations'}
              </CardDescription>
            </div>
            <Badge variant="outline">{agent.category}</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Brand Selection - show when not in brand context */}
      {!slug && (
        <Card>
          <CardHeader>
            <CardTitle>Select Brand</CardTitle>
            <CardDescription>Choose the brand this analysis is for</CardDescription>
          </CardHeader>
          <CardContent>
            {brandsLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading brands...</span>
              </div>
            ) : (
              <Select value={selectedBrandSlug} onValueChange={setSelectedBrandSlug}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a brand..." />
                </SelectTrigger>
                <SelectContent>
                  {allBrands?.map((b) => (
                    <SelectItem key={b.id} value={b.slug}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show selected brand name when in brand context */}
      {slug && brand && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              Analyzing: <strong className="text-foreground">{brand.name}</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model</CardTitle>
          <CardDescription>Choose which AI model to use for analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Select model..." />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Run Agent Section - always show */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Run Analysis{brand ? ` for ${brand.name}` : ''}
          </CardTitle>
          <CardDescription>
            The agent will analyze your brand's knowledge base, analytics data, and KPIs to provide insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Predefined Prompts */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Quick Analysis Options</p>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_PROMPTS.map((item, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt(item.prompt)}
                  disabled={mutation.isPending}
                  className="text-xs hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Textarea
              placeholder={`Or write a custom prompt, e.g., "Focus on improving conversion rates" or "Analyze our content performance and suggest improvements${brand ? ` for ${brand.name}` : ''}"`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px]"
              disabled={mutation.isPending}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => handleRunAgent()} 
              disabled={mutation.isPending || !prompt.trim() || !brand}
              className="flex-1 sm:flex-none bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Run Custom Analysis
                </>
              )}
            </Button>
            {(analysisResult || showResults) && (
              <Button
                variant="outline"
                onClick={() => refetchRun()}
                disabled={mutation.isPending}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {mutation.isPending && brand && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h3 className="font-medium mb-2">Analyzing {brand.name}...</h3>
            <p className="text-sm text-muted-foreground">
              The agent is reviewing your brand's knowledge base, analytics, and KPIs
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {analysisResult && !mutation.isPending && brand && (
        <div className="space-y-4">
          {/* Save to Insights Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleSaveToInsights}
              disabled={isSaving || saveToInsightsMutation.isSuccess}
              className="gap-2"
            >
              {saveToInsightsMutation.isSuccess ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Saved to Insights
                </>
              ) : isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4" />
                  Save to Brand Insights
                </>
              )}
            </Button>
          </div>

          {/* Summary */}
          {analysisResult.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{analysisResult.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Key Findings */}
          {keyFindings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Key Findings ({keyFindings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {keyFindings.map((finding, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="font-medium">{finding.title}</span>
                        {finding.impact && (
                          <Badge 
                            variant={finding.impact === 'high' ? 'destructive' : finding.impact === 'medium' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {finding.impact} impact
                          </Badge>
                        )}
                        {finding.category && finding.category !== 'general' && (
                          <Badge variant="outline" className="text-[10px]">
                            {finding.category}
                          </Badge>
                        )}
                      </div>
                      {finding.description && (
                        <p className="text-sm text-muted-foreground ml-6">{finding.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  Recommendations ({recommendations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="font-medium">{rec.title}</span>
                        {rec.priority && (
                          <Badge 
                            variant={rec.priority === 'critical' || rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {rec.priority}
                          </Badge>
                        )}
                        {rec.timeline && (
                          <Badge variant="outline" className="text-[10px]">
                            <Clock className="h-3 w-3 mr-1" />
                            {rec.timeline}
                          </Badge>
                        )}
                      </div>
                      {rec.description && (
                        <p className="text-sm text-muted-foreground ml-6 mb-2">{rec.description}</p>
                      )}
                      {rec.rationale && (
                        <p className="text-xs text-muted-foreground/70 ml-6 italic">
                          <strong>Why:</strong> {rec.rationale}
                        </p>
                      )}
                      {rec.expected_outcome && (
                        <p className="text-xs text-green-600 ml-6 mt-1">
                          <strong>Expected Outcome:</strong> {rec.expected_outcome}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Items */}
          {actionItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-purple-500" />
                  Action Items ({actionItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {actionItems.map((item, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-purple-500 shrink-0" />
                        <span className="font-medium">{item.title}</span>
                        <Badge 
                          variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {item.priority} priority
                        </Badge>
                        {item.effort && (
                          <Badge variant="outline" className="text-[10px]">
                            <Zap className="h-3 w-3 mr-1" />
                            {item.effort} effort
                          </Badge>
                        )}
                        {item.confidence && (
                          <Badge variant="outline" className="text-[10px]">
                            {Math.round(item.confidence * 100)}% confidence
                          </Badge>
                        )}
                      </div>
                      
                      {item.description && item.description !== item.title && (
                        <p className="text-sm text-muted-foreground ml-6 mb-2">{item.description}</p>
                      )}
                      
                      {/* Steps */}
                      {item.steps && item.steps.length > 0 && (
                        <div className="ml-6 mt-3 space-y-1">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <ListChecks className="h-3 w-3" />
                            Steps:
                          </p>
                          <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1 ml-2">
                            {item.steps.map((step, stepIdx) => (
                              <li key={stepIdx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      
                      {/* Metadata row */}
                      <div className="flex flex-wrap gap-3 ml-6 mt-3 text-xs text-muted-foreground">
                        {item.owner_suggestion && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {item.owner_suggestion}
                          </span>
                        )}
                        {item.deadline_suggestion && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.deadline_suggestion}
                          </span>
                        )}
                      </div>
                      
                      {item.expected_impact && (
                        <p className="text-xs text-green-600 ml-6 mt-2">
                          <strong>Expected Impact:</strong> {item.expected_impact}
                        </p>
                      )}
                      
                      {/* Success Metrics */}
                      {item.success_metrics && item.success_metrics.length > 0 && (
                        <div className="ml-6 mt-2">
                          <p className="text-xs text-muted-foreground">
                            <strong>Track:</strong> {item.success_metrics.join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Opportunities */}
          {opportunities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Rocket className="h-5 w-5 text-blue-500" />
                  Growth Opportunities ({opportunities.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {opportunities.map((opp, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Rocket className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="font-medium">{opp.title}</span>
                        {opp.risk_level && (
                          <Badge 
                            variant={opp.risk_level === 'high' ? 'destructive' : opp.risk_level === 'medium' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {opp.risk_level} risk
                          </Badge>
                        )}
                      </div>
                      {opp.description && (
                        <p className="text-sm text-muted-foreground ml-6 mb-2">{opp.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 ml-6 text-xs">
                        {opp.potential_value && (
                          <span className="text-green-600">
                            <strong>Value:</strong> {opp.potential_value}
                          </span>
                        )}
                        {opp.required_investment && (
                          <span className="text-muted-foreground">
                            <strong>Investment:</strong> {opp.required_investment}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risks */}
          {risks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                  Risks & Concerns ({risks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {risks.map((risk, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-red-500/5 border-red-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="font-medium">{risk.title}</span>
                        {risk.severity && (
                          <Badge 
                            variant={risk.severity === 'critical' || risk.severity === 'high' ? 'destructive' : risk.severity === 'medium' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {risk.severity}
                          </Badge>
                        )}
                        {risk.likelihood && (
                          <Badge variant="outline" className="text-[10px]">
                            {risk.likelihood} likelihood
                          </Badge>
                        )}
                      </div>
                      {risk.description && (
                        <p className="text-sm text-muted-foreground ml-6 mb-2">{risk.description}</p>
                      )}
                      {risk.mitigation && (
                        <p className="text-xs text-muted-foreground ml-6">
                          <strong>Mitigation:</strong> {risk.mitigation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metrics */}
          {analysisResult.metrics && typeof analysisResult.metrics === 'object' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Analysis Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(analysisResult.metrics).map(([key, value], i) => (
                    <div key={i} className="p-4 rounded-lg border bg-muted/30 text-center">
                      <p className="text-sm text-muted-foreground mb-1">{key.replace(/_/g, ' ')}</p>
                      <p className="text-2xl font-bold">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Token Usage & Meta */}
          {analysisResult._meta && (
            <Card className="bg-muted/20">
              <CardContent className="py-4 space-y-3">
                {/* Main stats row */}
                <div className="flex flex-wrap gap-4 justify-center text-xs text-muted-foreground">
                  <span>Model: <strong>{analysisResult._meta.model}</strong></span>
                  {analysisResult._meta.total_tokens && (
                    <span>
                      Tokens: <strong>{analysisResult._meta.total_tokens.toLocaleString()}</strong>
                      {analysisResult._meta.prompt_tokens && analysisResult._meta.completion_tokens && (
                        <span className="text-muted-foreground/70"> ({analysisResult._meta.prompt_tokens} in / {analysisResult._meta.completion_tokens} out)</span>
                      )}
                    </span>
                  )}
                  {analysisResult._meta.response_time_ms && (
                    <span>Response: <strong>{(analysisResult._meta.response_time_ms / 1000).toFixed(1)}s</strong></span>
                  )}
                  {analysisResult.confidence_score && (
                    <span>Confidence: <strong>{Math.round(analysisResult.confidence_score * 100)}%</strong></span>
                  )}
                </div>

                {/* Data sources row */}
                {analysisResult._meta.brand_context_used && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {analysisResult._meta.brand_context_used.has_knowledge && (
                      <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/30">
                        ✓ Knowledge Base
                        {analysisResult._meta.brand_context_used.knowledge_snippets ? ` (${analysisResult._meta.brand_context_used.knowledge_snippets} snippets)` : ''}
                        {analysisResult._meta.brand_context_used.knowledge_files ? ` (${analysisResult._meta.brand_context_used.knowledge_files} files)` : ''}
                      </Badge>
                    )}
                    {analysisResult._meta.brand_context_used.has_analytics && (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30">
                        ✓ Analytics
                      </Badge>
                    )}
                    {analysisResult._meta.brand_context_used.has_kpis && (
                      <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 border-purple-500/30">
                        ✓ KPIs
                      </Badge>
                    )}
                    {analysisResult._meta.brand_context_used.has_info && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                        ✓ Brand Info
                      </Badge>
                    )}
                    {!analysisResult._meta.brand_context_used.has_knowledge && (
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/30">
                        ✗ No Knowledge Base
                      </Badge>
                    )}
                    {!analysisResult._meta.brand_context_used.has_analytics && (
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/30">
                        ✗ No Analytics
                      </Badge>
                    )}
                  </div>
                )}

                {/* Warnings */}
                {analysisResult._meta.warnings && analysisResult._meta.warnings.length > 0 && (
                  <div className="flex flex-col gap-1 items-center">
                    {analysisResult._meta.warnings.map((warning, i) => (
                      <p key={i} className="text-[10px] text-amber-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                {/* Parse error indicator */}
                {analysisResult._parse_error && (
                  <p className="text-[10px] text-red-500 text-center flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {analysisResult._parse_error}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Run timestamp */}
          {latestRun?.created_at && (
            <p className="text-xs text-center text-muted-foreground">
              Last analysis: {new Date(latestRun.created_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Empty state if no results yet */}
      {!analysisResult && !mutation.isPending && !showResults && brand && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Analysis Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a quick analysis option or write a custom prompt to get AI-powered insights for {brand.name}
            </p>
            <p className="text-xs text-muted-foreground">
              The agent will analyze your brand's knowledge base, analytics data, and KPIs
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
