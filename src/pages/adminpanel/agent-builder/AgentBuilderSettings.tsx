import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Settings2, Brain, Wrench, Database,
  CheckCircle2, AlertCircle, ExternalLink, Loader2,
  Lock, Unlock, ChevronDown, ChevronRight,
  Zap, Globe2, MessageSquare, BarChart3, FolderOpen, Users, Briefcase,
  FileText, Save, History, CircleDot, Mail, Plug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ab } from "./agentBuilderTheme";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentBuilderPrompt } from "./types";
import { McpServersPanel } from "./McpServersPanel";

// ── Types ────────────────────────────────────────────────────────────────────

type ProviderStatus = "connected" | "not_configured" | "error" | "loading";

interface AIProvider {
  id: "openai" | "gemini" | "claude" | "perplexity";
  label: string;
  icon: string;
  models: string[];
  defaultModel: string;
}

interface ToolDef {
  id: string;
  label: string;
  description: string;
  integrationKey: string;
  category: string;
  icon: React.ReactNode;
}

interface DataTableDef {
  name: string;
  description: string;
  category: string;
}

// ── Static definitions ────────────────────────────────────────────────────────

const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    label: "OpenAI",
    icon: "🤖",
    // Fallback list — real list is fetched dynamically from the API when connected
    models: [
      "gpt-5",
      "gpt-5-mini",
      "gpt-4.5-preview",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4",
      "gpt-3.5-turbo",
      "o4-mini",
      "o3",
      "o3-mini",
      "o1",
      "o1-mini",
      "chatgpt-4o-latest",
    ],
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    icon: "✦",
    // Fallback list — real list is fetched dynamically from the API when connected
    models: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
    defaultModel: "gemini-1.5-flash",
  },
  {
    id: "claude",
    label: "Anthropic Claude",
    icon: "◈",
    // Anthropic has no public listing API — curated list
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ],
    defaultModel: "claude-3-5-haiku-20241022",
  },
  {
    id: "perplexity",
    label: "Perplexity AI",
    icon: "⊛",
    // Perplexity has no public listing API — curated list
    models: ["sonar-reasoning-pro", "sonar-reasoning", "sonar-pro", "sonar", "sonar-deep-research"],
    defaultModel: "sonar-reasoning-pro",
  },
];

const TOOLS: ToolDef[] = [
  {
    id: "activecollab",
    label: "ActiveCollab",
    description: "Query projects, tasks, and time tracking data",
    integrationKey: "activecollab",
    category: "Project Management",
    icon: <Briefcase className="w-4 h-4" />,
  },
  {
    id: "hubspot",
    label: "HubSpot",
    description: "Access CRM contacts, deals, and pipeline data",
    integrationKey: "hubspot",
    category: "CRM",
    icon: <Users className="w-4 h-4" />,
  },
  {
    id: "gohighlevel",
    label: "GoHighLevel",
    description: "Access contacts and CRM workflows",
    integrationKey: "gohighlevel",
    category: "CRM",
    icon: <Globe2 className="w-4 h-4" />,
  },
  {
    id: "n8n",
    label: "n8n Automation",
    description: "Trigger n8n workflows and automation pipelines",
    integrationKey: "n8n_analytics",
    category: "Automation",
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: "google_analytics",
    label: "Google Analytics",
    description: "Read website analytics and performance data",
    integrationKey: "google_analytics",
    category: "Analytics",
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    id: "google_drive",
    label: "Google Drive",
    description: "Read and search documents in Google Drive",
    integrationKey: "google_drive",
    category: "Storage",
    icon: <FolderOpen className="w-4 h-4" />,
  },
  {
    id: "gmail",
    label: "Gmail",
    description: "Read unread emails from Gmail inbox for automations",
    integrationKey: "gmail",
    category: "Email",
    icon: <Mail className="w-4 h-4" />,
  },
  {
    id: "slack",
    label: "Slack",
    description: "Send messages and notifications to Slack channels",
    integrationKey: "slack",
    category: "Messaging",
    icon: <MessageSquare className="w-4 h-4" />,
  },
];

