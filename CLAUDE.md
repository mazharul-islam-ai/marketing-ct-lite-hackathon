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
