import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PerplexityTestDialog } from "@/components/admin/PerplexityTestDialog";
import { PerplexitySettingsDialog } from "@/components/admin/PerplexitySettingsDialog";
import { N8nWorkflowConfig } from "@/components/admin/N8nWorkflowConfig";
import { IntegrationStatusBadge } from "@/components/integrations/IntegrationStatusBadge";
import { IntegrationStatus } from "@/types/integration-status";
import {
  Plug,
  Search,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Power,
  Copy,
  Check,
  BarChart3,
  Eye,
  Loader2,
  Info,
  Download,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { ProviderCard } from "@/components/integrations/ProviderCard";
import { INTEGRATION_CATEGORIES } from "@/lib/integration-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockBrands } from "@/data/mockData";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { useToast } from "@/hooks/use-toast";

// Union type for different integration config structures
type IntegrationConfig =
  | { api_key: string; location_id: string } // GoHighLevel
  | { access_token: string; company_id: string } // LinkedIn
  | { tracking_id: string; domain: string } // Analytics
  | { access_token: string; account_id: string } // Meta Ads
  | { webhook_url?: string; webhook_secret?: string; sync_frequency?: string; last_sync_at?: string | null } // n8n Analytics
  | Record<string, any>; // Fallback for other configs

interface GlobalIntegration {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: string;
  category: string;
  is_available: boolean;
  is_enabled: boolean;
  setup_complexity: "easy" | "medium" | "complex";
  required_fields: string[];
  status?: IntegrationStatus;
}

interface BrandConnection {
  is_enabled: boolean;
  config: IntegrationConfig;
  status: "connected" | "error" | "pending";
}

interface BrandIntegration {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: string;
  category: "crm" | "social" | "analytics" | "marketing";
  is_available: boolean;
  setup_complexity: "easy" | "medium" | "complex";
  required_fields: string[];
  brand_connections: {
    [brandId: string]: BrandConnection;
  };
}

interface AnalyticsIntegrationSummary {
  id: string;
  brand_id: string;
  webhook_url: string;
  n8n_workflow_id?: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_frequency: string;
  data_sources: Record<string, any>;
  metadata: Record<string, any>;
}

interface AnalyticsIntegrationDetails extends AnalyticsIntegrationSummary {
  webhook_secret: string;
}

interface BrandSummary {
  id: string;
  name: string;
  active_integrations: string[];
  integration?: AnalyticsIntegrationSummary | null;
}

interface AnalyticsDataEntry {
  id: string;
  integration_id: string | null;
  data_type: string;
  date_range_start: string;
  date_range_end: string;
  metrics: Record<string, any>;
  dimensions: Record<string, any>;
  raw_data?: Record<string, any> | null;
  received_at: string | null;
}

const IntegrationManager = () => {
  const { toast } = useToast();
  const [globalIntegrations, setGlobalIntegrations] = useState<GlobalIntegration[]>([]);
  const [brandIntegrations, setBrandIntegrations] = useState<BrandIntegration[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("global");
  const [configData, setConfigData] = useState<{
    apiKey: string;
    baseUrl: string;
    locationId: string;
    projectId: string;
    collectionName: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    folderId: string;
  }>({
    apiKey: "",
    baseUrl: "",
    locationId: "",
    projectId: "",
    collectionName: "",
    clientId: "",
    clientSecret: "",
    refreshToken: "",
    folderId: "",
  });
  const [brandOptions, setBrandOptions] = useState<BrandSummary[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [configBrandId, setConfigBrandId] = useState<string>("");
  const [analyticsConfig, setAnalyticsConfig] = useState<AnalyticsIntegrationDetails | null>(null);
  const [analyticsSyncFrequency, setAnalyticsSyncFrequency] = useState<string>("daily");
  const [analyticsWorkflowId, setAnalyticsWorkflowId] = useState<string>("");
  const [regenerateSecret, setRegenerateSecret] = useState(false);
  const [isAnalyticsConfigLoading, setIsAnalyticsConfigLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDataEntry[]>([]);
  const [isAnalyticsDataDialogOpen, setIsAnalyticsDataDialogOpen] = useState(false);
  const [isAnalyticsDataLoading, setIsAnalyticsDataLoading] = useState(false);
  const [analyticsFilterStart, setAnalyticsFilterStart] = useState("");
  const [analyticsFilterEnd, setAnalyticsFilterEnd] = useState("");
  const [analyticsDataBrandId, setAnalyticsDataBrandId] = useState<string>("");
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isPerplexityTestDialogOpen, setIsPerplexityTestDialogOpen] = useState(false);
  const [isPerplexitySettingsDialogOpen, setIsPerplexitySettingsDialogOpen] = useState(false);
  const [serviceAccountFile, setServiceAccountFile] = useState<File | null>(null);
  const [isSavingServiceAccount, setIsSavingServiceAccount] = useState(false);
  const [oauthCredsFile, setOauthCredsFile] = useState<File | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["ai", "meetings", "storage", "crm", "email", "analytics", "project-management"]),
  );

  // Load integrations on mount
  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setIsLoadingBrands(true);
    setCopySuccess(null);

    const globalIntegrationsData: GlobalIntegration[] = [
      {
        id: "openai",
        name: "OpenAI",
        type: "openai",
        description: "AI-powered analysis and intelligent automation using GPT models",
        icon: "🤖",
        category: "ai",
        is_available: true,
        is_enabled: true,
        setup_complexity: "easy",
        required_fields: ["OPENAI_KEY (secret)"],
      },
      {
        id: "perplexity",
        name: "Perplexity",
        type: "perplexity",
        description: "AI-powered research and trend analysis with real-time web data",
        icon: "🔍",
        category: "ai",
        is_available: true,
        is_enabled: false,
        setup_complexity: "easy",
        required_fields: ["PERPLEXITY_API_KEY (secret)"],
      },
      {
        id: "anthropic",
        name: "Anthropic",
        type: "anthropic",
        description: "Claude AI models for advanced reasoning, analysis, and long-context tasks",
        icon: "🧠",
        category: "ai",
        is_available: true,
        is_enabled: false,
        setup_complexity: "easy",
        required_fields: ["ANTHROPIC_API_KEY (secret)"],
      },
      {
        id: "google-gemini",
        name: "Google Gemini",
        type: "google_gemini",
        description: "Google's multimodal AI for text, image, and video generation via Gemini API",
        icon: "✨",
        category: "ai",
        is_available: true,
        is_enabled: false,
        setup_complexity: "easy",
        required_fields: ["GEMINI_API_KEY (secret)"],
      },
      {
        id: "google-drive",
        name: "Google Drive",
        type: "google_drive",
        description: "Connect Google Drive for document ingestion and knowledge management.",
        icon: "📁",
        category: "storage",
        is_available: true,
        is_enabled: false,
        setup_complexity: "medium",
        required_fields: ["clientId", "clientSecret", "refreshToken", "folderId (optional)"],
      },
      {
        id: "gohighlevel",
        name: "GoHighLevel",
        type: "gohighlevel",
        description: "CRM and marketing automation platform for agencies",
        icon: "🎯",
        category: "crm",
        is_available: true,
        is_enabled: false,
        setup_complexity: "medium",
        required_fields: ["api_key", "location_id"],
      },
      {
        id: "hubspot",
        name: "HubSpot",
        type: "hubspot",
        description: "CRM, marketing, sales and service platform",
        icon: "🧡",
        category: "crm",
        is_available: true,
        is_enabled: false,
        setup_complexity: "medium",
        required_fields: ["api_key"],
      },
      {
        id: "activecollab",
        name: "ActiveCollab",
        type: "activecollab",
        description: "Project management and collaboration tool for teams",
        icon: "📋",
        category: "project-management",
        is_available: true,
        is_enabled: false,
        setup_complexity: "easy",
        required_fields: ["api_key", "base_url"],
      },
      // Meeting & Collaboration
      {
        id: "microsoft-teams",
        name: "Microsoft Teams",
        type: "microsoft_teams",
        description: "Meeting transcripts auto-indexed to knowledge base; agents pull meeting context for content generation.",
        icon: "💬",
        category: "meetings",
        is_available: true,
        is_enabled: false,
        setup_complexity: "complex",
        required_fields: ["client_id", "client_secret", "tenant_id"],
      },
      {
        id: "google-meet",
        name: "Google Meet",
        type: "google_meet",
        description: "Google Workspace Meet transcripts for scheduling context and meeting intelligence.",
        icon: "🎥",
        category: "meetings",
        is_available: true,
        is_enabled: false,
        setup_complexity: "complex",
        required_fields: ["client_id", "client_secret"],
      },
      // CRM additions
      {
        id: "salesforce",
        name: "Salesforce",
        type: "salesforce",
        description: "Enterprise CRM — pull client data for personalized content and campaign targeting.",
        icon: "☁️",
        category: "crm",
        is_available: true,
        is_enabled: false,
        setup_complexity: "complex",
        required_fields: ["client_id", "client_secret", "instance_url"],
      },
      {
        id: "pipedrive",
        name: "Pipedrive",
        type: "pipedrive",
        description: "Sales pipeline context for marketing content alignment and deal tracking.",
        icon: "🔵",
        category: "crm",
        is_available: true,
        is_enabled: false,
        setup_complexity: "easy",
        required_fields: ["api_key"],
      },
      // Project Management additions
      {
        id: "jira",
        name: "Jira",
        type: "jira",
        description: "Task and project context for agents — sync issues, epics, and sprints into the knowledge base.",
        icon: "🎫",
        category: "project-management",
        is_available: true,
        is_enabled: false,
        setup_complexity: "medium",
        required_fields: ["api_token", "domain", "email"],
      },
      {
        id: "clickup",
        name: "ClickUp",
        type: "clickup",
        description: "Project and task management for teams that use ClickUp as their primary PM tool.",
        icon: "✅",
        category: "project-management",
        is_available: true,
        is_enabled: false,
        setup_complexity: "easy",
        required_fields: ["api_key"],
      },
      {
        id: "asana",
        name: "Asana",
        type: "asana",
        description: "Task and project tracking — agents pull project context for content scheduling.",
        icon: "🌀",
        category: "project-management",
        is_available: true,
        is_enabled: false,
        setup_complexity: "easy",
        required_fields: ["personal_access_token"],
      },
      // Email Delivery
      {
        id: "sendgrid",
        name: "SendGrid",
        type: "sendgrid",
        description: "Transactional email for AI-generated reports, weekly summaries, and client emails at scale.",
        icon: "📨",
        category: "email",
        is_available: true,
        is_enabled: false,
        setup_complexity: "easy",
        required_fields: ["api_key"],
      },
      {
        id: "resend",
        name: "Resend",
        type: "resend",
        description: "Developer-first transactional email API for reliable delivery of agent-generated content.",
        icon: "📬",
        category: "email",
        is_available: true,
        is_enabled: false,
        setup_complexity: "easy",
        required_fields: ["api_key"],
      },
    ];

    const brandIntegrationsData: BrandIntegration[] = [
      {
        id: "gohighlevel",
        name: "GoHighLevel",
        type: "gohighlevel",
        description: "CRM and marketing automation platform",
        icon: "🎯",
        category: "crm",
        is_available: true,
        setup_complexity: "medium",
        required_fields: ["api_key", "location_id"],
        brand_connections: {},
      },
    ];

    // Load integration statuses from edge functions
    const checkIntegrationStatus = async (
      integrationId: string,
      edgeFunction: string,
      method: "GET" | "POST" = "GET",
      body?: any,
    ): Promise<IntegrationStatus> => {
      try {
        const { data, error } = await supabase.functions.invoke(edgeFunction, {
          method,
          body,
        });

        if (error) {
          return {
            id: integrationId,
            configured: false,
            connected: false,
            enabled: false,
            lastChecked: new Date().toISOString(),
            error: error.message,
            config: null,
          };
        }

        const config: Record<string, any> | null = data?.config ? { ...data.config } : null;

        return {
          id: integrationId,
          configured: data?.configured ?? false,
          connected: data?.connected ?? data?.enabled ?? false,
          enabled: data?.enabled ?? false,
          lastChecked: data?.lastCheckedAt ?? new Date().toISOString(),
          error: data?.error,
          hasApiKey: data?.hasApiKey,
          config,
        };
      } catch (err) {
        console.error(`Failed to check ${integrationId} status:`, err);
        return {
          id: integrationId,
          configured: false,
          connected: false,
          enabled: false,
          lastChecked: null,
          error: err instanceof Error ? err.message : "Unknown error",
          config: null,
        };
      }
    };

    let savedOpenAIApiKey = "";
    let savedPerplexityApiKey = "";
    let savedAnthropicApiKey = "";
    let savedGeminiApiKey = "";
    try {
      const { data: openaiConfigData } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("integration_type", "openai")
        .single();
      if (openaiConfigData?.config) {
        const config = openaiConfigData.config as Record<string, any>;
        savedOpenAIApiKey = (config.api_key ?? config.apiKey ?? "").toString().trim();
      }
    } catch (error) {
      console.warn("Unable to load saved OpenAI key for status check", error);
    }
    try {
      const { data: perplexityConfigData } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("integration_type", "perplexity")
        .single();
      if (perplexityConfigData?.config) {
        const config = perplexityConfigData.config as Record<string, any>;
        savedPerplexityApiKey = (config.api_key ?? config.apiKey ?? "").toString().trim();
      }
    } catch (error) {
      console.warn("Unable to load saved Perplexity key for status check", error);
    }
    try {
      const { data: anthropicConfigData } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("integration_type", "anthropic")
        .single();
      if (anthropicConfigData?.config) {
        const config = anthropicConfigData.config as Record<string, any>;
        savedAnthropicApiKey = (config.api_key ?? config.apiKey ?? "").toString().trim();
      }
    } catch (error) {
      console.warn("Unable to load saved Anthropic key for status check", error);
    }
    try {
      const { data: geminiConfigData } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("integration_type", "google_gemini")
        .single();
      if (geminiConfigData?.config) {
        const config = geminiConfigData.config as Record<string, any>;
        savedGeminiApiKey = (config.api_key ?? config.apiKey ?? "").toString().trim();
      }
    } catch (error) {
      console.warn("Unable to load saved Gemini key for status check", error);
    }

    // Check all integrations in parallel
    const [openaiStatus, perplexityStatus, anthropicStatus, geminiStatus, googleDriveStatus] = await Promise.all([
      checkIntegrationStatus("openai", "openai-test", "POST", {
        action: "status",
        apiKey: savedOpenAIApiKey || undefined,
      }),
      checkIntegrationStatus("perplexity", "perplexity-test", "POST", {
        action: "status",
        apiKey: savedPerplexityApiKey || undefined,
      }),
      checkIntegrationStatus("anthropic", "anthropic-test", "POST", {
        action: "status",
        apiKey: savedAnthropicApiKey || undefined,
      }),
      checkIntegrationStatus("google-gemini", "gemini-test", "POST", {
        action: "status",
        apiKey: savedGeminiApiKey || undefined,
      }),
      checkIntegrationStatus("google-drive", "test-google-drive", "POST", { action: "status" }),
    ]);

    // Update integrations with status
    const updateGlobalStatus = (id: string, status: IntegrationStatus, enabledFromConfigured = false) => {
      const idx = globalIntegrationsData.findIndex((item) => item.id === id);
      if (idx >= 0) {
        globalIntegrationsData[idx].is_enabled = enabledFromConfigured ? status.configured : status.enabled;
        globalIntegrationsData[idx].status = status;
      }
    };

    updateGlobalStatus("openai", openaiStatus);
    updateGlobalStatus("perplexity", perplexityStatus);
    updateGlobalStatus("anthropic", anthropicStatus);
    updateGlobalStatus("google-gemini", geminiStatus);
    updateGlobalStatus("google-drive", googleDriveStatus, true);

    try {
      const { data: ghlConfig } = await supabase.functions.invoke("gohighlevel-manage", { method: "GET" });
      if (ghlConfig?.configured) {
        brandIntegrationsData[0].brand_connections["current"] = {
          is_enabled: ghlConfig.enabled,
          config: { location_id: ghlConfig.locationId || "" },
          status: "connected",
        };
        const ghlGlobalIdx = globalIntegrationsData.findIndex((i) => i.id === "gohighlevel");
        if (ghlGlobalIdx >= 0) {
          globalIntegrationsData[ghlGlobalIdx].is_enabled = ghlConfig.enabled ?? false;
          globalIntegrationsData[ghlGlobalIdx].status = {
            id: "gohighlevel",
            configured: true,
            connected: ghlConfig.enabled ?? false,
            enabled: ghlConfig.enabled ?? false,
            lastChecked: new Date().toISOString(),
            config: null,
          };
        }
      }
    } catch (error) {
      console.error("Failed to load GoHighLevel config", error);
    }

    let fetchedBrands: BrandSummary[] = [];
    let analyticsConnections: Record<string, BrandConnection> = {};
    const fallbackBrandSummaries: BrandSummary[] = mockBrands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      active_integrations: brand.active_integrations,
      integration: undefined,
    }));

    try {
      const { data, error } = await supabase.functions.invoke("n8n-analytics-manage", {
        body: { action: "list_brands" },
      });

      if (error) {
        console.error("Failed to fetch n8n analytics brands", error);
        toast({
          title: "Failed to load analytics integrations",
          description: "Could not fetch n8n analytics data. Using cached data.",
          variant: "destructive",
        });
        throw error;
      }

      const brandsFromApi: BrandSummary[] = data?.brands ?? [];
      fetchedBrands = brandsFromApi;

      const sourceBrands = brandsFromApi.length > 0 ? brandsFromApi : fallbackBrandSummaries;
      analyticsConnections = sourceBrands.reduce<Record<string, BrandConnection>>((acc, brand) => {
        const isActive = brand.integration?.is_active ?? false;
        acc[brand.id] = {
          is_enabled: isActive,
          config: {
            webhook_url: brand.integration?.webhook_url,
            sync_frequency: brand.integration?.sync_frequency ?? "daily",
            last_sync_at: brand.integration?.last_sync_at ?? null,
          },
          status: isActive ? "connected" : "pending",
        };
        return acc;
      }, {});
    } catch (error) {
      console.error("Failed to load analytics integrations", error);
      toast({
        title: "Error loading integrations",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      if (fetchedBrands.length === 0) {
        fetchedBrands = fallbackBrandSummaries;
      }
      const sourceBrands = fetchedBrands.length > 0 ? fetchedBrands : fallbackBrandSummaries;
      analyticsConnections = sourceBrands.reduce<Record<string, BrandConnection>>((acc, brand) => {
        acc[brand.id] = {
          is_enabled: false,
          config: { sync_frequency: "daily", last_sync_at: null },
          status: "pending",
        };
        return acc;
      }, {});
    }

    const analyticsIntegration: BrandIntegration = {
      id: "google-analytics-direct",
      name: "Google Analytics",
      type: "google_analytics",
      description: "Direct integration with Google Analytics 4 for real-time data sync.",
      icon: "📊",
      category: "analytics",
      is_available: true,
      setup_complexity: "easy",
      required_fields: ["ga4_property_id", "credentials"],
      brand_connections: analyticsConnections,
    };

    setBrandOptions(fetchedBrands.length > 0 ? fetchedBrands : fallbackBrandSummaries);

    const availableBrands = fetchedBrands.length > 0 ? fetchedBrands : fallbackBrandSummaries;

    if (selectedBrand !== "all") {
      const stillExists = availableBrands.some((brand) => brand.id === selectedBrand);
      if (!stillExists) {
        setSelectedBrand("all");
      }
    }

    if (!configBrandId && availableBrands.length > 0) {
      setConfigBrandId(availableBrands[0].id);
    }

    if (!analyticsDataBrandId && availableBrands.length > 0) {
      setAnalyticsDataBrandId(availableBrands[0].id);
    }

    setGlobalIntegrations(globalIntegrationsData);
    setBrandIntegrations([...brandIntegrationsData, analyticsIntegration]);
    setIsLoadingBrands(false);
  };

  const filteredGlobalIntegrations = globalIntegrations.filter(
    (integration) =>
      integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredBrandIntegrations = brandIntegrations.filter(
    (integration) =>
      integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const toggleGlobalIntegration = (id: string) => {
    setGlobalIntegrations((prev) =>
      prev.map((integration) =>
        integration.id === id ? { ...integration, is_enabled: !integration.is_enabled } : integration,
      ),
    );
  };

  const toggleCategory = (slug: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleBrandIntegration = async (integrationId: string, brandId: string, nextState: boolean) => {
    if (integrationId === "n8n-analytics") {
      try {
        const { data, error } = await supabase.functions.invoke("n8n-analytics-manage", {
          body: { action: "update", brandId, isActive: nextState },
        });

        if (error || !data?.ok) {
          throw error || new Error(data?.error || "Unable to update integration state");
        }

        toast({
          title: nextState ? "Integration enabled" : "Integration disabled",
          description: "The n8n analytics integration status has been updated.",
        });

        await loadIntegrations();
      } catch (error: any) {
        console.error("Failed to toggle analytics integration", error);
        toast({
          title: "Update failed",
          description: error?.message ?? "Unable to update analytics integration.",
          variant: "destructive",
        });
      }
      return;
    }

    setBrandIntegrations((prev) =>
      prev.map((integration) => {
        if (integration.id === integrationId) {
          const updatedConnections = { ...integration.brand_connections };
          if (updatedConnections[brandId]) {
            updatedConnections[brandId] = {
              ...updatedConnections[brandId],
              is_enabled: nextState,
            };
          } else {
            const defaultConfig: IntegrationConfig = {};
            updatedConnections[brandId] = {
              is_enabled: nextState,
              config: defaultConfig,
              status: "pending" as const,
            };
          }
          return { ...integration, brand_connections: updatedConnections };
        }
        return integration;
      }),
    );
  };

  const loadAnalyticsConfiguration = async (brandId: string, options?: { includeData?: boolean }) => {
    if (!brandId) return;
    setIsAnalyticsConfigLoading(true);
    try {
      const payload: Record<string, any> = {
        action: "get",
        brandId,
        limit: options?.includeData ? 50 : 10,
      };

      if (options?.includeData && analyticsFilterStart) {
        payload.startDate = analyticsFilterStart;
      }
      if (options?.includeData && analyticsFilterEnd) {
        payload.endDate = analyticsFilterEnd;
      }

      const { data, error } = await supabase.functions.invoke("n8n-analytics-manage", {
        body: payload,
      });

      if (error) {
        throw error;
      }

      const integrationDetails = data?.integration as AnalyticsIntegrationDetails | null;
      const entries = Array.isArray(data?.data) ? (data.data as AnalyticsDataEntry[]) : [];

      setAnalyticsConfig(integrationDetails ?? null);
      setAnalyticsSyncFrequency(integrationDetails?.sync_frequency ?? "daily");
      setAnalyticsWorkflowId(integrationDetails?.n8n_workflow_id ?? "");
      if (options?.includeData || analyticsDataBrandId === brandId) {
        setAnalyticsData(entries);
      }
    } catch (error: any) {
      console.error("Failed to load analytics configuration", error);
      toast({
        title: "Unable to load analytics configuration",
        description: error?.message ?? "Check your permissions and try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyticsConfigLoading(false);
    }
  };

  const handleGenerateWebhook = async () => {
    if (!configBrandId) {
      toast({
        title: "Select a brand",
        description: "Choose a brand to generate a webhook for.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyticsConfigLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("n8n-analytics-manage", {
        body: {
          action: "create",
          brandId: configBrandId,
          syncFrequency: analyticsSyncFrequency,
          metadata: analyticsConfig?.metadata ?? {},
          dataSources: analyticsConfig?.data_sources ?? { google_analytics: true },
        },
      });

      if (error || !data?.ok) {
        throw error || new Error(data?.error || "Failed to create webhook");
      }

      const integrationDetails = data.integration as AnalyticsIntegrationDetails;
      setAnalyticsConfig(integrationDetails);
      setAnalyticsWorkflowId(integrationDetails?.n8n_workflow_id ?? "");
      setAnalyticsSyncFrequency(integrationDetails?.sync_frequency ?? analyticsSyncFrequency);
      setRegenerateSecret(false);
      setCopySuccess(null);

      toast({
        title: "Webhook ready",
        description: "A dedicated webhook URL and secret were generated for this brand.",
      });
      await loadIntegrations();
    } catch (error: any) {
      console.error("Failed to generate webhook", error);
      toast({
        title: "Webhook generation failed",
        description: error?.message ?? "Unable to create webhook. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyticsConfigLoading(false);
    }
  };

  const handleSaveAnalyticsSettings = async () => {
    if (!configBrandId) {
      toast({
        title: "Select a brand",
        description: "Choose a brand to update integration settings.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyticsConfigLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("n8n-analytics-manage", {
        body: {
          action: "update",
          brandId: configBrandId,
          syncFrequency: analyticsSyncFrequency,
          n8nWorkflowId: analyticsWorkflowId || null,
          regenerateSecret,
          metadata: analyticsConfig?.metadata ?? {},
          dataSources: analyticsConfig?.data_sources ?? { google_analytics: true },
        },
      });

      if (error || !data?.ok) {
        throw error || new Error(data?.error || "Failed to update analytics settings");
      }

      const integrationDetails = data.integration as AnalyticsIntegrationDetails;
      setAnalyticsConfig(integrationDetails ?? null);
      setAnalyticsWorkflowId(integrationDetails?.n8n_workflow_id ?? "");
      setAnalyticsSyncFrequency(integrationDetails?.sync_frequency ?? analyticsSyncFrequency);
      if (regenerateSecret) {
        setCopySuccess(null);
      }
      setRegenerateSecret(false);

      toast({ title: "Settings saved", description: "Analytics integration settings updated successfully." });
      await loadIntegrations();
    } catch (error: any) {
      console.error("Failed to update analytics settings", error);
      toast({
        title: "Save failed",
        description: error?.message ?? "Unable to update analytics integration.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyticsConfigLoading(false);
    }
  };

  const handleTestAnalytics = async () => {
    if (!configBrandId) {
      toast({
        title: "Select a brand",
        description: "Choose a brand to test the webhook configuration.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyticsConfigLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("n8n-analytics-manage", {
        body: { action: "test", brandId: configBrandId },
      });

      if (error || !data?.ok) {
        throw error || new Error(data?.error || "Webhook test failed");
      }

      toast({
        title: "Webhook verified",
        description: "Your n8n workflow can reach this webhook successfully.",
      });
    } catch (error: any) {
      console.error("Analytics test failed", error);
      toast({
        title: "Test failed",
        description: error?.message ?? "Unable to verify the webhook. Check your n8n workflow and secret.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyticsConfigLoading(false);
    }
  };

  const handleFetchAnalyticsData = async (brandId: string) => {
    if (!brandId) {
      toast({ title: "Select a brand", description: "Choose a brand to load analytics data.", variant: "destructive" });
      return;
    }

    setIsAnalyticsDataLoading(true);
    try {
      const payload: Record<string, any> = {
        action: "fetch_data",
        brandId,
        limit: 50,
      };

      if (analyticsFilterStart) payload.startDate = analyticsFilterStart;
      if (analyticsFilterEnd) payload.endDate = analyticsFilterEnd;

      const { data, error } = await supabase.functions.invoke("n8n-analytics-manage", { body: payload });
      if (error || !data?.ok) {
        throw error || new Error(data?.error || "Failed to load analytics data");
      }

      setAnalyticsData(data.data as AnalyticsDataEntry[]);
      setAnalyticsDataBrandId(brandId);
    } catch (error: any) {
      console.error("Failed to fetch analytics data", error);
      toast({
        title: "Unable to load analytics data",
        description: error?.message ?? "Try adjusting the filters or check the webhook activity.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyticsDataLoading(false);
    }
  };

  const handleCopyToClipboard = async (value: string | undefined, key: string) => {
    if (!value) {
      toast({
        title: "Nothing to copy",
        description: "Generate the webhook first to view this value.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
      toast({ title: "Copied to clipboard", description: "Use this value inside your n8n workflow." });
    } catch (error) {
      console.error("Clipboard copy failed", error);
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard. Copy manually instead.",
        variant: "destructive",
      });
    }
  };

  const handleExportAnalyticsData = () => {
    if (!analyticsData || analyticsData.length === 0) {
      toast({
        title: "No data to export",
        description: "Load analytics data before exporting.",
        variant: "destructive",
      });
      return;
    }

    try {
      const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `n8n-analytics-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Exported ${analyticsData.length} analytics records.`,
      });
    } catch (error) {
      console.error("Export failed", error);
      toast({
        title: "Export failed",
        description: "Could not export analytics data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAnalyticsBrandChange = (brandId: string) => {
    setConfigBrandId(brandId);
    setAnalyticsFilterStart("");
    setAnalyticsFilterEnd("");
    setAnalyticsDataBrandId(brandId);
    setAnalyticsConfig(null);
    setAnalyticsData([]);
    setRegenerateSecret(false);
    loadAnalyticsConfiguration(brandId);
  };

  const openAnalyticsDataDialog = async (brandId: string) => {
    setAnalyticsFilterStart("");
    setAnalyticsFilterEnd("");
    if (!brandId) {
      toast({ title: "Select a brand", description: "Choose a brand to view analytics data.", variant: "destructive" });
      return;
    }
    setIsAnalyticsDataDialogOpen(true);
    await handleFetchAnalyticsData(brandId);
  };

  const testConnection = async (integration: any) => {
    if (integration.id === "collabai") {
      if (!configData.baseUrl) {
        toast({
          title: "Missing Configuration",
          description: "Please enter Base URL before testing.",
          variant: "destructive",
        });
        return;
      }

      try {
        // Just test if the URL is reachable
        const testUrl = configData.baseUrl.trim().replace(/\/+$/, "");
        const response = await fetch(`${testUrl}/api/health`, { method: "HEAD" });
        toast({
          title: "URL Configured",
          description: "CollabAI base URL saved. Users can now configure their API keys in their profile.",
        });
      } catch (err: any) {
        toast({
          title: "URL Saved",
          description: "Base URL saved for CollabAI. Users can configure their API keys in profile.",
        });
      }
      return;
    }

    if (integration.id === "openai") {
      try {
        toast({
          title: "Testing Connection",
          description: "Testing OpenAI API connectivity...",
        });

        let resolvedApiKey = configData.apiKey?.trim() || "";
        if (!resolvedApiKey) {
          const { data: savedOpenAIConfig } = await supabase
            .from("organization_integrations")
            .select("config")
            .eq("integration_type", "openai")
            .single();

          if (savedOpenAIConfig?.config) {
            const savedConfig = savedOpenAIConfig.config as Record<string, any>;
            resolvedApiKey = (savedConfig.api_key ?? savedConfig.apiKey ?? "").toString().trim();
          }
        }

        const { data, error } = await supabase.functions.invoke("openai-test", {
          body: { action: "test", apiKey: resolvedApiKey || undefined },
        });

        if (error) {
          throw error;
        }

        if (!data?.ok) {
          throw new Error(data?.error || "OpenAI connection test failed");
        }

        const modelsInfo = data.models_available
          ? ` (${data.models_available} models available${data.has_gpt_models ? ", including GPT models" : ""})`
          : "";

        toast({
          title: "OpenAI Connection Successful",
          description: `Successfully connected to OpenAI API${modelsInfo}`,
        });

        // Also test text generation
        const { data: genData } = await supabase.functions.invoke("openai-test", {
          body: { action: "generate_test", apiKey: resolvedApiKey || undefined },
        });

        if (genData?.ok && genData?.generation_test) {
          toast({
            title: "OpenAI Generation Test Passed",
            description: `Text generation working. Response: "${genData.test_response}"`,
          });
        }
      } catch (err: any) {
        console.error("OpenAI test error:", err);
        toast({
          title: "OpenAI Connection Failed",
          description: err.message || "Failed to connect to OpenAI API. Check your API key in secrets.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "perplexity") {
      try {
        toast({
          title: "Testing Connection",
          description: "Testing Perplexity API connectivity...",
        });

        let resolvedApiKey = configData.apiKey?.trim() || "";
        if (!resolvedApiKey) {
          const { data: savedPerplexityConfig } = await supabase
            .from("organization_integrations")
            .select("config")
            .eq("integration_type", "perplexity")
            .single();

          if (savedPerplexityConfig?.config) {
            const savedConfig = savedPerplexityConfig.config as Record<string, any>;
            resolvedApiKey = (savedConfig.api_key ?? savedConfig.apiKey ?? "").toString().trim();
          }
        }

        const { data, error } = await supabase.functions.invoke("perplexity-test", {
          body: { action: "test", apiKey: resolvedApiKey || undefined },
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Perplexity connection test failed");

        toast({
          title: "Perplexity Connection Successful",
          description: "Successfully connected to Perplexity API.",
        });
      } catch (err: any) {
        console.error("Perplexity test error:", err);
        toast({
          title: "Perplexity Connection Failed",
          description: err.message || "Failed to connect to Perplexity API.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "anthropic") {
      try {
        toast({
          title: "Testing Connection",
          description: "Testing Anthropic API connectivity...",
        });

        let resolvedApiKey = configData.apiKey?.trim() || "";
        if (!resolvedApiKey) {
          const { data: savedAnthropicConfig } = await supabase
            .from("organization_integrations")
            .select("config")
            .eq("integration_type", "anthropic")
            .single();

          if (savedAnthropicConfig?.config) {
            const savedConfig = savedAnthropicConfig.config as Record<string, any>;
            resolvedApiKey = (savedConfig.api_key ?? savedConfig.apiKey ?? "").toString().trim();
          }
        }

        const { data, error } = await supabase.functions.invoke("anthropic-test", {
          body: { action: "test", apiKey: resolvedApiKey || undefined },
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Anthropic connection test failed");

        toast({
          title: "Anthropic Connection Successful",
          description: "Successfully connected to Anthropic API.",
        });
      } catch (err: any) {
        console.error("Anthropic test error:", err);
        toast({
          title: "Anthropic Connection Failed",
          description: err.message || "Failed to connect to Anthropic API.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "google-gemini") {
      try {
        toast({
          title: "Testing Connection",
          description: "Testing Gemini API connectivity...",
        });

        let resolvedApiKey = configData.apiKey?.trim() || "";
        if (!resolvedApiKey) {
          const { data: savedGeminiConfig } = await supabase
            .from("organization_integrations")
            .select("config")
            .eq("integration_type", "google_gemini")
            .single();

          if (savedGeminiConfig?.config) {
            const savedConfig = savedGeminiConfig.config as Record<string, any>;
            resolvedApiKey = (savedConfig.api_key ?? savedConfig.apiKey ?? "").toString().trim();
          }
        }

        const { data, error } = await supabase.functions.invoke("gemini-test", {
          body: { action: "test", apiKey: resolvedApiKey || undefined },
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Gemini connection test failed");

        toast({
          title: "Gemini Connection Successful",
          description: "Successfully connected to Google Gemini API.",
        });
      } catch (err: any) {
        console.error("Gemini test error:", err);
        toast({
          title: "Gemini Connection Failed",
          description: err.message || "Failed to connect to Google Gemini API.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "google-drive") {
      if (!configData.clientId || !configData.clientSecret || !configData.refreshToken) {
        toast({
          title: "Missing Configuration",
          description: "Please enter Client ID, Client Secret, and Refresh Token before testing.",
          variant: "destructive",
        });
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("test-google-drive", {
          body: {
            clientId: configData.clientId.trim(),
            clientSecret: configData.clientSecret.trim(),
            refreshToken: configData.refreshToken.trim(),
            folderId: configData.folderId?.trim() || undefined,
          },
        });

        if (error || !data?.success) {
          throw error || new Error(data?.error || "Google Drive connection test failed");
        }

        const filesInfo = data.filesChecked !== undefined ? ` Verified access to ${data.filesChecked} file(s).` : "";

        toast({
          title: "Google Drive Connection Successful",
          description: `Successfully connected to Google Drive.${filesInfo}`,
        });
      } catch (err: any) {
        toast({
          title: "Google Drive Connection Failed",
          description: err?.message ?? "Unable to connect to Google Drive. Check your credentials.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "n8n-analytics") {
      await handleTestAnalytics();
      return;
    }

    if (integration.id === "gohighlevel") {
      if (!configData.apiKey) {
        toast({
          title: "Missing API Key",
          description: "Please enter an API key before testing the connection.",
          variant: "destructive",
        });
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("gohighlevel-manage", {
          body: {
            action: "test",
            apiKey: configData.apiKey,
            locationId: configData.locationId,
          },
        });
        if (error || !data?.ok) throw error || new Error(data?.error || "Test failed");
        toast({ title: "Connection Successful", description: "Successfully connected to GoHighLevel" });
      } catch (err: any) {
        toast({
          title: "Connection Failed",
          description: err.message || "Failed to connect to GoHighLevel. Please check your credentials.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "hubspot") {
      if (!configData.apiKey) {
        toast({
          title: "Missing API Key",
          description: "Please enter an API key before testing the connection.",
          variant: "destructive",
        });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("hubspot-sync", {
          body: { action: "test", apiKey: configData.apiKey },
        });
        if (error || !data?.ok) throw error || new Error(data?.error || "Test failed");
        toast({ title: "Connection Successful", description: "Successfully connected to HubSpot." });
      } catch (err: any) {
        toast({
          title: "Connection Failed",
          description: err.message || "Failed to connect to HubSpot. Please check your API key.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "activecollab") {
      if (!configData.apiKey || !configData.baseUrl) {
        toast({
          title: "Missing Configuration",
          description: "Please enter API key and Base URL before testing.",
          variant: "destructive",
        });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("activecollab-projects", {
          body: { action: "test", apiKey: configData.apiKey, baseUrl: configData.baseUrl },
        });
        if (error || !data?.ok) throw error || new Error(data?.error || "Test failed");
        toast({ title: "Connection Successful", description: "Successfully connected to ActiveCollab." });
      } catch (err: any) {
        toast({
          title: "Connection Failed",
          description: err.message || "Failed to connect to ActiveCollab. Check your credentials.",
          variant: "destructive",
        });
      }
      return;
    }

    const noEdgeFunctionIds = [
      "microsoft-teams",
      "google-meet",
      "salesforce",
      "pipedrive",
      "jira",
      "clickup",
      "asana",
      "sendgrid",
      "resend",
    ];
    if (noEdgeFunctionIds.includes(integration.id)) {
      if (!integration.status?.configured) {
        toast({
          title: "Not configured yet",
          description: `Save ${integration.name} credentials first via Configure, then test the connection.`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Credentials stored",
        description: `${integration.name} credentials are saved. Full API test will be available once the sync function is deployed.`,
      });
      return;
    }
  };

  const saveConfiguration = async (integration: any) => {
    if (integration.id === "n8n-analytics") {
      await handleSaveAnalyticsSettings();
      return;
    }

    if (integration.id === "collabai") {
      if (!configData.baseUrl?.trim()) {
        toast({ title: "Missing field", description: "Base URL is required.", variant: "destructive" });
        return;
      }
      try {
        // Save base URL to a global setting (you may want to create a separate table for this)
        const { data, error } = await supabase.functions.invoke("collabai-manage", {
          body: { action: "save_base_url", baseUrl: configData.baseUrl.trim() },
        });
        if (error || !data?.ok) throw error || new Error(data?.error || "Save failed");
        toast({
          title: "Settings Saved",
          description: "CollabAI base URL configured. Users can now set up their API keys.",
        });
        setIsConfigDialogOpen(false);
        setConfigData({
          apiKey: "",
          baseUrl: "",
          locationId: "",
          projectId: "",
          collectionName: "",
          clientId: "",
          clientSecret: "",
          refreshToken: "",
          folderId: "",
        });
        loadIntegrations();
      } catch (e: any) {
        toast({
          title: "Save failed",
          description: e?.message ?? "Unable to save integration.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "google-drive") {
      if (!configData.clientId?.trim() || !configData.clientSecret?.trim() || !configData.refreshToken?.trim()) {
        toast({
          title: "Missing configuration",
          description: "Client ID, Client Secret, and Refresh Token are required.",
          variant: "destructive",
        });
        return;
      }

      try {
        const { data: existingData } = await supabase
          .from("organization_integrations")
          .select("*")
          .eq("integration_type", "google_drive")
          .single();

        const configPayload = {
          clientId: configData.clientId.trim(),
          clientSecret: configData.clientSecret.trim(),
          refreshToken: configData.refreshToken.trim(),
          folderId: configData.folderId?.trim() || "",
        };

        if (existingData) {
          const { error } = await supabase
            .from("organization_integrations")
            .update({
              config: configPayload,
              is_active: true,
            })
            .eq("integration_type", "google_drive");

          if (error) throw error;
        } else {
          const { error } = await supabase.from("organization_integrations").insert({
            integration_type: "google_drive",
            config: configPayload,
            is_active: true,
          });

          if (error) throw error;
        }

        toast({ title: "Google Drive settings saved", description: "Google Drive credentials stored successfully." });
        setIsConfigDialogOpen(false);
        setConfigData({
          apiKey: "",
          baseUrl: "",
          locationId: "",
          projectId: "",
          collectionName: "",
          clientId: "",
          clientSecret: "",
          refreshToken: "",
          folderId: "",
        });
        await loadIntegrations();
      } catch (e: any) {
        toast({
          title: "Save failed",
          description: e?.message ?? "Unable to save Google Drive integration.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "gohighlevel") {
      if (!configData.apiKey?.trim()) {
        toast({ title: "Missing API Key", description: "API key is required.", variant: "destructive" });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("gohighlevel-manage", {
          body: { action: "save", apiKey: configData.apiKey.trim(), locationId: configData.locationId?.trim() },
        });
        if (error || !data?.ok) throw error || new Error(data?.error || "Save failed");
        toast({ title: "Settings Saved", description: "GoHighLevel credentials stored successfully." });
        setIsConfigDialogOpen(false);
        setConfigData({
          apiKey: "",
          baseUrl: "",
          locationId: "",
          projectId: "",
          collectionName: "",
          clientId: "",
          clientSecret: "",
          refreshToken: "",
          folderId: "",
        });
        loadIntegrations();
      } catch (e: any) {
        toast({
          title: "Save failed",
          description: e?.message ?? "Unable to save integration.",
          variant: "destructive",
        });
      }
      return;
    }

    if (integration.id === "hubspot") {
      if (!configData.apiKey?.trim()) {
        toast({ title: "Missing API Key", description: "API key is required.", variant: "destructive" });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("hubspot-sync", {
          body: { action: "save", apiKey: configData.apiKey.trim() },
        });
        if (error || !data?.ok) throw error || new Error(data?.error || "Save failed");
        toast({ title: "Settings Saved", description: "HubSpot API key stored successfully." });
        setIsConfigDialogOpen(false);
        setConfigData({
          apiKey: "",
          baseUrl: "",
          locationId: "",
          projectId: "",
          collectionName: "",
          clientId: "",
          clientSecret: "",
          refreshToken: "",
          folderId: "",
        });
        loadIntegrations();
      } catch (e: any) {
        toast({ title: "Save failed", description: e?.message ?? "Unable to save integration.", variant: "destructive" });
      }
      return;
    }

    if (integration.id === "activecollab") {
      if (!configData.apiKey?.trim() || !configData.baseUrl?.trim()) {
        toast({ title: "Missing fields", description: "API key and Base URL are required.", variant: "destructive" });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("activecollab-projects", {
          body: { action: "save", apiKey: configData.apiKey.trim(), baseUrl: configData.baseUrl.trim() },
        });
        if (error || !data?.ok) throw error || new Error(data?.error || "Save failed");
        toast({ title: "Settings Saved", description: "ActiveCollab credentials stored successfully." });
        setIsConfigDialogOpen(false);
        setConfigData({
          apiKey: "",
          baseUrl: "",
          locationId: "",
          projectId: "",
          collectionName: "",
          clientId: "",
          clientSecret: "",
          refreshToken: "",
          folderId: "",
        });
        loadIntegrations();
      } catch (e: any) {
        toast({ title: "Save failed", description: e?.message ?? "Unable to save integration.", variant: "destructive" });
      }
      return;
    }

    const genericSaveIds = [
      "openai",
      "perplexity",
      "anthropic",
      "google-gemini",
      "microsoft-teams",
      "google-meet",
      "salesforce",
      "pipedrive",
      "jira",
      "clickup",
      "asana",
      "sendgrid",
      "resend",
    ];
    if (genericSaveIds.includes(integration.id)) {
      if (!configData.apiKey?.trim()) {
        toast({
          title: "Missing credentials",
          description: "Please enter the required API key or client secret.",
          variant: "destructive",
        });
        return;
      }
      const configPayload: Record<string, any> = { api_key: configData.apiKey.trim() };
      if (configData.baseUrl?.trim()) configPayload.base_url = configData.baseUrl.trim();
      if (configData.locationId?.trim()) configPayload.location_id = configData.locationId.trim();

      try {
        const { data: existingData } = await supabase
          .from("organization_integrations")
          .select("*")
          .eq("integration_type", integration.type)
          .single();

        if (existingData) {
          const { error } = await supabase
            .from("organization_integrations")
            .update({ config: configPayload, is_active: true })
            .eq("integration_type", integration.type);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("organization_integrations").insert({
            integration_type: integration.type,
            config: configPayload,
            is_active: true,
          });
          if (error) throw error;
        }

        toast({ title: "Settings Saved", description: `${integration.name} credentials stored successfully.` });
        setIsConfigDialogOpen(false);
        setConfigData({
          apiKey: "",
          baseUrl: "",
          locationId: "",
          projectId: "",
          collectionName: "",
          clientId: "",
          clientSecret: "",
          refreshToken: "",
          folderId: "",
        });
        loadIntegrations();
      } catch (e: any) {
        toast({ title: "Save failed", description: e?.message ?? "Unable to save integration.", variant: "destructive" });
      }
      return;
    }

    toast({
      title: "Save not configured",
      description: `${integration?.name ?? "This integration"} does not have a save handler yet.`,
      variant: "destructive",
    });
  };

  const removeConfiguration = async (integration: any) => {
    if (!integration?.id) return;

    const removableIntegrationIds = [
      "google-drive",
      "openai",
      "anthropic",
      "google-gemini",
      "microsoft-teams",
      "google-meet",
      "salesforce",
      "pipedrive",
      "jira",
      "clickup",
      "asana",
      "sendgrid",
      "resend",
    ];

    if (!removableIntegrationIds.includes(integration.id)) {
      toast({
        title: "Remove not supported",
        description: `${integration.name} does not support credential removal from this dialog yet.`,
        variant: "destructive",
      });
      return;
    }

    const integrationType = integration.id === "google-drive" ? "google_drive" : integration.type;

    try {
      const { error } = await supabase
        .from("organization_integrations")
        .delete()
        .eq("integration_type", integrationType);

      if (error) throw error;

      toast({
        title: "Credentials removed",
        description: `${integration.name} credentials were removed successfully.`,
      });
      setIsConfigDialogOpen(false);
      setConfigData({
        apiKey: "",
        baseUrl: "",
        locationId: "",
        projectId: "",
        collectionName: "",
        clientId: "",
        clientSecret: "",
        refreshToken: "",
        folderId: "",
      });
      await loadIntegrations();
    } catch (e: any) {
      toast({
        title: "Remove failed",
        description: e?.message ?? "Unable to remove credentials.",
        variant: "destructive",
      });
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case "easy":
        return "bg-success text-success-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      case "complex":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const openConfigDialog = async (integration: any, brandId?: string) => {
    setSelectedIntegration(integration);
    setServiceAccountFile(null); // Reset file on dialog open
    setOauthCredsFile(null); // Reset OAuth file on dialog open

    if (integration.id === "n8n-analytics") {
      const availableBrands =
        brandOptions.length > 0
          ? brandOptions
          : mockBrands.map((brand) => ({
              id: brand.id,
              name: brand.name,
              active_integrations: brand.active_integrations,
              integration: undefined,
            }));
      const fallbackBrandId = brandId || (selectedBrand !== "all" ? selectedBrand : availableBrands[0]?.id);

      if (fallbackBrandId) {
        handleAnalyticsBrandChange(fallbackBrandId);
      } else {
        setAnalyticsConfig(null);
      }
      setRegenerateSecret(false);
    } else {
      setConfigData({
        apiKey: "",
        baseUrl: "",
        locationId: "",
        projectId: "",
        collectionName: "",
        clientId: "",
        clientSecret: "",
        refreshToken: "",
        folderId: "",
      });

      try {
        const integrationType = integration.id === "google-drive" ? "google_drive" : integration.type;
        const { data, error } = await supabase
          .from("organization_integrations")
          .select("config")
          .eq("integration_type", integrationType)
          .single();

        if (!error && data?.config) {
          const config = data.config as Record<string, any>;
          setConfigData((prev) => ({
            ...prev,
            apiKey: config.api_key ?? config.apiKey ?? "",
            baseUrl: config.base_url ?? config.baseUrl ?? "",
            locationId: config.location_id ?? config.locationId ?? "",
            clientId: config.clientId ?? "",
            clientSecret: config.clientSecret ?? "",
            refreshToken: config.refreshToken ?? "",
            folderId: config.folderId ?? "",
          }));
        }
      } catch (error) {
        console.error(`Failed to load ${integration.name} configuration`, error);
      }
    }

    setIsConfigDialogOpen(true);
  };

  const handleServiceAccountUpload = async () => {
    if (!serviceAccountFile) {
      toast({
        title: "No file selected",
        description: "Please select a service account JSON file",
        variant: "destructive",
      });
      return;
    }

    setIsSavingServiceAccount(true);
    try {
      const fileContent = await serviceAccountFile.text();
      const jsonData = JSON.parse(fileContent);

      const { error } = await supabase
        .from("google_drive_settings")
        .insert({
          service_account_json: jsonData,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service account credentials saved successfully",
      });

      setServiceAccountFile(null);
      setIsConfigDialogOpen(false);
      await loadIntegrations();
    } catch (error) {
      console.error("Error saving service account:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save service account",
        variant: "destructive",
      });
    } finally {
      setIsSavingServiceAccount(false);
    }
  };

  const handleOAuthCredsUpload = async () => {
    if (!oauthCredsFile) {
      toast({
        title: "No file selected",
        description: "Please select a Google OAuth credentials JSON file",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileContent = await oauthCredsFile.text();
      const jsonData = JSON.parse(fileContent);

      // Extract credentials from the "web" object structure
      const webCreds = jsonData.web || jsonData;
      const clientId = webCreds.client_id;
      const clientSecret = webCreds.client_secret;

      if (!clientId || !clientSecret) {
        throw new Error("Invalid OAuth credentials file format");
      }

      // Auto-fill the form fields
      setConfigData((prev) => ({
        ...prev,
        clientId,
        clientSecret,
      }));

      toast({
        title: "Success",
        description: "OAuth credentials loaded from file. Click 'Save Configuration' to store them.",
      });

      setOauthCredsFile(null);
    } catch (error) {
      console.error("Error parsing OAuth credentials:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to parse OAuth credentials file",
        variant: "destructive",
      });
    }
  };

  const getIntegrationStats = () => {
    const globalStats = {
      available: globalIntegrations.filter((i) => i.is_available).length,
      enabled: globalIntegrations.filter((i) => i.is_enabled).length,
    };

    const brandStats = {
      available: brandIntegrations.filter((i) => i.is_available).length,
      connected: brandIntegrations.reduce((acc, integration) => {
        const connections = Object.values(integration.brand_connections).filter((conn) => conn.is_enabled);
        return acc + connections.length;
      }, 0),
    };

    return { global: globalStats, brand: brandStats };
  };

  const availableBrandOptions =
    brandOptions.length > 0
      ? brandOptions
      : mockBrands.map((brand) => ({
          id: brand.id,
          name: brand.name,
          active_integrations: brand.active_integrations,
          integration: undefined,
        }));

  const formatDateTime = (value?: string | null) => {
    if (!value) return "No data received yet";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const activeBrandForActions = selectedBrand !== "all" ? selectedBrand : (availableBrandOptions[0]?.id ?? "");

  const stats = getIntegrationStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Integration Manager</h1>
        <p className="text-muted-foreground">Configure and manage system-wide and brand-specific integrations</p>
      </div>

      <Alert className="border-muted-foreground/30 bg-muted/40">
        <Info className="h-4 w-4" />
        <AlertTitle>Investigate recent integration failures</AlertTitle>
        <AlertDescription>
          Review Supabase Edge Function errors, Codex remediation guidance, and issue logs inside the{" "}
          <Link to="/adminpanel/settings" className="font-medium underline underline-offset-4">
            System Settings
          </Link>{" "}
          workspace.
        </AlertDescription>
      </Alert>

      {/* Integration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="global">Global Integrations</TabsTrigger>
          <TabsTrigger value="brand">Brand Integrations</TabsTrigger>
          <TabsTrigger value="n8n">n8n Workflows</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        {/* Global Integrations Tab */}
        <TabsContent value="global" className="space-y-6">
          {/* Search */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search integrations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadIntegrations()} disabled={isLoadingBrands}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingBrands ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available</CardTitle>
                <Plug className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.global.available}</div>
                <p className="text-xs text-muted-foreground">Global integrations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Enabled</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.global.enabled}</div>
                <p className="text-xs text-muted-foreground">System-wide enabled</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{INTEGRATION_CATEGORIES.length}</div>
                <p className="text-xs text-muted-foreground">Integration categories</p>
              </CardContent>
            </Card>
          </div>

          {/* Categorized provider grid */}
          <div className="space-y-6">
            {INTEGRATION_CATEGORIES.map((category) => {
              const CategoryIcon = category.icon;
              const categoryProviders = filteredGlobalIntegrations.filter(
                (i) => i.category === category.slug,
              );
              if (categoryProviders.length === 0) return null;
              const isExpanded = expandedCategories.has(category.slug);

              return (
                <div key={category.slug} className="space-y-3">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => toggleCategory(category.slug)}
                  >
                    <CategoryIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="text-base font-semibold text-foreground">{category.name}</span>
                    <Badge variant="outline" className="ml-1 text-xs">
                      {categoryProviders.length}
                    </Badge>
                    <ChevronDown
                      className={`h-4 w-4 ml-auto text-muted-foreground transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-1">
                      {categoryProviders.map((integration) => (
                        <ProviderCard
                          key={integration.id}
                          integration={integration}
                          testLabel={integration.id === "openai" ? "Test API" : undefined}
                          onConfigure={() => void openConfigDialog(integration)}
                          onTest={() => void testConnection(integration)}
                          onToggle={() => toggleGlobalIntegration(integration.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredGlobalIntegrations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="h-8 w-8 mb-3 opacity-30" />
                <p className="text-sm">No integrations match your search.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Brand Integrations Tab */}
        <TabsContent value="brand" className="space-y-6">
          {/* Search and Brand Filter */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search brand integrations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedBrand} onValueChange={setSelectedBrand} disabled={isLoadingBrands}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {availableBrandOptions.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingBrands && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading brand integrations...
            </div>
          )}

          {/* Brand Integration Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available</CardTitle>
                <Plug className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.brand.available}</div>
                <p className="text-xs text-muted-foreground">Brand integrations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connected</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.brand.connected}</div>
                <p className="text-xs text-muted-foreground">Brand connections</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Category</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">CRM, Social, Analytics</div>
              </CardContent>
            </Card>
          </div>

          {/* Brand Integrations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBrandIntegrations.map((integration) => (
              <Card key={integration.id} className="relative">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{integration.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                      <Badge className={getComplexityColor(integration.setup_complexity)}>
                        {integration.setup_complexity}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>{integration.description}</CardDescription>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Brand Connections:</p>
                    <div className="space-y-1">
                      {availableBrandOptions.slice(0, 3).map((brand) => {
                        const connection = integration.brand_connections[brand.id];
                        return (
                          <div key={brand.id} className="flex items-center justify-between text-xs">
                            <span>{brand.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant={connection?.is_enabled ? "default" : "outline"} className="text-xs">
                                {connection?.is_enabled ? "Connected" : "Not Connected"}
                              </Badge>
                              <Switch
                                checked={connection?.is_enabled || false}
                                onCheckedChange={(checked) => toggleBrandIntegration(integration.id, brand.id, checked)}
                                disabled={integration.id === "n8n-analytics" && isLoadingBrands}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {integration.id === "google-analytics-direct" ? (
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link to="/adminpanel/integrations/analytics">
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void openConfigDialog(
                            integration,
                            integration.id === "n8n-analytics" ? activeBrandForActions || undefined : undefined,
                          )
                        }
                        className="flex-1"
                        disabled={integration.id === "n8n-analytics" && !activeBrandForActions}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    )}
                    {integration.id === "n8n-analytics" ? (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => activeBrandForActions && openAnalyticsDataDialog(activeBrandForActions)}
                          className="flex-1"
                          disabled={!activeBrandForActions || isAnalyticsDataLoading}
                        >
                          {isAnalyticsDataLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <BarChart3 className="h-4 w-4 mr-2" />
                          )}
                          View Data
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => activeBrandForActions && handleFetchAnalyticsData(activeBrandForActions)}
                          className="flex-1"
                          disabled={!activeBrandForActions || isAnalyticsDataLoading}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => testConnection(integration)}
                        className="flex-1"
                        disabled={!integration.is_available}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Test
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* n8n Workflows Tab */}
        <TabsContent value="n8n" className="space-y-6">
          <N8nWorkflowConfig />
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Global Integration Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Global Integrations</CardTitle>
                <CardDescription>System-wide integrations configured by administrators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {globalIntegrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{integration.icon}</span>
                      <div>
                        <p className="font-medium text-foreground">{integration.name}</p>
                        <p className="text-sm text-muted-foreground">{integration.category}</p>
                      </div>
                    </div>
                    {integration.status ? (
                      <IntegrationStatusBadge
                        configured={integration.status.configured}
                        connected={integration.status.connected}
                        enabled={integration.status.enabled}
                        error={integration.status.error}
                        lastChecked={integration.status.lastChecked}
                      />
                    ) : (
                      <Badge variant={integration.is_enabled ? "default" : "secondary"}>
                        {integration.is_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Brand Integration Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Brand Integrations</CardTitle>
                <CardDescription>Brand-specific integrations and their connection status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {brandIntegrations.map((integration) => {
                  const connectedCount = Object.values(integration.brand_connections).filter(
                    (conn) => conn.is_enabled,
                  ).length;
                  return (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{integration.icon}</span>
                        <div>
                          <p className="font-medium text-foreground">{integration.name}</p>
                          <p className="text-sm text-muted-foreground">{integration.category}</p>
                        </div>
                      </div>
                      <Badge variant={connectedCount > 0 ? "default" : "secondary"}>{connectedCount} Connected</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog
        open={isConfigDialogOpen}
        onOpenChange={(open) => {
          setIsConfigDialogOpen(open);
          if (!open) {
            setSelectedIntegration(null);
            setConfigData({
              apiKey: "",
              baseUrl: "",
              locationId: "",
              projectId: "",
              collectionName: "",
              clientId: "",
              clientSecret: "",
              refreshToken: "",
              folderId: "",
            });
            setAnalyticsConfig(null);
            setRegenerateSecret(false);
            setCopySuccess(null);
            setAnalyticsWorkflowId("");
            setIsAnalyticsConfigLoading(false);
          }
        }}
      >
        <DialogContent
          className={selectedIntegration?.id === "n8n-analytics" ? "sm:max-w-[720px]" : "sm:max-w-[425px]"}
        >
          <DialogHeader>
            <DialogTitle>Configure {selectedIntegration?.name}</DialogTitle>
            <DialogDescription>Set up your {selectedIntegration?.name} integration settings</DialogDescription>
          </DialogHeader>

          {selectedIntegration?.id === "n8n-analytics" ? (
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label>Brand</Label>
                <Select
                  value={configBrandId || activeBrandForActions || ""}
                  onValueChange={handleAnalyticsBrandChange}
                  disabled={availableBrandOptions.length === 0 || isAnalyticsConfigLoading || isLoadingBrands}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingBrands ? "Loading brands..." : "Select brand"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBrandOptions.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingBrands && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading available brands...
                  </p>
                )}
                {!isLoadingBrands && availableBrandOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">No brands available for configuration.</p>
                )}
              </div>

              <div className="grid gap-4 rounded-lg border border-border/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Integration status</p>
                    <p className="text-xs text-muted-foreground">
                      Last sync: {formatDateTime(analyticsConfig?.last_sync_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {(analyticsConfig?.is_active ?? false) ? "Active" : "Paused"}
                    </span>
                    <Switch
                      checked={analyticsConfig?.is_active ?? false}
                      onCheckedChange={(checked) =>
                        configBrandId && toggleBrandIntegration("n8n-analytics", configBrandId, checked)
                      }
                      disabled={!configBrandId}
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Webhook URL</p>
                      <p className="text-xs text-muted-foreground">Use this URL in your n8n HTTP Request node.</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(analyticsConfig?.webhook_url, "url")}
                      disabled={!analyticsConfig?.webhook_url}
                    >
                      {copySuccess === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="break-all rounded-md bg-muted px-3 py-2 text-xs font-mono">
                    {analyticsConfig?.webhook_url ?? "Generate a webhook to view the URL."}
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Webhook secret</p>
                      <p className="text-xs text-muted-foreground">
                        Send this in the X-Webhook-Secret header from n8n.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(analyticsConfig?.webhook_secret, "secret")}
                      disabled={!analyticsConfig?.webhook_secret}
                    >
                      {copySuccess === "secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="break-all rounded-md bg-muted px-3 py-2 text-xs font-mono">
                    {analyticsConfig?.webhook_secret ?? "Generate a webhook to view the secret."}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Sync frequency</Label>
                  <Select
                    value={analyticsSyncFrequency}
                    onValueChange={setAnalyticsSyncFrequency}
                    disabled={isAnalyticsConfigLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="workflow-id">n8n Workflow ID (optional)</Label>
                  <Input
                    id="workflow-id"
                    placeholder="e.g. 123"
                    value={analyticsWorkflowId}
                    onChange={(e) => setAnalyticsWorkflowId(e.target.value)}
                    disabled={isAnalyticsConfigLoading}
                  />
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="regenerate-secret"
                  checked={regenerateSecret}
                  onCheckedChange={(checked) => setRegenerateSecret(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="regenerate-secret">Regenerate webhook secret on save</Label>
                  <p className="text-xs text-muted-foreground">
                    Creates a new secret and URL. Update your n8n workflow after saving.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Info className="h-4 w-4" />
                  Setup steps
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  <li>Generate the webhook and copy the URL + secret.</li>
                  <li>In n8n, add an HTTP Request node pointing to the webhook URL with the secret header.</li>
                  <li>Map Google Analytics metrics to the payload structure and schedule the workflow.</li>
                  <li>Run a test execution and use “Test Webhook” to confirm delivery.</li>
                </ul>
              </div>

              <DialogFooter className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateWebhook}
                  disabled={!configBrandId || isAnalyticsConfigLoading}
                >
                  {isAnalyticsConfigLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plug className="h-4 w-4 mr-2" />
                  )}
                  {analyticsConfig?.webhook_secret ? "Regenerate Webhook" : "Generate Webhook"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestAnalytics}
                  disabled={!analyticsConfig?.webhook_secret || isAnalyticsConfigLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Test Webhook
                </Button>
                <Button onClick={handleSaveAnalyticsSettings} disabled={isAnalyticsConfigLoading || !configBrandId}>
                  {isAnalyticsConfigLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Settings
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-4">
                {selectedIntegration?.id !== "collabai" &&
                  selectedIntegration?.id !== "google-drive" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="api-key" className="text-right">
                        {selectedIntegration?.id === "jira"
                          ? "API Token *"
                          : ["microsoft-teams", "google-meet", "salesforce"].includes(
                                selectedIntegration?.id ?? "",
                              )
                            ? "Client Secret *"
                            : selectedIntegration?.id === "asana"
                              ? "Access Token *"
                              : "API Key *"}
                      </Label>
                      <Input
                        id="api-key"
                        type="password"
                        placeholder={
                          selectedIntegration?.id === "jira"
                            ? "Your Atlassian API token..."
                            : selectedIntegration?.id === "sendgrid"
                              ? "SG.xxxxxxxx..."
                              : selectedIntegration?.id === "resend"
                                ? "re_xxxxxxxx..."
                                : selectedIntegration?.id === "microsoft-teams" ||
                                    selectedIntegration?.id === "google-meet" ||
                                    selectedIntegration?.id === "salesforce"
                                  ? "Enter client secret..."
                                  : "Enter API key..."
                        }
                        className="col-span-3"
                        value={configData.apiKey}
                        onChange={(e) => setConfigData((prev) => ({ ...prev, apiKey: e.target.value }))}
                      />
                    </div>
                  )}
                {[
                  "collabai",
                  "activecollab",
                  "jira",
                  "salesforce",
                  "microsoft-teams",
                ].includes(selectedIntegration?.id ?? "") && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="base-url" className="text-right">
                      {selectedIntegration?.id === "jira"
                        ? "Domain *"
                        : selectedIntegration?.id === "salesforce"
                          ? "Instance URL *"
                          : selectedIntegration?.id === "microsoft-teams"
                            ? "Tenant ID *"
                            : "Base URL *"}
                    </Label>
                    <Input
                      id="base-url"
                      placeholder={
                        selectedIntegration?.id === "jira"
                          ? "yourcompany.atlassian.net"
                          : selectedIntegration?.id === "salesforce"
                            ? "yourcompany.salesforce.com"
                            : selectedIntegration?.id === "microsoft-teams"
                              ? "your-azure-tenant-id"
                              : selectedIntegration?.id === "activecollab"
                                ? "https://your-app.activecollab.com"
                                : "https://your-collabai-instance.com"
                      }
                      className="col-span-3"
                      value={configData.baseUrl}
                      onChange={(e) => setConfigData((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    />
                  </div>
                )}
                {selectedIntegration?.id === "google-drive" && (
                  <>
                    <div className="space-y-3 col-span-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Label>Upload OAuth Credentials JSON</Label>
                        <Badge variant="secondary" className="text-xs">Quick Setup</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload the credentials JSON file from Google Cloud Console to auto-fill Client ID and Client Secret
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          id="oauth-creds-file"
                          type="file"
                          accept=".json"
                          onChange={(e) => setOauthCredsFile(e.target.files?.[0] || null)}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleOAuthCredsUpload}
                          disabled={!oauthCredsFile}
                          size="sm"
                          variant="outline"
                        >
                          Load
                        </Button>
                      </div>
                      {oauthCredsFile && (
                        <p className="text-xs text-muted-foreground">
                          Selected: {oauthCredsFile.name}
                        </p>
                      )}
                    </div>
                    
                    <Separator className="col-span-4" />
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="google-client-id" className="text-right">
                        Client ID *
                      </Label>
                      <Input
                        id="google-client-id"
                        placeholder="Your Google OAuth Client ID"
                        className="col-span-3"
                        value={configData.clientId}
                        onChange={(e) => setConfigData((prev) => ({ ...prev, clientId: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="google-client-secret" className="text-right">
                        Client Secret *
                      </Label>
                      <Input
                        id="google-client-secret"
                        type="password"
                        placeholder="Your Google OAuth Client Secret"
                        className="col-span-3"
                        value={configData.clientSecret}
                        onChange={(e) => setConfigData((prev) => ({ ...prev, clientSecret: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="google-refresh-token" className="text-right">
                        Refresh Token *
                      </Label>
                      <Input
                        id="google-refresh-token"
                        type="password"
                        placeholder="Your Google OAuth Refresh Token"
                        className="col-span-3"
                        value={configData.refreshToken}
                        onChange={(e) => setConfigData((prev) => ({ ...prev, refreshToken: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="google-folder-id" className="text-right">
                        Folder ID
                      </Label>
                      <div className="col-span-3 space-y-1">
                        <Input
                          id="google-folder-id"
                          placeholder="Optional: Specific Google Drive folder ID"
                          value={configData.folderId}
                          onChange={(e) => setConfigData((prev) => ({ ...prev, folderId: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">Leave empty to access all accessible files</p>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label>Service Account JSON</Label>
                        <Badge variant="secondary" className="text-xs">Alternative Method</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload a Google Cloud service account JSON file for server-side authentication
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          id="service-account-file"
                          type="file"
                          accept=".json"
                          onChange={(e) => setServiceAccountFile(e.target.files?.[0] || null)}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleServiceAccountUpload}
                          disabled={!serviceAccountFile || isSavingServiceAccount}
                          size="sm"
                        >
                          {isSavingServiceAccount ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Upload"
                          )}
                        </Button>
                      </div>
                      {serviceAccountFile && (
                        <p className="text-xs text-muted-foreground">
                          Selected: {serviceAccountFile.name}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {["gohighlevel", "jira", "microsoft-teams", "salesforce"].includes(
                  selectedIntegration?.id ?? "",
                ) && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location-id" className="text-right">
                      {selectedIntegration?.id === "jira"
                        ? "Account Email *"
                        : selectedIntegration?.id === "microsoft-teams"
                          ? "Client ID *"
                          : selectedIntegration?.id === "salesforce"
                            ? "Client ID *"
                            : "Location ID"}
                    </Label>
                    <Input
                      id="location-id"
                      placeholder={
                        selectedIntegration?.id === "jira"
                          ? "you@company.com"
                          : selectedIntegration?.id === "microsoft-teams" ||
                              selectedIntegration?.id === "salesforce"
                            ? "Enter client ID..."
                            : "Optional location ID..."
                      }
                      className="col-span-3"
                      value={configData.locationId}
                      onChange={(e) => setConfigData((prev) => ({ ...prev, locationId: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <DialogFooter className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => removeConfiguration(selectedIntegration)}>
                  Remove Credentials
                </Button>
                <Button variant="outline" onClick={() => testConnection(selectedIntegration)}>
                  Test Connection
                </Button>
                <Button onClick={() => saveConfiguration(selectedIntegration)}>Save Configuration</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAnalyticsDataDialogOpen}
        onOpenChange={(open) => {
          setIsAnalyticsDataDialogOpen(open);
          if (!open) {
            setAnalyticsData([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[860px]">
          <DialogHeader>
            <DialogTitle>Analytics data</DialogTitle>
            <DialogDescription>Recent payloads delivered from your n8n workflow.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Brand</Label>
                <Select
                  value={analyticsDataBrandId || activeBrandForActions || ""}
                  onValueChange={(value) => handleFetchAnalyticsData(value)}
                  disabled={availableBrandOptions.length === 0 || isAnalyticsDataLoading || isLoadingBrands}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingBrands ? "Loading brands..." : "Select brand"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBrandOptions.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="analytics-start">Start date</Label>
                  <Input
                    id="analytics-start"
                    type="date"
                    value={analyticsFilterStart}
                    onChange={(e) => setAnalyticsFilterStart(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="analytics-end">End date</Label>
                  <Input
                    id="analytics-end"
                    type="date"
                    value={analyticsFilterEnd}
                    onChange={(e) => setAnalyticsFilterEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => analyticsDataBrandId && handleFetchAnalyticsData(analyticsDataBrandId)}
                disabled={!analyticsDataBrandId}
              >
                {isAnalyticsDataLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Apply filter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAnalyticsFilterStart("");
                  setAnalyticsFilterEnd("");
                  if (analyticsDataBrandId) {
                    handleFetchAnalyticsData(analyticsDataBrandId);
                  }
                }}
                disabled={!analyticsDataBrandId}
              >
                <Clock className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAnalyticsData}
                disabled={analyticsData.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>

            <div className="rounded-lg border border-border/50">
              <ScrollArea className="h-80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Data type</TableHead>
                      <TableHead className="w-[180px]">Date range</TableHead>
                      <TableHead>Metrics</TableHead>
                      <TableHead className="w-[160px]">Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                          {isAnalyticsDataLoading ? "Loading analytics data..." : "No analytics data received yet."}
                        </TableCell>
                      </TableRow>
                    )}
                    {analyticsData.map((entry) => {
                      const metricsEntries = Object.entries(entry.metrics || {});
                      const metricsPreview = metricsEntries.slice(0, 3);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="align-top text-sm font-medium text-foreground">
                            {entry.data_type}
                          </TableCell>
                          <TableCell className="align-top text-xs text-muted-foreground">
                            <div className="flex flex-col">
                              <span>{entry.date_range_start}</span>
                              <span>{entry.date_range_end}</span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1 text-xs">
                              {metricsPreview.map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between gap-4">
                                  <span className="font-medium text-foreground">{key}</span>
                                  <span className="text-muted-foreground">
                                    {typeof value === "number" ? value.toLocaleString() : String(value)}
                                  </span>
                                </div>
                              ))}
                              {metricsEntries.length > metricsPreview.length && (
                                <span className="text-xs text-muted-foreground">
                                  +{metricsEntries.length - metricsPreview.length} more metrics
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-xs text-muted-foreground">
                            {formatDateTime(entry.received_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Perplexity Dialogs */}
      <PerplexityTestDialog open={isPerplexityTestDialogOpen} onOpenChange={setIsPerplexityTestDialogOpen} />
      <PerplexitySettingsDialog
        open={isPerplexitySettingsDialogOpen}
        onOpenChange={setIsPerplexitySettingsDialogOpen}
        onOpenTest={() => {
          setIsPerplexitySettingsDialogOpen(false);
          setIsPerplexityTestDialogOpen(true);
        }}
      />
    </div>
  );
};

export default IntegrationManager;
