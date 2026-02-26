import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRunAIAgent } from "@/hooks/useRunAIAgent";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import type { Database } from "@/integrations/supabase/types";
import Unauthorized from "@/pages/Unauthorized";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MousePointerClick,
  RefreshCw,
} from "lucide-react";

interface AuditSuggestion {
  text: string;
  confidence?: number;
}

interface AuditResult {
  summary?: string;
  suggestions: AuditSuggestion[];
}

type BrandRecord = Database["public"]["Tables"]["brands"]["Row"];
type BrandKPIRow = Database["public"]["Tables"]["brand_kpis"]["Row"] & {
  metric?: string | null;
  data?: unknown;
  value?: unknown;
  metrics?: unknown;
  source?: string | null;
  name?: string | null;
};
type AgentRunRow = Database["public"]["Tables"]["ai_agent_runs"]["Row"];

type BrandAccessResult = {
  brand: BrandRecord | null;
  hasAccess: boolean;
};

const CHECKLIST_ITEMS = [
  "Meta title includes primary keyword",
  "Meta description < 160 characters",
  "Image alt tags are descriptive",
  "Internal linking exists",
  "Header tags (H1, H2, etc.) used correctly",
];

const METRIC_ALIASES: Record<string, string[]> = {
  pageViews: ["pageviews", "page_views", "sessions"],
  bounceRate: ["bouncerate", "bounce_rate"],
  avgSession: ["avgsessionduration", "avg_session_duration", "average_session_duration", "sessionduration"],
  topPages: ["toppages", "top_pages", "toplandingpages"],
};

const METRIC_CONFIG = [
  {
    key: "pageViews",
    label: "Page Views",
    description: "Total GA4 sessions for the selected period",
    icon: BarChart3,
  },
  {
    key: "bounceRate",
    label: "Bounce Rate",
    description: "Percentage of single-page sessions",
    icon: Activity,
  },
  {
    key: "avgSession",
    label: "Avg. Session Duration",
    description: "Average time users spend per session",
    icon: Clock3,
  },
  {
    key: "topPages",
    label: "Top Pages",
    description: "Highest-performing landing pages",
    icon: FileText,
  },
] as const;

function normalizeKey(value?: string | null) {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDuration(value?: number | null) {
  if (!value || Number.isNaN(value)) return "—";
  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function toStringArray(value: unknown): string[] | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === "object") {
    const pages = (value as { pages?: unknown }).pages;
    if (Array.isArray(pages)) {
      return pages.map((item) => String(item));
    }
  }

  return null;
}

function parseSuggestionItem(item: unknown): AuditSuggestion {
  if (typeof item === "string") {
    return { text: item };
  }

  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    let textValue: string;

    if (typeof record.text === "string") {
      textValue = record.text;
    } else if (typeof record.message === "string") {
      textValue = record.message;
    } else if (record.text !== undefined) {
      textValue = String(record.text);
    } else {
      try {
        textValue = JSON.stringify(record);
      } catch (error) {
        textValue = String(item);
      }
    }

    const confidenceValue =
      typeof record.confidence === "number"
        ? record.confidence
        : undefined;

    return {
      text: textValue,
      confidence: confidenceValue,
    };
  }

  return { text: String(item) };
}

