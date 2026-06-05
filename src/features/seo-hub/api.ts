import { supabase } from '@/integrations/supabase/client';
import {
  MOCK_SEO_SUMMARY,
  MOCK_SEO_REPORTS,
  MOCK_BACKLINK_RESULTS,
  MOCK_COMPETITOR_RESULTS,
} from '@/data/mockData';
import type {
  SEOSummary,
  SEOSavedReport,
  SEOToolType,
  BacklinkResultRow,
  CompetitorResultCard,
  SEOHubApiSaveReportRequest,
} from './types';

const USE_SEO_HUB_API = import.meta.env.VITE_SEO_HUB_API_ENABLED === 'true';

async function invokeSeoHubApi<T>(body: Record<string, unknown>): Promise<T | null> {
  if (!USE_SEO_HUB_API) return null;
  try {
    const { data, error } = await supabase.functions.invoke('seo-hub-api', { body });
    if (error) throw error;
    return data as T;
  } catch {
    return null;
  }
}

async function fetchKeywordCount(brandId?: string): Promise<number> {
  let query = supabase.from('keyword_research').select('id', { count: 'exact', head: true });
  if (brandId) query = query.eq('brand_id', brandId);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function fetchLatestAuditScore(brandId?: string): Promise<{ score: number | null; date: string | null }> {
  const { data: agents } = await supabase
    .from('ai_agents')
    .select('id')
    .eq('category', 'seo')
    .eq('is_enabled', true);

  const agentIds = (agents ?? []).map((a) => a.id);
  if (agentIds.length === 0) return { score: null, date: null };

  let query = supabase
    .from('ai_agent_runs')
    .select('ai_summary, created_at, execution_context')
    .in('agent_id', agentIds)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data, error } = await query;
  if (error || !data?.length) return { score: null, date: null };

  const run = data.find((r) => {
    if (!brandId) return true;
    const ctx = r.execution_context as Record<string, unknown> | null;
    return ctx?.brand_id === brandId;
  }) ?? data[0];

  const summary = run.ai_summary as Record<string, unknown> | null;
  let score: number | null = null;
  if (summary) {
    if (typeof summary.score === 'number') score = summary.score;
    else if (typeof summary.overall_score === 'number') score = summary.overall_score;
  }

  return { score, date: run.created_at };
}

export async function getSEOSummary(brandId?: string): Promise<SEOSummary> {
  const apiResult = await invokeSeoHubApi<SEOSummary>({
    action: 'get_summary',
    brand_id: brandId,
  });
  if (apiResult) return { ...apiResult, isDemo: false };

  const [keywordCount, audit] = await Promise.all([
    fetchKeywordCount(brandId),
    fetchLatestAuditScore(brandId),
  ]);

  const hasRealData = keywordCount > 0 || audit.score !== null;
  if (!hasRealData) {
    return { ...MOCK_SEO_SUMMARY, isDemo: true };
  }

  return {
    latestScanScore: audit.score ?? MOCK_SEO_SUMMARY.latestScanScore,
    keywordCount: keywordCount || MOCK_SEO_SUMMARY.keywordCount,
    backlinkCount: MOCK_SEO_SUMMARY.backlinkCount,
    reportsThisMonth: MOCK_SEO_SUMMARY.reportsThisMonth,
    lastScanDate: audit.date,
    isDemo: false,
  };
}

function mapAgentRunToReport(
  run: Record<string, unknown>,
  brandMap: Map<string, { name: string; slug: string }>
): SEOSavedReport | null {
  const ctx = run.execution_context as Record<string, unknown> | null;
  const brandId = (ctx?.brand_id as string) ?? '';
  const brand = brandMap.get(brandId);
  const summary = run.ai_summary as Record<string, unknown> | null;

  let toolType: SEOToolType = 'site_audit';
  const agentName = String(run.agent_name ?? '').toLowerCase();
  if (agentName.includes('competitor')) toolType = 'competitor';
  else if (agentName.includes('keyword')) toolType = 'keyword_research';
  else if (agentName.includes('backlink')) toolType = 'backlink';

  const score =
    typeof summary?.score === 'number'
      ? summary.score
      : typeof summary?.overall_score === 'number'
        ? summary.overall_score
        : null;

  return {
    id: String(run.id),
    brand_id: brandId,
    brand_name: brand?.name ?? 'Unknown Brand',
    brand_slug: brand?.slug ?? '',
    tool_type: toolType,
    title: `${toolType.replace('_', ' ')} — ${brand?.name ?? 'Scan'}`,
    score,
    status: (run.status as SEOSavedReport['status']) ?? 'completed',
    input_value: String(ctx?.url ?? ctx?.domain ?? brand?.slug ?? ''),
    result_summary:
      typeof summary?.summary === 'string'
        ? summary.summary
        : null,
    created_at: String(run.created_at),
    result_url: brand?.slug
      ? toolType === 'site_audit'
        ? `/brands/${brand.slug}/seo/workspace`
        : `/brands/${brand.slug}/seo`
      : undefined,
  };
}

export async function listSEOSavedReports(brandId?: string): Promise<SEOSavedReport[]> {
  const apiResult = await invokeSeoHubApi<{ reports: SEOSavedReport[] }>({
    action: 'list_reports',
    brand_id: brandId,
    limit: 50,
  });
  if (apiResult?.reports?.length) return apiResult.reports;

  const { data: agents } = await supabase
    .from('ai_agents')
    .select('id, name')
    .eq('category', 'seo');

  const agentMap = new Map((agents ?? []).map((a) => [a.id, a.name]));

  let runsQuery = supabase
    .from('ai_agent_runs')
    .select('id, agent_id, status, ai_summary, execution_context, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: runs } = await runsQuery;

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('is_active', true);

  const brandMap = new Map(
    (brands ?? []).map((b) => [b.id, { name: b.name ?? '', slug: b.slug ?? '' }])
  );

  const fromRuns: SEOSavedReport[] = (runs ?? [])
    .filter((r) => agentMap.has(r.agent_id))
    .map((r) =>
      mapAgentRunToReport(
        { ...r, agent_name: agentMap.get(r.agent_id) },
        brandMap
      )
    )
    .filter((r): r is SEOSavedReport => r !== null)
    .filter((r) => !brandId || r.brand_id === brandId);

  if (fromRuns.length > 0) return fromRuns;

  const filtered = brandId
    ? MOCK_SEO_REPORTS.filter((r) => r.brand_id === brandId)
    : MOCK_SEO_REPORTS;

  return filtered;
}

export async function saveSEOReport(
  payload: Omit<SEOHubApiSaveReportRequest, 'action'>
): Promise<void> {
  await invokeSeoHubApi({ action: 'save_report', ...payload });
}

export async function checkBacklinks(
  brandId: string,
  domain: string
): Promise<BacklinkResultRow[]> {
  const apiResult = await invokeSeoHubApi<{ backlinks: BacklinkResultRow[] }>({
    action: 'check_backlinks',
    brand_id: brandId,
    domain,
  });
  if (apiResult?.backlinks?.length) return apiResult.backlinks;
  return MOCK_BACKLINK_RESULTS;
}

export function getMockCompetitorResults(): CompetitorResultCard[] {
  return MOCK_COMPETITOR_RESULTS;
}

export async function resolveTechnicalSeoAuditorId(): Promise<string | null> {
  const { data } = await supabase
    .from('ai_agents')
    .select('id')
    .eq('slug', 'technical-seo-auditor')
    .eq('is_enabled', true)
    .maybeSingle();
  return data?.id ?? null;
}
