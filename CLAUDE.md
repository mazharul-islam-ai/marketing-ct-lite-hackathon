# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


# DOCS
We keep all important docs in .agent folder and keep updating them, structure like below

.agent
- Tasks: PRD & implementation plan for each feature
- System: Document the current state of the system (project structure, tech stack, integration points, database schema, and core functionalities such as agent architecture, LLM layer, etc.)
- SOP: Best practices of execute certain tasks (e.g. how to add a schema migration, how to add a new page route, etc.)
- README.md: an index of all the documentations we have so people know what & where to look for things

We should always update .agent docs after we implement certain featrue, to make sure it fully reflect the up to date information

Before you plan any implementation, always read the .agent/README first to get context

## Project Overview

This is a React-based marketing AI platform built with Vite, TypeScript, and Supabase. The application provides AI-powered content generation, client management, analytics integration, and team collaboration tools for marketing agencies.

**Tech Stack:**
- Frontend: React 18, TypeScript, Vite 5
- UI: shadcn-ui components, Tailwind CSS 3.4, Radix UI
- Backend: Supabase (PostgreSQL + Edge Functions)
- State Management: TanStack Query v5 (React Query)
- Routing: React Router v6
- AI Integrations: OpenAI, Anthropic Claude, Google Gemini, Perplexity
- Vector Storage: Supabase pgvector
- Document Processing: unpdf (PDF parsing), react-markdown, rehype-raw
- External Integrations: ActiveCollab, Google Analytics, Google Drive, HubSpot, n8n, GoHighLevel
- Additional Libraries: date-fns, fuse.js (fuzzy search), recharts (charts), xlsx (Excel), zod (validation)

## Development Commands

### Frontend
```bash
npm run dev              # Start dev server on port 8080
npm run build            # Production build
npm run build:dev        # Development build with source maps
npm run lint             # Run ESLint
npm run preview          # Preview production build
```

### Supabase Edge Functions
Edge functions are Deno-based serverless functions deployed to Supabase.

```bash
# Deploy a specific function
supabase functions deploy <function-name>

# Deploy all functions
supabase functions deploy

# Test locally (requires Supabase CLI)
supabase functions serve <function-name>

# View function logs
supabase functions logs <function-name>
```

**Important:** Edge functions are located in `supabase/functions/`. Each function has its own directory with an `index.ts` file. JWT verification settings are configured per-function in `supabase/config.toml`.

### Edge Function Memory Constraints (CRITICAL)

Supabase Edge Functions have a **~150MB memory limit**. Violating this causes crashes.

**NEVER do this:**
```typescript
const text = await response.text()     // Loads entire file
const chunks = chunkText(text)         // Creates large array
const embeddings = chunks.map(...)     // Accumulates in memory
```

**ALWAYS stream:**
```typescript
async function* streamChunks(bucket, path) {
  const reader = response.body.getReader()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    while (buffer.length >= CHUNK_SIZE) {
      yield buffer.slice(0, CHUNK_SIZE)
      buffer = buffer.slice(CHUNK_SIZE - OVERLAP)
    }
  }
}

for await (const chunk of streamChunks()) {
  const embedding = await generateEmbedding(chunk)
  await insertImmediately(chunk, embedding)
}
```

**Rules:**
- Stream downloads with `ReadableStream`, never `response.text()`
- Process and insert chunk-by-chunk
- Hash only first chunk (or skip hashing)
- Keep memory O(1), not O(file_size)
- Release references immediately after use

## Architecture

### Frontend Structure

- **`src/pages/`** - Route-level page components
  - **`admin/`** - Super admin pages (brand management, team, settings)
  - **`adminpanel/`** - Admin control panel pages (AI control, knowledge base, feedback, control tower, data sync, hackathon)
  - **`ai-agents/`**, **`ai-dashboard/`** - AI workspace pages
  - **`brands/`** - Brand-specific public pages and SEO workspace
  - **`content/`** - LinkedIn content generation, newsletter, SEO blog generator
  - **`hackathon/`** - Hackathon module (onboarding, dashboard, team formation, submissions, judging)
  - **`my-agents/`** - User's personal AI agents
  - **`video/`** - Video generation studio

- **`src/components/`** - Reusable React components
  - **`ui/`** - shadcn-ui base components
  - **`admin/`**, **`adminpanel/`** - Admin-specific components
  - **`ai/`**, **`ai-control/`** - AI configuration and control
  - **`brands/`** - Brand management components
  - **`chat/`** - Chat interface components
  - **`clients/`**, **`projects/`** - Client and project management
  - **`eod/`** - End-of-day submission components
  - **`integrations/`** - External integration components
  - **`linkedin/`**, **`newsletter/`** - Content generation tools
  - **`video/`**, **`video-veo/`** - Video generation components
  - **`skeleton/`**, **`empty-states/`** - Loading and empty states

- **`src/features/`** - Feature-specific logic modules
  - **`ai/`** - AI agent orchestration
  - **`collabai/`** - Collaborative AI features
  - **`linkedin-content/`** - LinkedIn content generation

- **`src/integrations/supabase/`** - Auto-generated Supabase client and types
  - **`client.ts`** - Supabase client singleton
  - **`types.ts`** - Database type definitions (auto-generated)

- **`src/hooks/`** - Custom React hooks (e.g., `useAuth`)
- **`src/lib/`** - Utility libraries
- **`src/utils/`** - Helper functions
- **`src/types/`** - TypeScript type definitions

### Backend Structure (Supabase Edge Functions)

Located in `supabase/functions/`, each function is a separate Deno module:

**Key Function Categories:**
- **Auth & Users:** `auth`, `bootstrap-admin`, `create-super-admin`, `admin-users`, `employee-sync`
- **AI Agents:** `run-ai-agent`, `stream-ai-response`, `linkedin-chat-stream`, `linkedin-content`, `agent-memory`, `fetch-external-agents`
- **Knowledge Management:** `knowledge-base`, `knowledge-base-upload`, `index-brand-knowledge`, `brand-knowledge-upload`, `project-knowledge-sync`, `reindex-knowledge`, `migrate-knowledge-base`, `bulk-index-leader-files`, `diagnose-knowledge-source-rls`
- **AI Model Integrations:** `gemini-image-generator`, `gemini-veo-manager`, `sora-video-manager`, `improve-prompt`, `openai-test`, `perplexity-test`
- **Content Generation:** `linkedin-content`, `generate-seo-blog`, `fetch-and-summarize-newsletter`, `keyword-research-api`, `reconstruct-linkedin-prompt`, `generate-codex-fix`
- **External Integrations:** `activecollab-projects`, `activecollab-tasks`, `activecollab-time-tracking`, `activecollab-scheduled-sync`, `google-analytics-direct`, `fetch-google-analytics`, `hubspot-sync`, `n8n-analytics-manage`, `gohighlevel-manage`, `collabai-manage`
- **Google Drive:** `google-drive-oauth-init`, `google-drive-oauth-callback`, `admin-google-drive-sync`, `test-google-drive`
- **EOD (End of Day):** `eod-data-sync`, `generate-eod-summary`, `seed-sample-eod-data`, `import-hours`
- **Client Management:** `send-client-email`, `weekly-client-summary`
- **Hackathon:** `hackathon-invite`
- **Control Tower:** `control-tower-proxy`
- **Admin & Analytics:** `admin-brands`, `integration-health-check`, `linkedin-analytics-upload`, `create-company-vector-store`
- **File Management:** `cleanup-ai-images`, `cleanup-pdf-files`, `linkedin-upload-document`, `linkedin-upload-file-to-openai`, `test-rss-feed`, `report-false-positive`