function extractTopPages(kpi?: BrandKPIRow) {
  if (!kpi) return [] as string[];
  const extended = kpi as BrandKPIRow & { data?: unknown; metrics?: unknown; value?: unknown };

  const candidates: string[][] = [];
  const dataPages = toStringArray(extended.data);
  if (dataPages) candidates.push(dataPages);

  const metricPages = toStringArray(extended.metrics);
  if (metricPages) candidates.push(metricPages);

  const valuePages = toStringArray(extended.value);
  if (valuePages) candidates.push(valuePages);

  if (candidates.length > 0) {
    return candidates[0];
  }

  if (typeof kpi.description === "string" && kpi.description.includes("http")) {
    return kpi.description
      .split(/,|\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseAuditSummary(summary: unknown): AuditResult | null {
  if (!summary) return null;

  const buildResult = (value: Record<string, unknown>): AuditResult => {
    const summaryValue = value.summary;
    const parsedSummary =
      typeof summaryValue === "string"
        ? summaryValue
        : summaryValue !== undefined && summaryValue !== null
          ? String(summaryValue)
          : undefined;

    const suggestionsValue = value.suggestions;
    const parsedSuggestions = Array.isArray(suggestionsValue)
      ? suggestionsValue.map((item) => parseSuggestionItem(item))
      : [];

    return {
      summary: parsedSummary,
      suggestions: parsedSuggestions,
    };
  };

  if (typeof summary === "string") {
    try {
      const parsed = JSON.parse(summary);
      if (parsed && typeof parsed === "object") {
        return buildResult(parsed as Record<string, unknown>);
      }
    } catch (error) {
      return {
        summary,
        suggestions: [],
      };
    }

    return {
      summary,
      suggestions: [],
    };
  }

  if (typeof summary === "object") {
    return buildResult(summary as Record<string, unknown>);
  }

  return {
    summary: String(summary),
    suggestions: [],
  };
}

function BrandHeader({ brand, lastAuditAt }: { brand: BrandRecord; lastAuditAt?: string | null }) {
  const initial = brand.name?.charAt(0)?.toUpperCase() ?? "B";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            {brand.logo_url ? (
              <AvatarImage src={brand.logo_url} alt={brand.name} />
            ) : (
              <AvatarFallback>{initial}</AvatarFallback>
            )}
          </Avatar>
          <div>
            <CardTitle className="text-2xl font-semibold">{brand.name}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3">
              {(brand as any).website_url && (
                <a
                  href={(brand as any).website_url.startsWith("http") ? (brand as any).website_url : `https://${(brand as any).website_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Visit Website
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <Link
                to={`/brands/${brand.slug}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
              >
                View Brand Overview
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              {lastAuditAt && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Last audit: {new Date(lastAuditAt).toLocaleString()}
                </span>
              )}
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/reports?type=seo">Submit SEO Report</Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            asChild
          >
            <a href="/docs/seo-resources.pdf" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              SEO Resources
            </a>
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function SEOMetricsPanel({ metrics }: { metrics: Record<string, BrandKPIRow | undefined> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {METRIC_CONFIG.map(({ key, label, description, icon: Icon }) => {
        const metric = metrics[key];
        const rawValue = metric?.value;
        let fallbackValue: number | null = null;

        if (typeof rawValue === "number") {
          fallbackValue = rawValue;
        } else if (typeof rawValue === "string") {
          const parsedValue = Number(rawValue);
          fallbackValue = Number.isNaN(parsedValue) ? null : parsedValue;
        }

        const currentValue = metric?.current_value ?? fallbackValue;
        let displayValue: string | string[] = "—";
        const numericValue =
          typeof currentValue === "number"
            ? currentValue
            : currentValue === null || currentValue === undefined
              ? null
              : Number(currentValue);

        if (key === "bounceRate") {
          displayValue = formatPercent(typeof numericValue === "number" ? numericValue : null);
        } else if (key === "avgSession") {
          displayValue = formatDuration(typeof numericValue === "number" ? numericValue : null);
        } else if (key === "topPages") {
          const pages = extractTopPages(metric);
          displayValue = pages.length > 0 ? pages.slice(0, 5) : [];
        } else {
          displayValue = formatNumber(typeof numericValue === "number" ? numericValue : null);
        }

        return (
          <Card key={key}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
              <Badge variant="secondary" className="rounded-full p-2">
                <Icon className="h-4 w-4" />
              </Badge>
            </CardHeader>
            <CardContent>
              {key === "topPages" ? (
                Array.isArray(displayValue) && displayValue.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {displayValue.map((page, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span className="break-all">{page}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No top pages data available yet.</p>
                )
              ) : (
                <p className="text-2xl font-semibold">
                  {typeof displayValue === "string" ? displayValue : "—"}
                </p>
              )}
              {metric?.source && (
                <p className="mt-2 text-xs text-muted-foreground">Source: {metric.source}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SEOChecklist() {
  const [progress, setProgress] = useState<Record<string, boolean>>({});

  const toggleItem = (item: string) => {
    setProgress((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const completedCount = Object.values(progress).filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>On-Page SEO Checklist</CardTitle>
        <CardDescription>
          Track your progress as you work through on-page optimizations. Saved locally for now.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {completedCount} of {CHECKLIST_ITEMS.length} items completed
        </div>
        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id={item}
                checked={progress[item] ?? false}
                onCheckedChange={() => toggleItem(item)}
                className="mt-1"
              />
              <Label htmlFor={item} className="text-sm leading-relaxed">
                {item}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface RunAIAuditSectionProps {
  brand: BrandRecord;
  metrics: Record<string, BrandKPIRow | undefined>;
  auditResult: AuditResult | null;
  setAuditResult: (result: AuditResult) => void;
  lastAudit?: AgentRunRow | null;
  refetchLastAudit: () => Promise<unknown>;
}

function RunAIAuditSection({
  brand,
  metrics,
  auditResult,
  setAuditResult,
  lastAudit,
  refetchLastAudit,
}: RunAIAuditSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const runAgent = useRunAIAgent();

  const copySuggestion = (text: string) => {
    if (!navigator?.clipboard) {
      toast({
        title: "Clipboard unavailable",
        description: "Your browser does not support copying to the clipboard.",
        variant: "destructive",
      });
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: "Suggestion copied for quick sharing.",
        });
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "We couldn't copy this suggestion. Please try again.",
          variant: "destructive",
        });
      });
  };

  const handleRunAudit = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to run the SEO audit.",
        variant: "destructive",
      });
      return;
    }

    const payloadMetrics: Record<string, unknown> = {};
    METRIC_CONFIG.forEach(({ key }) => {
      const metric = metrics[key];
      if (metric) {
        if (key === "topPages") {
          payloadMetrics[key] = {
            value: extractTopPages(metric),
            source: metric.source,
          };
          return;
        }

        const payloadValue = metric.current_value ?? metric.value ?? null;
        payloadMetrics[key] = {
          value: payloadValue,
          source: metric.source,
        };
      }
    });

    try {
      const response = await runAgent.mutateAsync({
        agent_id: "seo-audit-agent",
        execution_context: {
          user_id: user.id,
          brand_id: brand.id,
          metrics: payloadMetrics,
        },
      });

      const parsedSuggestions: AuditSuggestion[] = Array.isArray(response?.suggestions)
        ? response.suggestions.map((item) => parseSuggestionItem(item))
        : [];

      let summaryText: string | undefined;
      if (typeof response?.summary === "string") {
        summaryText = response.summary;
      } else if (response?.summary && typeof response.summary === "object" && "text" in response.summary) {
        summaryText = String((response.summary as Record<string, unknown>).text);
      } else {
        const responseRecord =
          response && typeof response === "object"
            ? (response as Record<string, unknown>)
            : undefined;
        const nestedData = responseRecord?.data;
        if (nestedData && typeof nestedData === "object") {
          const nestedSummary = (nestedData as Record<string, unknown>).summary;
          if (typeof nestedSummary === "string") {
            summaryText = nestedSummary;
          }
        }
      }

      let suggestionsResult = parsedSuggestions;
      if (suggestionsResult.length === 0) {
        const responseRecord =
          response && typeof response === "object"
            ? (response as Record<string, unknown>)
            : undefined;
        const nestedData = responseRecord?.data;
        if (nestedData && typeof nestedData === "object") {
          const nestedSuggestions = (nestedData as Record<string, unknown>).suggestions;
          if (Array.isArray(nestedSuggestions)) {
            suggestionsResult = nestedSuggestions.map((item) => parseSuggestionItem(item));
          }
        }
      }

      const result: AuditResult = {
        summary: summaryText,
        suggestions: suggestionsResult,
      };

      setAuditResult(result);
      toast({
        title: "SEO audit complete",
        description: "Review the AI suggestions below to take action.",
      });
      await refetchLastAudit();
    } catch (error) {
      console.error(error);
      toast({
        title: "Audit failed",
        description: "We couldn't run the AI audit. Please try again.",
        variant: "destructive",
      });
    }
  };

  const suggestions = auditResult?.suggestions ?? [];
  const summary = auditResult?.summary;
  const lastRunDate = lastAudit?.created_at ? new Date(lastAudit.created_at).toLocaleString() : null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>AI SEO Audit</CardTitle>
          <CardDescription>
            Generate optimization ideas using the CollabAI SEO expert agent.
          </CardDescription>
        </div>
        <Button onClick={handleRunAudit} disabled={runAgent.isPending} className="inline-flex items-center gap-2">
          {runAgent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {runAgent.isPending ? "Running audit..." : "Run SEO Audit"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastRunDate && (
          <p className="text-xs text-muted-foreground">
            Last run on {lastRunDate}
          </p>
        )}
        {summary && (
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium text-muted-foreground">Summary</p>
            <p className="mt-2 text-foreground">{summary}</p>
          </div>
        )}
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Run the audit to generate prioritized SEO recommendations.
            </p>
          ) : (
            suggestions.map((suggestion, index) => (
              <div key={`${suggestion.text}-${index}`} className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <p className="text-sm text-foreground">{suggestion.text}</p>
                  {typeof suggestion.confidence === "number" && (
                    <Badge variant="secondary" className="mt-2">
                      Confidence: {(suggestion.confidence * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="inline-flex items-center gap-2"
                  onClick={() => copySuggestion(suggestion.text)}
                >
                  <ClipboardCopy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExportButtons({
  suggestions,
  brand,
}: {
  suggestions: AuditSuggestion[];
  brand: BrandRecord | null;
}) {
  const { toast } = useToast();

  const handleCopyAll = () => {
    if (!suggestions.length) {
      toast({
        title: "No suggestions to copy",
        description: "Run the audit to generate AI recommendations.",
      });
      return;
    }

    if (!navigator?.clipboard) {
      toast({
        title: "Clipboard unavailable",
        description: "Your browser does not support copying to the clipboard.",
        variant: "destructive",
      });
      return;
    }

    const text = suggestions
      .map((item, index) => `${index + 1}. ${item.text}${typeof item.confidence === "number" ? ` (Confidence: ${(item.confidence * 100).toFixed(0)}%)` : ""}`)
      .join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({
          title: "Suggestions copied",
          description: "All AI recommendations copied to your clipboard.",
        });
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "We couldn't copy the suggestions. Please try again.",
          variant: "destructive",
        });
      });
  };

  const handleDownloadCsv = () => {
    if (!suggestions.length) {
      toast({
        title: "No suggestions to export",
        description: "Run the audit to generate AI recommendations first.",
      });
      return;
    }

    const header = "Suggestion,Confidence";
    const rows = suggestions.map((item) => {
      const confidenceValue = typeof item.confidence === "number" ? (item.confidence * 100).toFixed(0) : "";
      const escapedText = `"${item.text.replace(/"/g, '""')}"`;
      return `${escapedText},${confidenceValue}`;
    });
    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${brand?.slug ?? "brand"}-seo-suggestions.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "CSV downloaded",
      description: "Saved the AI suggestions as a CSV file.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export & Actions</CardTitle>
        <CardDescription>Share insights with stakeholders or jump to analytics tools.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 md:flex-row">
        <Button onClick={handleCopyAll} className="inline-flex items-center gap-2">
          <ClipboardCopy className="h-4 w-4" />
          Copy all suggestions
        </Button>
        <Button onClick={handleDownloadCsv} variant="secondary" className="inline-flex items-center gap-2">
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
        <Button asChild variant="outline" className="inline-flex items-center gap-2">
          <a href="https://analytics.google.com/" target="_blank" rel="noreferrer">
            <MousePointerClick className="h-4 w-4" />
            Open GA
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function BrandSEOWorkspace() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  const {
    data: brandAccess,
    isLoading: loadingBrand,
    error: brandError,
  } = useQuery<BrandAccessResult>({
    queryKey: ["brand-seo-workspace", slug, user?.id],
    enabled: Boolean(slug && user?.id),
    queryFn: async () => {
      if (!slug) {
        return { brand: null, hasAccess: false };
      }

      const { data: brand, error } = await supabase
        .from("brands")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      if (!brand) {
        return { brand: null, hasAccess: false };
      }

      const { data: assignment, error: assignmentError } = await supabase
        .from("user_brands")
        .select("can_view_analytics")
        .eq("brand_id", brand.id)
        .eq("user_id", user!.id)
        .eq("can_view_analytics", true)
        .maybeSingle();

      if (assignmentError) throw assignmentError;

      return {
        brand,
        hasAccess: Boolean(assignment),
      };
    },
    retry: 1,
  });

  const brand = brandAccess?.brand ?? null;
  const hasAccess = brandAccess?.hasAccess ?? false;

  const {
    data: kpis,
    isLoading: loadingKpis,
  } = useQuery<BrandKPIRow[]>({
    queryKey: ["brand-seo-kpis", brand?.id],
    enabled: Boolean(brand?.id && hasAccess),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_kpis")
        .select("*")
        .eq("brand_id", brand!.id);

      if (error) throw error;
      return (data ?? []) as BrandKPIRow[];
    },
  });

  const {
    data: lastAudit,
    refetch: refetchLastAudit,
  } = useQuery<AgentRunRow | null>({
    queryKey: ["brand-seo-last-audit", brand?.id],
    enabled: Boolean(brand?.id && hasAccess),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("*")
        .eq("agent_id", "seo-audit-agent")
        .contains("execution_context", { brand_id: brand!.id })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    },
  });

  useEffect(() => {
    if (brandError) {
      console.error(brandError);
      toast({
        title: "Unable to load brand",
        description: "We couldn't find this brand or you don't have access.",
        variant: "destructive",
      });
    }
  }, [brandError, toast]);

  useEffect(() => {
    if (lastAudit?.ai_summary) {
      const parsed = parseAuditSummary(lastAudit.ai_summary);
      if (parsed) {
        setAuditResult(parsed);
      }
    }
  }, [lastAudit]);

  const metricsMap = useMemo(() => {
    const map: Record<string, BrandKPIRow | undefined> = {};
    if (!kpis) return map;

    kpis.forEach((kpi) => {
      const metricKey = typeof kpi.metric === "string" ? kpi.metric : undefined;
      const normalizedMetric = normalizeKey(metricKey);
      const normalizedName = normalizeKey(kpi.name);

      METRIC_CONFIG.forEach(({ key }) => {
        const normalizedKey = normalizeKey(key);
        const aliasMatches = METRIC_ALIASES[key]?.some((alias) => {
          const normalizedAlias = normalizeKey(alias);
          return normalizedAlias === normalizedMetric || normalizedAlias === normalizedName;
        });
        if (
          normalizedMetric === normalizedKey ||
          normalizedName === normalizedKey ||
          aliasMatches
        ) {
          map[key] = kpi;
        }
      });
    });

    return map;
  }, [kpis]);

  if (!user) {
    return <Unauthorized />;
  }

  if (loadingBrand) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto py-12">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!brand || !hasAccess) {
    return <Unauthorized />;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-12">
      <BrandHeader brand={brand} lastAuditAt={lastAudit?.created_at} />
      {loadingKpis ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <SEOMetricsPanel metrics={metricsMap} />
      )}
      <SEOChecklist />
      <RunAIAuditSection
        brand={brand}
        metrics={metricsMap}
        auditResult={auditResult}
        setAuditResult={setAuditResult}
        lastAudit={lastAudit ?? undefined}
        refetchLastAudit={refetchLastAudit}
      />
      <ExportButtons suggestions={auditResult?.suggestions ?? []} brand={brand} />
    </div>
  );
}
