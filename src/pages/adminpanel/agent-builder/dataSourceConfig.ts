export interface DataTableDef {
  name: string;
  description: string;
  category: string;
}

export const DATA_TABLE_GROUPS: { category: string; tables: DataTableDef[] }[] = [
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

export type KbCollectionType = "category" | "brand" | "project";

export type KbIndexingStatus = "ready" | "indexing" | "empty" | "partial" | "failed";

export interface KbCollection {
  key: string;
  type: KbCollectionType;
  id: string;
  name: string;
  slug?: string;
  fileCount: number;
  chunkCount: number;
  status: KbIndexingStatus;
  lastIndexed: string | null;
  manageUrl: string;
}

export interface DataSourceIntegrationConfig {
  enabled_tables: string[];
  enabled_kb: string[];
}

export function kbCollectionKey(type: KbCollectionType, id: string): string {
  return `${type}:${id}`;
}

export function parseKbCollectionKey(key: string): { type: KbCollectionType; id: string } | null {
  const [type, ...rest] = key.split(":");
  const id = rest.join(":");
  if (!id || (type !== "category" && type !== "brand" && type !== "project")) {
    return null;
  }
  return { type, id };
}
