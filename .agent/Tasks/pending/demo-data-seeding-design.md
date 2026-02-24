# Demo Data Seeding Design

**Date:** 2026-02-24
**Status:** Approved
**Version:** 1.0
**Scope:** Comprehensive demo data across all 115+ platform features

---

## Overview

Create realistic, lightweight demo data (100-500 records) across 115+ tables, seeded via SQL migration files. Multi-phase implementation with multiple brands, organizations, and user roles to showcase all platform features end-to-end.

**Key Requirements:**
- ✅ Comprehensive coverage of ALL major features
- ✅ Lightweight volume (~100-500 records total)
- ✅ Multiple demo users with different roles
- ✅ Multiple brands and organizations
- ✅ Mock data for external integrations
- ✅ Phased implementation approach
- ✅ SQL migration-based (Option A)

---

## Phase Breakdown

### **Phase 1: Foundation (Users, Brands, Orgs, AI Agents & Knowledge)**

**Goal:** Establish core data structures and AI capabilities
**Scope:** ~25 tables, ~150 records
**Timeline:** Phase 1

**Includes:**
- 5-6 demo users with different roles (super_admin, admin, pm, brand_manager, user)
- 2-3 organizations/companies
- 3-4 brands per organization
- 15-20 AI agents (LinkedIn content, business analysis, SEO, etc.)
- Knowledge base with categories and sample content (~50 entries)
- Agent configurations and memories
- User brand access mappings

**Demo User Accounts:**

| Email | Password | Role | Access | Purpose |
|-------|----------|------|--------|---------|
| demo.admin@sjinnovation.com | demo-password-123 | super_admin | All admin panels | Full platform exploration |
| demo.pm@sjinnovation.com | demo-password-123 | pm | Clients, projects, tasks | PM workflow demo |
| demo.brand.manager@sjinnovation.com | demo-password-123 | brand_manager | 2 assigned brands | Brand-specific content |
| demo.user@sjinnovation.com | demo-password-123 | user | Standard features | Basic user experience |
| demo.manager@sjinnovation.com | demo-password-123 | manager | Team management | Manager workflow |

**Demo Organizations & Brands:**

Organization 1: "Tech Marketing Co"
- Brand 1: TechBlog (tech content)
- Brand 2: StartupLife (startup insights)
- Brand 3: DevTools (developer tools)

Organization 2: "Creative Agency Plus"
- Brand 4: DesignTrends (design focus)
- Brand 5: AgencyNews (agency insights)

**Success Criteria:** Can log in as all roles, view agents, browse knowledge base

**Tables to Seed (Phase 1):**
- auth.users (via Supabase Auth)
- users (profiles)
- user_roles
- organizations
- brands
- user_brands
- ai_agents (15-20 agents)
- knowledge_base (~50 entries)
- knowledge_base_categories
- agent_memories
- ai_configurations
- user_accountability_chart

---

### **Phase 2: Content Generation (LinkedIn, SEO, Newsletter, Media)**

**Goal:** Showcase content creation and media generation features
**Scope:** ~20 tables, ~100 records
**Timeline:** Phase 2

**Includes:**
- LinkedIn posts and content (~30 posts across brands)
- SEO blogs and keywords (~15 blogs)
- Newsletter content and subscriptions (~20 subscribers)
- AI-generated images (DALL-E, Gemini Veo) (~20 images)
- Video generation records (Sora, Gemini Veo) (~10 videos)
- Content calendars and schedules
- LinkedIn analytics data

**Success Criteria:** Dashboard shows generated content, media galleries populated

**Tables to Seed (Phase 2):**
- linkedin_posts
- linkedin_analytics
- seo_blogs
- seo_keywords
- newsletter_content
- newsletter_subscriptions
- ai_generated_images
- gemini_videos
- sora_videos
- content_calendar
- content_calendar_entries
- linkedin_content_metadata

---

### **Phase 3: Project & Client Management**

**Goal:** Showcase project workflows and team collaboration
**Scope:** ~15 tables, ~80 records
**Timeline:** Phase 3

**Includes:**
- 5-10 projects per brand
- 10-15 clients
- 30-40 tasks (assigned, delegated, completed)
- End-of-day (EOD) submissions (~20 entries)
- Weekly client email summaries
- Task comments and activity

**Success Criteria:** View projects, clients, tasks, and team activity

**Tables to Seed (Phase 3):**
- clients
- projects
- tasks
- task_comments
- task_assignments
- eod_submissions
- eod_submission_items
- weekly_client_summary
- project_team_members
- client_projects

---

### **Phase 4: External Integrations & Advanced Features**

**Goal:** Showcase third-party integrations and specialized modules
**Scope:** ~20 tables, ~80 records
**Timeline:** Phase 4

**Includes:**

**ActiveCollab Mock Data:**
- 10-15 synced projects
- 20-30 synced tasks
- 10-15 time tracking entries

**Google Analytics Mock Data:**
- 30 analytics records with metrics
- Brand-specific analytics

**HubSpot Mock Data:**
- 10-15 mock contacts
- 5-10 deals

**Control Tower (Pods & Employees):**
- 3-4 pods/teams
- 15-20 employees mapped to pods

**Hackathon Module:**
- 1 active hackathon event
- 3-5 teams
- 10-15 participants
- 5-10 submissions
- Judging scores/feedback

**n8n Workflow Data:**
- Workflow execution records
- Analytics pipeline data