const DATA_TABLE_GROUPS: { category: string; tables: DataTableDef[] }[] = [
  {
    category: "CRM & Clients",
    tables: [
      { name: "clients", description: "Client accounts and contact info", category: "CRM" },
      { name: "contacts", description: "Individual contacts and leads", category: "CRM" },
      { name: "deals", description: "Sales pipeline and deal data", category: "CRM" },
      { name: "brands", description: "Brand profiles and settings", category: "CRM" },
      { name: "projects", description: "Active and completed projects", category: "CRM" },
    ],
  },
  {
    category: "Content",
    tables: [
      { name: "generated_posts", description: "All AI-generated social posts", category: "Content" },
      { name: "brand_generated_posts", description: "Brand-specific generated posts", category: "Content" },
      { name: "seo_blog_content", description: "SEO blog articles and metadata", category: "Content" },
    ],
  },
  {
    category: "Analytics",
    tables: [
      { name: "brand_analytics_data", description: "Brand performance metrics", category: "Analytics" },
      { name: "content_performance_metrics", description: "Content engagement data", category: "Analytics" },
    ],
  },
  {
    category: "Knowledge Base",
    tables: [
      { name: "knowledge_base", description: "Organizational knowledge entries", category: "Knowledge" },
      { name: "knowledge_base_files", description: "Uploaded knowledge files", category: "Knowledge" },
      { name: "brand_knowledge_files", description: "Brand-specific knowledge files", category: "Knowledge" },
    ],
  },
  {
    category: "Team & HR",
    tables: [
      { name: "team_members", description: "Team member profiles", category: "Team" },
      { name: "employees", description: "Employee records from ActiveCollab", category: "Team" },
      { name: "pods", description: "Team pods and groups", category: "Team" },
      { name: "team_eod_submissions", description: "End-of-day activity logs", category: "Team" },
    ],
  },
  {
    category: "AI Agents",
    tables: [
      { name: "ai_agents", description: "Configured AI agent definitions", category: "Agents" },
      { name: "ai_agent_runs", description: "Agent execution history", category: "Agents" },
      { name: "agent_memories", description: "Persistent agent memory store", category: "Agents" },
    ],
  },
  {
    category: "ActiveCollab Sync",
    tables: [
      { name: "activecollab_task_data", description: "Synced tasks from ActiveCollab", category: "AC" },
      { name: "activecollab_sync_logs", description: "Sync operation history", category: "AC" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentBuilderSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"models" | "tools" | "mcp" | "data" | "system_prompt">("models");

  // AI provider health
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({
    openai: "loading", gemini: "loading", claude: "loading", perplexity: "loading",
  });
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [dynamicModels, setDynamicModels] = useState<Record<string, string[]>>({});
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});
  const [isSavingModels, setIsSavingModels] = useState(false);

  // Connected tools
  const [connectedTools, setConnectedTools] = useState<Set<string>>(new Set());
  const [isLoadingTools, setIsLoadingTools] = useState(true);

  // Data source enabled tables
  const [enabledTables, setEnabledTables] = useState<Set<string>>(new Set());
  const [isSavingData, setIsSavingData] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(DATA_TABLE_GROUPS.map((g) => g.category)),
  );

  // System Prompt versioning
  const [promptText, setPromptText] = useState("");
  const [activePrompt, setActivePrompt] = useState<AgentBuilderPrompt | null>(null);
  const [promptVersions, setPromptVersions] = useState<AgentBuilderPrompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isActivatingPrompt, setIsActivatingPrompt] = useState<string | null>(null);
  const isDirty = promptText !== (activePrompt?.prompt_text ?? "");

  // ── Load data on mount ────────────────────────────────────────────────────

  useEffect(() => {
    loadProviderHealthAndModels();
    loadSavedModelDefaults();
    loadConnectedTools();
    loadDataSourceSettings();
    loadPromptVersions();
  }, []);

  async function loadProviderHealthAndModels() {
    try {
      const types = ["openai", "google_gemini", "anthropic", "perplexity"];
      const { data } = await supabase
        .from("organization_integrations" as never)
        .select("integration_type, config")
        .in("integration_type" as never, types) as {
          data: { integration_type: string; config: Record<string, unknown> | null }[] | null;
        };

      const rows = data ?? [];
      const configured = new Set(
        rows
          .filter((r) => {
            const cfg = r.config;
            const key = ((cfg?.api_key ?? cfg?.apiKey ?? "") as string).trim();
            return key.length > 0;
          })
          .map((r) => r.integration_type),
      );

      const newStatus: Record<string, ProviderStatus> = {
        openai:     configured.has("openai")        ? "connected" : "not_configured",
        gemini:     configured.has("google_gemini") ? "connected" : "not_configured",
        claude:     configured.has("anthropic")     ? "connected" : "not_configured",
        perplexity: configured.has("perplexity")    ? "connected" : "not_configured",
      };
      setProviderStatus(newStatus);

      // Fetch real model lists for OpenAI and Gemini when connected
      if (newStatus.openai === "connected") {
        fetchDynamicModels("openai", "openai-test");
      }
      if (newStatus.gemini === "connected") {
        fetchDynamicModels("gemini", "gemini-test");
      }
    } catch {
      setProviderStatus({ openai: "error", gemini: "error", claude: "error", perplexity: "error" });
    }
  }

  async function fetchDynamicModels(providerId: string, edgeFunction: string) {
    setLoadingModels((prev) => ({ ...prev, [providerId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke(edgeFunction, {
        body: { action: "list_models" },
      });
      if (!error && data?.ok && Array.isArray(data.models) && data.models.length > 0) {
        setDynamicModels((prev) => ({ ...prev, [providerId]: data.models as string[] }));
      }
    } catch {
      // silently fall back to curated list
    } finally {
      setLoadingModels((prev) => ({ ...prev, [providerId]: false }));
    }
  }

  async function loadSavedModelDefaults() {
    const { data } = await supabase
      .from("organization_integrations" as never)
      .select("config")
      .eq("integration_type", "agent_builder_model_defaults")
      .maybeSingle() as { data: { config: Record<string, string> } | null };

    if (data?.config) {
      setSelectedModels(data.config as Record<string, string>);
    } else {
      // seed defaults
      const defaults: Record<string, string> = {};
      AI_PROVIDERS.forEach((p) => { defaults[p.id] = p.defaultModel; });
      setSelectedModels(defaults);
    }
  }

  async function loadConnectedTools() {
    setIsLoadingTools(true);
    try {
      const { data } = await supabase
        .from("organization_integrations" as never)
        .select("integration_type")
        .eq("is_active" as never, true) as { data: { integration_type: string }[] | null };

      const types = new Set((data ?? []).map((r) => r.integration_type));
      setConnectedTools(types);
    } finally {
      setIsLoadingTools(false);
    }
  }

  async function loadDataSourceSettings() {
    const { data } = await supabase
      .from("organization_integrations" as never)
      .select("config")
      .eq("integration_type", "agent_builder_data_sources")
      .maybeSingle() as { data: { config: { enabled_tables: string[] } } | null };

    if (data?.config?.enabled_tables) {
      setEnabledTables(new Set(data.config.enabled_tables));
    }
  }

  // ── Save handlers ─────────────────────────────────────────────────────────

  const saveModelDefaults = useCallback(async () => {
    setIsSavingModels(true);
    try {
      const { data: existing } = await supabase
        .from("organization_integrations" as never)
        .select("id")
        .eq("integration_type", "agent_builder_model_defaults")
        .maybeSingle() as { data: { id: string } | null };

      if (existing?.id) {
        await supabase
          .from("organization_integrations" as never)
          .update({ config: selectedModels, is_active: true } as never)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("organization_integrations" as never)
          .insert({ integration_type: "agent_builder_model_defaults", config: selectedModels, is_active: true } as never);
      }
      toast.success("Model defaults saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSavingModels(false);
    }
  }, [selectedModels]);

  const saveDataSources = useCallback(async (tables: Set<string>) => {
    setIsSavingData(true);
    try {
      const config = { enabled_tables: Array.from(tables) };
      const { data: existing } = await supabase
        .from("organization_integrations" as never)
        .select("id")
        .eq("integration_type", "agent_builder_data_sources")
        .maybeSingle() as { data: { id: string } | null };

      if (existing?.id) {
        await supabase
          .from("organization_integrations" as never)
          .update({ config, is_active: true } as never)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("organization_integrations" as never)
          .insert({ integration_type: "agent_builder_data_sources", config, is_active: true } as never);
      }
    } catch {
      toast.error("Failed to save data source settings");
    } finally {
      setIsSavingData(false);
    }
  }, []);

  async function loadPromptVersions() {
    setIsLoadingPrompts(true);
    try {
      const { data, error } = await supabase
        .from("agent_builder_prompts" as never)
        .select("*")
        .order("version_number", { ascending: false }) as {
          data: AgentBuilderPrompt[] | null;
          error: unknown;
        };

      if (error) throw error;

      const versions = data ?? [];
      setPromptVersions(versions);
      const active = versions.find((v) => v.is_active) ?? versions[0] ?? null;
      setActivePrompt(active);
      setPromptText(active?.prompt_text ?? "");
    } catch {
      // table may not exist yet in the current environment — fail silently
    } finally {
      setIsLoadingPrompts(false);
    }
  }

  const savePromptVersion = useCallback(async () => {
    const text = promptText.trim();
    if (!text || !isDirty) return;

    setIsSavingPrompt(true);
    try {
      // Determine next version number
      const nextVersion =
        promptVersions.length > 0
          ? Math.max(...promptVersions.map((v) => v.version_number)) + 1
          : 1;

      // Build version name using today's date
      const today = new Date();
      const datePart = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("");
      const versionName = `${datePart}_agent_builder_prompt_v${nextVersion}`;

      // Deactivate all existing versions
      if (promptVersions.length > 0) {
        await supabase
          .from("agent_builder_prompts" as never)
          .update({ is_active: false } as never)
          .neq("id", "00000000-0000-0000-0000-000000000000"); // update all rows
      }

      // Insert new active version
      const { data: inserted, error } = await supabase
        .from("agent_builder_prompts" as never)
        .insert({
          version_name: versionName,
          version_number: nextVersion,
          prompt_text: text,
          is_active: true,
        } as never)
        .select()
        .single() as { data: AgentBuilderPrompt | null; error: unknown };

      if (error) throw error;

      toast.success(`Saved as ${versionName}`);
      await loadPromptVersions();
      if (inserted) setActivePrompt(inserted);
    } catch {
      toast.error("Failed to save prompt version");
    } finally {
      setIsSavingPrompt(false);
    }
  }, [promptText, isDirty, promptVersions]); // eslint-disable-line react-hooks/exhaustive-deps

  async function activatePromptVersion(version: AgentBuilderPrompt) {
    if (version.is_active) return;
    setIsActivatingPrompt(version.id);
    try {
      // Deactivate all
      await supabase
        .from("agent_builder_prompts" as never)
        .update({ is_active: false } as never)
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // Activate chosen
      const { error } = await supabase
        .from("agent_builder_prompts" as never)
        .update({ is_active: true } as never)
        .eq("id", version.id);

      if (error) throw error;

      setActivePrompt(version);
      setPromptText(version.prompt_text);
      toast.success(`Activated ${version.version_name}`);
      await loadPromptVersions();
    } catch {
      toast.error("Failed to activate version");
    } finally {
      setIsActivatingPrompt(null);
    }
  }

  function toggleTable(name: string) {
    setEnabledTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      saveDataSources(next);
      return next;
    });
  }

  function toggleGroup(category: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "models"         as const, label: "AI Models",     icon: Brain },
    { id: "tools"          as const, label: "Tools",          icon: Wrench },
    { id: "mcp"            as const, label: "MCP Servers",    icon: Plug },
    { id: "data"           as const, label: "Data Sources",   icon: Database },
    { id: "system_prompt"  as const, label: "System Prompt",  icon: FileText },
  ];

  return (
    <div className={cn(ab.page, ab.canvas, "min-h-0")}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/adminpanel">Admin Panel</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink href="/adminpanel/agent-builder">Agent Builder</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate("/adminpanel/agent-builder")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ab.accentMuted)}>
            <Settings2 className={cn("w-4 h-4", ab.accentText)} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Agent Builder Settings</h1>
            <p className="text-xs text-muted-foreground">Configure models, tools, and data sources available to your agents</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all",
              activeTab === id
                ? ab.accentSoft
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto px-6 py-6">

        {/* ── AI MODELS TAB ── */}
        {activeTab === "models" && (
          <div className="max-w-3xl space-y-4">
            <p className="text-xs text-slate-500">
              Select which AI model to use by default for each provider when building agents.
              Only providers with valid API keys configured in your environment are available.
            </p>

            <div className="grid gap-3">
              {AI_PROVIDERS.map((provider) => {
                const status = providerStatus[provider.id] ?? "loading";
                const isConnected = status === "connected";
                const isLoading  = status === "loading";
                const isFetchingModels = loadingModels[provider.id] ?? false;
                // Use dynamically fetched models if available, otherwise fall back to curated list
                const modelList = dynamicModels[provider.id] ?? provider.models;
                const currentModel = selectedModels[provider.id] ?? provider.defaultModel;
                // Ensure the currently selected model is in the list (could be from before a dynamic fetch)
                const displayList = modelList.includes(currentModel)
                  ? modelList
                  : [currentModel, ...modelList];

                return (
                  <div
                    key={provider.id}
                    className={cn(
                      "rounded-xl border p-4 bg-[hsl(250_28%_96%)] transition-all",
                      isConnected  ? "border-[hsl(250_18%_90%)] shadow-sm"
                      : isLoading  ? "border-[hsl(250_18%_90%)] opacity-70"
                      : "border-[hsl(250_18%_90%)] opacity-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0",
                        isConnected ? ab.accentMuted : "bg-muted",
                      )}>
                        {provider.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{provider.label}</span>
                          {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                          ) : isConnected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-[hsl(250_18%_90%)]">
                              <AlertCircle className="w-2.5 h-2.5" /> Not configured
                            </span>
                          )}
                          {isFetchingModels && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                              <Loader2 className="w-3 h-3 animate-spin" /> Loading models…
                            </span>
                          )}
                        </div>

                        {isConnected ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Select
                              value={currentModel}
                              onValueChange={(v) => setSelectedModels((prev) => ({ ...prev, [provider.id]: v }))}
                              disabled={isFetchingModels}
                            >
                              <SelectTrigger className="h-8 text-xs w-72">
                                {isFetchingModels
                                  ? <span className="flex items-center gap-1.5 text-slate-400"><Loader2 className="w-3 h-3 animate-spin" />Fetching models…</span>
                                  : <SelectValue />
                                }
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                {displayList.map((m) => (
                                  <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {dynamicModels[provider.id] && (
                              <span className="text-[10px] text-slate-400">{dynamicModels[provider.id].length} models from API</span>
                            )}
                          </div>
                        ) : !isLoading ? (
                          <p className="text-xs text-slate-400 mt-1">
                            API key not configured.{" "}
                            <Link to="/adminpanel/integrations" className={cn(ab.accentText, "hover:underline inline-flex items-center gap-0.5")}>
                              Set up in Integrations <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                className="gap-2"
                onClick={saveModelDefaults}
                disabled={isSavingModels}
              >
                {isSavingModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save Model Defaults
              </Button>
            </div>
          </div>
        )}

        {/* ── TOOLS TAB ── */}
        {activeTab === "tools" && (
          <div className="max-w-3xl space-y-4">
            <p className="text-xs text-slate-500">
              These tools become available as nodes in your agent flow canvas when their integrations are connected.
              Connect missing integrations from the Integrations page.
            </p>

            {isLoadingTools ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
              </div>
            ) : (
              <div className="grid gap-3">
                {TOOLS.map((tool) => {
                  const isConnected = connectedTools.has(tool.integrationKey);
                  return (
                    <div
                      key={tool.id}
                      className={cn(
                        "rounded-xl border p-4 bg-[hsl(250_28%_96%)] flex items-center gap-4 transition-all",
                        isConnected ? "border-[hsl(250_18%_90%)] shadow-sm" : "border-[hsl(250_18%_90%)] opacity-60",
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isConnected ? cn(ab.accentMuted, ab.accentText) : "bg-[hsl(250_25%_94%)] text-[hsl(240_8%_40%)]",
                      )}>
                        {tool.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-slate-800">{tool.label}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{tool.category}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">{tool.description}</p>
                      </div>

                      <div className="shrink-0">
                        {isConnected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Connected
                          </span>
                        ) : (
                          <Link
                            to="/adminpanel/integrations"
                            className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors", ab.accentSoft, "hover:bg-[hsl(248_45%_92%)]")}
                          >
                            Connect <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MCP SERVERS TAB ── */}
        {activeTab === "mcp" && (
          <McpServersPanel />
        )}

        {/* ── DATA SOURCES TAB ── */}
        {activeTab === "data" && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-start justify-between">
              <p className="text-xs text-slate-500 max-w-xl">
                Enable database tables that agents are allowed to query when running.
                Disabled tables cannot be accessed even if an agent flow includes a DB Query node.
                The compiler will ask which table to query if you mention a database without specifying one.
                {isSavingData && <span className="ml-2 text-slate-400 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Saving…</span>}
              </p>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    const all = new Set(DATA_TABLE_GROUPS.flatMap((g) => g.tables.map((t) => t.name)));
                    setEnabledTables(all);
                    saveDataSources(all);
                  }}
                >
                  Enable all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setEnabledTables(new Set());
                    saveDataSources(new Set());
                  }}
                >
                  Disable all
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {DATA_TABLE_GROUPS.map((group) => {
                const expanded = expandedGroups.has(group.category);
                const enabledCount = group.tables.filter((t) => enabledTables.has(t.name)).length;

                return (
                  <div key={group.category} className="rounded-xl border border-[hsl(250_18%_90%)] bg-[hsl(250_28%_96%)] overflow-hidden shadow-sm">
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.category)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(250_25%_95%)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">{group.category}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {enabledCount}/{group.tables.length} enabled
                        </span>
                      </div>
                      {expanded
                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                      }
                    </button>

                    {/* Table rows */}
                    {expanded && (
                      <div className="divide-y divide-slate-100">
                        {group.tables.map((table) => {
                          const enabled = enabledTables.has(table.name);
                          return (
                            <div
                              key={table.name}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 transition-colors",
                                !enabled && "bg-[hsl(250_25%_95%)]/50",
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                                enabled ? cn(ab.accentMuted, ab.accentText) : "bg-[hsl(250_25%_94%)] text-[hsl(240_8%_40%)]",
                              )}>
                                {enabled
                                  ? <Unlock className="w-3 h-3" />
                                  : <Lock className="w-3 h-3" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-xs font-mono font-semibold", enabled ? "text-slate-800" : "text-slate-400")}>
                                  {table.name}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{table.description}</p>
                              </div>
                              <Switch
                                checked={enabled}
                                onCheckedChange={() => toggleTable(table.name)}
                                className="shrink-0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* ── SYSTEM PROMPT TAB ── */}
        {activeTab === "system_prompt" && (
          <div className="max-w-3xl space-y-6">
            <p className="text-xs text-slate-500">
              Define the global system prompt used by the Agent Builder. Saving creates a new
              immutable version; activate any past version to make it live.
            </p>

            {/* Editor */}
            <div className="rounded-xl border border-[hsl(250_18%_90%)] bg-[hsl(250_28%_96%)] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[hsl(250_18%_90%)] bg-[hsl(250_25%_95%)] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">Prompt Editor</span>
                {activePrompt && (
                  <span className="ml-auto text-[10px] text-slate-400 font-mono">
                    Active: {activePrompt.version_name}
                  </span>
                )}
              </div>

              {isLoadingPrompts ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <Textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Enter the system prompt for the Agent Builder…"
                    className="min-h-[280px] text-xs font-mono resize-y leading-relaxed"
                    spellCheck={false}
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      {promptText.length} characters
                      {isDirty && (
                        <span className="ml-2 text-amber-500 font-medium">● Unsaved changes</span>
                      )}
                    </span>
                    <Button
                      className="gap-2"
                      onClick={savePromptVersion}
                      disabled={!isDirty || isSavingPrompt || !promptText.trim()}
                      size="sm"
                    >
                      {isSavingPrompt
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Save className="w-3.5 h-3.5" />
                      }
                      {promptVersions.length === 0
                        ? "Save v1"
                        : `Save v${Math.max(...promptVersions.map((v) => v.version_number)) + 1}`
                      }
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Version history */}
            <div className="rounded-xl border border-[hsl(250_18%_90%)] bg-[hsl(250_28%_96%)] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[hsl(250_18%_90%)] bg-[hsl(250_25%_95%)] flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">Version History</span>
                <span className="ml-auto text-[10px] text-slate-400">{promptVersions.length} versions</span>
              </div>

              {isLoadingPrompts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                </div>
              ) : promptVersions.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-medium">No versions yet</p>
                  <p className="text-[11px] mt-1">Write a prompt above and click Save to create v1</p>
                </div>
              ) : (
                <ScrollArea className="max-h-72">
                  <div className="divide-y divide-slate-100">
                    {promptVersions.map((v) => {
                      const isActive = v.is_active;
                      const isActivating = isActivatingPrompt === v.id;
                      return (
                        <div
                          key={v.id}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 transition-colors",
                            isActive ? "bg-[hsl(248_40%_96%)]" : "hover:bg-[hsl(250_25%_94%)]",
                          )}
                        >
                          {/* Version badge */}
                          <div className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold shrink-0",
                            isActive
                              ? ab.accentBtn
                              : "bg-slate-100 text-slate-600",
                          )}>
                            v{v.version_number}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-semibold text-slate-700 truncate">
                                {v.version_name}
                              </span>
                              {isActive && (
                                <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0", ab.accentSoft)}>
                                  <CircleDot className="w-2.5 h-2.5" /> active
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(v.created_at).toLocaleString()}
                              {" · "}
                              {v.prompt_text.length} chars
                            </p>
                          </div>

                          {/* Action */}
                          <div className="shrink-0">
                            {isActive ? (
                              <span className="text-[11px] text-slate-400">Current</span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] gap-1 px-2.5"
                                onClick={() => activatePromptVersion(v)}
                                disabled={!!isActivatingPrompt}
                              >
                                {isActivating
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <CheckCircle2 className="w-3 h-3" />
                                }
                                Activate
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