**Shared Code:** Common utilities live in `supabase/functions/_shared/`:
- `cors.ts` - CORS headers configuration
- `supabase.ts` - Supabase client utilities
- `openai-client.ts` - OpenAI API wrapper
- `activecollab-client.ts` - ActiveCollab API integration
- `blog-prompts.ts` - SEO blog generation prompts
- `blog-validator.ts` - Content validation logic
- `reference-summarizer.ts` - Reference content summarization
- `encryption.ts` - Data encryption utilities
- `integrations/pgvector.ts` - Vector embedding and search utilities

### Authentication & Authorization

The app uses Supabase Auth with a custom role-based permission system:

**Role Hierarchy (lowest to highest):**
1. `user` - Basic access
2. `pm` - Project Manager
3. `brand_manager` - Brand-specific admin
4. `manager` - General manager
5. `super_admin` - Full system access

**Role Checking:**
- `hasRole(role)` - Exact role match
- `hasMinimumRole(role)` - User has this role or higher

**Implementation:** See `src/hooks/useAuth.tsx` for auth context. User roles are stored in the `user_roles` table and loaded with the user profile.

### Demo Credentials for Testing

For development and demo purposes, the login page includes quick-access demo credentials in the password tab:

**Demo Admin Account:**
- Email: `demo.admin@sjinnovation.com`
- Password: `demo-password-123`
- Role: `super_admin` (Full system access)
- Access: All admin panel features at `/adminpanel`

**Demo User Account:**
- Email: `demo.user@sjinnovation.com`
- Password: `demo-password-123`
- Role: `user` (Basic user access)
- Access: User dashboard and standard features

**How to use:**
1. Navigate to `/login`
2. On the "Password" tab, scroll down to find the "Demo Credentials" section
3. Click on "Admin Demo" or "User Demo" button
4. Credentials auto-fill and login is automatic

**Setup Instructions:**
1. Run the migration: `supabase db push` (to create profiles and roles)
2. Manually create auth users in Supabase dashboard or via Supabase Admin API:
   - Email: `demo.admin@sjinnovation.com` with password `demo-password-123`
   - Email: `demo.user@sjinnovation.com` with password `demo-password-123`
3. Demo accounts are then ready to use

**Files involved:**
- Migration: `supabase/migrations/20260224000000_setup_demo_credentials.sql`
- Frontend: `src/pages/Login.tsx` (demo credentials section in password tab)

### Routing Architecture

The app uses React Router v6 with role-based protected routes:

- **Public Routes:** `/login`, `/reset-password`, `/unauthorized`
- **Authenticated User Routes (base: `/`):** Dashboard, workspace, brands, content, tasks, EOD
- **PM+ Routes:** `/clients/*`, `/projects/*`, `/my-eod-submissions`, `/weekly-client-email-summary`
- **Super Admin Routes (base: `/adminpanel`):** All admin panel pages

**Protected Routes:** Use `<ProtectedRoute>` component with either:
- `requiredRole="super_admin"` - Exact role match required
- `requiredMinimumRole="pm"` - PM or higher role required

See `src/App.tsx` for full routing structure.

### AI Agent System

The platform includes a sophisticated AI agent system:

1. **Agent Configuration:** Configured in the admin panel (`/adminpanel/ai-control`)
2. **Knowledge Sources:** Uses Supabase pgvector for vector storage and semantic search
3. **Agent Execution:** Triggered via `run-ai-agent` edge function
4. **Streaming Responses:** Real-time streaming via `stream-ai-response` and `linkedin-chat-stream`
5. **Memory:** Agent memory stored in Supabase `agent_memories` table with vector embeddings
6. **Knowledge Base:** Document indexing and retrieval from brand/project knowledge bases

**Agent Types:**
- LinkedIn content generation agents (configured per leader/brand)
- Business analysis agents
- Client email summary agents
- Custom AI agents with configurable prompts and knowledge sources

**Vector Storage:**
- All embeddings use OpenAI text-embedding-3-small (1536 dimensions)
- Company knowledge stored in `knowledge_embeddings` table
- Brand knowledge stored in `brand_knowledge_embeddings` table
- Agent memories stored in `agent_memories` table
- Semantic search powered by pgvector cosine similarity

### Data Flow Patterns

**Supabase Integration:**
- Client initialization: `src/integrations/supabase/client.ts`
- Type safety: Auto-generated types in `src/integrations/supabase/types.ts`
- Data fetching: Use TanStack Query hooks for server state management
- Real-time subscriptions: Supabase real-time for live updates

**Edge Function Calls:**
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { ...params }
});
```

**CORS:** Edge functions use shared CORS headers from `_shared/cors.ts`

## Important Development Notes

### Vite Configuration
- Dev server runs on `0.0.0.0:8080` (IPv6 compatible)
- Path alias: `@/` maps to `src/`
- SWC used for fast React compilation
- Lovable tagger plugin enabled in development mode

### Supabase Edge Functions
- All functions are Deno-based (not Node.js)
- Import from `https://deno.land/` or `npm:` specifiers
- JWT verification configured per-function in `supabase/config.toml`
- Environment variables accessed via `Deno.env.get()`

### Role-Based Access Control
Always check user roles before showing UI or calling protected endpoints. Use `useAuth()` hook for client-side checks, and verify roles in edge functions for security.

### Knowledge Base & Vector Storage
- Supabase pgvector: Native PostgreSQL extension for vector similarity search
- OpenAI Embeddings: All text converted to 1536-dimensional vectors using text-embedding-3-small
- Files can be uploaded and automatically indexed to pgvector tables
- Vector search integrates with AI agents for RAG (Retrieval Augmented Generation)
- Three main embedding tables:
  - `knowledge_embeddings` - Company knowledge with category filtering
  - `brand_knowledge_embeddings` - Brand-specific documents
  - `agent_memories` - Persistent agent conversation memory

