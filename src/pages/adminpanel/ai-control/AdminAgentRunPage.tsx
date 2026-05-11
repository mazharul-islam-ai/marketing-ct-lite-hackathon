import { useParams, useNavigate } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { DataStrategistInlinePanel } from "@/components/agents/DataStrategistInlinePanel";
import { ContentStrategistInlinePanel } from "@/components/agents/ContentStrategistInlinePanel";
import { ChiefOfStaffInlinePanel } from "@/components/agents/ChiefOfStaffInlinePanel";
import { DocumentationGeneratorPanel } from "@/components/agents/DocumentationGeneratorPanel";
import SEOBlogGenerator from "@/pages/content/SEOBlogGenerator";
import HeroSectionOptimizer from "@/pages/content/HeroSectionOptimizer";
import WeeklyClientEmailSummary from "@/pages/WeeklyClientEmailSummary";
import BrandPerformanceOptimizationPage from "@/pages/brands/[slug]/brand-performance-optimization";
import LinkedInContentGeneratorPage from "./LinkedInContentGeneratorPage";
import ContentLifecyclePanel from "@/components/agents/ContentLifecyclePanel";
import { MarketingIntelligencePanel } from "@/components/agents/MarketingIntelligencePanel";
import { GenericAgentRunnerPanel } from "@/components/agents/GenericAgentRunnerPanel";
import { Card, CardContent } from "@/components/ui/card";

const agentNameMap: Record<string, string> = {
  "data-strategist": "Data Strategist",
  "content-strategist": "Content Strategist",
  "chief-of-staff": "Chief of Staff",
  "linkedin-content-gen": "LinkedIn Content Generator",
  "seo-blog-generator": "SEO Blog Generator",
  "brand-performance-optimization": "Brand Performance Optimization",
  "hero-section-optimizer": "Hero Section Optimizer",
  "weekly-client-email": "Weekly Client Email",
  "content-lifecycle": "Content Lifecycle Manager",
  "brand-docs-generator": "Brand Docs Generator",
  "documentation-generator": "Documentation Generator",
  "marketing-intelligence": "Marketing Intelligence",
};

const AdminAgentRunPage = () => {
  const { agentSlug, leaderSlug } = useParams<{ agentSlug?: string; leaderSlug?: string }>();
  const navigate = useNavigate();

  // Handle linkedin-content-gen with leaderSlug route
  const effectiveAgentSlug = leaderSlug ? "linkedin-content-gen" : agentSlug;
  const agentName = agentNameMap[effectiveAgentSlug || ""] || effectiveAgentSlug;

  const handleClose = () => {
    navigate("/adminpanel/ai-control");
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to AI Control
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate("/adminpanel")}>
                Admin Panel
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate("/adminpanel/ai-control")}>
                AI Control
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

      {/* Agent Components */}
      <div className="container mx-auto max-w-7xl">
        {effectiveAgentSlug === "data-strategist" && (
          <DataStrategistInlinePanel
            onClose={handleClose}
          />
        )}

        {effectiveAgentSlug === "content-strategist" && (
          <ContentStrategistInlinePanel
            onClose={handleClose}
          />
        )}

        {effectiveAgentSlug === "chief-of-staff" && (
          <ChiefOfStaffInlinePanel
            onClose={handleClose}
          />
        )}

        {effectiveAgentSlug === "seo-blog-generator" && (
          <SEOBlogGenerator />
        )}

        {effectiveAgentSlug === "hero-section-optimizer" && (
          <HeroSectionOptimizer />
        )}

        {effectiveAgentSlug === "weekly-client-email" && (
          <WeeklyClientEmailSummary />
        )}

        {effectiveAgentSlug === "brand-performance-optimization" && (
          <BrandPerformanceOptimizationPage />
        )}

        {effectiveAgentSlug === "linkedin-content-gen" && (
          <LinkedInContentGeneratorPage />
        )}

        {effectiveAgentSlug === "content-lifecycle" && (
          <ContentLifecyclePanel />
        )}

        {(effectiveAgentSlug === "brand-docs-generator" || effectiveAgentSlug === "documentation-generator") && (
          <DocumentationGeneratorPanel onClose={handleClose} />
        )}

        {effectiveAgentSlug === "marketing-intelligence" && (
          <MarketingIntelligencePanel />
        )}

        {/* Fallback for unknown agents */}
        {!["data-strategist", "content-strategist", "chief-of-staff", "seo-blog-generator", "hero-section-optimizer", "weekly-client-email", "brand-performance-optimization", "linkedin-content-gen", "content-lifecycle", "brand-docs-generator", "documentation-generator", "marketing-intelligence"].includes(effectiveAgentSlug || "") && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Agent "{effectiveAgentSlug}" is not available yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminAgentRunPage;

