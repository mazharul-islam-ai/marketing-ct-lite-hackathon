# AI Agents Catalog

> **Last Updated:** 2026-01-05
> **Purpose:** Complete reference of all AI agents available in the SJ Marketing AI platform

## Overview

This document provides a comprehensive catalog of all AI agents configured in the system, their capabilities, categories, and usage guidelines.

**Related Documentation:**
- [AI Agent System Architecture](../System/ai_agent_system.md)
- [AI Agent Architecture](../System/features/ai-agent-architecture.md)

---

## Agent Categories

The platform organizes agents into the following categories:

| Category | Purpose | Example Agents |
|----------|---------|----------------|
| `seo` | SEO content generation and optimization | SEO Blog Generator |
| `business_analysis` | Data analysis, insights, and reporting | Data Strategist |
| `operations` | Task management, risk monitoring | Chief of Staff |
| `content_generation` | Content repurposing and ideation | Content Strategist |
| `communication` | Client communication and summaries | Weekly Client Email Agent |
| `linkedin` | LinkedIn content generation | LinkedIn Content Generator |
| `enablement` | Team enablement and training | Prompt Coach |
| `expense`, `income`, `cash_flow` | Financial analysis | Expense Analysis, etc. |

---

## Agent Catalog

### 1. SEO Blog Generator

**Slug:** `seo-blog-generator`
**Category:** `seo`
**Required Role:** `user`
**Model:** GPT-4o

**Description:**
Generates SEO-optimized blog posts with strict keyword placement and formatting rules.

**Key Features:**
- Enforces 600-700 word count
- Title requirements: 7-14 words with primary keyword
- Keyword placement rules:
  - Primary keyword: 2x (once in title, once in body)
  - Secondary keyword: 1x (body only)
  - Third keyword: 1x (body only)
  - No two keywords in same paragraph
- Structure: 5-8 paragraphs, exactly 4 sentences each (except bullet paragraph)
- One bullet paragraph with 3-5 bullets
- Brand name appears exactly once in last paragraph
- Forbidden characters: No hyphens or colons anywhere

**Data Sources:**
- Brand knowledge base
- Global knowledge base

**Output Format:**
```json
{
  "title": "7-14 word title with primary keyword",
  "paragraphs": [
    "First paragraph...",
    "Second paragraph...",
    "Bullet paragraph:\n- Point 1\n- Point 2\n- Point 3",
    "Fourth paragraph...",
    "Last paragraph with brand name..."
  ]
}
```

**Where to Use:**
- Brand SEO workspace: `/brands/[slug]/seo`
- Admin configuration: `/adminpanel/ai-control`

---

### 2. Data Strategist

**Slug:** `data-strategist`
**Category:** `business_analysis`
**Required Role:** `manager`
**Schedule:** Weekly (Monday 9:00 AM)

**Description:**
Turns raw data into clear charts, executive summaries, and actionable insights for the marketing team.

**Key Features:**
- Analyzes brand KPIs, analytics data, and project performance
- Validates input ranges and metric names
- Provides data quality assessment with confidence level

**Data Sources:**
- `brands` - Brand information
- `brand_kpis` - Key performance indicators
- `brand_analytics_data` - Analytics metrics
- `projects` - Project data

**Output Format:**
```json
{
  "charts": [
    {
      "type": "bar|line|pie",
      "title": "Chart title",
      "data": [...],
      "caption": "Short explanation"
    }
  ],
  "summary": [
    "Bullet 1 (max 18 words)",
    "Bullet 2 (max 18 words)",
    "Bullet 3 (max 18 words)"
  ],
  "actions": [
    {
      "what": "Action description",
      "who": "Role/person",
      "effort": "low|medium|high"
    }
  ],
  "reproduce": "SQL or spreadsheet formula",
  "data_warnings": "Quality notes",
  "confidence": "High|Medium|Low"
}
```

**Edge Function:** `data-strategist-agent`

---

### 3. Chief of Staff

**Slug:** `chief-of-staff`
**Category:** `operations`
**Required Role:** `manager`
**Schedule:** Daily (weekdays 8:00 AM)