**File Upload Restrictions:**
- Knowledge base uploads are restricted to `.txt` and `.md` files only
- PDF files are processed using `unpdf` library in edge functions for text extraction
- File validation occurs at both frontend and backend levels
- See `KNOWLEDGE_BASE_DATA_CLEANUP_GUIDE.md` for data management best practices

**Brand Knowledge Management:**
- Super admins can view "All Brand Files" tab in knowledge base
- Brand-specific knowledge is isolated per brand with proper RLS policies
- Files are automatically indexed upon upload via `brand-knowledge-upload` function
- Supports bulk indexing with `bulk-index-leader-files` function

### External Integrations
The platform integrates with multiple external services:

**ActiveCollab:**
- Project, task, and time tracking synchronization
- Encrypted API credentials with `encryption.ts` utilities
- Scheduled automatic syncs via `activecollab-scheduled-sync`
- See `ACTIVECOLLAB_ENCRYPTION_SETUP.md` for configuration

**Google Drive:**
- OAuth 2.0 authentication flow
- Document access and knowledge sync
- Admin-level Google Drive integration for knowledge base
- Routes: `/google-drive-callback` for OAuth callback
- Functions: `google-drive-oauth-init`, `google-drive-oauth-callback`, `admin-google-drive-sync`
- See `docs/google-drive-integration.md` for setup

**Google Analytics:**
- Direct API integration for brand metrics
- Analytics data visualization in dashboard
- Functions: `google-analytics-direct`, `fetch-google-analytics`

**HubSpot:**
- Client/contact import and synchronization
- CRM data integration
- Function: `hubspot-sync`

**n8n Workflow Automation:**
- Webhook-based workflow triggers
- EOD workflow automation
- Analytics data pipeline
- Function: `n8n-analytics-manage`
- See `docs/n8n-eod-workflow-setup.md` and `docs/n8n-google-analytics-setup.md`

**GoHighLevel:**
- CRM integration
- Function: `gohighlevel-manage`

**CollabAI:**
- External AI agent integration
- Function: `collabai-manage`, `fetch-external-agents`

Integration health is monitored via `integration-health-check` function.

### Content Generation Workflow
1. User selects a LinkedIn leader/brand
2. System loads leader-specific knowledge files
3. Agent configuration determines AI model and prompt
4. Knowledge base provides context via vector search
5. AI generates content with streaming response
6. Content can be reviewed and edited before publishing

### Weekly Client Email Summary
- Fetches project data from ActiveCollab API or database
- Generates AI-powered summaries per client
- Sends via `send-client-email` function
- Accessible at `/weekly-client-email-summary` for PMs

### Hackathon Module
The platform includes a complete hackathon management system:

**Participant Features:**
- **Onboarding:** Registration and team formation
- **Dashboard:** Event overview and schedule
- **Team Formation:** Create or join teams
- **Submission:** Project submission with details and links
- **Judging:** View judging results and feedback

**Admin Features:**
- **Event Management:** Create and configure hackathon events
- **Employee Invitation:** Invite participants via email
- **Judging Panel:** Review and score submissions

**Key Routes:**
- `/hackathon/onboarding` - Registration flow
- `/hackathon/dashboard` - Main participant dashboard
- `/hackathon/team-formation` - Team creation
- `/hackathon/submission` - Project submission
- `/hackathon/judging` - Results and scoring
- `/adminpanel/hackathon/events` - Admin event management
- `/adminpanel/hackathon/invitations` - Admin invitations

**Edge Function:**
- `hackathon-invite` - Sends invitation emails to participants

### Control Tower Module
Organizational structure management for pods and employees:

**Features:**
- **Pod Management:** Organize employees into pods/teams
- **Employee Directory:** View and manage employee information
- **Pod Details:** Detailed pod composition and metrics

**Key Routes:**
- `/adminpanel/control-tower/employees` - Employee directory
- `/adminpanel/control-tower/pods` - Pod listing
- `/adminpanel/control-tower/pods/:id` - Pod details

**Edge Functions:**
- `control-tower-proxy` - Proxy for control tower operations
- `employee-sync` - Synchronize employee data

### Data Sync & ActiveCollab Integration
Comprehensive synchronization with ActiveCollab project management:

**Features:**
- Project synchronization
- Task tracking
- Time tracking integration
- Scheduled automatic syncs

**Key Routes:**
- `/adminpanel/data-sync/activecollab` - Sync dashboard

**Edge Functions:**
- `activecollab-projects` - Sync project data
- `activecollab-tasks` - Sync tasks
- `activecollab-time-tracking` - Sync time entries
- `activecollab-scheduled-sync` - Automated scheduled syncs

**Configuration:**
- Encrypted API credentials stored in database
- See `ACTIVECOLLAB_ENCRYPTION_SETUP.md` for setup details

## Common Patterns

### Adding a New Page
1. Create page component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add appropriate `ProtectedRoute` wrapper if auth required
4. Create any needed UI components in `src/components/`
5. Use TanStack Query for data fetching

### Adding a New Edge Function
1. Create function directory in `supabase/functions/<function-name>/`
2. Add `index.ts` with Deno imports
3. Configure JWT verification in `supabase/config.toml`
4. Import shared utilities from `_shared/`
5. Deploy with `supabase functions deploy <function-name>`

### Working with shadcn-ui
Components are in `src/components/ui/`. To add new shadcn components, they should follow the shadcn-ui patterns with Radix UI primitives and Tailwind styling.

### Database Type Updates
When the Supabase schema changes, regenerate types:
```bash
supabase gen types typescript --project-id fzknasqrludvoyxdzbxl > src/integrations/supabase/types.ts
```


<!-- TRIGGER.DEV basic START -->
# Trigger.dev Basic Tasks (v4)

**MUST use `@trigger.dev/sdk`, NEVER `client.defineJob`**

## Basic Task

```ts
import { task } from "@trigger.dev/sdk";

export const processData = task({
  id: "process-data",
  retry: {
    maxAttempts: 10,
    factor: 1.8,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 30_000,
    randomize: false,
  },
  run: async (payload: { userId: string; data: any[] }) => {
    // Task logic - runs for long time, no timeouts
    console.log(`Processing ${payload.data.length} items for user ${payload.userId}`);
    return { processed: payload.data.length };
  },
});
```

## Schema Task (with validation)

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

export const validatedTask = schemaTask({
  id: "validated-task",
  schema: z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  }),
  run: async (payload) => {
    // Payload is automatically validated and typed
    return { message: `Hello ${payload.name}, age ${payload.age}` };
  },
});
```

## Triggering Tasks

### From Backend Code

```ts
import { tasks } from "@trigger.dev/sdk";
import type { processData } from "./trigger/tasks";

// Single trigger
const handle = await tasks.trigger<typeof processData>("process-data", {
  userId: "123",
  data: [{ id: 1 }, { id: 2 }],
});

