# 📊 Brand Knowledge Base - Complete Flow Chart

> **Comprehensive visual guide to all knowledge base operations**
> Last Updated: 2026-01-08

---

## 🎯 MAIN OPERATIONS OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                   KNOWLEDGE BASE OPERATIONS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Manual File Upload (.txt, .md)                              │
│  2. Google Drive Sync                                           │
│  3. File Processing & Chunking                                  │
│  4. Vector Embedding & Storage                                  │
│  5. Search & Retrieval                                          │
│  6. Delete Operations                                           │
│  7. Stuck Files Management                                      │
│  8. Re-indexing                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📤 FLOW 1: MANUAL FILE UPLOAD

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER UPLOADS FILE                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────┐
                    │ User Action      │
                    │ - Click Upload   │
                    │ - Select file    │
                    │ - Add summary    │
                    └────────┬─────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Frontend Validation      │
                    │ - File type (.txt, .md)  │
                    │ - File size (< 10MB)     │
                    └────────┬─────────────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
            ❌ INVALID              ✅ VALID
                 │                       │
                 ↓                       ↓
        ┌─────────────────┐    ┌──────────────────────┐
        │ Show Error      │    │ Call Edge Function   │
        │ Toast Message   │    │ brand-knowledge-     │
        │ Allow Retry     │    │ upload               │
        └─────────────────┘    └──────────┬───────────┘
                                          │
                                          ↓
                              ┌────────────────────────┐
                              │ EDGE FUNCTION          │
                              │ Receives FormData:     │
                              │ - file                 │
                              │ - brandId              │
                              │ - sourceId             │
                              │ - fileSummary          │
                              └──────────┬─────────────┘
                                         │
                                         ↓
                              ┌────────────────────────┐
                              │ Authentication Check   │
                              │ - Verify JWT token     │
                              │ - Get user from auth   │
                              └──────────┬─────────────┘
                                         │
                             ┌───────────┴───────────┐
                             │                       │
                        ❌ UNAUTHORIZED         ✅ AUTHORIZED
                             │                       │
                             ↓                       ↓
                    ┌─────────────────┐   ┌──────────────────────┐
                    │ Return 401      │   │ Check Brand Access   │
                    │ Error           │   │ user_has_brand_      │
                    └─────────────────┘   │ access RPC           │
                                          └──────────┬───────────┘
                                                     │
                                         ┌───────────┴───────────┐
                                         │                       │
                                    ❌ NO ACCESS           ✅ HAS ACCESS
                                         │                       │
                                         ↓                       ↓
                                ┌─────────────────┐   ┌──────────────────────┐
                                │ Return 403      │   │ Backend File         │
                                │ Access Denied   │   │ Validation           │
                                └─────────────────┘   │ - Extension check    │
                                                      │ - MIME type check    │
                                                      │ - Size check         │
                                                      └──────────┬───────────┘
                                                                 │
                                                     ┌───────────┴───────────┐
                                                     │                       │
                                                ❌ INVALID              ✅ VALID
                                                     │                       │
                                                     ↓                       ↓
                                            ┌─────────────────┐   ┌──────────────────────┐
                                            │ Return 400      │   │ Verify Source        │
                                            │ Validation Error│   │ - Source exists?     │
                                            └─────────────────┘   │ - Belongs to brand?  │
                                                                  │ - is_active = true?  │
                                                                  └──────────┬───────────┘
                                                                             │
                                                                             ↓
                                                                  ┌──────────────────────┐
                                                                  │ Upload to Storage    │
                                                                  │ Bucket: 'knowledge'  │
                                                                  │ Path: brands/{id}/   │
                                                                  │       {timestamp}-   │
                                                                  │       {filename}     │
                                                                  └──────────┬───────────┘
                                                                             │
                                                                             ↓
                                                                  ┌──────────────────────┐
                                                                  │ Create DB Record     │
                                                                  │ Table:               │
                                                                  │ knowledge_files      │
                                                                  │                      │
                                                                  │ Fields:              │
                                                                  │ - source_id          │
                                                                  │ - brand_id           │
                                                                  │ - uploaded_by        │
                                                                  │ - name               │
                                                                  │ - path               │
                                                                  │ - file_type          │
                                                                  │ - metadata           │
                                                                  │ - processing_status  │
                                                                  │   = 'pending'        │
                                                                  └──────────┬───────────┘
                                                                             │
                                                              ┌──────────────┴──────────────┐
                                                              │                             │
                                                         ❌ DB ERROR                   ✅ SUCCESS
                                                              │                             │
                                                              ↓                             ↓
                                                     ┌─────────────────┐          ┌──────────────────┐
                                                     │ Cleanup Storage │          │ IMMEDIATE        │
                                                     │ Delete uploaded │          │ PROCESSING       │
                                                     │ file            │          │ (See Flow 3)     │
                                                     │ Return 500      │          └────────┬─────────┘
                                                     └─────────────────┘                   │
                                                                                           ↓
                                                                                  GO TO FLOW 3:
                                                                                  FILE PROCESSING
