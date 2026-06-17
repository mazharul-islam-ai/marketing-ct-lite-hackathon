#!/usr/bin/env bash
set -e
export PGPASSWORD='Nihad#10867'
export DATABASE_URL="postgresql://postgres.mqdztkwdivjhvwlbqlpt@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
cd "$(dirname "$0")/11_data"

echo "==> Disabling FK checks and loading all CSV data..."

# Use a single psql session with replica mode so FK constraints are skipped during load.
# Tables loaded in dependency order (parents first).
psql "$DATABASE_URL" <<'PSQL'
SET session_replication_role = replica;

\copy public."organizations"                 FROM 'organizations.csv'                 CSV HEADER
\copy public."users"                         FROM 'users.csv'                         CSV HEADER
\copy public."user_roles"                    FROM 'user_roles.csv'                    CSV HEADER
\copy public."brands"                        FROM 'brands.csv'                        CSV HEADER
\copy public."user_brands"                   FROM 'user_brands.csv'                   CSV HEADER
\copy public."clients"                       FROM 'clients.csv'                       CSV HEADER
\copy public."contacts"                      FROM 'contacts.csv'                      CSV HEADER
\copy public."deals"                         FROM 'deals.csv'                         CSV HEADER
\copy public."projects"                      FROM 'projects.csv'                      CSV HEADER
\copy public."project_tasks"                 FROM 'project_tasks.csv'                 CSV HEADER
\copy public."project_task_comments"         FROM 'project_task_comments.csv'         CSV HEADER
\copy public."teams"                         FROM 'teams.csv'                         CSV HEADER
\copy public."team_members"                  FROM 'team_members.csv'                  CSV HEADER
\copy public."team_eod_submissions"          FROM 'team_eod_submissions.csv'          CSV HEADER
\copy public."pods"                          FROM 'pods.csv'                          CSV HEADER
\copy public."pod_members"                   FROM 'pod_members.csv'                   CSV HEADER
\copy public."employees"                     FROM 'employees.csv'                     CSV HEADER
\copy public."ai_agents"                     FROM 'ai_agents.csv'                     CSV HEADER
\copy public."ai_agent_runs"                 FROM 'ai_agent_runs.csv'                 CSV HEADER
\copy public."ai_configurations"             FROM 'ai_configurations.csv'             CSV HEADER
\copy public."ai_agent_knowledge_selection"  FROM 'ai_agent_knowledge_selection.csv'  CSV HEADER
\copy public."ai_generated_images"           FROM 'ai_generated_images.csv'           CSV HEADER
\copy public."knowledge_base_categories"     FROM 'knowledge_base_categories.csv'     CSV HEADER
\copy public."knowledge_base"                FROM 'knowledge_base.csv'                CSV HEADER
\copy public."thought_leaders"               FROM 'thought_leaders.csv'               CSV HEADER
\copy public."generated_posts"               FROM 'generated_posts.csv'               CSV HEADER
\copy public."brand_generated_posts"         FROM 'brand_generated_posts.csv'         CSV HEADER
\copy public."brand_kpis"                    FROM 'brand_kpis.csv'                    CSV HEADER
\copy public."brand_analytics_data"          FROM 'brand_analytics_data.csv'          CSV HEADER
\copy public."content_performance_metrics"   FROM 'content_performance_metrics.csv'   CSV HEADER
\copy public."keyword_research"              FROM 'keyword_research.csv'              CSV HEADER
\copy public."seo_blog_content"              FROM 'seo_blog_content.csv'              CSV HEADER
\copy public."newsletter_sources"            FROM 'newsletter_sources.csv'            CSV HEADER
\copy public."n8n_workflow_configs"          FROM 'n8n_workflow_configs.csv'          CSV HEADER
\copy public."organization_integrations"     FROM 'organization_integrations.csv'     CSV HEADER
\copy public."hackathon_events"              FROM 'hackathon_events.csv'              CSV HEADER
\copy public."hackathon_participants"        FROM 'hackathon_participants.csv'         CSV HEADER
\copy public."hackathon_teams"               FROM 'hackathon_teams.csv'               CSV HEADER
\copy public."hackathon_submissions"         FROM 'hackathon_submissions.csv'         CSV HEADER
\copy public."sora_videos"                   FROM 'sora_videos.csv'                   CSV HEADER
\copy public."activecollab_task_data"        FROM 'activecollab_task_data.csv'        CSV HEADER
\copy public."weekly_client_summary"         FROM 'weekly_client_summary.csv'         CSV HEADER

SET session_replication_role = default;
PSQL

echo ""
echo "==> Data load complete!"