**Success Criteria:** Integration dashboards show data, Control Tower displays pods, Hackathon shows events

**Tables to Seed (Phase 4):**
- activecollab_projects
- activecollab_tasks
- activecollab_time_tracking
- google_analytics_data
- hubspot_contacts
- hubspot_deals
- pods
- employees
- pod_members
- hackathon_events
- hackathon_teams
- hackathon_participants
- hackathon_submissions
- hackathon_judging_scores
- n8n_workflow_executions

---

## Data Architecture

### Migration Structure

```
supabase/migrations/
├── 20260224_seed_demo_data_phase1.sql
├── 20260224_seed_demo_data_phase2.sql
├── 20260224_seed_demo_data_phase3.sql
└── 20260224_seed_demo_data_phase4.sql
```

### Data Volume Summary

| Phase | Tables | Records | Purpose |
|-------|--------|---------|---------|
| 1 | 25 | ~150 | Foundation |
| 2 | 20 | ~100 | Content |
| 3 | 15 | ~80 | Projects |
| 4 | 20 | ~80 | Integrations |
| **Total** | **~80** | **~410** | **Lightweight demo** |

---

## Key Data Relationships

### User → Brand → Knowledge → AI Agent Chain
```
demo.brand.manager@sjinnovation.com
  ↓
  Brand: TechBlog
    ↓
    Knowledge Base: Tech articles, case studies
      ↓
      AI Agents: LinkedIn content agent, SEO agent, Email agent
        ↓
        Generated Content: 10+ posts, blogs, emails
```

### Project → Tasks → Assignments Chain
```
Client: "Tech Startup Inc"
  ↓
Project: "Q1 2026 Marketing Campaign"
  ↓
Tasks:
  - Content creation (assigned to demo.pm)
  - Social media posting (delegated)
  - Analytics review (completed)
    ↓
    EOD Submissions: Team member status updates
```

---

## Mock Integration Data Strategy

### ActiveCollab Mock Data
- Create 10 fake projects with realistic names
- Seed 25-30 tasks with various statuses
- Add time tracking entries (5-15 hours per task)
- **Note:** Don't actually sync with real ActiveCollab; just populate tables as if data was synced

### Google Analytics Mock Data
- Create realistic metrics: pageviews, sessions, users, conversions
- Date range: Last 90 days with realistic trends
- Per-brand analytics with different traffic patterns

### HubSpot Mock Data
- Create 10-15 contact records
- Create 5-10 deals in various stages
- Link to projects/clients where applicable

### n8n Workflow Data
- Workflow execution history entries
- EOD workflow trigger records
- Analytics pipeline execution data

---

## Implementation Details

### SQL Migration Approach

1. **Transactions & Safety:**
   - Wrap each migration in BEGIN/COMMIT
   - Include rollback instructions in comments
   - Disable RLS during seeding, re-enable after
   - Test foreign key constraints

2. **Data Generation:**
   - Use UUIDs consistently across related tables
   - Use realistic timestamps (spread over past month)
   - Create data in dependency order
   - Handle created_at vs updated_at patterns

3. **User Authentication:**
   - Demo users pre-created in Supabase Auth dashboard
   - Profiles created in users table during migration
   - Roles assigned via user_roles table
   - Brand access via user_brands table

4. **RLS Considerations:**
   - Super admin data visible to demo.admin
   - Brand-specific data filtered per brand_manager role
   - User data scoped to organization/brand

5. **Data Authenticity:**
   - Brand names: Real-sounding marketing companies
   - Project names: Realistic marketing campaigns
   - Content samples: Generic but professional
   - Metrics: Realistic patterns (not perfect numbers)

### Setup Instructions for Users

1. Create auth users in Supabase dashboard:
   ```
   demo.admin@sjinnovation.com: demo-password-123
   demo.pm@sjinnovation.com: demo-password-123
   demo.brand.manager@sjinnovation.com: demo-password-123
   demo.user@sjinnovation.com: demo-password-123
   demo.manager@sjinnovation.com: demo-password-123
   ```

2. Run migrations:
   ```bash
   supabase db push  # Runs all pending migrations
   ```

3. Access demo at:
   ```
   http://localhost:8080/login
   # Use any demo credentials above
   ```

---

## Success Criteria

✅ **Phase 1:**
- Can log in as all 5 demo users
- Different roles see different content
- AI agents visible in admin panel
- Knowledge base accessible

✅ **Phase 2:**
- Dashboard shows generated content
- Media galleries populated
- Content calendars displayed
- LinkedIn analytics visible

✅ **Phase 3:**
- Projects and clients viewable
- Tasks assigned and delegated
- EOD submissions visible
- Team activity displayed

✅ **Phase 4:**
- Integration dashboards show synced data
- Control Tower displays pods and employees
- Hackathon module shows events and submissions
- All role-based access working correctly

---

## Rollback Strategy

Each migration includes:
- Documented DELETE statements (commented out)
- Instructions for reverting data
- Backup references if needed
- Drop foreign keys if rolling back tables

---

## Related Documentation

- [System/database_schema.md](./../System/database_schema.md) - Complete table reference
- [System/project_architecture.md](./../System/project_architecture.md) - System overview
- [CLAUDE.md](./../../CLAUDE.md) - Development guidelines

---

**Design Approved By:** User
**Next Step:** Implementation Plan (invoke writing-plans skill)