```

---

## ☁️ FLOW 2: GOOGLE DRIVE SYNC

```
┌─────────────────────────────────────────────────────────────────┐
│                   GOOGLE DRIVE SYNC FLOW                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────┐
                    │ User Action      │
                    │ - Configure      │
                    │   Google Drive   │
                    │   folder ID      │
                    │ - Click "Sync"   │
                    └────────┬─────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Create/Update Source     │
                    │ Table: knowledge_sources │
                    │ type: 'google_drive'     │
                    │ config: {                │
                    │   folderId: "xyz123"     │
                    │ }                        │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Call Edge Function       │
                    │ knowledge-base           │
                    │ action: 'sync-google-    │
                    │         drive'           │
                    │ sourceId: "source-uuid"  │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ EDGE FUNCTION            │
                    │ Load source config       │
                    │ Get Google Drive         │
                    │ credentials from env     │
                    └────────┬─────────────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
            ❌ NO CREDENTIALS       ✅ CREDENTIALS OK
                 │                       │
                 ↓                       ↓
        ┌─────────────────┐   ┌──────────────────────┐
        │ Return Error    │   │ Google Drive API     │
        │ "Setup required"│   │ List files in folder │
        └─────────────────┘   │                      │
                              │ Filter:              │
                              │ - mimeType text/*    │
                              │ - Not trashed        │
                              └──────────┬───────────┘
                                         │
                                         ↓
                              ┌────────────────────────┐
                              │ Compare with DB        │
                              │ Check each file:       │
                              │ - Already synced?      │
                              │ - Modified since sync? │
                              └──────────┬─────────────┘
                                         │
                                         ↓
                              ┌────────────────────────┐
                              │ For Each New/Updated:  │
                              └──────────┬─────────────┘
                                         │
                      ┌──────────────────┴──────────────────┐
                      │                                     │
                      ↓                                     ↓
         ┌──────────────────────┐            ┌──────────────────────┐
         │ Download from        │            │ Create knowledge_    │
         │ Google Drive API     │            │ files record         │
         │ - Get file content   │─────────→  │                      │
         │ - Get metadata       │            │ Fields:              │
         └──────────────────────┘            │ - source_id          │
                                             │ - brand_id           │
                                             │ - name               │
                                             │ - path (Drive ID)    │
                                             │ - file_type          │
                                             │ - metadata           │
                                             │   {driveFileId,      │
                                             │    modifiedTime}     │
                                             │ - processing_status  │
                                             │   = 'pending'        │
                                             └──────────┬───────────┘
                                                        │
                                                        ↓
                                             ┌──────────────────────┐
                                             │ Queue for Processing │
                                             │ (See Flow 3)         │
                                             └──────────┬───────────┘
                                                        │
                                                        ↓
                                             ┌──────────────────────┐
                                             │ Update Source        │
                                             │ last_synced = now()  │
                                             └──────────┬───────────┘
                                                        │
                                                        ↓
                                             ┌──────────────────────┐
                                             │ Return Summary       │
                                             │ {                    │
                                             │   synced: 15,        │
                                             │   inserted: 12,      │
                                             │   updated: 3,        │
                                             │   errors: 0          │
                                             │ }                    │
                                             └──────────────────────┘
```

---

## ⚙️ FLOW 3: FILE PROCESSING & CHUNKING

```
┌─────────────────────────────────────────────────────────────────┐
│          FILE PROCESSING, CHUNKING & EMBEDDING                   │
│          (Triggered immediately after upload/sync)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────────────┐
                    │ File Record Created      │
                    │ processing_status:       │
                    │ 'pending'                │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Edge Function            │
                    │ brand-knowledge-upload   │
                    │ OR knowledge-base        │
                    │                          │
                    │ Synchronous Processing   │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Update Status            │
                    │ processing_status:       │
                    │ 'processing'             │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Download File Content    │
                    │ FROM:                    │
                    │ - Supabase Storage       │
                    │   OR                     │
                    │ - Google Drive API       │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Extract Text             │
                    │ - Already plain text     │
                    │   (.txt, .md)            │
                    │ - Use .text() method     │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Text Validation          │
                    │ ✓ Not empty              │
                    │ ✓ No binary data         │
                    │ ✓ Valid UTF-8            │
                    └────────┬─────────────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
            ❌ INVALID              ✅ VALID
                 │                       │
                 ↓                       ↓
        ┌─────────────────┐   ┌──────────────────────┐
        │ Mark as Failed  │   │ Call indexKnowledge  │
        │ processing_     │   │ File()               │
        │ status: 'failed'│   │                      │
        │ last_error: msg │   │ From: pgvector.ts    │
        │ Return 500      │   └──────────┬───────────┘
        └─────────────────┘              │
                                         ↓
                              ┌────────────────────────┐
                              │ Generate Content Hash  │
                              │ SHA-256 of full text   │
                              │                        │
                              │ "a3f5b8c9d1e2..."      │
                              └──────────┬─────────────┘
                                         │
                                         ↓
                              ┌────────────────────────┐
                              │ Check Deduplication    │
                              │ Query existing chunks  │
                              │ Same content_hash?     │
                              └──────────┬─────────────┘
                                         │
                             ┌───────────┴───────────┐
                             │                       │
                        ✅ ALREADY INDEXED     ❌ NEW/CHANGED
                             │                       │
                             ↓                       ↓
                    ┌─────────────────┐   ┌──────────────────────┐
                    │ Skip Processing │   │ CHUNKING ALGORITHM   │
                    │ Mark completed  │   │                      │
                    │ Return early    │   │ chunkText()          │
                    └─────────────────┘   │                      │
                                          │ Input: Full text     │
                                          │ maxChunkSize: 6000   │
                                          │ overlap: 200         │
                                          └──────────┬───────────┘
                                                     │
                                                     ↓
                                          ┌────────────────────────┐
                                          │ Chunking Process       │
                                          │                        │
                                          │ IF text ≤ 6000 chars:  │
                                          │   → [single chunk]     │
                                          │                        │
                                          │ ELSE:                  │
                                          │   Split intelligently: │
                                          │                        │
                                          │   Priority 1:          │
                                          │   Paragraph (\n\n)     │
                                          │        ↓ not found     │
                                          │   Priority 2:          │
                                          │   Sentence (. )        │
                                          │        ↓ not found     │
                                          │   Priority 3:          │
                                          │   Line break (\n)      │
                                          │        ↓ not found     │
                                          │   Priority 4:          │
                                          │   Hard cut at 6000     │
                                          │                        │
                                          │ Add 200 char overlap   │
                                          │ between chunks         │
                                          └──────────┬─────────────┘
                                                     │
                                                     ↓
                                          ┌────────────────────────┐
                                          │ EXAMPLE:               │
                                          │                        │
                                          │ Input: 15,000 chars    │
                                          │                        │
                                          │ Output:                │
                                          │ Chunk 0: [0-5800]      │
                                          │   (paragraph break)    │
                                          │                        │
                                          │ Chunk 1: [5600-11450]  │
                                          │   (200 overlap +       │
                                          │    sentence break)     │
                                          │                        │
                                          │ Chunk 2: [11250-15000] │
                                          │   (200 overlap +       │
                                          │    remaining)          │
                                          │                        │
                                          │ Total: 3 chunks        │
                                          └──────────┬─────────────┘
                                                     │
                                                     ↓
                                          ┌────────────────────────┐
                                          │ Delete Old Embeddings  │
                                          │ (if re-indexing)       │
                                          │                        │
                                          │ DELETE FROM            │
                                          │ brand_knowledge_       │
                                          │ embeddings             │
                                          │ WHERE file_id = ?      │
                                          └──────────┬─────────────┘
                                                     │
                                                     ↓
                                          ┌────────────────────────┐
                                          │ FOR EACH CHUNK         │
                                          │ Loop i = 0 to n-1      │
                                          └──────────┬─────────────┘
                                                     │
                    ┌────────────────────────────────┴────────────────────────────────┐
                    │                                                                  │
                    ↓                                                                  ↓
         ┌────────────────────────┐                                       ┌────────────────────────┐
         │ Generate Embedding     │                                       │ Store in Database      │
         │                        │                                       │                        │
         │ Call OpenAI API:       │                                       │ INSERT INTO            │
         │                        │                                       │ brand_knowledge_       │
         │ POST /v1/embeddings    │                                       │ embeddings             │
         │ {                      │                                       │                        │
         │   model:               │                                       │ {                      │
         │   "text-embedding-     │                                       │   file_id,             │
         │    3-small",           │                                       │   brand_id,            │
         │   input: chunk_text,   │───────────────────────────────────→  │   embedding,           │
         │   encoding: "float"    │     Returns: [0.123, -0.456, ...]    │   chunk_text,          │
         │ }                      │              1536 dimensions          │   chunk_index: i,      │
         │                        │                                       │   metadata: {          │
         │ Response:              │                                       │     content_hash,      │
         │ {                      │                                       │     total_chunks,      │
         │   embedding: [...],    │                                       │     chunk_index: i,    │
         │   tokens: 1247         │                                       │     file, source,      │
         │ }                      │                                       │     ...                │
         │                        │                                       │   }                    │
         │ Time: ~200-500ms       │                                       │ }                      │
         └────────────────────────┘                                       └────────────────────────┘
                    │                                                                  │
                    │                                                                  │
                    └────────────────────────────┬─────────────────────────────────────┘
                                                 │
                                                 ↓
                                      ┌──────────────────────┐
                                      │ Chunk i Complete     │
                                      │                      │
                                      │ Log:                 │
                                      │ "Indexed chunk       │
                                      │  {i+1}/{total}"      │
                                      └──────────┬───────────┘
                                                 │
                                                 ↓
                                      ┌──────────────────────┐
                                      │ Next Chunk?          │
                                      └──────────┬───────────┘
                                                 │
                                     ┌───────────┴───────────┐
                                     │                       │
                                ✅ MORE CHUNKS          ❌ DONE
                                     │                       │
                                     ↓                       ↓
                              LOOP BACK TO              ┌──────────────────────┐
                              "FOR EACH CHUNK"          │ All Chunks Processed │
                                                        └──────────┬───────────┘
                                                                   │
                                                                   ↓
                                                        ┌──────────────────────┐
                                                        │ Update knowledge_    │
                                                        │ files Record         │
                                                        │                      │
                                                        │ SET:                 │
                                                        │ is_indexed = true    │
                                                        │ last_indexed = now() │
                                                        │ embedding_count = 3  │
                                                        │ processing_status =  │
                                                        │   'completed'        │
                                                        │ last_error = null    │
                                                        │ error_timestamp =    │
                                                        │   null               │
                                                        └──────────┬───────────┘
                                                                   │
                                                                   ↓
                                                        ┌──────────────────────┐
                                                        │ ✅ SUCCESS           │
                                                        │                      │
                                                        │ Return to user:      │
                                                        │ {                    │
                                                        │   success: true,     │
                                                        │   file: {...},       │
                                                        │   message: "File     │
                                                        │   uploaded and       │
                                                        │   indexed"           │
                                                        │ }                    │
                                                        └──────────────────────┘
                                                                   │
                                                                   ↓
                                                        ┌──────────────────────┐
                                                        │ Frontend Updates     │
                                                        │                      │
                                                        │ - Show success toast │
                                                        │ - Refresh file list  │
                                                        │ - Status: "Indexed"  │
                                                        │ - Green checkmark ✓  │
                                                        └──────────────────────┘


                                    ┌─────────────────────────────────┐
                                    │ ERROR HANDLING                  │
                                    │ (At any step)                   │
                                    └─────────┬───────────────────────┘
                                              │
                                              ↓
                                    ┌──────────────────────┐
                                    │ Catch Error          │
                                    │                      │
                                    │ Log to console       │
                                    │ Get retry_count      │
                                    │ from DB              │
                                    └──────────┬───────────┘
                                               │
                                               ↓
                                    ┌──────────────────────┐
                                    │ Update knowledge_    │
                                    │ files Record         │
                                    │                      │
                                    │ SET:                 │
                                    │ processing_status =  │
                                    │   'failed'           │
                                    │ last_error = msg     │
                                    │ error_timestamp =    │
                                    │   now()              │
                                    │ retry_count += 1     │
                                    └──────────┬───────────┘
                                               │
                                               ↓
                                    ┌──────────────────────┐
                                    │ Return Error         │
                                    │                      │
                                    │ Frontend shows:      │
                                    │ - Error toast        │
                                    │ - File status: ❌    │
                                    │ - Error message      │
                                    └──────────────────────┘
```

---

## 🔍 FLOW 4: VECTOR SEARCH & RETRIEVAL

```
┌─────────────────────────────────────────────────────────────────┐
│              SEMANTIC SEARCH & RETRIEVAL FLOW                    │
│              (Used by AI agents)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────────────┐
                    │ AI Agent Execution       │
                    │ User asks question or    │
                    │ requests content         │
                    │                          │
                    │ Example:                 │
                    │ "Generate LinkedIn post  │
                    │  about customer success" │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Prepare Query            │
                    │                          │
                    │ Extract search terms:    │
                    │ "customer success        │
                    │  stories results"        │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Call searchBrand         │
                    │ Embeddings()             │
                    │                          │
                    │ Parameters:              │
                    │ - queryText              │
                    │ - brandIds: [uuid]       │
                    │ - matchCount: 5          │
                    │ - threshold: 0.7         │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Generate Query Embedding │
                    │                          │
                    │ OpenAI API Call:         │
                    │ text-embedding-3-small   │
                    │                          │
                    │ "customer success..." → │
                    │ [0.234, -0.567, ...]     │
                    │ (1536 dimensions)        │
                    │                          │
                    │ Time: ~200ms             │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ PostgreSQL Query         │
                    │ search_brand_embeddings  │
                    │ RPC Function             │
                    │                          │
                    │ SELECT                   │
                    │   chunk_text,            │
                    │   metadata,              │
                    │   1 - (embedding <=>     │
                    │     query_embedding)     │
                    │     AS similarity        │
                    │ FROM                     │
                    │   brand_knowledge_       │
                    │   embeddings             │
                    │ WHERE                    │
                    │   brand_id = ?           │
                    │   AND similarity >= 0.7  │
                    │ ORDER BY                 │
                    │   embedding <=>          │
                    │   query_embedding        │
                    │ LIMIT 5                  │
                    │                          │
                    │ Uses HNSW Index          │
                    │ Time: ~50ms              │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────────────────────┐
                    │ Results (Top 5 Chunks)                   │
                    │                                          │
                    │ [                                        │
                    │   {                                      │
                    │     chunk_text: "Customer success...",  │
                    │     similarity: 0.94,                    │
                    │     metadata: {                          │
                    │       file: "cs-guide.txt",              │
                    │       chunk_index: 3,                    │
                    │       total_chunks: 12                   │
                    │     }                                    │
                    │   },                                     │
                    │   {                                      │
                    │     chunk_text: "Our methodology...",    │
                    │     similarity: 0.89,                    │
                    │     metadata: { ... }                    │
                    │   },                                     │
                    │   ... 3 more                             │
                    │ ]                                        │
                    └────────┬─────────────────────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Extract Text Content     │
                    │                          │
                    │ Return array of strings: │
                    │ [                        │
                    │   "Customer success...", │
                    │   "Our methodology...",  │
                    │   ...                    │
                    │ ]                        │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Inject into AI Prompt    │
                    │                          │
                    │ SYSTEM PROMPT:           │
                    │ "You are a LinkedIn      │
                    │  expert...               │
                    │                          │
                    │  BRAND KNOWLEDGE:        │
                    │  - Customer success...   │
                    │  - Our methodology...    │
                    │  - [context from search] │
                    │                          │
                    │  TASK: Generate post..." │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Send to AI Model         │
                    │ (GPT-4o, Gemini, etc.)   │
                    │                          │
                    │ AI generates response    │
                    │ using knowledge context  │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Return to User           │
                    │                          │
                    │ AI-generated content     │
                    │ with brand-specific      │
                    │ context and knowledge    │
                    └──────────────────────────┘
```

---

## 🗑️ FLOW 5: DELETE OPERATIONS

```
┌─────────────────────────────────────────────────────────────────┐
│                      DELETE FILE FLOW                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────────────┐
                    │ User Action              │
                    │ - Click delete icon      │
                    │ - Confirm deletion       │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Frontend Mutation        │
                    │ useBrandKnowledgeBase    │
                    │ .deleteFile()            │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Database DELETE          │
                    │                          │
                    │ DELETE FROM              │
                    │ knowledge_files          │
                    │ WHERE                    │
                    │   id = ?                 │
                    │   AND brand_id = ?       │
                    │                          │
                    │ RLS Policy Enforces:     │
                    │ - User owns file         │
                    │   (uploaded_by = user)   │
                    │   OR                     │
                    │ - User is admin          │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ CASCADE DELETE           │
                    │ (Automatic)              │
                    │                          │
                    │ Triggers deletion in:    │
                    │                          │
                    │ 1. brand_knowledge_      │
                    │    embeddings            │
                    │    ON DELETE CASCADE     │
                    │                          │
                    │ All chunks for this      │
                    │ file are deleted         │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Storage Cleanup          │
                    │ (Manual/Scheduled)       │
                    │                          │
                    │ File remains in          │
                    │ Supabase Storage         │
                    │                          │
                    │ Cleanup job removes      │
                    │ orphaned files           │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Success Response         │
                    │                          │
                    │ - Invalidate cache       │
                    │ - Refresh file list      │
                    │ - Show success toast     │
                    └──────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│              DELETE STUCK FILES (BULK OPERATION)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────────────┐
                    │ User Action              │
                    │ - Click "Delete Stuck    │
                    │   Files" button          │
                    │ - Confirm bulk delete    │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Query Stuck Files        │
                    │                          │
                    │ SELECT id FROM           │
                    │ knowledge_files          │
                    │ WHERE brand_id = ?       │
                    │ AND (                    │
                    │   processing_status IN   │
                    │   ('pending', 'failed')  │
                    │   OR                     │
                    │   (processing_status =   │
                    │    'processing' AND      │
                    │    updated_at < now() -  │
                    │    interval '1 hour')    │
                    │ )                        │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Call Edge Function       │
                    │ delete-stuck-knowledge-  │
                    │ files                    │
                    │                          │
                    │ Body: {                  │
                    │   file_ids: [uuids],     │
                    │   brand_id: uuid         │
                    │ }                        │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ For Each File:           │
                    │                          │
                    │ 1. Delete from storage   │
                    │ 2. Delete embeddings     │
                    │ 3. Delete file record    │
                    │                          │
                    │ Track:                   │
                    │ - Deleted count          │
                    │ - Failed count           │
                    │ - Errors                 │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Return Summary           │
                    │                          │
                    │ {                        │
                    │   deleted: 15,           │
                    │   failed: 2,             │
                    │   errors: [...]          │
                    │ }                        │
                    │                          │
                    │ Show toast with results  │
                    └──────────────────────────┘
```

---

## 🔄 FLOW 6: RE-INDEXING & STUCK FILES

```
┌─────────────────────────────────────────────────────────────────┐
│                    RE-INDEXING FLOW                              │
│                    (Manual trigger or automatic)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────────────┐
                    │ Trigger Events           │
                    │                          │
                    │ 1. User clicks "Retry"   │
                    │    on failed file        │
                    │ 2. Admin clicks "Re-     │
                    │    index All"            │
                    │ 3. File content changed  │
                    │ 4. Scheduled job         │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Query Files to Re-index  │
                    │                          │
                    │ SELECT * FROM            │
                    │ knowledge_files          │
                    │ WHERE                    │
                    │   (processing_status =   │
                    │    'failed'              │
                    │    AND retry_count < 3)  │
                    │   OR                     │
                    │   reindex_required =     │
                    │    true                  │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ For Each File:           │
                    │                          │
                    │ Reset status to          │
                    │ 'pending'                │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ GO TO FLOW 3:            │
                    │ FILE PROCESSING          │
                    │ & CHUNKING               │
                    │                          │
                    │ (Same process as         │
                    │  initial upload)         │
                    └──────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    STUCK FILE DETECTION                          │
│                    (Monitoring & Auto-recovery)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────────────┐
                    │ Detection Methods        │
                    │                          │
                    │ 1. Frontend Auto-refresh │
                    │    (every 3s if pending/ │
                    │     processing)          │
                    │                          │
                    │ 2. Database Query        │
                    │    (admin dashboard)     │
                    │                          │
                    │ 3. Scheduled Job         │
                    │    (cron or edge         │
                    │     function)            │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Identify Stuck Files     │
                    │                          │
                    │ Criteria:                │
                    │                          │
                    │ 1. Status 'processing'   │
                    │    for > 5 minutes       │
                    │                          │
                    │ 2. Status 'pending'      │
                    │    for > 10 minutes      │
                    │                          │
                    │ 3. Status 'failed'       │
                    │    with retry_count ≥ 3  │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Admin Dashboard Shows:   │
                    │                          │
                    │ 🔴 Stuck Files: 5        │
                    │ ⚠️  Failed: 3            │
                    │ 🕐 Pending too long: 2   │
                    │                          │
                    │ [Delete All Stuck]       │
                    │ [Retry All]              │
                    └────────┬─────────────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ↓                     ↓
         ┌─────────────────┐   ┌──────────────────┐
         │ Option 1:       │   │ Option 2:        │
         │ Delete Stuck    │   │ Retry Failed     │
         │                 │   │                  │
         │ (See DELETE     │   │ (See RE-INDEXING │
         │  FLOW above)    │   │  FLOW above)     │
         └─────────────────┘   └──────────────────┘
```

---

## 📊 FLOW 7: STATUS TRACKING & MONITORING

```
┌─────────────────────────────────────────────────────────────────┐
│              FILE STATUS LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────┘

       UPLOAD/SYNC
            │
            ↓
      ┌───────────┐
      │ pending   │ ← Initial state after upload
      └─────┬─────┘
            │
            ↓ (Processing starts)
      ┌───────────┐
      │processing │ ← Actively chunking/embedding
      └─────┬─────┘
            │
            ├────────────────┐
            │                │
            ↓                ↓
      ┌───────────┐    ┌──────────┐
      │ completed │    │  failed  │
      └───────────┘    └────┬─────┘
            │               │
            │               ↓
            │          ┌──────────────┐
            │          │ retry_count++│
            │          └────┬─────────┘
            │               │
            │      ┌────────┴────────┐
            │      │                 │
            │      ↓                 ↓
            │  retry_count < 3   retry_count ≥ 3
            │      │                 │
            │      ↓                 ↓
            │  Back to          ┌──────────┐
            │  'pending'        │ STUCK    │
            │                   │ Manual   │
            │                   │ action   │
            │                   │ needed   │
            │                   └──────────┘
            │
            ↓
      ┌───────────┐
      │ Searchable│
      │ by AI     │
      └───────────┘


┌─────────────────────────────────────────────────────────────────┐
│              REAL-TIME STATUS UPDATES                            │
└─────────────────────────────────────────────────────────────────┘

Frontend Query (React Query)
      │
      ↓
┌──────────────────────────┐
│ Auto-refetch Logic       │
│                          │
│ refetchInterval: (query) │
│   if hasProcessingFiles  │
│     return 3000ms        │
│   else                   │
│     return false         │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│ Query Database           │
│                          │
│ SELECT                   │
│   id,                    │
│   name,                  │
│   processing_status,     │
│   is_indexed,            │
│   last_error,            │
│   retry_count,           │
│   embedding_count        │
│ FROM knowledge_files     │
│ WHERE brand_id = ?       │
│ ORDER BY created_at DESC │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│ Render Status Badge      │
│                          │
│ if 'completed':          │
│   ✅ Indexed (green)     │
│                          │
│ if 'pending':            │
│   🕐 Pending (yellow)    │
│                          │
│ if 'processing':         │
│   ⏳ Processing (blue)   │
│                          │
│ if 'failed':             │
│   ❌ Failed (red)        │
│   Show error tooltip     │
└──────────────────────────┘
```

---

## 🔧 FLOW 8: ADMIN OPERATIONS

```
┌─────────────────────────────────────────────────────────────────┐
│              ADMIN PANEL - ALL BRAND FILES VIEW                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────────────┐
                    │ Admin Navigates to       │
                    │ /adminpanel/knowledge    │
                    │ base                     │
                    │                          │
                    │ Tab: "All Brand Files"   │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Query All Brand Files    │
                    │                          │
                    │ SELECT                   │
                    │   kf.*,                  │
                    │   b.name as brand_name,  │
                    │   ks.name as source_name │
                    │ FROM knowledge_files kf  │
                    │ JOIN brands b            │
                    │   ON kf.brand_id = b.id  │
                    │ LEFT JOIN                │
                    │   knowledge_sources ks   │
                    │   ON kf.source_id = ks.id│
                    │ WHERE kf.brand_id IS NOT │
                    │   NULL                   │
                    │ ORDER BY kf.created_at   │
                    │   DESC                   │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Display Table            │
                    │                          │
                    │ Columns:                 │
                    │ - Brand Name             │
                    │ - File Name              │
                    │ - Source                 │
                    │ - Status                 │
                    │ - Chunks                 │
                    │ - Uploaded By            │
                    │ - Created At             │
                    │ - Actions                │
                    └────────┬─────────────────┘
                             │
                             ↓
                    ┌──────────────────────────┐
                    │ Admin Actions Available  │
                    │                          │
                    │ 1. Filter by brand       │
                    │ 2. Filter by status      │
                    │ 3. Search by filename    │
                    │ 4. View file details     │
                    │ 5. Delete any file       │
                    │ 6. Bulk delete stuck     │
                    │ 7. Re-index failed       │
                    │ 8. Export file list      │
                    └────────┬─────────────────┘
                             │
                  ┌──────────┴──────────────────────┐
                  │                                 │
                  ↓                                 ↓
         ┌─────────────────┐            ┌─────────────────────┐
         │ Filter by Brand │            │ Bulk Operations     │
         │                 │            │                     │
         │ Dropdown:       │            │ - Select multiple   │
         │ - All Brands    │            │ - Delete selected   │
         │ - Brand A       │            │ - Re-index selected │
         │ - Brand B       │            │ - Export selected   │
         │ - ...           │            └─────────────────────┘
         │                 │
         │ Updates query   │
         │ with brand_id   │
         │ filter          │
         └─────────────────┘
```

---

## 📈 PERFORMANCE METRICS

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPERATION TIMINGS                             │
└─────────────────────────────────────────────────────────────────┘

UPLOAD (Small file ~5KB, 2,000 words):
  Frontend validation:         10ms
  Network upload:             200ms
  Storage write:              100ms
  DB insert:                   50ms
  Text extraction:             20ms
  Chunking (1 chunk):          5ms
  OpenAI embedding:          400ms
  DB insert embedding:         30ms
  Status update:               20ms
  ────────────────────────────────
  TOTAL:                    ~835ms


UPLOAD (Large file ~500KB, 100,000 words):
  Frontend validation:         10ms
  Network upload:            3000ms
  Storage write:              500ms
  DB insert:                   50ms
  Text extraction:            200ms
  Chunking (17 chunks):        50ms
  OpenAI embedding:         6800ms (17 × 400ms)
  DB insert embeddings:       510ms (17 × 30ms)
  Status update:               20ms
  ────────────────────────────────
  TOTAL:                   ~11.1s


GOOGLE DRIVE SYNC (10 files):
  List files API:             500ms
  Compare with DB:            100ms
  Download 10 files:         2000ms
  Process each (parallel):
    10 × ~1.5s =           ~15s (sequential)
                           ~3s  (with batching)
  ────────────────────────────────
  TOTAL:                   ~5.6s (optimized)


VECTOR SEARCH:
  Query embedding:            200ms
  PostgreSQL vector search:    50ms
  Return top 5 results:        10ms
  ────────────────────────────────
  TOTAL:                    ~260ms


DELETE SINGLE FILE:
  DB query:                    20ms
  Cascade delete embeddings:   30ms
  Success response:            10ms
  ────────────────────────────────
  TOTAL:                     ~60ms


DELETE BULK (50 stuck files):
  Query stuck files:           50ms
  For each file:
    - Delete storage:       1000ms (batch)
    - Delete embeddings:     500ms (cascade)
    - Delete records:        200ms
  ────────────────────────────────
  TOTAL:                   ~1.75s
```

---

## 💾 STORAGE BREAKDOWN

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA STORAGE LOCATIONS                        │
└─────────────────────────────────────────────────────────────────┘

1. SUPABASE STORAGE
   ├─ Bucket: 'knowledge'
   │  └─ brands/
   │     ├─ {brand_id}/
   │     │  ├─ {timestamp}-file1.txt
   │     │  ├─ {timestamp}-file2.md
   │     │  └─ ...
   │     └─ {brand_id_2}/
   │        └─ ...
   │
   └─ Purpose: Original uploaded files


2. POSTGRESQL DATABASE
   │
   ├─ knowledge_files
   │  ├─ Metadata about each file
   │  ├─ Processing status
   │  ├─ Error tracking
   │  └─ Links to storage path
   │
   ├─ brand_knowledge_embeddings
   │  ├─ Vector embeddings (1536-dim)
   │  ├─ Chunk text content
   │  ├─ Chunk metadata
   │  └─ Links to knowledge_files
   │
   └─ knowledge_sources
      ├─ Source configurations
      ├─ Google Drive folder IDs
      └─ Sync timestamps


SIZE ESTIMATES (1000 brand files, avg 10KB each):

Original files (Storage):
  1000 files × 10KB = 10 MB

Knowledge files table:
  1000 rows × 2KB = 2 MB

Embeddings (avg 3 chunks/file):
  1000 files × 3 chunks × 10KB = 30 MB
  (6KB vector + 4KB text per chunk)

TOTAL: ~42 MB for 1000 brand files
```

---

## 🚨 ERROR HANDLING MATRIX

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMON ERRORS & RESOLUTIONS                   │
└─────────────────────────────────────────────────────────────────┘

ERROR                           STATUS    RETRY?   ACTION
─────────────────────────────────────────────────────────────────
Invalid file type               400       No       User fixes
File too large (>10MB)          400       No       User splits file
No brand access                 403       No       Admin grants access
Invalid source                  400       No       Select valid source

Network timeout (upload)        500       Yes      Auto-retry
Storage write failed            500       Yes      Auto-retry
DB connection lost              500       Yes      Auto-retry

OpenAI API rate limit           429       Yes      Exponential backoff
OpenAI API key invalid          401       No       Admin fixes config
OpenAI service down             503       Yes      Wait + retry

Binary data in text file        400       No       User re-saves as text
Empty file                      400       No       User uploads content
Corrupted file                  500       Yes      Re-upload

Embedding generation timeout    500       Yes      Retry with backoff
DB constraint violation         409       No       Check duplicates
Storage quota exceeded          507       No       Upgrade plan

Google Drive auth expired       401       No       Re-authenticate
Google Drive file not found     404       No       Check folder ID
Google Drive quota exceeded     429       Yes      Wait + retry


RETRY STRATEGY:
  Attempt 1: Immediate
  Attempt 2: Wait 5 seconds
  Attempt 3: Wait 30 seconds
  Attempt 4+: Manual intervention required
```

---

## 🎯 SUMMARY DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│          END-TO-END KNOWLEDGE BASE FLOW SUMMARY                  │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │    USER      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │                         │
              ↓                         ↓
     ┌─────────────────┐      ┌──────────────────┐
     │ Manual Upload   │      │ Google Drive     │
     │ (.txt, .md)     │      │ Sync             │
     └────────┬────────┘      └────────┬─────────┘
              │                        │
              └────────────┬───────────┘
                           │
                           ↓
                ┌────────────────────────┐
                │  Supabase Storage      │
                │  + knowledge_files DB  │
                └──────────┬─────────────┘
                           │
                           ↓
                ┌────────────────────────┐
                │  Edge Function         │
                │  - Validate            │
                │  - Extract text        │
                │  - Chunk (6000 chars)  │
                │  - Generate embeddings │
                └──────────┬─────────────┘
                           │
              ┌────────────┼────────────┐
              │                         │
              ↓                         ↓
     ┌─────────────────┐      ┌──────────────────┐
     │ OpenAI API      │      │ PostgreSQL       │
     │ text-embedding  │      │ pgvector         │
     │ -3-small        │─────→│ brand_knowledge_ │
     │                 │      │ embeddings       │
     │ [1536-dim]      │      │ + HNSW index     │
     └─────────────────┘      └────────┬─────────┘
                                       │
                                       ↓
                            ┌────────────────────┐
                            │ Status: completed  │
                            │ Ready for search!  │
                            └──────────┬─────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ↓                        ↓                        ↓
     ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
     │ AI Agent Search │    │ User Views Files │    │ Admin Management │
     │ Semantic query  │    │ Status tracking  │    │ Bulk operations  │
     │ Context for RAG │    │ Delete own files │    │ Re-indexing      │
     └─────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 📝 NOTES

### File Type Restrictions
- **Allowed**: `.txt`, `.md` only
- **Reason**: Ensures plain text for reliable processing
- **Validation**: Frontend + Backend double-check

### Processing Model
- **Synchronous**: File is indexed during upload request
- **Benefit**: Immediate feedback to user
- **Trade-off**: Longer upload time for large files
- **Alternative**: Could be made async with job queue

### Chunking Strategy
- **Size**: 6,000 characters (~1,500 tokens)
- **Overlap**: 200 characters between chunks
- **Break priority**: Paragraph > Sentence > Line > Hard cut
- **Benefit**: Preserves semantic coherence

### Vector Search Performance
- **Index**: HNSW (Hierarchical Navigable Small World)
- **Speed**: Sub-second for millions of vectors
- **Accuracy**: 95%+ recall vs exact search
- **Distance metric**: Cosine similarity

### Cost Optimization
- **Deduplication**: Content hash prevents re-indexing unchanged files
- **Batch processing**: Reduces API calls
- **Caching**: Query results cached on frontend
- **Token efficiency**: Chunking optimizes token usage

---

**Last Updated**: 2026-01-08
**Version**: 1.0
**Maintained by**: Engineering Team