// Batch trigger (up to 1,000 items, 3MB per payload)
const batchHandle = await tasks.batchTrigger<typeof processData>("process-data", [
  { payload: { userId: "123", data: [{ id: 1 }] } },
  { payload: { userId: "456", data: [{ id: 2 }] } },
]);
```

### Debounced Triggering

Consolidate multiple triggers into a single execution:

```ts
// Multiple rapid triggers with same key = single execution
await myTask.trigger(
  { userId: "123" },
  {
    debounce: {
      key: "user-123-update",  // Unique key for debounce group
      delay: "5s",              // Wait before executing
    },
  }
);

// Trailing mode: use payload from LAST trigger
await myTask.trigger(
  { data: "latest-value" },
  {
    debounce: {
      key: "trailing-example",
      delay: "10s",
      mode: "trailing",  // Default is "leading" (first payload)
    },
  }
);
```

**Debounce modes:**
- `leading` (default): Uses payload from first trigger, subsequent triggers only reschedule
- `trailing`: Uses payload from most recent trigger

### From Inside Tasks (with Result handling)

```ts
export const parentTask = task({
  id: "parent-task",
  run: async (payload) => {
    // Trigger and continue
    const handle = await childTask.trigger({ data: "value" });

    // Trigger and wait - returns Result object, NOT task output
    const result = await childTask.triggerAndWait({ data: "value" });
    if (result.ok) {
      console.log("Task output:", result.output); // Actual task return value
    } else {
      console.error("Task failed:", result.error);
    }

    // Quick unwrap (throws on error)
    const output = await childTask.triggerAndWait({ data: "value" }).unwrap();

    // Batch trigger and wait
    const results = await childTask.batchTriggerAndWait([
      { payload: { data: "item1" } },
      { payload: { data: "item2" } },
    ]);

    for (const run of results) {
      if (run.ok) {
        console.log("Success:", run.output);
      } else {
        console.log("Failed:", run.error);
      }
    }
  },
});

export const childTask = task({
  id: "child-task",
  run: async (payload: { data: string }) => {
    return { processed: payload.data };
  },
});
```

> Never wrap triggerAndWait or batchTriggerAndWait calls in a Promise.all or Promise.allSettled as this is not supported in Trigger.dev tasks.

## Waits

```ts
import { task, wait } from "@trigger.dev/sdk";

export const taskWithWaits = task({
  id: "task-with-waits",
  run: async (payload) => {
    console.log("Starting task");

    // Wait for specific duration
    await wait.for({ seconds: 30 });
    await wait.for({ minutes: 5 });
    await wait.for({ hours: 1 });
    await wait.for({ days: 1 });

    // Wait until specific date
    await wait.until({ date: new Date("2024-12-25") });

    // Wait for token (from external system)
    await wait.forToken({
      token: "user-approval-token",
      timeoutInSeconds: 3600, // 1 hour timeout
    });

    console.log("All waits completed");
    return { status: "completed" };
  },
});
```

> Never wrap wait calls in a Promise.all or Promise.allSettled as this is not supported in Trigger.dev tasks.

## Key Points

- **Result vs Output**: `triggerAndWait()` returns a `Result` object with `ok`, `output`, `error` properties - NOT the direct task output
- **Type safety**: Use `import type` for task references when triggering from backend
- **Waits > 5 seconds**: Automatically checkpointed, don't count toward compute usage
- **Debounce + idempotency**: Idempotency keys take precedence over debounce settings

## NEVER Use (v2 deprecated)

```ts
// BREAKS APPLICATION
client.defineJob({
  id: "job-id",
  run: async (payload, io) => {
    /* ... */
  },
});
```

Use SDK (`@trigger.dev/sdk`), check `result.ok` before accessing `result.output`

<!-- TRIGGER.DEV basic END -->

<!-- TRIGGER.DEV advanced-tasks START -->
# Trigger.dev Advanced Tasks (v4)

**Advanced patterns and features for writing tasks**

## Tags & Organization

```ts
import { task, tags } from "@trigger.dev/sdk";

export const processUser = task({
  id: "process-user",
  run: async (payload: { userId: string; orgId: string }, { ctx }) => {
    // Add tags during execution
    await tags.add(`user_${payload.userId}`);
    await tags.add(`org_${payload.orgId}`);

    return { processed: true };
  },
});

// Trigger with tags
await processUser.trigger(
  { userId: "123", orgId: "abc" },
  { tags: ["priority", "user_123", "org_abc"] } // Max 10 tags per run
);

// Subscribe to tagged runs
for await (const run of runs.subscribeToRunsWithTag("user_123")) {
  console.log(`User task ${run.id}: ${run.status}`);
}
```

**Tag Best Practices:**

- Use prefixes: `user_123`, `org_abc`, `video:456`
- Max 10 tags per run, 1-64 characters each
- Tags don't propagate to child tasks automatically

## Batch Triggering v2

Enhanced batch triggering with larger payloads and streaming ingestion.

### Limits

- **Maximum batch size**: 1,000 items (increased from 500)
- **Payload per item**: 3MB each (increased from 1MB combined)
- Payloads > 512KB automatically offload to object storage

### Rate Limiting (per environment)

| Tier | Bucket Size | Refill Rate |
|------|-------------|-------------|
| Free | 1,200 runs | 100 runs/10 sec |
| Hobby | 5,000 runs | 500 runs/5 sec |
| Pro | 5,000 runs | 500 runs/5 sec |

### Concurrent Batch Processing

| Tier | Concurrent Batches |
|------|-------------------|
| Free | 1 |
| Hobby | 10 |
| Pro | 10 |

### Usage

```ts
import { myTask } from "./trigger/myTask";

// Basic batch trigger (up to 1,000 items)
const runs = await myTask.batchTrigger([
  { payload: { userId: "user-1" } },
  { payload: { userId: "user-2" } },
  { payload: { userId: "user-3" } },
]);

// Batch trigger with wait
const results = await myTask.batchTriggerAndWait([
  { payload: { userId: "user-1" } },
  { payload: { userId: "user-2" } },
]);

for (const result of results) {
  if (result.ok) {
    console.log("Result:", result.output);
  }
}

// With per-item options
const batchHandle = await myTask.batchTrigger([
  {
    payload: { userId: "123" },
    options: {
      idempotencyKey: "user-123-batch",
      tags: ["priority"],
    },
  },
  {
    payload: { userId: "456" },
    options: {
      idempotencyKey: "user-456-batch",
    },
  },
]);
```

## Debouncing

Consolidate multiple triggers into a single execution by debouncing task runs with a unique key and delay window.

### Use Cases

- **User activity updates**: Batch rapid user actions into a single run
- **Webhook deduplication**: Handle webhook bursts without redundant processing
- **Search indexing**: Combine document updates instead of processing individually
- **Notification batching**: Group notifications to prevent user spam

### Basic Usage

```ts
await myTask.trigger(
  { userId: "123" },
  {
    debounce: {
      key: "user-123-update",  // Unique identifier for debounce group
      delay: "5s",              // Wait duration ("5s", "1m", or milliseconds)
    },
  }
);
```

### Execution Modes

**Leading Mode** (default): Uses payload/options from the first trigger; subsequent triggers only reschedule execution time.

```ts
// First trigger sets the payload
await myTask.trigger({ action: "first" }, {
  debounce: { key: "my-key", delay: "10s" }
});

