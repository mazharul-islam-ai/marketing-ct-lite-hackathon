/** SEO Hub types — frontend contract for Pritesh's seo-hub-api */

export type SEOToolType =
  | 'site_audit'
  | 'keyword_research'
  | 'backlink'
  | 'competitor';

export type SEOReportStatus = 'completed' | 'running' | 'failed';

export interface SEOSummary {
  latestScanScore: number | null;
  keywordCount: number;
  backlinkCount: number;
  reportsThisMonth: number;
  lastScanDate: string | null;
  isDemo: boolean;
}

export interface SEOSavedReport {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  tool_type: SEOToolType;
  title: string;
  score: number | null;
  status: SEOReportStatus;
  input_value: string;
  result_summary: string | null;
  created_at: string;
  result_url?: string;
}

export interface KeywordResultRow {
  keyword: string;
  search_volume: number | null;
  competition: 'low' | 'medium' | 'high' | null;
  relevance_score: number;
}

export interface AuditSuggestion {
  text: string;
  confidence?: number;
}

export interface SiteAuditResult {
  score: number | null;
  summary: string | null;
  suggestions: AuditSuggestion[];
}

export interface BacklinkResultRow {
  source_domain: string;
  target_url: string;
  link_type: 'dofollow' | 'nofollow' | 'unknown';
  anchor_text: string;
  domain_rating: number | null;
}

export interface CompetitorResultCard {
  domain: string;
  overlap_keywords: number;
  gap_score: number;
  top_keywords: string[];
  summary: string | null;
}

export type SEOInputType = 'url' | 'keyword' | 'domain' | 'domains';

export interface SEOToolConfig {
  id: SEOToolType;
  name: string;
  description: string;
  inputType: SEOInputType;
  href: (brandSlug: string) => string;
  icon: string;
}

/** seo-hub-api action payloads */
export interface SEOHubApiGetSummaryRequest {
  action: 'get_summary';
  brand_id?: string;
}

export interface SEOHubApiListReportsRequest {
  action: 'list_reports';
  brand_id?: string;
  limit?: number;
}

export interface SEOHubApiSaveReportRequest {
  action: 'save_report';
  brand_id: string;
  tool_type: SEOToolType;
  title: string;
  score: number | null;
  input_value: string;
  result_summary: string | null;
  result_url?: string;
}

export interface SEOHubApiCheckBacklinksRequest {
  action: 'check_backlinks';
  brand_id: string;
  domain: string;
}