**Description:**
Daily digest of blocked/at-risk tasks with suggested actions and ready-to-use message templates.

**Key Features:**
- Risk detection rules:
  - **Blocked:** Explicit blocker or status = blocked
  - **At-risk:** Due in ≤7 days with progress <50% OR no update in 10 days
- Provides Slack and email templates
- Surfaces quick wins
- Never changes tasks without human approval

**Data Sources:**
- `project_tasks` - Task tracking
- `projects` - Project information
- `employees` - Team directory
- `team_eod_submissions` - End-of-day updates
- `team_daily_summaries` - Daily team metrics

**Output Format:**
```json
{
  "digest_text": "Executive summary",
  "risk_list": [
    {
      "task_id": "uuid",
      "title": "Task title",
      "reason": "Why at risk",
      "next_action": "Specific next step",
      "owner": "Person name"
    }
  ],
  "blocked_list": [
    {
      "task_id": "uuid",
      "blocker": "What's blocking",
      "ask": "Exact request to unblock"
    }
  ],
  "quick_wins": ["Win 1", "Win 2", "Win 3"],
  "slack_templates": [...],
  "email_templates": [...]
}
```

---

### 4. Content Strategist

**Slug:** `content-strategist`
**Category:** `content_generation`
**Required Role:** `manager`

**Description:**
Generates hooks, repurposes assets, and creates content calendars from transcripts and videos.

**Key Features:**
- 10 hook ideas per content item
- 3 distinct content angles: story, data, how-to
- Full repurpose assets for top 3 hooks
- One-week calendar entry with channel and CTA
- Each hook includes performance reasoning

**Data Sources:**
- `leader_uploads` - Content files
- `thought_leaders` - Leader profiles
- `generated_posts` - Historical posts
- `content_performance_metrics` - Performance data
- `brands` - Brand information

**Output Format:**
```json
{
  "content_id": "uuid",
  "hooks": [
    {
      "hook": "1-2 line hook",
      "reason": "Why this may perform"
    }
  ],
  "top_3": [
    {
      "hook": "Best hook",
      "angle": "Content angle (one sentence)",
      "script_30s": "30-second video script",
      "newsletter": {
        "subject": "Email subject",
        "preview_lines": ["Line 1", "Line 2"]
      },
      "linkedin": {
        "post": "LinkedIn post text",
        "hashtags": ["#tag1", "#tag2", "#tag3"]
      }
    }
  ],
  "calendar": {
    "publish_date": "YYYY-MM-DD",
    "channel": "linkedin|email|blog",
    "cta": "Call to action"
  }
}
```

---

### 5. Weekly Client Email Agent

**Slug:** `weekly-client-email`
**Category:** `communication`
**Required Role:** `manager`

**Description:**
Generates and sends weekly project summaries to clients based on ActiveCollab task comments.

**Key Features:**
- Fetches all projects linked to selected client
- Retrieves tasks and comments from date range (default: Monday-Friday)
- AI generates professional summary
- Editable summary before sending
- Email record saved in `client_communications` table

**Data Sources:**
- `activecollab_task_data` - Task and comment data
- `projects` - Project information
- `clients` - Client details

**User Flow:**
1. User navigates to `/weekly-client-email-summary`
2. Selects client from dropdown
3. Selects date range
4. System fetches data and generates summary
5. User reviews/edits summary
6. User sends email

**Edge Functions:**
- `weekly-client-summary` - Generates AI summary
- `send-client-email` - Sends via SendGrid

**Environment Variables Required:**
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `OPENAI_KEY`
- `ACTIVECOLLAB_API_URL`

**Related Documentation:** See the Weekly Client Email Agent section in this catalog.

---

### 6. LinkedIn Content Generator

**Category:** `linkedin`
**Required Role:** `user`

**Description:**
Leader-specific content generation with persona-driven prompts and knowledge base integration.

**Key Features:**
- Uses thought leader profiles (name, title, tone, audience)
- Integrates leader-specific documents
- Incorporates weekly trends and influencer styles
- Real-time streaming responses
- Company knowledge base search