// Second trigger only reschedules - payload remains "first"
await myTask.trigger({ action: "second" }, {
  debounce: { key: "my-key", delay: "10s" }
});
// Task executes with { action: "first" }
```

**Trailing Mode**: Uses payload/options from the most recent trigger.

```ts
await myTask.trigger(
  { data: "latest-value" },
  {
    debounce: {
      key: "trailing-example",
      delay: "10s",
      mode: "trailing",
    },
  }
);
```

In trailing mode, these options update with each trigger:
- `payload` — task input data
- `metadata` — run metadata
- `tags` — run tags (replaces existing)
- `maxAttempts` — retry attempts
- `maxDuration` — maximum compute time
- `machine` — machine preset

### Important Notes

- Idempotency keys take precedence over debounce settings
- Compatible with `triggerAndWait()` — parent runs block correctly on debounced execution
- Debounce key is scoped to the task

## Concurrency & Queues

```ts
import { task, queue } from "@trigger.dev/sdk";

// Shared queue for related tasks
const emailQueue = queue({
  name: "email-processing",
  concurrencyLimit: 5, // Max 5 emails processing simultaneously
});

// Task-level concurrency
export const oneAtATime = task({
  id: "sequential-task",
  queue: { concurrencyLimit: 1 }, // Process one at a time
  run: async (payload) => {
    // Critical section - only one instance runs
  },
});

// Per-user concurrency
export const processUserData = task({
  id: "process-user-data",
  run: async (payload: { userId: string }) => {
    // Override queue with user-specific concurrency
    await childTask.trigger(payload, {
      queue: {
        name: `user-${payload.userId}`,
        concurrencyLimit: 2,
      },
    });
  },
});

export const emailTask = task({
  id: "send-email",
  queue: emailQueue, // Use shared queue
  run: async (payload: { to: string }) => {
    // Send email logic
  },
});
```

## Error Handling & Retries

```ts
import { task, retry, AbortTaskRunError } from "@trigger.dev/sdk";

export const resilientTask = task({
  id: "resilient-task",
  retry: {
    maxAttempts: 10,
    factor: 1.8, // Exponential backoff multiplier
    minTimeoutInMs: 500,
    maxTimeoutInMs: 30_000,
    randomize: false,
  },
  catchError: async ({ error, ctx }) => {
    // Custom error handling
    if (error.code === "FATAL_ERROR") {
      throw new AbortTaskRunError("Cannot retry this error");
    }

    // Log error details
    console.error(`Task ${ctx.task.id} failed:`, error);

    // Allow retry by returning nothing
    return { retryAt: new Date(Date.now() + 60000) }; // Retry in 1 minute
  },
  run: async (payload) => {
    // Retry specific operations
    const result = await retry.onThrow(
      async () => {
        return await unstableApiCall(payload);
      },
      { maxAttempts: 3 }
    );

    // Conditional HTTP retries
    const response = await retry.fetch("https://api.example.com", {
      retry: {
        maxAttempts: 5,
        condition: (response, error) => {
          return response?.status === 429 || response?.status >= 500;
        },
      },
    });

    return result;
  },
});
```

## Machines & Performance

```ts
export const heavyTask = task({
  id: "heavy-computation",
  machine: { preset: "large-2x" }, // 8 vCPU, 16 GB RAM
  maxDuration: 1800, // 30 minutes timeout
  run: async (payload, { ctx }) => {
    // Resource-intensive computation
    if (ctx.machine.preset === "large-2x") {
      // Use all available cores
      return await parallelProcessing(payload);
    }

    return await standardProcessing(payload);
  },
});

// Override machine when triggering
await heavyTask.trigger(payload, {
  machine: { preset: "medium-1x" }, // Override for this run
});
```

**Machine Presets:**

- `micro`: 0.25 vCPU, 0.25 GB RAM
- `small-1x`: 0.5 vCPU, 0.5 GB RAM (default)
- `small-2x`: 1 vCPU, 1 GB RAM
- `medium-1x`: 1 vCPU, 2 GB RAM
- `medium-2x`: 2 vCPU, 4 GB RAM
- `large-1x`: 4 vCPU, 8 GB RAM
- `large-2x`: 8 vCPU, 16 GB RAM

## Idempotency

```ts
import { task, idempotencyKeys } from "@trigger.dev/sdk";

export const paymentTask = task({
  id: "process-payment",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: { orderId: string; amount: number }) => {
    // Automatically scoped to this task run, so if the task is retried, the idempotency key will be the same
    const idempotencyKey = await idempotencyKeys.create(`payment-${payload.orderId}`);

    // Ensure payment is processed only once
    await chargeCustomer.trigger(payload, {
      idempotencyKey,
      idempotencyKeyTTL: "24h", // Key expires in 24 hours
    });
  },
});

// Payload-based idempotency
import { createHash } from "node:crypto";

function createPayloadHash(payload: any): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(payload));
  return hash.digest("hex");
}

export const deduplicatedTask = task({
  id: "deduplicated-task",
  run: async (payload) => {
    const payloadHash = createPayloadHash(payload);
    const idempotencyKey = await idempotencyKeys.create(payloadHash);

    await processData.trigger(payload, { idempotencyKey });
  },
});
```

## Metadata & Progress Tracking

```ts
import { task, metadata } from "@trigger.dev/sdk";

export const batchProcessor = task({
  id: "batch-processor",
  run: async (payload: { items: any[] }, { ctx }) => {
    const totalItems = payload.items.length;

    // Initialize progress metadata
    metadata
      .set("progress", 0)
      .set("totalItems", totalItems)
      .set("processedItems", 0)
      .set("status", "starting");

    const results = [];

    for (let i = 0; i < payload.items.length; i++) {
      const item = payload.items[i];

      // Process item
      const result = await processItem(item);
      results.push(result);

      // Update progress
      const progress = ((i + 1) / totalItems) * 100;
      metadata
        .set("progress", progress)
        .increment("processedItems", 1)
        .append("logs", `Processed item ${i + 1}/${totalItems}`)
        .set("currentItem", item.id);
    }

    // Final status
    metadata.set("status", "completed");

    return { results, totalProcessed: results.length };
  },
});

