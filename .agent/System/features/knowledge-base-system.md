# Knowledge Base - Implementation Verification

> **Last Updated:** 2026-01-28
> **Status:** Verified against codebase

## 🏗️ Architecture Overview (Updated Jan 2026)

### Async Job Queue Architecture

The knowledge base system uses a production-safe async architecture to handle file processing:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PHASE 1 (EDGE - FAST)                       │
│                                                                     │
│  User Upload → Auth Check → Store File → Create Job → Return ✓     │
│                                                                     │
│  No parsing. No embeddings. No AI calls. Edge stays tiny.          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PHASE 2 (WORKER - ASYNC)                       │
│                                                                     │
│  Cron/Worker → Fetch Pending Job → Mark Processing →               │
│  Download File → Extract Text → Chunk → Embed (batched) →          │
│  Store Vectors → Mark Done                                          │
│                                                                     │
│  Heavy work happens here. Controlled. Isolated. Retryable.         │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Roles

| Component | Role | Characteristics |
|-----------|------|-----------------|
| **Edge Function** | Accept uploads only | Fast, stateless, never crashes |
| **Storage** | Hold raw files | Persistent, CDN-backed |
| **DB (knowledge_files)** | Job queue | status: queued/processing/completed/failed |
| **Worker** | Heavy processing | CPU + OpenAI work, controlled concurrency |
| **pgvector** | Store embeddings | Searchable vectors |

### Key Edge Functions

| Function | Purpose | JWT Required |
|----------|---------|--------------|
| `brand-knowledge-upload` | Fast upload for brand files | Yes |
| `knowledge-base-upload` | Fast upload for global files | Yes |
| `process-knowledge-jobs` | Background worker for indexing | No (cron) |

### Processing Status Values

| Status | UI Display | Color | Description |
|--------|------------|-------|-------------|
| `queued` | "Waiting to process..." | Gray | Job created, waiting for worker |
| `processing` | "Indexing..." | Blue | Worker is processing |
| `completed` | "Ready" | Green | Successfully indexed |
| `failed` | "Failed - Retrying" | Red | Error occurred, will retry |

### Shared Utilities

- **`_shared/integrations/pgvector-lite.ts`** - Lightweight fetch-based utilities for embeddings
  - `generateEmbedding()` - Single text embedding
  - `generateEmbeddingsBatch()` - Batch embeddings (up to 50-100 texts)
  - `chunkText()` - Split text into chunks for embedding
  - `generateContentHash()` - SHA-256 hash for change detection

### Database Function: Atomic Job Claiming

```sql
-- claim_pending_knowledge_jobs(job_limit, max_retries)
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions
```

---

## ✅ Completed Components

### 1. Database Schema
- [x] `knowledge_base_categories` table with RLS policies
- [x] `knowledge_sources` table with RLS policies
- [x] `knowledge_files` table with RLS policies
- [x] `project_knowledge_sources` table with RLS policies
- [x] `project_knowledge_files` table with RLS policies
- [x] Indexes for performance
- [x] Triggers for `updated_at` columns
- [x] Storage bucket `knowledge` created
- [x] Storage bucket `project-knowledge` created

### 2. Frontend UI (`/adminpanel/knowledgebase`)
- [x] Left sidebar showing categories list
- [x] Category selection (desktop sidebar + mobile dropdown)
- [x] "Add Category" button and modal
- [x] Main content area with 3 tabs:
  - [x] **Sources Tab**: Shows connected sources with sync actions
  - [x] **Files Tab**: Shows all files with search and filters
  - [x] **Sync Tab**: Manual upload interface and sync status
- [x] "Sync to Chroma" button in header
- [x] "Last Synced" display in header
- [x] "Add Source" modal with type selection:
  - [x] Manual Upload (bucket + folder)
  - [x] Google Drive (folder ID)
  - [x] Supabase Storage (bucket + folder)

### 3. Project Knowledge Base UI (`/projects/:slug/knowledge`)
- [x] Clean, modern interface design
- [x] Manual Upload section with direct file selection
- [x] Google Drive connection dialog
- [x] Real-time connection status indicators
- [x] Automatic file count updates
- [x] Source cards with status badges
- [x] File viewer with management options
- [x] Sync controls for Google Drive sources
- [x] Responsive layout with proper spacing
- [x] Delete confirmations for sources and files

