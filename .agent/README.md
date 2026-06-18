# .agent Documentation Index

Welcome to the comprehensive documentation for the SJ Marketing AI platform. This folder contains all critical information needed for engineers to understand and work with the system.

---

## Quick Start

If you're new to the codebase, start here:

1. **[System/project_architecture.md](./System/project_architecture.md)** - Get a complete overview of the system
2. **[System/database_schema.md](./System/database_schema.md)** - Understand the database structure
3. **[System/ai_agent_system.md](./System/ai_agent_system.md)** - Learn how AI agents work
4. **Root CLAUDE.md** - Read the project-level instructions for Claude Code

---

## Documentation Structure

### System (Current State)

Documentation about the current state of the system - architecture, tech stack, database schema, and core functionalities.

#### Core System Documentation

**[project_architecture.md](./System/project_architecture.md)** - Complete System Architecture
- Executive summary and scale indicators
- Complete tech stack (frontend & backend)
- Project structure (frontend & backend)
- Authentication & authorization
- Routing architecture
- State management patterns (TanStack Query)
- UI component architecture (shadcn-ui)
- Development workflow & configuration
- Security best practices
- Performance optimizations

**[database_schema.md](./System/database_schema.md)** - Database Structure
- Overview (115+ tables, pgvector, RLS)
- Core table categories:
  - Authentication & Users
  - AI & Agents
  - Knowledge Base & Vector Storage
  - Content Generation (LinkedIn, SEO, Newsletter)
  - Projects & Clients
  - ActiveCollab Integration
  - Analytics & Integrations
  - EOD & Team
  - Hackathon Module
  - Control Tower
  - Brands
  - Other Integrations
- Database functions (RPC)
- Custom types (enums)
- Row Level Security (RLS) policies
- Indexes (vector & standard)
- Database relationships
- Type generation

**[ai_agent_system.md](./System/ai_agent_system.md)** - AI Agent Architecture
- Agent execution flow
- Agent configuration
- Provider fallback chain
- Knowledge context collection (RAG)
- Agent memory (persistent with embeddings)
- Prompt assembly
- AI provider execution (OpenAI, Gemini, Claude, Perplexity)
- Structured output (function calling)
- Response storage
- Streaming responses
- LinkedIn content generation (special case)
- Best practices
- Monitoring & debugging

**[integration_points.md](./System/integration_points.md)** - External Integrations
- ActiveCollab (Project Management)
  - Dual authentication
  - Credential encryption (AES-GCM)
  - API operations
  - Scheduled sync
- Google Drive (Document Storage)
  - OAuth 2.0 flow
  - Document sync
  - Token refresh
- Google Analytics (Metrics)
  - GA4 API integration
- HubSpot (CRM)
  - Contact & deal sync
- n8n (Workflow Automation)
  - Webhook integration
  - EOD workflow
  - Analytics pipeline
- GoHighLevel (CRM)
- CollabAI (External AI Agents)
- AI Provider Integrations (OpenAI, Gemini, Claude, Perplexity)
- Integration health monitoring
- Security best practices
- Error handling & retry logic

**[vector-embeddings-system.md](./System/vector-embeddings-system.md)** - Vector Embeddings Architecture
- OpenAI embeddings integration
- pgvector implementation
- Semantic search workflows

#### Feature-Specific Documentation