**Enhanced Context Sources:**
1. **Thought Leader Profile** (`thought_leaders`)
   - Name, title, tone, target audience
   - Key topics and expertise areas

2. **Leader Documents** (`leader_uploads`)
   - Personal writing samples
   - Previous successful posts
   - Brand guidelines

3. **Weekly Trends** (`weekly_trends`)
   - Current trending topics
   - Industry news and insights

4. **Influencer Styles** (`influencer_style_library`)
   - Reference posts from top influencers
   - Tone and style patterns

5. **Company Knowledge** (`knowledge_embeddings`)
   - Company values and messaging
   - Product information

6. **Agent Templates** (`linkedin_agent_templates`)
   - Reusable prompt templates

**Edge Functions:**
- `linkedin-content` - Content generation
- `linkedin-chat-stream` - Streaming responses
- `reconstruct-linkedin-prompt` - Prompt reconstruction

**Where to Use:**
- LinkedIn content page: `/content/linkedin-leader/:id`
- Brand workspace: `/brands/[slug]`

---

### 7. Prompt Coach

**Slug:** `prompt-coach`
**Category:** `enablement`
**Required Role:** `manager`

**Description:**
Guides marketers in crafting effective AI prompts with structured feedback and rewrite suggestions.

**Key Features:**
- Assesses clarity, context, and desired outcome
- Asks up to 2 focused questions if details missing
- Provides concise critique highlighting strengths and opportunities
- Delivers polished rewrite in markdown
- Offers 2 follow-up variations with different tones

**System Prompt Focus:**
- Context assessment
- Goal clarification
- Key inputs identification
- Desired output specification
- Encouraging and actionable feedback
- Marketing use case tailored

**Rewrite Format:**
```markdown
## Context
[Relevant background]

## Goal
[Clear objective]

## Key Inputs
[Required information]

## Desired Output
[Expected result format]
```

---

### 8. Financial Analysis Agents

#### Expense Analysis
**Slug:** `expense-analysis`
**Category:** `expense`
**Description:** AI-powered expense analysis and optimization
**Data Sources:** `expenses`, `invoices`

#### Income Forecasting
**Slug:** `income-forecasting`
**Category:** `income`
**Description:** Intelligent income prediction and trend analysis
**Data Sources:** `invoices`, `payments`

#### Cash Flow Analysis
**Slug:** `cash-flow-analysis`
**Category:** `cash_flow`
**Description:** Comprehensive cash flow analysis and forecasting
**Data Sources:** `expenses`, `invoices`, `payments`

---

## Agent Management

### Admin Access

**Location:** `/admin/AIAgentManagement` (Admin page) or `/adminpanel/ai-control` (Admin panel)

**Required Role:** `super_admin`

**Capabilities:**
- View all agents
- Configure provider settings (OpenAI, Gemini, Claude, Perplexity)
- Set model versions
- Configure external data sources
- Update agent scope (brand, project, operations, global)
- Enable/disable agents

**Agent Configuration UI:**
- **Scope Selection:** Brand, Project, Operations, Global
- **Provider Config:** Primary model, fallback provider, version
- **External Sources:** Enable/configure data sources
- **Schedule:** For automated agents (Data Strategist, Chief of Staff)

### Database Structure

**Table:** `ai_agents`

```sql
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  data_sources JSONB DEFAULT '[]',
  is_enabled BOOLEAN DEFAULT true,
  required_role app_role DEFAULT 'manager',
  schedule_config JSONB DEFAULT '{}',
  output_actions JSONB DEFAULT '{}',
  scope TEXT, -- 'brand', 'project', 'operations', 'global'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);
```

### Execution Tracking

**Table:** `ai_agent_runs`

Stores every agent execution with:
- Agent ID and executor
- Execution context (inputs, parameters)
- AI summary (output)
- Generated tasks/actions
- Status and approval status
- Category and title
- Error messages (if failed)
- Timestamps

---

## Agent Execution Flow

### High-Level Process

