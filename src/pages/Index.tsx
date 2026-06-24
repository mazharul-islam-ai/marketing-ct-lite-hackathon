import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  BarChart3, 
  Code, 
  Linkedin, 
  Youtube, 
  Target,
  DollarSign,
  Building2,
  Zap,
  Activity,
  AlertCircle,
  Sparkles,
  Clock,
  Bot,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KPICard from "@/components/dashboard/KPICard";
import EffortChart from "@/components/dashboard/EffortChart";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { EmptyBrands } from "@/components/empty-states/EmptyBrands";
import { EmptyDashboard } from "@/components/empty-states/EmptyDashboard";
import { BrandCardSkeleton } from "@/components/skeleton/BrandCardSkeleton";
import { TestimonialDashboardSection } from "@/components/marketing/TestimonialDashboardSection";
import { SEODashboardSection } from "@/features/seo-hub/components/SEODashboardSection";
import { I420DashboardHero } from "@/components/i420/I420DashboardHero";

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dashboardData = useDashboardData();
  const [viewMode, setViewMode] = useState<"overview" | "comparison">("overview");

  const brands = dashboardData.brandPerformance;

  const getBrandIcon = (brandName: string) => {
    const iconMap: Record<string, any> = {
      "Community Outreach": Users,
      "CollabAI": Code,
      "LeadsLift": TrendingUp,
      "BuildYourAI": Code,
      "Social Growth": Linkedin,
      "Content Engine": Youtube,
      "GHL Developer": Building2,
      "Crafted.Email": Activity,
      "PlatePresence": DollarSign,
      "SJ Innovation": Zap,
    };
    return iconMap[brandName] || Building2;
  };

  const getBrandStatusVariant = (status: string) => {
    switch (status) {
      case "growing": return "default";
      case "stable": return "secondary"; 
      case "declining": return "destructive";
      default: return "secondary";
    }
  };

  const renderAllBrandsOverview = () => {
    if (dashboardData.loading) {
      return (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <BrandCardSkeleton key={i} />
            ))}
          </div>
        </div>
      );
    }

    if (dashboardData.error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-medium">Error loading dashboard</p>
            <p className="text-sm text-muted-foreground">{dashboardData.error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={dashboardData.refreshData}
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    // Show empty dashboard for new users
    if (brands.length === 0) {
      return (
        <EmptyDashboard
          userName={user?.email?.split('@')[0]}
          brandsCount={brands.length}
          kpisCount={dashboardData.teamEffortKPIs.length + dashboardData.socialMediaKPIs.length + dashboardData.websiteKPIs.length + dashboardData.paidCampaignKPIs.length}
          projectsCount={0}
        />
      );
    }

    return (
      <div className="space-y-6">
        {/* Brand Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => {
            const IconComponent = getBrandIcon(brand.name);
            const totalKPIs = brand.kpis.length;
            const achievedKPIs = brand.kpis.filter(kpi => 
              kpi.target_value ? kpi.current_value >= kpi.target_value : true
            ).length;
            const achievementRate = totalKPIs > 0 ? Math.round((achievedKPIs / totalKPIs) * 100) : 0;
            
            return (
              <Card 
                key={brand.id} 
                className="cursor-pointer hover:shadow-md transition-shadow" 
                onClick={() => navigate(`/brands/${brand.slug}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-gradient-primary rounded-md flex items-center justify-center">
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{brand.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">Revenue: ${brand.revenue.toLocaleString()}</p>
                      </div>
                    </div>
                    <Badge variant={getBrandStatusVariant(brand.status)}>
                      {brand.growth > 0 ? '+' : ''}{brand.growth}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">KPI Achievement</span>
                      <span className="font-medium">{achievementRate}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${achievementRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{totalKPIs} KPIs</span>
                      <span>{brand.activeTasks} active tasks</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Performance Rankings */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {brands
                .sort((a, b) => {
                  const aRate = a.kpis.length > 0 ? a.kpis.filter(kpi => 
                    kpi.target_value ? kpi.current_value >= kpi.target_value : true
                  ).length / a.kpis.length : 0;
                  const bRate = b.kpis.length > 0 ? b.kpis.filter(kpi => 
                    kpi.target_value ? kpi.current_value >= kpi.target_value : true
                  ).length / b.kpis.length : 0;
                  return bRate - aRate;
                })
                .slice(0, 5)
                .map((brand, index) => {
                  const IconComponent = getBrandIcon(brand.name);
                  const achievementRate = brand.kpis.length > 0 ? Math.round(
                    (brand.kpis.filter(kpi => 
                      kpi.target_value ? kpi.current_value >= kpi.target_value : true
                    ).length / brand.kpis.length) * 100
                  ) : 0;
                  
                  return (
                    <div key={brand.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-primary rounded-full">
                          {index + 1}
                        </div>
                        <div className="h-8 w-8 bg-gradient-primary rounded-md flex items-center justify-center">
                          <IconComponent className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">{brand.name}</p>
                          <p className="text-xs text-muted-foreground">{brand.kpis.length} KPIs tracked</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{achievementRate}%</p>
                        <p className="text-xs text-muted-foreground">achievement</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <KPICard
            title="Total Brands"
            value={brands.length}
            description={`${brands.filter(b => b.status === 'growing').length} growing`}
            icon={<BarChart3 />}
          />
          <KPICard
            title="Active Tasks"
            value={brands.reduce((sum, b) => sum + b.activeTasks, 0)}
            description="Across all brands"
            icon={<Users />}
          />
          <KPICard
            title="Total Revenue"
            value={`$${(dashboardData.totalRevenue / 1000).toFixed(0)}K`}
            description="Monthly tracking"
            icon={<TrendingUp />}
          />
          <KPICard
            title="Avg Performance"
            value={`${Math.round(brands.reduce((sum, b) => {
              const achieved = b.kpis.filter(kpi => kpi.target_value ? kpi.current_value >= kpi.target_value : true).length;
              return sum + (achieved / Math.max(b.kpis.length, 1) * 100);
            }, 0) / Math.max(brands.length, 1))}%`}
            description="goal achievement"
            icon={<Target />}
          />
        </div>

        {user?.role && ["pm", "manager", "super_admin"].includes(user.role) && (
          <>
            <SEODashboardSection />
            <TestimonialDashboardSection />
          </>
        )}

        {/* Tabs for different views */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Cross-Brand Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <EffortChart />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="comparison">
            <div className="grid gap-6 md:grid-cols-2">
              {dashboardData.teamEffortKPIs.slice(0, 4).map((kpi, index) => (
                <KPICard key={index} {...kpi} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  const aiAgents = [
    {
      name: "Data Strategist",
      icon: TrendingUp,
      color: "from-blue-500 to-cyan-400",
      bullets: ["Analyze brand KPIs", "Generate charts", "Action recommendations"],
      location: "Brand Pages → AI Solutions",
    },
    {
      name: "Chief of Staff",
      icon: Clock,
      color: "from-purple-500 to-pink-400",
      bullets: ["Daily operations digest", "At-risk task alerts", "Quick wins today"],
      location: "Control Tower",
    },
    {
      name: "Content Strategist",
      icon: Sparkles,
      color: "from-orange-500 to-amber-400",
      bullets: ["Hook ideas from transcripts", "Multi-channel repurpose", "Content calendar"],
      location: "Brand Pages → AI Solutions",
    },
  ];

  return (
    <div className="space-y-6">
      {user?.role === "super_admin" && <I420DashboardHero />}

      {/* AI Agents Spotlight */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-primary/20">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold">✨ Meet Your AI Agents</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4 ml-11">Run these within your brands & projects for context-aware insights</p>
          <div className="grid gap-4 md:grid-cols-3">
            {aiAgents.map((agent) => (
              <div 
                key={agent.name}
                className="p-4 rounded-lg bg-background/80 backdrop-blur border border-border"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${agent.color} shadow-lg`}>
                    <agent.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-semibold">{agent.name}</span>
                </div>
                <ul className="space-y-1 mb-3">
                  {agent.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="text-primary font-medium">{agent.location}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing Dashboard</h1>
          <p className="text-muted-foreground">Overview of all brand modules</p>
          {dashboardData.loading && (
            <div className="mt-2">
              <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 text-xs px-2 py-1 rounded-full font-medium">
                🔄 Loading Real Data...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard Content */}
      {renderAllBrandsOverview()}
    </div>
  );
}
