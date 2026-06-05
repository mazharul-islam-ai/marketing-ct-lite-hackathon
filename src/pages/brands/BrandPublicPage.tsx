import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { useAuth } from "@/hooks/useAuth";
import { BrandKPICard } from "@/components/brands/BrandKPICard";
import { BrandMetricsPanel } from "@/components/brands/BrandMetricsPanel";
import { BrandInsightsCard } from "@/components/brands/BrandInsightsCard";
import { InsightDetailDialog } from "@/components/brands/InsightDetailDialog";
import { BrandContentManager } from "@/components/brands/BrandContentManager";
import { AnalyticsMetricCard } from "@/components/brands/AnalyticsMetricCard";
import { ChannelBreakdownChart } from "@/components/brands/ChannelBreakdownChart";
import { TopPagesTable } from "@/components/brands/TopPagesTable";
import { N8nAnalyticsPanel } from "@/components/brands/N8nAnalyticsPanel";
import { GoogleAnalyticsConfig } from "@/components/brands/GoogleAnalyticsConfig";
import {
  ExternalLink,
  BarChart3,
  Target,
  Lightbulb,
  Lock,
  Users,
  Eye,
  Clock,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Bot,
  Database,
  ListTodo,
  Trophy,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { MyAgentsPanel } from "@/components/agents/MyAgentsPanel";
import BrandKnowledgeBase from "./BrandKnowledgeBase";
import { BrandTasksTab } from "@/components/brands/BrandTasksTab";
import { HackathonBrandTab } from "@/components/hackathon/HackathonBrandTab";

interface Insight {
  id: string;
  title: string | null;
  ai_summary: any;
  category: string | null;
  status: string | null;
  created_at: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  status: string | null;
  type: string | null;
}

const BrandPublicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

  const { data: brand, isLoading, isError, error } = useQuery<Brand | null>({
    queryKey: ["public-brand", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      if (!slug) return null;

      const { data, error: brandError } = await supabase
        .from("brands")
        .select("id, name, slug, description, logo_url, website_url, status, type")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (brandError) {
        throw brandError;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        name: data.name ?? "",
        slug: data.slug ?? "",
        description: data.description ?? null,
        logo_url: data.logo_url ?? null,
        website_url: data.website_url ?? null,
        status: data.status ?? null,
        type: data.type ?? null,
      };
    },
  });

  // Fetch KPIs if user is authenticated
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["brand-kpis", brand?.id],
    enabled: Boolean(brand?.id && user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_kpis")
        .select("*")
        .eq("brand_id", brand!.id)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent analytics if user is authenticated
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["brand-analytics", brand?.id],
    enabled: Boolean(brand?.id && user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_analytics_data")
        .select("*")
        .eq("brand_id", brand!.id)
        .order("date_range_start", { ascending: false })
        .limit(45);
      
      if (error) throw error;
      // Reverse to get chronological order for charts (oldest first)
      return (data || []).reverse();
    },
  });

  // Fetch AI insights if user is authenticated - filter by brand
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["brand-insights", brand?.id],
    enabled: Boolean(brand?.id && user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("id, title, ai_summary, category, created_at, status, execution_context")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      // Filter to only runs that include this brand
      return (data || []).filter((run: any) => {
        const ctx = run.execution_context;
        if (!ctx) return false;
        // Check if brand_id matches or brand_ids array contains this brand
        return ctx.brand_id === brand!.id || 
               (Array.isArray(ctx.brand_ids) && ctx.brand_ids.includes(brand!.id));
      }).slice(0, 10);
    },
  });

  if (!slug) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <Card>
          <CardContent className="py-12 text-center text-lg font-semibold text-muted-foreground">
            Brand not found
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading brand profile...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : "Unable to load brand";
    return (
      <div className="mx-auto max-w-3xl py-12">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {message}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!brand || brand.status?.toLowerCase() !== "active") {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <Card>
          <CardContent className="py-12 text-center text-lg font-semibold text-muted-foreground">
            Brand not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl relative">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Breadcrumb Navigation */}
      <div className="mb-4">
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
              <BreadcrumbPage>{brand.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Brand Header (no card) */}
      <div className="mb-8 border-b border-border pb-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {brand.logo_url && (
            <div className="flex-shrink-0 p-4 bg-white dark:bg-muted rounded-xl shadow-md">
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="h-16 w-auto"
              />
            </div>
          )}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="space-y-1">
              <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                <h1 className="text-3xl font-display font-bold tracking-tight">
                  {brand.name}
                </h1>
                <Badge variant="secondary" className="text-xs font-semibold px-3 py-1">
                  {brand.type || 'internal'}
                </Badge>
              </div>
              {brand.description && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {brand.description}
                </p>
              )}
            </div>
            {brand.website_url && (
              <a
                href={brand.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors group"
              >
                Visit Website
                <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs for Different Data Views */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex items-center gap-2 bg-muted/50 p-2 rounded-xl border border-border/50 shadow-sm mb-6 overflow-x-auto">
          <TabsTrigger 
            value="overview"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <Target className="h-4 w-4 mr-2 flex-shrink-0" />
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="analytics"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <BarChart3 className="h-4 w-4 mr-2 flex-shrink-0" />
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value="seo"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <TrendingUp className="h-4 w-4 mr-2 flex-shrink-0" />
            SEO
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <Database className="h-4 w-4 mr-2 flex-shrink-0" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger
            value="ai-solutions"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <Bot className="h-4 w-4 mr-2 flex-shrink-0" />
            AI Solutions
          </TabsTrigger>
          <TabsTrigger 
            value="insights"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <Lightbulb className="h-4 w-4 mr-2 flex-shrink-0" />
            Insights
          </TabsTrigger>
          <TabsTrigger 
            value="content"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4 mr-2 flex-shrink-0" />
            Content
          </TabsTrigger>
          <TabsTrigger 
            value="tasks"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <ListTodo className="h-4 w-4 mr-2 flex-shrink-0" />
            Tasks
          </TabsTrigger>
          {slug === 'sj-innovation' && (
            <TabsTrigger 
              value="hackathon"
              className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
            >
              <Trophy className="h-4 w-4 mr-2 flex-shrink-0" />
              Hackathon
            </TabsTrigger>
          )}
        </TabsList>

        <div className="space-y-8">

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
          {!user ? (
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">Sign in to unlock metrics</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Get access to comprehensive brand KPIs, analytics, and performance metrics
                </p>
                <Button className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:scale-105 transition-all duration-200">
                  Sign In Now
                </Button>
              </CardContent>
            </Card>
          ) : kpisLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[180px]" />
              ))}
            </div>
          ) : kpis && kpis.length > 0 ? (
            <div className="space-y-6">
              <h2 className="text-3xl font-display font-bold tracking-tight">Key Performance Indicators</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kpis.map(kpi => (
                  <BrandKPICard
                    key={kpi.id}
                    name={kpi.name}
                    currentValue={Number(kpi.current_value)}
                    targetValue={kpi.target_value ? Number(kpi.target_value) : undefined}
                    type={kpi.type}
                    description={kpi.description || undefined}
                  />
                ))}
              </div>
            </div>
          ) : (
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">No KPI Data Available</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  KPI data will appear here once configured for this brand
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
          {!user ? (
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">Sign in to unlock analytics</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Get access to comprehensive brand analytics, insights, and performance metrics
                </p>
                <Button className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:scale-105 transition-all duration-200">
                  Sign In Now
                </Button>
              </CardContent>
            </Card>
          ) : analyticsLoading ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-[140px]" />
                <Skeleton className="h-[140px]" />
                <Skeleton className="h-[140px]" />
                <Skeleton className="h-[140px]" />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-[350px]" />
                <Skeleton className="h-[350px]" />
              </div>
            </div>
          ) : (
            <>
              {/* Google Analytics Integration */}
              <div className="space-y-4">
                <h2 className="text-3xl font-display font-bold tracking-tight">Google Analytics Configuration</h2>
                {brand && (
                  <GoogleAnalyticsConfig 
                    brandId={brand.id}
                    onConfigured={() => {
                      // Refresh analytics data when configured
                    }}
                  />
                )}
              </div>

              {/* Analytics Data Display */}
              <div className="space-y-4">
                <h2 className="text-3xl font-display font-bold tracking-tight">Analytics Data</h2>
                {brand && <N8nAnalyticsPanel brandId={brand.id} />}
              </div>

              {/* Performance Overview Section */}
              {analytics && analytics.length > 0 && (
                <>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-display font-bold tracking-tight">Performance Overview</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <AnalyticsMetricCard
                        title="Total Visitors"
                        value={analytics.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.unique_visitors || 0), 0)}
                        trend={(() => {
                          if (analytics.length < 2) return 0;
                          const splitPoint = Math.floor(analytics.length / 2);
                          const currentPeriod = analytics.slice(splitPoint);
                          const previousPeriod = analytics.slice(0, splitPoint);
                          const currentSum = currentPeriod.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.unique_visitors || 0), 0);
                          const previousSum = previousPeriod.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.unique_visitors || 0), 0);
                          return previousSum === 0 ? 0 : ((currentSum - previousSum) / previousSum) * 100;
                        })()}
                        icon={<Users className="h-5 w-5" />}
                      />
                      <AnalyticsMetricCard
                        title="Page Views"
                        value={analytics.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.pageviews || 0), 0)}
                        trend={(() => {
                          if (analytics.length < 2) return 0;
                          const splitPoint = Math.floor(analytics.length / 2);
                          const currentPeriod = analytics.slice(splitPoint);
                          const previousPeriod = analytics.slice(0, splitPoint);
                          const currentSum = currentPeriod.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.pageviews || 0), 0);
                          const previousSum = previousPeriod.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.pageviews || 0), 0);
                          return previousSum === 0 ? 0 : ((currentSum - previousSum) / previousSum) * 100;
                        })()}
                        icon={<Eye className="h-5 w-5" />}
                      />
                      <AnalyticsMetricCard
                        title="Conversion Rate"
                        value={analytics.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.conversion_rate || 0), 0) / analytics.length}
                        trend={(() => {
                          if (analytics.length < 2) return 0;
                          const splitPoint = Math.floor(analytics.length / 2);
                          const currentPeriod = analytics.slice(splitPoint);
                          const previousPeriod = analytics.slice(0, splitPoint);
                          const currentAvg = currentPeriod.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.conversion_rate || 0), 0) / currentPeriod.length;
                          const previousAvg = previousPeriod.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.conversion_rate || 0), 0) / previousPeriod.length;
                          return previousAvg === 0 ? 0 : ((currentAvg - previousAvg) / previousAvg) * 100;
                        })()}
                        icon={<Target className="h-5 w-5" />}
                        format="percentage"
                      />
                      <AnalyticsMetricCard
                        title="Avg. Session"
                        value={Math.round(analytics.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.avg_session_duration || 0), 0) / analytics.length)}
                        trend={(() => {
                          if (analytics.length < 2) return 0;
                          const splitPoint = Math.floor(analytics.length / 2);
                          const currentPeriod = analytics.slice(splitPoint);
                          const previousPeriod = analytics.slice(0, splitPoint);
                          const currentAvg = currentPeriod.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.avg_session_duration || 0), 0) / currentPeriod.length;
                          const previousAvg = previousPeriod.reduce((sum: number, a: any) => sum + ((a.metrics as any)?.avg_session_duration || 0), 0) / previousPeriod.length;
                          return previousAvg === 0 ? 0 : ((currentAvg - previousAvg) / previousAvg) * 100;
                        })()}
                        icon={<Clock className="h-5 w-5" />}
                        format="duration"
                      />
                    </div>
                  </div>

                  {/* Detailed Analytics Section */}
                  <div className="space-y-4">
                    <h2 className="text-3xl font-display font-bold tracking-tight">Detailed Analytics</h2>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <BrandMetricsPanel
                        title="Traffic Trend (Last 45 Days)"
                        data={analytics.slice(-30).map((a: any) => ({
                          date: new Date(a.date_range_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          value: (a.metrics as any)?.unique_visitors || 0,
                        }))}
                        valueLabel="Visitors"
                        chartType="area"
                      />
                      
                      <ChannelBreakdownChart
                        title="Traffic Sources"
                        data={(() => {
                          const latestAnalytics = analytics[analytics.length - 1];
                          const channels = (latestAnalytics?.dimensions as any)?.channels || {};
                          return Object.entries(channels).map(([name, value]) => ({
                            name,
                            value: value as number,
                          }));
                        })()}
                      />
                    </div>
                  </div>

                  {/* Engagement & Conversion Section */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    <BrandMetricsPanel
                      title="Engagement Metrics"
                      data={analytics.slice(-30).map((a: any) => ({
                        date: new Date(a.date_range_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        value: (a.metrics as any)?.pages_per_session || 0,
                      }))}
                      valueLabel="Pages per Session"
                      chartType="line"
                    />
                    
                    <BrandMetricsPanel
                      title="Conversion Trend"
                      data={analytics.slice(-30).map((a: any) => ({
                        date: new Date(a.date_range_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        value: (a.metrics as any)?.goal_completions || 0,
                      }))}
                      valueLabel="Conversions"
                      chartType="bar"
                    />
                  </div>

                  {/* Top Content Section */}
                  <TopPagesTable
                    title="Top Performing Pages"
                    data={(() => {
                      const latestAnalytics = analytics[analytics.length - 1];
                      const topPages = (latestAnalytics?.dimensions as any)?.top_pages || [];
                      return topPages;
                    })()}
                  />
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
          <Card className="border border-border/50 shadow-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary to-primary/60" />
            <CardContent className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-3">SEO Workspace</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Access comprehensive SEO analysis and optimization tools for enhanced search performance
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  onClick={() => navigate(`/brands/${slug}/seo`)}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  Open SEO Workspace
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/seo-hub?brand=${slug}`)}
                >
                  View in SEO Hub
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
          {!user ? (
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">Sign in to access knowledge base</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Upload and manage knowledge files for AI-powered content generation
                </p>
                <Button className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:scale-105 transition-all duration-200">
                  Sign In Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            brand && <BrandKnowledgeBase brandId={brand.id} embedded={true} />
          )}
        </TabsContent>

        {/* AI Solutions Tab */}
        <TabsContent value="ai-solutions" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
          {!user ? (
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">Sign in to access AI Solutions</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  AI agents and solutions are available to authenticated users
                </p>
                <Button className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:scale-105 transition-all duration-200">
                  Sign In Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            brand && (
              <MyAgentsPanel
                userId={user.id}
                brandId={brand.id}
                brandSlug={brand.slug}
                brandName={brand.name}
                showHeader={true}
              />
            )
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
          {!user ? (
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">Sign in to unlock AI insights</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  AI-generated insights are available to authenticated users
                </p>
                <Button className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:scale-105 transition-all duration-200">
                  Sign In Now
                </Button>
              </CardContent>
            </Card>
          ) : insightsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map(i => (
                <Skeleton key={i} className="h-[200px]" />
              ))}
            </div>
          ) : insights && insights.length > 0 ? (
            <div className="space-y-6">
              <h2 className="text-3xl font-display font-bold tracking-tight">AI-Generated Insights</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {insights.map(insight => (
                  <BrandInsightsCard
                    key={insight.id}
                    title={insight.title || 'Untitled Insight'}
                    summary={typeof insight.ai_summary === 'string' 
                      ? insight.ai_summary 
                      : Array.isArray((insight.ai_summary as any)?.summary)
                        ? (insight.ai_summary as any).summary.join(' ')
                        : (insight.ai_summary as any)?.summary || 'No summary available'}
                    category={insight.category || undefined}
                    createdAt={insight.created_at}
                    status={insight.status || undefined}
                    onClick={() => setSelectedInsight(insight)}
                  />
                ))}
              </div>
              
              {/* Insight Detail Dialog */}
              {brand && (
                <InsightDetailDialog
                  insight={selectedInsight}
                  open={!!selectedInsight}
                  onOpenChange={(open) => !open && setSelectedInsight(null)}
                  brandId={brand.id}
                  onDeleted={() => queryClient.invalidateQueries({ queryKey: ["brand-insights", brand.id] })}
                  onUpdated={() => queryClient.invalidateQueries({ queryKey: ["brand-insights", brand.id] })}
                />
              )}
            </div>
          ) : (
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Lightbulb className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">No AI Insights Available</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  AI insights will appear here once generated for this brand
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
          {!user ? (
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">Sign in to manage content</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Get access to brand knowledge management and LinkedIn post generation
                </p>
                <Button className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:scale-105 transition-all duration-200">
                  Sign In Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            <BrandContentManager brandId={brand.id} brandSlug={brand.slug} />
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
          {!user ? (
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">Sign in to manage tasks</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Access and manage tasks associated with this brand
                </p>
                <Button className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:scale-105 transition-all duration-200">
                  Sign In Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            <BrandTasksTab brandId={brand.id} brandName={brand.name} brandSlug={brand.slug} />
          )}
        </TabsContent>

        {/* Hackathon Tab - Only for SJ Innovation */}
        {slug === 'sj-innovation' && (
          <TabsContent value="hackathon" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
            <HackathonBrandTab />
          </TabsContent>
        )}
        </div>
      </Tabs>
    </div>
  );
};

export default BrandPublicPage;
