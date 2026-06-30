# LinkedIn Content Module – Backend Notes

> **Last Updated:** 2026-01-02  
> **Verified Against:** Current codebase  
> **Status:** ✅ Active

This document summarizes the database schema and Supabase edge function that power the LinkedIn content generation experience.

## Database Objects

### Tables

| Table | Description |
|-------|-------------|
| `thought_leaders` | Leader personas with prompts and guide text |
| `leader_uploads` | Influencer/reference docs tied to a leader |
| `weekly_trends` | Perplexity-researched topics with week anchor |
| `generated_posts` | GPT post drafts with structured extras |
| `brand_generated_posts` | Brand-specific generated posts |
| `content_performance_metrics` | Post performance analytics |

### Enum

- `public.linkedin_post_source` – Values: `trend`, `influencer`, `custom`

### Row Level Security

Access limited to authenticated users with `super_admin`, `manager`, or `pm` roles via `public.has_role` helper.

## Edge Function: `linkedin-content`

Location: `supabase/functions/linkedin-content/index.ts`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/leaders` | List leaders with counts |
| `POST` | `/leaders` | Create a leader profile |
| `GET` | `/leaders/:id` | Fetch single leader |
| `PUT` | `/leaders/:id` | Update leader details |
| `DELETE` | `/leaders/:id` | Remove leader (cascades) |
| `GET` | `/leaders/:id/uploads` | List uploads |
| `POST` | `/leaders/:id/uploads` | Save new upload |
| `DELETE` | `/leaders/:id/uploads/:uploadId` | Delete upload |
| `GET` | `/leaders/:id/trends` | Get weekly trends |
| `POST` | `/leaders/:id/trends` | Generate trends via Perplexity |
| `GET` | `/leaders/:id/posts` | List generated posts |
| `POST` | `/leaders/:id/posts` | Generate post via OpenAI |
| `PUT` | `/leaders/:id/posts/:postId` | Update existing post |

## External API Configuration

Set the following secrets in Supabase:

- `PERPLEXITY_API_KEY` – For weekly trend generation
- `OPENAI_KEY` – For GPT post drafts

## Frontend Integration

### Hooks

| Hook | File |
|------|------|
| `useGenerateLinkedInPost` | `src/hooks/useGenerateLinkedInPost.ts` |
| `useLeaderAnalytics` | `src/hooks/useLeaderAnalytics.ts` |

### Components

| Component | File |
|-----------|------|
| `GeneratePostView` | `src/features/linkedin-content/components/GeneratePostView.tsx` |
| `EditPostDialog` | `src/features/linkedin-content/components/EditPostDialog.tsx` |
| `LeaderFormDialog` | `src/features/linkedin-content/components/LeaderFormDialog.tsx` |

### Pages

| Page | Route |
|------|-------|
| Leader List | `/content/linkedin` |
| Leader Detail | `/content/linkedin/:slug` |
| Generate Post | `/content/linkedin/generate` |
| Post Result | `/content/linkedin/generate/result` |

## Notes

- API returns snake_case fields to match database naming
- `generated_posts.extra_payload` includes `carousel_outline`, `caption_ideas`
- Trend generation replaces prior rows for same leader/week
