

## Plan: Fix All Demo Seed Data SQL Migrations

### Problem Summary

The four seed data migration files (`20260224_seed_demo_data_phase1.sql` through `phase4.sql`) contain numerous column mismatches against the actual database schema. These migrations would fail if re-run because they reference columns that don't exist on the actual tables. Here is a comprehensive inventory of every issue found.

---

### Phase 1 Issues (`_phase1.sql`)

| Table | Issue | Fix |
|-------|-------|-----|
| `brands` | References `status`, `type`, `owner_id`, `monthly_budget` -- none of these columns exist. Actual columns: `name`, `slug`, `description`, `logo_url`, `website`, `industry`, `organization_id`, `is_active`, `created_by`, `created_at`, `updated_at` | Remove `status`, `type`, `monthly_budget`; rename `owner_id` to `created_by` |
| `user_brands` | References `access_level`, `can_manage_team`, `can_manage_settings`, `can_view_analytics`, `can_manage_content` -- none exist. Actual columns: `id`, `user_id`, `brand_id`, `created_at` | Remove all extra columns; only insert `id`, `user_id`, `brand_id`, `created_at` |

### Phase 2 Issues (`_phase2.sql`)

| Table | Issue | Fix |
|-------|-------|-----|
| `generated_posts` | References `leader_id` FK to `leader-001-...` UUIDs -- `thought_leaders` table exists but no seed data creates those leader records, so FK will fail | Either remove `leader_id` values or add leader seed data before posts |
| `ai_generated_images` | References `thumbnail_url`, `model_used`, `model_version`, `size` -- none exist. Actual columns: `id`, `prompt`, `image_url`, `model`, `brand_id`, `generated_by`, `metadata`, `created_at` | Remove `thumbnail_url`, `model_version`, `size`; rename `model_used` to `model` |
| `sora_videos` | References `thumbnail_url`, `duration_seconds` -- don't exist. Actual columns: `id`, `prompt`, `video_url`, `status`, `brand_id`, `generated_by`, `metadata`, `created_at` | Remove `thumbnail_url`, `duration_seconds`; optionally set `status` |
| `content_performance_metrics` | References `shares`, `comments`, `conversion_rate`, `measured_at` -- don't exist. Actual columns: `id`, `content_id`, `content_type`, `views`, `clicks`, `conversions`, `engagement_rate`, `brand_id`, `recorded_at` | Remove `shares`, `comments`, `conversion_rate`, `measured_at`; add `recorded_at` instead |

### Phase 3 Issues (`_phase3.sql`)

| Table | Issue | Fix |
|-------|-------|-----|
| `projects` | References `project_manager`, `assigned_team` -- don't exist. Actual columns use `project_manager_id`. No `assigned_team` column. | Rename `project_manager` to `project_manager_id`; remove `assigned_team` |
| `project_tasks` | References `created_by`, `past_assignees` -- don't exist. Actual columns: `id`, `project_id`, `title`, `description`, `status`, `priority`, `assigned_to`, `due_date`, `activecollab_task_id`, `created_at`, `updated_at` | Remove `created_by`, `past_assignees` |
| `project_task_comments` | References `comment_text` -- actual column name is `comment` | Rename `comment_text` to `comment` |
| `eod_submissions` | Table does not exist | Remove EOD submission inserts entirely |
| `weekly_client_summary` | References `project_ids`, `total_tasks`, `completed_tasks`, `summary_content`, `generated_by_agent` -- actual columns: `id`, `client_id`, `summary_text`, `week_start`, `week_end`, `generated_by`, `created_at` | Rewrite to match actual schema |

### Phase 4 Issues (`_phase4.sql`)

