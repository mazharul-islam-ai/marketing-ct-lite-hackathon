import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { useAuth } from "@/hooks/useAuth";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { ChevronRight } from "lucide-react";
import { DataStrategistInlinePanel } from "@/components/agents/DataStrategistInlinePanel";
import { ContentStrategistInlinePanel } from "@/components/agents/ContentStrategistInlinePanel";
import BrandPerformanceOptimizationPage from "@/pages/brands/[slug]/brand-performance-optimization";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const agentNameMap: Record<string, string> = {
  "data-strategist": "Data Strategist",
  "content-strategist": "Content Strategist",
  "linkedin-content-gen": "LinkedIn Content Generator",
  "seo-blog-generator": "SEO Blog Generator",
  "brand-performance-optimization": "Brand Performance Optimization",
};

const BrandAgentPage = () => {
  const { slug, agentSlug } = useParams<{ slug: string; agentSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // For brand-performance-optimization, render its own page directly
  if (agentSlug === "brand-performance-optimization") {
    return <BrandPerformanceOptimizationPage />;
  }

  // Fetch brand data
  const { data: brand, isLoading } = useQuery({
    queryKey: ["brand-for-agent", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const handleClose = () => {
    navigate(`/brands/${slug}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Brand not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const agentName = agentNameMap[agentSlug || ""] || agentSlug;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
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
              <BreadcrumbPage>{agentName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Agent Panel */}
      {agentSlug === "data-strategist" && (
        <DataStrategistInlinePanel
          brandId={brand.id}
          brandName={brand.name}
          onClose={handleClose}
        />
      )}

      {agentSlug === "content-strategist" && (
        <ContentStrategistInlinePanel
          brandId={brand.id}
          brandName={brand.name}
          onClose={handleClose}
        />
      )}

      {/* Fallback for unknown agents */}
      {!["data-strategist", "content-strategist"].includes(agentSlug || "") && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Agent "{agentSlug}" is not available yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BrandAgentPage;
