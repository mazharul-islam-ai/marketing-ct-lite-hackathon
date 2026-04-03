import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  Play, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  FileText,
  Lightbulb,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  Target,
  Zap,
  BarChart3,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { useContentLifecycleAgent, useContentPipelineMetrics, useLatestContentLifecycleRun } from "@/hooks/useContentLifecycleAgent";
import { useToast } from "@/hooks/use-toast";
import { useSEOBlogGenerator, useSEOBlogDetails } from "@/hooks/useSEOBlogGenerator";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface ContentLifecyclePanelProps {
  brandId?: string;
  brandName?: string;
}

export function ContentLifecyclePanel({ brandId, brandName }: ContentLifecyclePanelProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [retryingBlogId, setRetryingBlogId] = useState<string | null>(null);
  
  const metricsQuery = useContentPipelineMetrics();
  const runAgentMutation = useContentLifecycleAgent();
  const lastRunQuery = useLatestContentLifecycleRun(brandId);
  const generateBlog = useSEOBlogGenerator();

  const handleRunAnalysis = () => {
    runAgentMutation.mutate(
      {
        brand_id: brandId,
        scope: brandId ? 'brand' : 'all',
        refinement_prompt: refinementPrompt || undefined,
      },
      {
        onSuccess: (data) => {
          setAnalysisResult(data);
          toast({
            title: "Analysis Complete",
            description: "Content lifecycle analysis has been generated.",
          });
        },
        onError: (error) => {
          toast({
            title: "Analysis Failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleRetryBlog = async (blogId: string) => {
    setRetryingBlogId(blogId);
    try {
      // Fetch existing blog data
      const { data: blog, error: fetchError } = await supabase
        .from('seo_blog_content')
        .select('*')
        .eq('id', blogId)
        .single();

      if (fetchError || !blog) {
        throw new Error('Failed to fetch blog data');
      }

      // Retry generation with existing parameters
      await generateBlog.mutateAsync({
        brand_id: blog.brand_id,
        brand_name: blog.brand_name,
        primary_keyword: blog.primary_keyword,
        primary_reference: blog.primary_reference || '',
        secondary_keyword: (blog as any).secondary_keyword || '',
        third_keyword: (blog as any).third_keyword || '',
        tone: blog.tone || 'informative',
        audience: blog.audience || 'general business audience',
      });

      toast({
        title: "Retry Started",
        description: "Blog regeneration has been initiated. Check the blog page for results.",
      });

      // Refresh analysis after a delay
      setTimeout(() => {
        handleRunAnalysis();
      }, 2000);
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRetryingBlogId(null);
    }
  };

  const quickMetrics = metricsQuery.data;
  const analysis = analysisResult?.analysis;
  const metrics = analysisResult?.metrics;

  const getTrendIcon = (trend?: string) => {
    if (trend === 'increasing') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'decreasing') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getBottleneckBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  const getCoverageIcon = (state: string) => {
    if (state.includes('🟢') || state.includes('Covered')) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (state.includes('🟡') || state.includes('Weak')) return <AlertCircle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Quick Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Failed SEO Blogs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {quickMetrics?.seo.failed ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              of {quickMetrics?.seo.total ?? 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Draft Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {quickMetrics?.trends.draft ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              awaiting action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Keywords Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quickMetrics?.keywords.tracked ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              for content planning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Completed Blogs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {quickMetrics?.seo.completed ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              published content
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Run Analysis Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content Lifecycle Analysis
          </CardTitle>
          <CardDescription>
            {brandName 
              ? `Analyze content pipeline for ${brandName}` 
              : 'Analyze content production pipeline across all brands'}
            {lastRunQuery.data?.created_at && (
              <span className="block mt-1 text-xs text-muted-foreground">
                Last run: {formatDistanceToNow(new Date(lastRunQuery.data.created_at), { addSuffix: true })}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Instructions (optional)</label>
            <Textarea
              value={refinementPrompt}
              onChange={(e) => setRefinementPrompt(e.target.value)}
              placeholder="Focus on SEO blogs only, or prioritize specific brands..."
              rows={2}
            />
          </div>
          
          <Button 
            onClick={handleRunAnalysis} 
            disabled={runAgentMutation.isPending}
            className="w-full sm:w-auto"
          >
            {runAgentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Pipeline...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Analysis Results
            </CardTitle>
            <CardDescription>
              Generated in {analysisResult?.provider_meta?.response_time_ms}ms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[800px] pr-4">
              <div className="space-y-6 pb-4">
                {/* Weekly Summary */}
                {analysis.weekly_summary && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Weekly Content Health
                    </h4>
                    <p className="text-sm">{analysis.weekly_summary}</p>
                  </div>
                )}

                {/* Fallback to old summary format */}
                {!analysis.weekly_summary && analysis.summary && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                  </div>
                )}

                <Separator />

                {/* Normalized Pipeline with Funnel */}
                {metrics?.pipeline && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Pipeline Status (Normalized)
                    </h4>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {['research', 'draft', 'review', 'published'].map((stage, idx) => (
                        <div key={stage} className="flex items-center gap-2">
                          <div className="text-center p-3 rounded-lg bg-muted/50 min-w-[80px]">
                            <div className="text-lg font-bold">
                              {metrics.pipeline[stage as keyof typeof metrics.pipeline] || 0}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">{stage}</div>
                          </div>
                          {idx < 3 && <span className="text-muted-foreground">→</span>}
                        </div>
                      ))}
                      {metrics.pipeline.failed > 0 && (
                        <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/20 min-w-[80px]">
                          <div className="text-lg font-bold text-destructive">{metrics.pipeline.failed}</div>
                          <div className="text-xs text-muted-foreground">Failed</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Trend Utilization Score */}
                {metrics?.trends && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Trend Utilization
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Utilization Score</span>
                        <span className="font-bold">{metrics.trends.utilization_score}%</span>
                      </div>
                      <Progress value={metrics.trends.utilization_score} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {metrics.trends.used} of {metrics.trends.total} trends converted to content
                      </p>
                      
                      {metrics.trends.unused_high_impact?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium mb-2">Unused High-Impact Trends:</p>
                          <div className="space-y-1">
                            {metrics.trends.unused_high_impact.slice(0, 3).map((trend: any) => (
                              <div key={trend.id} className="text-xs p-2 rounded bg-muted/50 flex justify-between">
                                <span className="truncate flex-1">{trend.topic_title}</span>
                                <span className="text-muted-foreground ml-2">{trend.days_old}d old</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* SLA Status */}
                {metrics?.sla && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Timer className="h-4 w-4 text-amber-500" />
                      SLA Tracking
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-lg font-bold text-amber-600">{metrics.sla.breaching_count}</div>
                        <div className="text-xs text-muted-foreground">SLA Breaches</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-lg font-bold">{metrics.sla.avg_delay_days}d</div>
                        <div className="text-xs text-muted-foreground">Avg Delay</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      <p>SLA Thresholds: Research→Draft: 2d | Draft→Review: 3d | Review→Publish: 2d</p>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Stuck Content with Bottleneck Tags */}
                {metrics?.trends?.draft_items && metrics.trends.draft_items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Stuck Content ({metrics.trends.draft_items.length})
                    </h4>
                    <div className="space-y-2">
                      {metrics.trends.draft_items.slice(0, 5).map((item: any) => (
                        <div key={item.id} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-start justify-between gap-2">
                            <div 
                              className="flex-1 cursor-pointer hover:text-primary transition-colors"
                              onClick={() => {
                                // Navigate to LinkedIn leader page if we can find the slug
                                // For now, just show the item - can be enhanced later
                                toast({
                                  title: "Trend Detail",
                                  description: "Trend detail navigation coming soon",
                                });
                              }}
                            >
                              <p className="font-medium text-sm">{item.topic_title}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.leader_name} • {item.days_stuck} days stuck
                              </p>
                            </div>
                          </div>
                          {item.bottleneck_tags && item.bottleneck_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.bottleneck_tags.map((tag: any, idx: number) => (
                                <Badge 
                                  key={idx} 
                                  variant={getBottleneckBadgeVariant(tag.priority)}
                                  className="text-xs"
                                >
                                  {tag.label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failed Content with Retry Intelligence */}
                {metrics?.seo?.failed_items && metrics.seo.failed_items.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        Failed Content ({metrics.seo.failed_items.length})
                      </h4>
                      <div className="space-y-2">
                        {metrics.seo.failed_items.slice(0, 5).map((item: any) => (
                          <div key={item.id} className="p-3 rounded-lg border bg-card">
                            <div className="flex items-start justify-between gap-2">
                              <div 
                                className="flex-1 cursor-pointer hover:text-primary transition-colors"
                                onClick={() => navigate(`/content/seo-blog/${item.id}`)}
                              >
                                <p className="font-medium text-sm">{item.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{item.brand_name}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.failure_reason?.retry_safe && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRetryBlog(item.id);
                                    }}
                                    disabled={retryingBlogId === item.id || generateBlog.isPending}
                                  >
                                    {retryingBlogId === item.id ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Retrying...
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Retry
                                      </>
                                    )}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/content/seo-blog/${item.id}`);
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 text-xs">
                              <span className="text-muted-foreground">Reason: </span>
                              <span className="font-medium">{item.failure_reason?.reason?.replace('_', ' ')}</span>
                              <span className="text-muted-foreground"> → </span>
                              <span>{item.failure_reason?.action}</span>
                            </div>
                            {item.paragraphs && item.paragraphs.length > 0 && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs font-medium mb-2 text-muted-foreground">Content:</p>
                                <ScrollArea className="h-[200px] w-full rounded-md border p-3">
                                  <div className="text-xs space-y-2 pr-4">
                                    {item.paragraphs.map((paragraph: string, idx: number) => (
                                      <p key={idx} className="text-muted-foreground leading-relaxed">
                                        {paragraph}
                                      </p>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}
                            {item.validation_errors && item.validation_errors.length > 0 && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs font-medium mb-2 text-destructive">Validation Errors:</p>
                                <ul className="text-xs space-y-1">
                                  {item.validation_errors.map((error: string, idx: number) => (
                                    <li key={idx} className="text-destructive/80">• {error}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Keyword Coverage */}
                {metrics?.keywords?.high_volume_gaps && metrics.keywords.high_volume_gaps.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Search className="h-4 w-4 text-primary" />
                      Keyword Coverage Gaps ({metrics.keywords.high_volume_gaps.length})
                    </h4>
                    <div className="space-y-2">
                      {metrics.keywords.high_volume_gaps.slice(0, 5).map((gap: any) => (
                        <div key={gap.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getCoverageIcon(gap.coverage_state)}
                            <div>
                              <p className="font-medium text-sm">{gap.keyword}</p>
                              <p className="text-xs text-muted-foreground">{gap.brand_name}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {gap.search_volume?.toLocaleString()} /mo
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Velocity */}
                {metrics?.velocity && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      {getTrendIcon(metrics.velocity.trend)}
                      Content Velocity
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <div className="text-lg font-bold">{metrics.velocity.this_week}</div>
                        <div className="text-xs text-muted-foreground">This week</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <div className="text-lg font-bold">{metrics.velocity.last_week}</div>
                        <div className="text-xs text-muted-foreground">Last week</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <div className={`text-lg font-bold ${metrics.velocity.change_pct > 0 ? 'text-green-600' : metrics.velocity.change_pct < 0 ? 'text-red-600' : ''}`}>
                          {metrics.velocity.change_pct > 0 ? '+' : ''}{metrics.velocity.change_pct}%
                        </div>
                        <div className="text-xs text-muted-foreground">Change</div>
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Priority Actions */}
                {analysis.priority_actions && analysis.priority_actions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Priority Actions</h4>
                    <div className="space-y-2">
                      {analysis.priority_actions.map((action: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-start gap-3">
                            <Badge 
                              variant={action.priority === 'high' ? 'destructive' : action.priority === 'medium' ? 'default' : 'secondary'}
                              className="text-xs shrink-0"
                            >
                              {action.priority}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{action.action}</p>
                              {action.impact && (
                                <p className="text-xs text-muted-foreground mt-1">{action.impact}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ContentLifecyclePanel;