**System/features/** - Individual feature documentation

- **[ai-agent-architecture.md](./System/features/ai-agent-architecture.md)** - AI Agent system architecture
- **[ai-dashboard.md](./System/features/ai-dashboard.md)** - AI Dashboard feature
- **[content-safety-system.md](./System/features/content-safety-system.md)** - Content safety and moderation
- **[hackathon-module.md](./System/features/hackathon-module.md)** - Hackathon management system
- **[knowledge-base-system.md](./System/features/knowledge-base-system.md)** - Knowledge base implementation
- **[people-management.md](./System/features/people-management.md)** - User and people management
- **[role-settings.md](./System/features/role-settings.md)** - Role-based permissions system
- **[task-management-system.md](./System/features/task-management-system.md)** - Task management (NEW - Jan 16, 2026)
- **[agent-builder-automations.md](./System/features/agent-builder-automations.md)** - Agent Builder, automations, integration-aware compiler (Jun 18, 2026)
  - My Tasks view with 3 view modes (Assigned, Delegated, All)
  - Task creation, editing, commenting
  - Searchable assignee selector
  - URL detection and linking in descriptions
  - Real-time cache invalidation

---

### Tasks (Feature PRDs & Implementation Plans)

Documentation for specific features, including Product Requirements Documents (PRDs) and implementation plans.

#### In Progress

**Tasks/in-progress/** - Features currently being implemented

- **[brand-knowledge-plan.md](./Tasks/in-progress/brand-knowledge-plan.md)** - Brand knowledge base implementation plan (30% complete)
- **[brand-knowledge-status.md](./Tasks/in-progress/brand-knowledge-status.md)** - Current status of brand knowledge implementation

#### Pending

**Tasks/pending/** - Features planned but not yet started

- **[keyword-research-plan.md](./Tasks/pending/keyword-research-plan.md)** - SEO keyword research feature implementation plan

#### Completed

**Tasks/completed/** - Historical implementation records and audits

- **[activecollab-analysis.md](./Tasks/completed/activecollab-analysis.md)** - ActiveCollab integration analysis
- **[activecollab-sync-review.md](./Tasks/completed/activecollab-sync-review.md)** - ActiveCollab sync implementation review
- **[control-tower-integration.md](./Tasks/completed/control-tower-integration.md)** - Control Tower project import integration (complete implementation and lessons learned)
- **[edge-function-audit-2024/](./Tasks/completed/edge-function-audit-2024/)** - Comprehensive edge function security and code quality audit (6 documents)

#### When to Add Here

- New feature PRDs
- Implementation plans
- Feature specifications
- Architecture decision records (ADRs)
- Completed feature summaries

**Naming Convention:** `feature_name_prd.md`, `feature_name_implementation.md`, `feature_name_status.md`

---

### SOP (Standard Operating Procedures)

Best practices and step-by-step guides for common development tasks.

#### Development Guides

**SOP/** - Core development procedures

- **[development-quickstart.md](./SOP/development-quickstart.md)** - Get started in 5 minutes
- **[local-environment-setup.md](./SOP/local-environment-setup.md)** - Complete local development environment setup (Supabase, env vars, migrations)
- **[development-practices.md](./SOP/development-practices.md)** - Development best practices, code standards, git workflow

#### Operations & Maintenance

- **[knowledge-base-maintenance.md](./SOP/knowledge-base-maintenance.md)** - Best practices for managing knowledge base data
- **[activecollab-encryption-setup.md](./SOP/activecollab-encryption-setup.md)** - Setup guide for encrypted ActiveCollab credentials
- **[external-api-integration-validation-guide.md](./SOP/external-api-integration-validation-guide.md)** - Comprehensive guide for validating and preventing errors when integrating external APIs (Control Tower case study)

#### Integration Setup Guides

**SOP/integrations/** - Third-party integration setup procedures

- **[google-drive-oauth-setup.md](./SOP/integrations/google-drive-oauth-setup.md)** - Google Drive OAuth 2.0 setup
- **[admin-google-drive-setup.md](./SOP/integrations/admin-google-drive-setup.md)** - Admin-level Google Drive integration
- **[n8n-eod-workflow-setup.md](./SOP/integrations/n8n-eod-workflow-setup.md)** - n8n workflow setup for EOD integration

#### Recommended SOPs to Create

**Development:**
- `adding_new_features.md` - How to add a new feature from start to finish
- `adding_new_page.md` - How to add a new page/route
- `database_migrations.md` - How to add database schema changes
- `adding_integrations.md` - How to integrate a new external service
- `configuring_ai_agents.md` - How to configure and deploy AI agents

**Code Quality:**
- `code_review_checklist.md` - What to check during code reviews
- `testing_guidelines.md` - How to write tests
- `debugging_guide.md` - Common debugging techniques

**Deployment:**
- `deploying_edge_functions.md` - How to deploy Supabase edge functions
- `production_deployment.md` - Production deployment checklist

**Maintenance:**
- `updating_dependencies.md` - How to update npm/deno dependencies
- `database_backup.md` - Database backup and restore procedures
- `monitoring_alerts.md` - How to set up and respond to alerts

---

## Key Technologies

### Frontend
- **React 18.3.1** - UI framework
- **TypeScript 5.8.3** - Type safety
- **Vite 5.4.19** - Build tool
- **TanStack Query v5** - Server state management
- **shadcn-ui** - Component library (49 components)
- **Tailwind CSS** - Styling

### Backend
- **Supabase** - Backend platform
  - PostgreSQL database
  - Edge Functions (Deno)
  - Supabase Auth
  - Real-time subscriptions
  - pgvector extension
- **64 Edge Functions** - Serverless backend logic

### AI Providers
- **OpenAI** - GPT-4o, embeddings, DALL-E, Sora
- **Google Gemini** - gemini-2.0-pro, Veo video
- **Anthropic Claude** - claude-3-5-sonnet
- **Perplexity AI** - sonar-reasoning-pro

### External Integrations
- **ActiveCollab** - Project management
- **Google Drive** - Document storage
- **Google Analytics** - Metrics
- **HubSpot** - CRM
- **n8n** - Workflow automation
- **GoHighLevel** - CRM
- **CollabAI** - External AI agents

---

## Project Statistics

- **Database Tables:** 115+
- **Edge Functions:** 64
- **React Components:** 135+ (includes new Task UI components)
- **Page Components:** 72 (includes MyTasksIndex)
- **Custom Hooks:** 47 (includes useMyTasks)
- **TypeScript Types:** 5,000+ lines (auto-generated)
- **shadcn-ui Components:** 50+

---

## Common Workflows

### Adding a New Feature

1. Read [System/project_architecture.md](./System/project_architecture.md) to understand the system
2. Check [System/database_schema.md](./System/database_schema.md) for relevant tables
3. Review existing similar features for patterns
4. Create a PRD in `Tasks/` directory
5. Implement following the architecture patterns
6. Update documentation when complete

### Working with AI Agents

1. Read [System/ai_agent_system.md](./System/ai_agent_system.md)
2. Configure agent in `ai_agents` table
3. Set up knowledge sources if needed
4. Test with streaming responses
5. Monitor costs and performance

### Adding an Integration

1. Read [System/integration_points.md](./System/integration_points.md)
2. Follow security best practices (encryption, OAuth, etc.)
3. Implement error handling and retry logic
4. Add health monitoring
5. Document in integration_points.md

### Database Changes

1. Review [System/database_schema.md](./System/database_schema.md)
2. Create migration SQL
3. Update RLS policies if needed
4. Regenerate TypeScript types:
   ```bash
   supabase gen types typescript --project-id fzknasqrludvoyxdzbxl > src/integrations/supabase/types.ts
   ```
5. Update database_schema.md documentation

---

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
```bash
supabase functions deploy <function-name>  # Deploy specific function
supabase functions deploy                  # Deploy all functions
supabase functions logs <function-name>    # View function logs
supabase functions serve <function-name>   # Test locally
```

### Database
```bash
# Generate TypeScript types from database schema
supabase gen types typescript \
  --project-id fzknasqrludvoyxdzbxl \
  > src/integrations/supabase/types.ts
```

---

## Getting Help

### Internal Resources
- **CLAUDE.md** - Instructions for Claude Code
- **Root Documentation** - See `/docs` folder for integration guides
- **Code Comments** - Many shared utilities have detailed comments

### External Resources
- **Supabase Docs** - https://supabase.com/docs
- **React Query Docs** - https://tanstack.com/query/latest
- **shadcn-ui Docs** - https://ui.shadcn.com
- **OpenAI API Docs** - https://platform.openai.com/docs

---

## Documentation Maintenance

### When to Update Documentation

**Always update after:**
- Adding new features
- Modifying database schema
- Adding/changing integrations
- Changing architecture patterns
- Adding new edge functions

**Update Process:**
1. Make code changes
2. Update relevant documentation files
3. Update this README.md if new docs added
4. Commit documentation with code changes

### Documentation Standards

- **Be Specific** - Include file paths, line numbers, code examples
- **Be Current** - Documentation should match code
- **Be Comprehensive** - Cover edge cases and gotchas
- **Use Examples** - Show, don't just tell
- **Link Related Docs** - Cross-reference related documentation

---

## Architecture Principles

### Code Organization
- **Feature-based structure** - Group by feature, not type
- **Shared utilities** - DRY principle with `_shared/` directory
- **Type safety** - Leverage TypeScript fully
- **Component reusability** - Use composition over inheritance

### Security
- **RLS everywhere** - Never rely on client-side security alone
- **Encrypted credentials** - AES-GCM for sensitive data
- **OAuth for external services** - Secure token management
- **Environment variables** - Never commit secrets

### Performance
- **Lazy loading** - Code splitting for pages
- **React Query caching** - Reduce redundant API calls
- **Vector indexes** - Fast semantic search with pgvector
- **Edge functions** - Low latency with Deno runtime

### Scalability
- **Horizontal scaling** - Stateless edge functions
- **Database optimization** - Proper indexes and RLS
- **Async processing** - Scheduled syncs for heavy operations
- **Provider fallback** - Reliability through redundancy

---

## Contact & Support

For questions about this documentation or the codebase:
- Review existing documentation first
- Check code comments in relevant files
- Consult the team lead or senior engineers

---

**Last Updated:** 2026-01-28

**Documentation Version:** 2.2.0

**Codebase Version:** See git commit history

---

## Documentation Summary

This documentation structure now includes:

**System Documentation (14 files):**
- 4 Core system docs (architecture, database, AI agents, integrations)
- 1 Vector embeddings doc
- 8 Feature-specific docs (including new task-management-system.md)
- 1 Documentation index (this file)

**SOP Documentation (10 files):**
- 3 Development guides
- 3 Operations & maintenance guides
- 3 Integration setup guides
- 1 ActiveCollab encryption guide

**Tasks Documentation (6+ files):**
- 2 In-progress features
- 1 Pending feature
- 3+ Completed tasks
- 6-file audit report

**Total:** 30+ comprehensive documentation files covering all aspects of the SJ Marketing AI platform.

### Recent Documentation Updates (Jan 28, 2026)

**New:**
- Async Job Queue Architecture for Knowledge Base processing
- `process-knowledge-jobs` edge function for background indexing
- `pgvector-lite.ts` shared utility for lightweight embeddings

**Updated:**
- `System/features/knowledge-base-system.md` - Added async architecture documentation
- README.md - Updated version and statistics

### Documentation Updates (Jan 16, 2026)

**New:**
- `System/features/task-management-system.md` - Comprehensive task management documentation

**Updated:**
- README.md - Added task management feature to index, updated statistics and version