```
1. User Request
   ↓
2. Agent Configuration (load from ai_agents table)
   ↓
3. Knowledge Context Collection (pgvector search)
   ↓
4. Agent Memory Retrieval (previous conversations)
   ↓
5. Prompt Assembly (system prompt + context + seasonal rules)
   ↓
6. AI Provider Selection (primary → fallback → ultimate)
   ↓
7. AI Model Execution (OpenAI/Gemini/Claude/Perplexity)
   ↓
8. Response Parsing & Validation
   ↓
9. Storage (ai_agent_runs table)
   ↓
10. Return to User
```

### Provider Fallback Chain

All agents support automatic fallback:

```
Primary Provider (configured)
         ↓ (if fails)
Fallback Provider (optional)
         ↓ (if fails)
Ultimate Fallback (OpenAI)
```

### RAG Integration

All agents can leverage knowledge bases through semantic search:

1. Generate embedding for user query
2. Search relevant knowledge via pgvector cosine similarity
3. Retrieve top 5 snippets (threshold: 0.7)
4. Append to system prompt

**Knowledge Sources:**
- Company knowledge (`knowledge_embeddings`)
- Brand knowledge (`brand_knowledge_embeddings`)
- Project knowledge (`project_knowledge_files`)
- Leader uploads (`leader_uploads`)

### Agent Memory

Agents maintain conversation history per user:

**Table:** `agent_memories`

```sql
CREATE TABLE agent_memories (
  id UUID PRIMARY KEY,
  agent_user_id UUID, -- Composite: agent_id + user_id
  agent_id UUID REFERENCES ai_agents(id),
  memory_text TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small
  tags TEXT[],
  context JSONB,
  created_at TIMESTAMPTZ
);
```

**How It Works:**
1. Query embedding generated for user input
2. Search agent_memories via pgvector (threshold: 0.6)
3. Retrieve relevant conversation snippets
4. Append to prompt as "Previous Conversations"
5. Store new conversation after completion

---

## Best Practices

### For Users

1. **Provide Clear Context**
   - Specify desired output format
   - Include relevant brand/project details
   - Mention target audience or tone

2. **Review AI Outputs**
   - Always review generated content before using
   - Edit for brand voice consistency
   - Verify factual accuracy

3. **Use Agent Memory**
   - Reference previous conversations
   - Build on prior outputs
   - Provide feedback for improvement

### For Administrators

1. **Choose Appropriate Providers**
   - OpenAI: Best for structured output, function calling
   - Gemini: Good for long context, cost-effective
   - Claude: Strong reasoning, safety-focused
   - Perplexity: Real-time data, external sources

2. **Configure Knowledge Sources**
   - Keep knowledge bases updated
   - Use relevant categories only
   - Monitor embedding quality

3. **Monitor Performance**
   - Track token usage and costs per agent
   - Review agent run success/failure rates
   - Collect user feedback

4. **Set Appropriate Scopes**
   - `brand`: Agent works within brand context
   - `project`: Agent tied to specific projects
   - `operations`: Cross-functional operations
   - `global`: System-wide capabilities

---

## Troubleshooting

### Common Issues

**Agent Not Appearing:**
- Check `is_enabled` flag in `ai_agents` table
- Verify user has required role
- Confirm RLS policies allow access

**Poor Quality Outputs:**
- Review system prompt clarity
- Add more relevant knowledge sources
- Adjust temperature/max_tokens settings
- Check if knowledge base is up to date

**Agent Execution Failures:**
- Check edge function logs: `supabase functions logs <function-name>`
- Verify API keys are set (OPENAI_KEY, etc.)
- Check provider rate limits
- Review error in `ai_agent_runs.error_message`

**Slow Response Times:**
- Reduce knowledge context (lower match_count)
- Use faster model (gpt-4o-mini instead of gpt-4o)
- Check if streaming is enabled for long responses
- Optimize system prompt length

---

## Adding New Agents

### Step-by-Step Guide

1. **Create Migration File**
   ```sql
   -- supabase/migrations/YYYYMMDDHHMMSS_add_my_agent.sql
   INSERT INTO public.ai_agents (
     name, slug, description, category,
     system_prompt, data_sources, is_enabled, required_role
   ) VALUES (
     'My Agent Name',
     'my-agent-slug',
     'Agent description',
     'agent_category',
     'System prompt here...',
     '["data_source1", "data_source2"]'::jsonb,
     true,
     'manager'
   );
   ```