| Table | Issue | Fix |
|-------|-------|-----|
| `pods` | References `name`, `slug`, `lead_id`, `status`, `updated_at` -- actual columns: `pod_name`, `pod_lead_id`, `is_active`. No `slug`, `status`, `updated_at` | Rename `name` to `pod_name`, `lead_id` to `pod_lead_id`; remove `slug`, `status`, `updated_at`; use `ON CONFLICT (id)` instead of `(slug)` |
| `employees` | References `role`, `status` -- actual columns: `job_title`, `is_active`. Also requires `employee_id` (text, NOT NULL) | Rename `role` to `job_title`, `status` to `is_active` (boolean); add `employee_id` text field |
| `pod_members` | References `created_at` -- actual column is `joined_at` | Rename `created_at` to `joined_at` |
| `hackathon_events` | References `max_participants` -- doesn't exist. Has `max_team_size`, `min_team_size`. Also uses `date` cast but columns are `timestamptz` | Remove `max_participants`; use `timestamptz` for dates |
| `hackathon_teams` | References `hackathon_id`, `name`, `description`, `team_lead_id` -- actual columns: `event_id`, `team_name`, `project_name`, `project_description`, `team_lead_id` | Rename accordingly |
| `hackathon_participants` | References `hackathon_id`, `employee_id`, `role` -- actual columns: `event_id`, `user_id`, `skills`, `interests`, `status` | Rename `hackathon_id` to `event_id`, `employee_id` to `user_id`; remove `role` |
| `hackathon_submissions` | References `title`, `status` -- actual columns: `submission_title`, `is_finalized`, `submitted_at` | Rename `title` to `submission_title`; replace `status` with `is_finalized` |
| `hackathon_judging_scores` | Table does not exist | Remove judging scores inserts entirely |
| Missing tables | `activecollab_projects`, `activecollab_tasks`, `activecollab_time_tracking`, `google_analytics_data`, `hubspot_contacts` do not exist | Remove all inserts for these non-existent tables |
| Indexes | References indexes on non-existent tables | Remove corresponding `CREATE INDEX` statements |

### Cross-Phase Issues

| Issue | Details |
|-------|---------|
| Invalid UUIDs | `f5d6e7b8-c9da-4e1f-b2g3-d4e5f6a7b8c9` and `a6e7f8c9-daeb-4f2g-c3h4-e5f6a7b8c9d0` contain `g` and `h` which are invalid hex -- UUIDs only allow `0-9a-f` | Replace with valid UUIDs |
| Missing thought leaders | Phase 2 posts reference `leader-001-...` and `leader-002-...` but no leader records are seeded | Set `leader_id` to NULL or add thought_leader seed data |

---

### Implementation Steps

1. **Rewrite Phase 1** -- Fix `brands` (remove `status`, `type`, `monthly_budget`, rename `owner_id`), fix `user_brands` (remove permission columns), fix invalid UUIDs throughout

2. **Rewrite Phase 2** -- Fix `ai_generated_images` (use `model` not `model_used`), fix `sora_videos` (remove `thumbnail_url`, `duration_seconds`), fix `content_performance_metrics` (remove non-existent columns), set `leader_id` to NULL in `generated_posts`

3. **Rewrite Phase 3** -- Fix `projects` (use `project_manager_id`, remove `assigned_team`), fix `project_tasks` (remove `created_by`, `past_assignees`), fix `project_task_comments` (use `comment`), remove `eod_submissions` inserts, fix `weekly_client_summary` to match actual schema

4. **Rewrite Phase 4** -- Fix `pods` (use `pod_name`, `pod_lead_id`), fix `employees` (add `employee_id`, use `job_title`), fix `pod_members` (use `joined_at`), fix `hackathon_events`/`teams`/`participants`/`submissions` column names, remove `hackathon_judging_scores`/`activecollab_*`/`google_analytics_data`/`hubspot_contacts` inserts (tables don't exist), clean up indexes

5. **Replace all invalid UUIDs** across all files -- replace any UUID containing `g` or `h` hex digits with valid UUIDs

6. **Deploy** a single new migration that:
   - Deletes existing seed data (by known IDs)
   - Re-inserts corrected data

### Technical Details

The invalid UUIDs needing replacement:
- `f5d6e7b8-c9da-4e1f-b2g3-d4e5f6a7b8c9` (brand_manager) -- replace with e.g. `f5d6e7b8-c9da-4e1f-b203-d4e5f6a7b8c9`
- `a6e7f8c9-daeb-4f2g-c3h4-e5f6a7b8c9d0` (manager) -- replace with e.g. `a6e7f8c9-daeb-4f20-c304-e5f6a7b8c9d0`

These appear in all 4 phase files and must be updated consistently.