### 4. Edge Functions
- [x] `supabase/functions/knowledge-base/index.ts` - Main handler
- [x] `supabase/functions/knowledge-base/sync-to-chroma.ts` - Chroma sync logic
- [x] `supabase/functions/knowledge-base/google-drive-sync.ts` - Google Drive integration
- [x] `supabase/functions/knowledge-base/deno.json` - Dependencies configured
- [x] `supabase/functions/knowledge-base-upload/index.ts` - Fast upload handler (queues job only)
- [x] `supabase/functions/brand-knowledge-upload/index.ts` - Fast brand upload handler (queues job only)
- [x] `supabase/functions/process-knowledge-jobs/index.ts` - **NEW** Background worker for async indexing
- [x] `supabase/functions/project-knowledge-sync/index.ts` - Project-specific knowledge sync
- [x] `supabase/functions/delete-stuck-knowledge-files/index.ts` - Bulk deletion of stuck/failed files

### 4a. Shared Utilities
- [x] `supabase/functions/_shared/integrations/pgvector.ts` - Full-featured pgvector utilities (uses OpenAI SDK)
- [x] `supabase/functions/_shared/integrations/pgvector-lite.ts` - **NEW** Lightweight fetch-based utilities (minimal memory)

### 5. Routing & Navigation
- [x] Route added to `src/App.tsx`: `/adminpanel/knowledgebase`
- [x] Route added to `src/App.tsx`: `/projects/:slug/knowledge`
- [x] Navigation link in `AdminLayout.tsx` under "Integrations & AI"
- [x] Project-level navigation integration
- [x] Component imports and lazy loading

### 6. Supporting Files
- [x] `AddCategoryModal.tsx` - Category creation with auto-generated Chroma collection name
- [x] `AddSourceModal.tsx` - Source connection with type-specific configuration (Admin Panel)
- [x] `GoogleDriveConnectDialog.tsx` - Simplified Google Drive connection for projects
- [x] `ProjectKnowledgeSource.tsx` - Source card with status, file count, and actions
- [x] `SourceFilesSection.tsx` - File upload and management for each source
- [x] `slugify` utility for collection naming

---

## 🔐 Required Secrets for Full Functionality

### For Google Drive Integration (Optional)
Only needed if connecting Google Drive sources:

```bash
# Add these secrets in Supabase Dashboard → Project Settings → Edge Functions
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
```

**How to get these:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Enable Google Drive API
4. Generate refresh token using OAuth playground

### For Chroma Sync (Required)
```bash
CHROMA_API_KEY=your_chroma_api_key
CHROMA_BASE_URL=https://api.trychroma.com  # Or your hosted instance
```

### For Embeddings (Required)
```bash
OPENAI_API_KEY=your_openai_api_key  # For text-embedding-3-small
```

**Alternative:** Use Lovable AI Gateway instead of OpenAI for embeddings (recommended).

---

## 🧪 Testing Checklist

### Basic Flow
- [ ] 1. Navigate to `/adminpanel/knowledgebase`
- [ ] 2. Click "Add Category" → Create category (e.g., "Marketing")
- [ ] 3. Verify Chroma collection name auto-generated (e.g., `company_marketing`)
- [ ] 4. Select the category from sidebar
- [ ] 5. Click "Add Source" → Select "Manual Upload"
- [ ] 6. Configure bucket (`knowledge`) and folder
- [ ] 7. In the Sources tab, click "Choose File" → Upload a document (PDF, DOCX, TXT)
- [ ] 8. Verify file appears in the file list with "Pending" status
- [ ] 9. Click "Sync to Chroma" → Verify success toast
- [ ] 10. Verify file status changes to "Indexed" with green checkmark
- [ ] 11. Check "Last Synced" timestamp updates

### Google Drive Flow (if configured)
- [ ] 1. Create a Google Drive folder and note its ID
- [ ] 2. Add secrets to Supabase Edge Functions
- [ ] 3. Click "Add Source" → Select "Google Drive"
- [ ] 4. Enter folder ID
- [ ] 5. In Sources tab, click "Sync" on the Drive source
- [ ] 6. Verify files from Drive appear in "Files" tab
- [ ] 7. Click "Sync to Chroma" to index them

### Permissions
- [ ] 1. Log in as `super_admin` → Full access
- [ ] 2. Log in as `manager` → Can manage sources and files
- [ ] 3. Log in as regular `user` → No access (should redirect or show unauthorized)

---

## 📋 Feature Summary