// Update parent metadata from child task
export const childTask = task({
  id: "child-task",
  run: async (payload, { ctx }) => {
    // Update parent task metadata
    metadata.parent.set("childStatus", "processing");
    metadata.root.increment("childrenCompleted", 1);

    return { processed: true };
  },
});
```

## Logging & Tracing

```ts
import { task, logger } from "@trigger.dev/sdk";

export const tracedTask = task({
  id: "traced-task",
  run: async (payload, { ctx }) => {
    logger.info("Task started", { userId: payload.userId });

    // Custom trace with attributes
    const user = await logger.trace(
      "fetch-user",
      async (span) => {
        span.setAttribute("user.id", payload.userId);
        span.setAttribute("operation", "database-fetch");

        const userData = await database.findUser(payload.userId);
        span.setAttribute("user.found", !!userData);

        return userData;
      },
      { userId: payload.userId }
    );

    logger.debug("User fetched", { user: user.id });

    try {
      const result = await processUser(user);
      logger.info("Processing completed", { result });
      return result;
    } catch (error) {
      logger.error("Processing failed", {
        error: error.message,
        userId: payload.userId,
      });
      throw error;
    }
  },
});
```

## Hidden Tasks

```ts
// Hidden task - not exported, only used internally
const internalProcessor = task({
  id: "internal-processor",
  run: async (payload: { data: string }) => {
    return { processed: payload.data.toUpperCase() };
  },
});

// Public task that uses hidden task
export const publicWorkflow = task({
  id: "public-workflow",
  run: async (payload: { input: string }) => {
    // Use hidden task internally
    const result = await internalProcessor.triggerAndWait({
      data: payload.input,
    });

    if (result.ok) {
      return { output: result.output.processed };
    }

    throw new Error("Internal processing failed");
  },
});
```

## Best Practices

- **Concurrency**: Use queues to prevent overwhelming external services
- **Retries**: Configure exponential backoff for transient failures
- **Idempotency**: Always use for payment/critical operations
- **Metadata**: Track progress for long-running tasks
- **Machines**: Match machine size to computational requirements
- **Tags**: Use consistent naming patterns for filtering
- **Debouncing**: Use for user activity, webhooks, and notification batching
- **Batch triggering**: Use for bulk operations up to 1,000 items
- **Error Handling**: Distinguish between retryable and fatal errors

Design tasks to be stateless, idempotent, and resilient to failures. Use metadata for state tracking and queues for resource management.

<!-- TRIGGER.DEV advanced-tasks END -->

<!-- TRIGGER.DEV config START -->
# Trigger.dev Configuration (v4)

**Complete guide to configuring `trigger.config.ts` with build extensions**

## Basic Configuration

```ts
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "<project-ref>", // Required: Your project reference
  dirs: ["./trigger"], // Task directories
  runtime: "node", // "node", "node-22", or "bun"
  logLevel: "info", // "debug", "info", "warn", "error"

  // Default retry settings
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },

  // Build configuration
  build: {
    autoDetectExternal: true,
    keepNames: true,
    minify: false,
    extensions: [], // Build extensions go here
  },

  // Global lifecycle hooks
  onStartAttempt: async ({ payload, ctx }) => {
    console.log("Global task start");
  },
  onSuccess: async ({ payload, output, ctx }) => {
    console.log("Global task success");
  },
  onFailure: async ({ payload, error, ctx }) => {
    console.log("Global task failure");
  },
});
```

## Build Extensions

### Database & ORM

#### Prisma

```ts
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

extensions: [
  prismaExtension({
    schema: "prisma/schema.prisma",
    version: "5.19.0", // Optional: specify version
    migrate: true, // Run migrations during build
    directUrlEnvVarName: "DIRECT_DATABASE_URL",
    typedSql: true, // Enable TypedSQL support
  }),
];
```

#### TypeScript Decorators (for TypeORM)

```ts
import { emitDecoratorMetadata } from "@trigger.dev/build/extensions/typescript";

extensions: [
  emitDecoratorMetadata(), // Enables decorator metadata
];
```

### Scripting Languages

#### Python

```ts
import { pythonExtension } from "@trigger.dev/build/extensions/python";

extensions: [
  pythonExtension({
    scripts: ["./python/**/*.py"], // Copy Python files
    requirementsFile: "./requirements.txt", // Install packages
    devPythonBinaryPath: ".venv/bin/python", // Dev mode binary
  }),
];

// Usage in tasks
const result = await python.runInline(`print("Hello, world!")`);
const output = await python.runScript("./python/script.py", ["arg1"]);
```

### Browser Automation

#### Playwright

```ts
import { playwright } from "@trigger.dev/build/extensions/playwright";

extensions: [
  playwright({
    browsers: ["chromium", "firefox", "webkit"], // Default: ["chromium"]
    headless: true, // Default: true
  }),
];
```

#### Puppeteer

```ts
import { puppeteer } from "@trigger.dev/build/extensions/puppeteer";

extensions: [puppeteer()];

// Environment variable needed:
// PUPPETEER_EXECUTABLE_PATH: "/usr/bin/google-chrome-stable"
```

#### Lightpanda

```ts
import { lightpanda } from "@trigger.dev/build/extensions/lightpanda";

extensions: [
  lightpanda({
    version: "latest", // or "nightly"
    disableTelemetry: false,
  }),
];
```

### Media Processing

#### FFmpeg

```ts
import { ffmpeg } from "@trigger.dev/build/extensions/core";

extensions: [
  ffmpeg({ version: "7" }), // Static build, or omit for Debian version
];

// Automatically sets FFMPEG_PATH and FFPROBE_PATH
// Add fluent-ffmpeg to external packages if using
```

#### Audio Waveform

```ts
import { audioWaveform } from "@trigger.dev/build/extensions/audioWaveform";

extensions: [
  audioWaveform(), // Installs Audio Waveform 1.1.0
];
```

### System & Package Management

#### System Packages (apt-get)

```ts
import { aptGet } from "@trigger.dev/build/extensions/core";

extensions: [
  aptGet({
    packages: ["ffmpeg", "imagemagick", "curl=7.68.0-1"], // Can specify versions
  }),
];
```

#### Additional NPM Packages

Only use this for installing CLI tools, NOT packages you import in your code.

```ts
import { additionalPackages } from "@trigger.dev/build/extensions/core";

extensions: [
  additionalPackages({
    packages: ["wrangler"], // CLI tools and specific versions
  }),
];
```

#### Additional Files

```ts
import { additionalFiles } from "@trigger.dev/build/extensions/core";

extensions: [
  additionalFiles({
    files: ["wrangler.toml", "./assets/**", "./fonts/**"], // Glob patterns supported
  }),
];
```

### Environment & Build Tools

#### Environment Variable Sync

```ts
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