2. **Create Edge Function** (if needed)
   ```bash
   mkdir -p supabase/functions/my-agent
   # Add index.ts with agent logic
   ```

3. **Deploy**
   ```bash
   supabase db push
   supabase functions deploy my-agent
   ```

4. **Test**
   - Navigate to admin panel
   - Configure agent settings
   - Run test execution
   - Verify output format

5. **Document**
   - Add agent details to this catalog
   - Update related documentation
   - Create user guide if needed

---

## API Reference

### Running an Agent

```typescript
const { data, error } = await supabase.functions.invoke('run-ai-agent', {
  body: {
    agentId: 'agent-uuid',
    prompt: 'User input',
    context: {
      brandId: 'brand-uuid',
      projectId: 'project-uuid',
      // Additional context...
    }
  }
});
```

### Streaming Response

```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/stream-ai-response`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemPrompt: 'System prompt...',
      userMessage: 'User message...',
      model: 'gpt-4o'
    })
  }
);

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Process chunk...
}
```

---

## Cost Tracking

All agent executions track token usage and costs:

```sql
-- Query monthly costs by agent
SELECT
  a.name,
  COUNT(*) as executions,
  SUM((ar.output->'provider_meta'->>'cost')::numeric) as total_cost,
  AVG((ar.output->'provider_meta'->>'cost')::numeric) as avg_cost
FROM ai_agent_runs ar
JOIN ai_agents a ON a.id = ar.agent_id
WHERE ar.created_at > NOW() - INTERVAL '30 days'
  AND ar.status = 'completed'
GROUP BY a.name
ORDER BY total_cost DESC;
```

**Model Pricing (approximate):**
- GPT-4o: $0.005/1K prompt tokens, $0.015/1K completion
- GPT-4o-mini: $0.00015/1K prompt, $0.0006/1K completion
- Gemini 2.0 Pro: $0.001/1K tokens (varies by region)
- Claude Sonnet 4: $0.003/1K input, $0.015/1K output

---

## Security & Permissions

### Role Requirements

| Agent | Minimum Role |
|-------|--------------|
| SEO Blog Generator | `user` |
| Data Strategist | `manager` |
| Chief of Staff | `manager` |
| Content Strategist | `manager` |
| Weekly Client Email | `manager` |
| LinkedIn Content | `user` |
| Prompt Coach | `manager` |
| Financial Agents | `manager` |

### RLS Policies

All agent tables enforce Row Level Security:

```sql
-- ai_agents: Super admins and managers can view/edit
CREATE POLICY "ai_agents_user_access"
ON ai_agents FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'manager'));

-- ai_agent_runs: Users see their own runs, managers see all
CREATE POLICY "ai_agent_runs_user_access"
ON ai_agent_runs FOR ALL TO authenticated
USING (executed_by = auth.uid()
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'super_admin'));
```

---

## Future Enhancements

Potential improvements for the agent system:

- [ ] Agent chaining (output of one agent → input to another)
- [ ] Scheduled agent runs with cron-like syntax
- [ ] Agent marketplace for custom agents
- [ ] Multi-agent collaboration on complex tasks
- [ ] Fine-tuning on company-specific data
- [ ] Agent performance analytics dashboard
- [ ] User feedback loop for continuous improvement
- [ ] Version control for agent prompts
- [ ] A/B testing for different prompt strategies
- [ ] Integration with external tools (Zapier, Make)

---

## Support & Feedback

For questions or issues with AI agents:

1. Check this documentation and related guides
2. Review edge function logs for errors
3. Check Supabase Dashboard for RLS/auth issues
4. Contact platform administrators

**Related Files:**
- Agent management UI: `src/pages/admin/AIAgentManagement.tsx`
- Agent execution: `supabase/functions/run-ai-agent/`
- Streaming: `supabase/functions/stream-ai-response/`
- Data strategist: `supabase/functions/data-strategist-agent/`

---

**Document Version:** 1.0
**Contributors:** System documentation
**Last Review:** 2026-01-05