### Chroma Collection Naming
- Format: `company_{slug}` for admin panel knowledge base
- Format: `project_{slug}` for project-specific knowledge bases
- Examples:
  - "HR" → `company_hr`
  - "Finance" → `company_finance`
  - "Marketing & Sales" → `company_marketing-sales`

### Source Types

#### Admin Panel Knowledge Base
1. **Manual Upload**
   - Files uploaded directly via UI per source
   - Stored in Supabase Storage (`knowledge` bucket by default)
   - Configurable folder prefix
   - Upload interface integrated into each source card
   - Real-time status tracking (Pending/Indexed)
   - Delete files directly from UI

2. **Google Drive**
   - Auto-sync from specified Drive folder
   - Requires Google OAuth credentials
   - One-click sync button per source

3. **Supabase Storage**
   - Link existing Supabase bucket/folder
   - Files already in storage get indexed

#### Project Knowledge Base (NEW)
1. **Manual Upload**
   - Direct file selection via "Choose File" button
   - Streamlined upload interface
   - No complex source configuration needed
   - Files stored in `project-knowledge` bucket
   - Automatic file count tracking
   - Real-time upload status

2. **Google Drive Integration**
   - Simple folder ID configuration via dialog
   - Real-time connection status indicators:
     - ✓ Connected (green) - Folder properly configured
     - ✗ Not Connected (red) - Missing or invalid configuration
   - Manual sync with "Sync Now" button
   - Automatic file count updates
   - Last sync timestamp tracking
   - No service account setup needed from UI

### Sync Process
1. Files collected from all active sources in a category
2. Text extracted from each file
3. OpenAI embeddings generated (`text-embedding-3-small`)
4. Vectors stored in Chroma collection
5. Metadata includes category name, file name, source name

### Stuck Files Management (Admin Panel)

The admin panel includes sophisticated stuck file detection and bulk deletion capabilities:

#### Detection Criteria
Files are considered "stuck" if they meet any of these conditions:
- **Status = 'pending'** AND created more than 10 minutes ago
- **Status = 'processing'** AND updated more than 5 minutes ago (likely timeout/crash)
- **Status = 'failed'** AND retry_count >= 3 (permanent failure)

#### Admin Panel Features
1. **All Brand Files Tab** - View all brand knowledge files across all brands
   - Filterable by brand, status, filename
   - Shows brand name, source, status, chunk count
   - Delete individual files or bulk operations

2. **Status Badges** - Real-time visual indicators:
   - 🕐 **Pending** (yellow) - Waiting to be processed
   - ⏳ **Processing** (blue) - Currently being indexed
   - ✅ **Indexed/Completed** (green) - Successfully indexed and searchable
   - ❌ **Failed** (red) - Processing failed, shows error tooltip
   - ⚠️ **Stuck** (orange) - File stuck in processing state for > 5 minutes

3. **Bulk Delete Stuck Files**
   - "Delete Stuck Files" button appears when stuck files detected
   - Shows count of files to be deleted
   - Confirmation dialog with details
   - Groups files by brand before deletion
   - Comprehensive cleanup:
     - Deletes from Supabase Storage
     - Deletes from `brand_knowledge_embeddings` table
     - Deletes from `knowledge_files` table
   - Returns detailed results: deleted count, failed count, errors

4. **Auto-refresh** - Files with pending/processing status trigger automatic refresh every 3 seconds until completion

#### Edge Function: `delete-stuck-knowledge-files`
Location: `supabase/functions/delete-stuck-knowledge-files/index.ts`

**Request:**
```typescript
{
  fileIds: string[], // Array of knowledge_files IDs to delete
  brandId?: string    // Optional brand filter for safety
}
```

**Response:**
```typescript
{
  success: boolean,
  deleted: number,     // Count of successfully deleted files
  failed: number,      // Count of failed deletions
  errors: string[]     // Array of error messages
}
```

**Processing Flow:**
1. Authenticates user (requires super_admin role)
2. Validates file IDs and brand access
3. Groups files by brand for efficient processing
4. For each file:
   - Deletes from Supabase Storage bucket
   - CASCADE delete removes embeddings automatically
   - Deletes knowledge_files record
5. Returns comprehensive summary

---

## 🚀 Next Steps (Optional Enhancements)