extensions: [
  syncEnvVars(async (ctx) => {
    // ctx contains: environment, projectRef, env
    return [
      { name: "SECRET_KEY", value: await getSecret(ctx.environment) },
      { name: "API_URL", value: ctx.environment === "prod" ? "api.prod.com" : "api.dev.com" },
    ];
  }),
];
```

#### ESBuild Plugins

```ts
import { esbuildPlugin } from "@trigger.dev/build/extensions";
import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";

extensions: [
  esbuildPlugin(
    sentryEsbuildPlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
    { placement: "last", target: "deploy" } // Optional config
  ),
];
```

## Custom Build Extensions

```ts
import { defineConfig } from "@trigger.dev/sdk";

const customExtension = {
  name: "my-custom-extension",

  externalsForTarget: (target) => {
    return ["some-native-module"]; // Add external dependencies
  },

  onBuildStart: async (context) => {
    console.log(`Build starting for ${context.target}`);
    // Register esbuild plugins, modify build context
  },

  onBuildComplete: async (context, manifest) => {
    console.log("Build complete, adding layers");
    // Add build layers, modify deployment
    context.addLayer({
      id: "my-layer",
      files: [{ source: "./custom-file", destination: "/app/custom" }],
      commands: ["chmod +x /app/custom"],
    });
  },
};

export default defineConfig({
  project: "my-project",
  build: {
    extensions: [customExtension],
  },
});
```

## Advanced Configuration

### Telemetry

```ts
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { OpenAIInstrumentation } from "@langfuse/openai";

export default defineConfig({
  // ... other config
  telemetry: {
    instrumentations: [new PrismaInstrumentation(), new OpenAIInstrumentation()],
    exporters: [customExporter], // Optional custom exporters
  },
});
```

### Machine & Performance

```ts
export default defineConfig({
  // ... other config
  defaultMachine: "large-1x", // Default machine for all tasks
  maxDuration: 300, // Default max duration (seconds)
  enableConsoleLogging: true, // Console logging in development
});
```

## Common Extension Combinations

### Full-Stack Web App

```ts
extensions: [
  prismaExtension({ schema: "prisma/schema.prisma", migrate: true }),
  additionalFiles({ files: ["./public/**", "./assets/**"] }),
  syncEnvVars(async (ctx) => [...envVars]),
];
```

### AI/ML Processing

```ts
extensions: [
  pythonExtension({
    scripts: ["./ai/**/*.py"],
    requirementsFile: "./requirements.txt",
  }),
  ffmpeg({ version: "7" }),
  additionalPackages({ packages: ["wrangler"] }),
];
```

### Web Scraping

```ts
extensions: [
  playwright({ browsers: ["chromium"] }),
  puppeteer(),
  additionalFiles({ files: ["./selectors.json", "./proxies.txt"] }),
];
```

## Best Practices

- **Use specific versions**: Pin extension versions for reproducible builds
- **External packages**: Add modules with native addons to the `build.external` array
- **Environment sync**: Use `syncEnvVars` for dynamic secrets
- **File paths**: Use glob patterns for flexible file inclusion
- **Debug builds**: Use `--log-level debug --dry-run` for troubleshooting

Extensions only affect deployment, not local development. Use `external` array for packages that shouldn't be bundled.

<!-- TRIGGER.DEV config END -->

<!-- TRIGGER.DEV scheduled-tasks START -->
# Scheduled tasks (cron)

Recurring tasks using cron. For one-off future runs, use the **delay** option.

## Define a scheduled task

```ts
import { schedules } from "@trigger.dev/sdk";

export const task = schedules.task({
  id: "first-scheduled-task",
  run: async (payload) => {
    payload.timestamp; // Date (scheduled time, UTC)
    payload.lastTimestamp; // Date | undefined
    payload.timezone; // IANA, e.g. "America/New_York" (default "UTC")
    payload.scheduleId; // string
    payload.externalId; // string | undefined
    payload.upcoming; // Date[]

    payload.timestamp.toLocaleString("en-US", { timeZone: payload.timezone });
  },
});
```

> Scheduled tasks need at least one schedule attached to run.

## Attach schedules

**Declarative (sync on dev/deploy):**

```ts
schedules.task({
  id: "every-2h",
  cron: "0 */2 * * *", // UTC
  run: async () => {},
});

schedules.task({
  id: "tokyo-5am",
  cron: { pattern: "0 5 * * *", timezone: "Asia/Tokyo", environments: ["PRODUCTION", "STAGING"] },
  run: async () => {},
});
```

**Imperative (SDK or dashboard):**

```ts
await schedules.create({
  task: task.id,
  cron: "0 0 * * *",
  timezone: "America/New_York", // DST-aware
  externalId: "user_123",
  deduplicationKey: "user_123-daily", // updates if reused
});
```

### Dynamic / multi-tenant example

```ts
// /trigger/reminder.ts
export const reminderTask = schedules.task({
  id: "todo-reminder",
  run: async (p) => {
    if (!p.externalId) throw new Error("externalId is required");
    const user = await db.getUser(p.externalId);
    await sendReminderEmail(user);
  },
});
```

```ts
// app/reminders/route.ts
export async function POST(req: Request) {
  const data = await req.json();
  return Response.json(
    await schedules.create({
      task: reminderTask.id,
      cron: "0 8 * * *",
      timezone: data.timezone,
      externalId: data.userId,
      deduplicationKey: `${data.userId}-reminder`,
    })
  );
}
```

## Cron syntax (no seconds)

```
* * * * *
| | | | └ day of week (0–7 or 1L–7L; 0/7=Sun; L=last)
| | | └── month (1–12)
| | └──── day of month (1–31 or L)
| └────── hour (0–23)
└──────── minute (0–59)
```

## When schedules won't trigger

- **Dev:** only when the dev CLI is running.
- **Staging/Production:** only for tasks in the **latest deployment**.

## SDK management (quick refs)

```ts
await schedules.retrieve(id);
await schedules.list();
await schedules.update(id, { cron: "0 0 1 * *", externalId: "ext", deduplicationKey: "key" });
await schedules.deactivate(id);
await schedules.activate(id);
await schedules.del(id);
await schedules.timezones(); // list of IANA timezones
```

## Dashboard

Create/attach schedules visually (Task, Cron pattern, Timezone, Optional: External ID, Dedup key, Environments). Test scheduled tasks from the **Test** page.

<!-- TRIGGER.DEV scheduled-tasks END -->

<!-- TRIGGER.DEV realtime START -->
# Trigger.dev Realtime (v4)

**Real-time monitoring and updates for runs**

## Core Concepts

Realtime allows you to:

- Subscribe to run status changes, metadata updates, and streams
- Build real-time dashboards and UI updates
- Monitor task progress from frontend and backend

## Authentication

### Public Access Tokens

```ts
import { auth } from "@trigger.dev/sdk";

// Read-only token for specific runs
const publicToken = await auth.createPublicToken({
  scopes: {
    read: {
      runs: ["run_123", "run_456"],
      tasks: ["my-task-1", "my-task-2"],
    },
  },
  expirationTime: "1h", // Default: 15 minutes
});
```

### Trigger Tokens (Frontend only)

```ts
// Single-use token for triggering tasks
const triggerToken = await auth.createTriggerPublicToken("my-task", {
  expirationTime: "30m",
});
```

## Backend Usage

### Subscribe to Runs

```ts
import { runs, tasks } from "@trigger.dev/sdk";

// Trigger and subscribe
const handle = await tasks.trigger("my-task", { data: "value" });

// Subscribe to specific run
for await (const run of runs.subscribeToRun<typeof myTask>(handle.id)) {
  console.log(`Status: ${run.status}, Progress: ${run.metadata?.progress}`);
  if (run.status === "COMPLETED") break;
}

// Subscribe to runs with tag
for await (const run of runs.subscribeToRunsWithTag("user-123")) {
  console.log(`Tagged run ${run.id}: ${run.status}`);
}

// Subscribe to batch
for await (const run of runs.subscribeToBatch(batchId)) {
  console.log(`Batch run ${run.id}: ${run.status}`);
}
```

### Realtime Streams v2 (Recommended)

```ts
import { streams, InferStreamType } from "@trigger.dev/sdk";

// 1. Define streams (shared location)
export const aiStream = streams.define<string>({
  id: "ai-output",
});

export type AIStreamPart = InferStreamType<typeof aiStream>;

// 2. Pipe from task
export const streamingTask = task({
  id: "streaming-task",
  run: async (payload) => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: payload.prompt }],
      stream: true,
    });

    const { waitUntilComplete } = aiStream.pipe(completion);
    await waitUntilComplete();
  },
});

// 3. Read from backend
const stream = await aiStream.read(runId, {
  timeoutInSeconds: 300,
  startIndex: 0, // Resume from specific chunk
});

for await (const chunk of stream) {
  console.log("Chunk:", chunk); // Fully typed
}
```

Enable v2 by upgrading to 4.1.0 or later.

## React Frontend Usage

### Installation

```bash
npm add @trigger.dev/react-hooks
```

### Triggering Tasks

```tsx
"use client";
import { useTaskTrigger, useRealtimeTaskTrigger } from "@trigger.dev/react-hooks";
import type { myTask } from "../trigger/tasks";

function TriggerComponent({ accessToken }: { accessToken: string }) {
  // Basic trigger
  const { submit, handle, isLoading } = useTaskTrigger<typeof myTask>("my-task", {
    accessToken,
  });

  // Trigger with realtime updates
  const {
    submit: realtimeSubmit,
    run,
    isLoading: isRealtimeLoading,
  } = useRealtimeTaskTrigger<typeof myTask>("my-task", { accessToken });

  return (
    <div>
      <button onClick={() => submit({ data: "value" })} disabled={isLoading}>
        Trigger Task
      </button>

      <button onClick={() => realtimeSubmit({ data: "realtime" })} disabled={isRealtimeLoading}>
        Trigger with Realtime
      </button>

      {run && <div>Status: {run.status}</div>}
    </div>
  );
}
```

### Subscribing to Runs

```tsx
"use client";
import { useRealtimeRun, useRealtimeRunsWithTag } from "@trigger.dev/react-hooks";
import type { myTask } from "../trigger/tasks";

function SubscribeComponent({ runId, accessToken }: { runId: string; accessToken: string }) {
  // Subscribe to specific run
  const { run, error } = useRealtimeRun<typeof myTask>(runId, {
    accessToken,
    onComplete: (run) => {
      console.log("Task completed:", run.output);
    },
  });

  // Subscribe to tagged runs
  const { runs } = useRealtimeRunsWithTag("user-123", { accessToken });

  if (error) return <div>Error: {error.message}</div>;
  if (!run) return <div>Loading...</div>;

  return (
    <div>
      <div>Status: {run.status}</div>
      <div>Progress: {run.metadata?.progress || 0}%</div>
      {run.output && <div>Result: {JSON.stringify(run.output)}</div>}

      <h3>Tagged Runs:</h3>
      {runs.map((r) => (
        <div key={r.id}>
          {r.id}: {r.status}
        </div>
      ))}
    </div>
  );
}
```

### Realtime Streams with React

```tsx
"use client";
import { useRealtimeStream } from "@trigger.dev/react-hooks";
import { aiStream } from "../trigger/streams";

function StreamComponent({ runId, accessToken }: { runId: string; accessToken: string }) {
  // Pass defined stream directly for type safety
  const { parts, error } = useRealtimeStream(aiStream, runId, {
    accessToken,
    timeoutInSeconds: 300,
    throttleInMs: 50, // Control re-render frequency
  });

  if (error) return <div>Error: {error.message}</div>;
  if (!parts) return <div>Loading...</div>;

  const text = parts.join(""); // parts is typed as AIStreamPart[]

  return <div>Streamed Text: {text}</div>;
}
```

### Wait Tokens

```tsx
"use client";
import { useWaitToken } from "@trigger.dev/react-hooks";

function WaitTokenComponent({ tokenId, accessToken }: { tokenId: string; accessToken: string }) {
  const { complete } = useWaitToken(tokenId, { accessToken });

  return <button onClick={() => complete({ approved: true })}>Approve Task</button>;
}
```

### SWR Hooks (Fetch Once)

```tsx
"use client";
import { useRun } from "@trigger.dev/react-hooks";
import type { myTask } from "../trigger/tasks";

function SWRComponent({ runId, accessToken }: { runId: string; accessToken: string }) {
  const { run, error, isLoading } = useRun<typeof myTask>(runId, {
    accessToken,
    refreshInterval: 0, // Disable polling (recommended)
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Run: {run?.status}</div>;
}
```

## Run Object Properties

Key properties available in run subscriptions:

- `id`: Unique run identifier
- `status`: `QUEUED`, `EXECUTING`, `COMPLETED`, `FAILED`, `CANCELED`, etc.
- `payload`: Task input data (typed)
- `output`: Task result (typed, when completed)
- `metadata`: Real-time updatable data
- `createdAt`, `updatedAt`: Timestamps
- `costInCents`: Execution cost

## Best Practices

- **Use Realtime over SWR**: Recommended for most use cases due to rate limits
- **Scope tokens properly**: Only grant necessary read/trigger permissions
- **Handle errors**: Always check for errors in hooks and subscriptions
- **Type safety**: Use task types for proper payload/output typing
- **Cleanup subscriptions**: Backend subscriptions auto-complete, frontend hooks auto-cleanup

<!-- TRIGGER.DEV realtime END -->