### Not in Original Spec (Future)
- [ ] Search within page using Chroma query
- [ ] File preview/viewer
- [x] **Bulk delete files** - ✅ Completed: Delete stuck files functionality (2026-01-08)
- [ ] Source edit/delete
- [ ] Category edit/delete
- [x] **Sync status indicators** - ✅ Completed: Processing status badges (pending, processing, completed, failed)
- [ ] Automatic scheduled syncs
- [ ] File content preview in Files tab
- [ ] Analytics on most-used categories

---

## 🐛 Known Limitations

1. **Google Drive Support:**
   - Only syncs top-level files in the specified folder (not recursive)
   - Requires manual secret configuration in Supabase
   - No auto-sync schedule yet (manual trigger only)
   - Project Knowledge Base: Connection status based on folder ID presence

2. **File Types:**
   - Text extraction works for: PDF, TXT, CSV, DOCX, PPTX, XLSX
   - Binary files (images, videos) will fail to index

3. **Chroma Sync:**
   - Full re-index on every sync (no delta/incremental yet)
   - Large categories may take time to sync

4. **Embeddings:**
   - Uses OpenAI's `text-embedding-3-small`
   - Consider switching to Lovable AI Gateway for cost efficiency

5. **UI Differences:**
   - **Admin Panel**: Full source management with multiple types
   - **Project Level**: Simplified interface focused on manual uploads and Google Drive
   - **File Count**: Updates on page load, may require refresh if stale

---

## ✅ Implementation Complete

All components from the original implementation are complete. Recent updates include:

### Recent Changes

#### 2026-01-28: Async Job Queue Architecture
- **Production-Safe Architecture** - Complete refactor of knowledge file processing:
  - Upload functions now only handle auth, validation, storage, and job creation
  - No synchronous indexing in edge functions (prevents memory crashes)
  - New `process-knowledge-jobs` worker for background processing
- **New Components:**
  - `process-knowledge-jobs/index.ts` - Background worker triggered by cron
  - `_shared/integrations/pgvector-lite.ts` - Lightweight fetch-based utilities
  - `claim_pending_knowledge_jobs` SQL function for atomic job locking
- **Improvements:**
  - Atomic job locking with `FOR UPDATE SKIP LOCKED`
  - Bulk insert for embeddings (single insert for all chunks)
  - Batched OpenAI calls (max 50-100 chunks per API call)
  - Idempotent processing (delete existing embeddings before insert)
  - Automatic retry (up to 3 attempts)
- **Status Values Updated:**
  - `pending` → `queued` for clearer UX
  - Added better status descriptions for users

#### 2026-01-08: Stuck Files Management & Brand Knowledge Improvements
- **Bulk Delete Stuck Files** - Admin panel now has ability to delete all stuck, pending, or failed files
  - New edge function: `delete-stuck-knowledge-files` for bulk operations
  - Groups files by brand before deletion for proper cleanup
  - Deletes files from storage, embeddings table, and knowledge_files table
  - Returns detailed summary of deletion results
- **Improved Admin Panel** - "All Brand Files" tab shows all brand knowledge files across all brands
- **Processing Status Tracking** - Real-time status badges showing:
  - 🕐 Pending (yellow)
  - ⏳ Processing (blue)
  - ✅ Indexed/Completed (green)
  - ❌ Failed (red) with error tooltip
- **Auto-refresh** - Files with pending/processing status auto-refresh every 3 seconds
- **Stuck File Detection** - Visual indicators for files stuck in processing state

#### 2025-11-11: Project Knowledge Base UI Improvements
- **Simplified Project Knowledge Base UI** - Removed complex "Add Source" modal in favor of direct upload
- **Real-time Connection Status** - Google Drive sources show live connection indicators
- **Automatic File Counts** - File counts update without needing to click "View Files"
- **Improved UX** - Better spacing, padding, and visual hierarchy
- **Status Indicators** - Clear visual feedback for connection status (Connected/Not Connected)

### External Dependencies
- Chroma API credentials (required for vector indexing)
- OpenAI API key or Lovable AI Gateway (required for embeddings)
- Google Drive OAuth credentials (optional, only if using Drive sources)

### Production Status
- ✅ **Admin Panel Knowledge Base**: Production-ready with full source management
- ✅ **Project Knowledge Base**: Production-ready with simplified upload and Google Drive sync
- ✅ **Manual Uploads**: Fully functional for both admin and project levels
- ⚠️ **Google Drive**: Requires secret configuration in Supabase Edge Functions

### Documentation
- ✅ Complete user guide in `.agent/System/features/knowledge-base-system.md`
- ✅ Technical implementation details in this document
