


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'super_admin',
    'manager',
    'pm',
    'user',
    'content_creator',
    'marketing'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."linkedin_post_source" AS ENUM (
    'trend',
    'influencer',
    'custom'
);


ALTER TYPE "public"."linkedin_post_source" OWNER TO "postgres";


CREATE TYPE "public"."processing_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


ALTER TYPE "public"."processing_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'manager',
    'assistant_manager',
    'project_coordinator',
    'content_writer',
    'seo_specialist',
    'design_consultant',
    'marketing_executive',
    'brand_owner',
    'team_member'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."image_user_quotas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "daily_limit" integer DEFAULT 50,
    "monthly_cost_limit_cents" integer DEFAULT 5000,
    "current_daily_count" integer DEFAULT 0,
    "current_monthly_cost_cents" numeric(12,6) DEFAULT 0,
    "last_reset_date" "date" DEFAULT CURRENT_DATE,
    "last_monthly_reset" "date" DEFAULT ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date",
    "has_unlimited" boolean DEFAULT false,
    "override_reason" "text",
    "override_by" "uuid",
    "override_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image_user_quotas" OWNER TO "postgres";


COMMENT ON TABLE "public"."image_user_quotas" IS 'Per-user daily and monthly generation quotas';



CREATE OR REPLACE FUNCTION "public"."add_image_cost"("p_user_id" "uuid", "p_cost_cents" numeric) RETURNS SETOF "public"."image_user_quotas"
    LANGUAGE "sql"
    AS $$
  UPDATE public.image_user_quotas
  SET
    current_monthly_cost_cents = current_monthly_cost_cents + p_cost_cents,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND (current_monthly_cost_cents + p_cost_cents <= monthly_cost_limit_cents OR has_unlimited = true)
  RETURNING *;
$$;


ALTER FUNCTION "public"."add_image_cost"("p_user_id" "uuid", "p_cost_cents" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_image_cost"("p_user_id" "uuid", "p_cost_cents" numeric) IS 'Atomically add cost to monthly tracking, returns empty if limit exceeded';



CREATE OR REPLACE FUNCTION "public"."aggregate_image_stats_for_date"("p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.image_generation_stats (
    date,
    user_id,
    total_generations,
    successful_generations,
    failed_generations,
    blocked_generations,
    total_cost_cents,
    avg_generation_time_ms,
    model_name
  )
  SELECT
    p_date as date,
    user_id,
    COUNT(*) as total_generations,
    COUNT(*) FILTER (WHERE generation_status = 'completed') as successful_generations,
    COUNT(*) FILTER (WHERE generation_status = 'failed') as failed_generations,
    COUNT(*) FILTER (WHERE status = 'blocked') as blocked_generations,
    COALESCE(SUM(cost_cents), 0) as total_cost_cents,
    AVG(generation_time_ms)::INTEGER as avg_generation_time_ms,
    COALESCE(model_name, 'gemini-2.5-flash-image') as model_name
  FROM public.ai_generated_images
  WHERE created_at >= p_date
    AND created_at < p_date + INTERVAL '1 day'
    AND deleted_at IS NULL
  GROUP BY user_id, model_name
  ON CONFLICT (date, user_id, model_name)
  DO UPDATE SET
    total_generations = EXCLUDED.total_generations,
    successful_generations = EXCLUDED.successful_generations,
    failed_generations = EXCLUDED.failed_generations,
    blocked_generations = EXCLUDED.blocked_generations,
    total_cost_cents = EXCLUDED.total_cost_cents,
    avg_generation_time_ms = EXCLUDED.avg_generation_time_ms,
    computed_at = NOW();
END;
$$;


ALTER FUNCTION "public"."aggregate_image_stats_for_date"("p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."aggregate_image_stats_for_date"("p_date" "date") IS 'Manually aggregate stats for a specific date';



CREATE OR REPLACE FUNCTION "public"."auto_link_thought_leader"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  leader_record RECORD;
  email_username TEXT;
BEGIN
  -- Extract username from email (e.g., 'daisyn' from 'daisyn@sjinnovation.com')
  email_username := LOWER(SPLIT_PART(NEW.email, '@', 1));
  
  -- Find unlinked thought leader where url_slug starts with the email username
  SELECT * INTO leader_record
  FROM public.thought_leaders
  WHERE user_id IS NULL
    AND url_slug LIKE email_username || '%'
  LIMIT 1;
  
  -- If found, link the user and assign content_creator role
  IF leader_record.id IS NOT NULL THEN
    UPDATE public.thought_leaders 
    SET user_id = NEW.id 
    WHERE id = leader_record.id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'content_creator'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_link_thought_leader"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_image_stats"("p_start_date" "date", "p_end_date" "date") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_date DATE;
  v_count INTEGER := 0;
BEGIN
  v_date := p_start_date;
  WHILE v_date <= p_end_date LOOP
    PERFORM aggregate_image_stats_for_date(v_date);
    v_count := v_count + 1;
    v_date := v_date + INTERVAL '1 day';
  END LOOP;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."backfill_image_stats"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."backfill_image_stats"("p_start_date" "date", "p_end_date" "date") IS 'Backfill stats for a date range (start_date to end_date inclusive)';



CREATE OR REPLACE FUNCTION "public"."check_analytics_api_rate_limit"("p_api_key_hash" "text", "p_max_requests" integer DEFAULT 100) RETURNS TABLE("allowed" boolean, "current_count" integer, "limit_max" integer, "window_resets_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_window_start := date_trunc('minute', NOW());

  INSERT INTO public.api_rate_limits (api_key_hash, window_start, request_count)
  VALUES (p_api_key_hash, v_window_start, 1)
  ON CONFLICT (api_key_hash, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  -- Probabilistic cleanup: ~1% of requests clean old rows
  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
  END IF;

  RETURN QUERY SELECT
    (v_count <= p_max_requests),
    v_count,
    p_max_requests,
    v_window_start + INTERVAL '1 minute';
END;
$$;


ALTER FUNCTION "public"."check_analytics_api_rate_limit"("p_api_key_hash" "text", "p_max_requests" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_image_quota"("p_user_id" "uuid") RETURNS TABLE("has_quota" boolean, "current_count" integer, "daily_limit" integer, "monthly_cost" numeric, "monthly_limit" integer, "has_unlimited" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    (q.current_daily_count < q.daily_limit OR q.has_unlimited) AS has_quota,
    q.current_daily_count,
    q.daily_limit,
    q.current_monthly_cost_cents,
    q.monthly_cost_limit_cents,
    q.has_unlimited
  FROM public.image_user_quotas q
  WHERE q.user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."check_image_quota"("p_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "path" "text",
    "file_type" "text",
    "is_indexed" boolean DEFAULT false,
    "last_indexed" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding_count" integer DEFAULT 0,
    "reindex_required" boolean DEFAULT false,
    "processing_status" "public"."processing_status" DEFAULT 'pending'::"public"."processing_status",
    "last_error" "text",
    "retry_count" integer DEFAULT 0,
    "error_timestamp" timestamp with time zone,
    "brand_id" "uuid",
    "uploaded_by" "uuid"
);


ALTER TABLE "public"."knowledge_files" OWNER TO "postgres";


COMMENT ON COLUMN "public"."knowledge_files"."processing_status" IS 'Job status: pending (waiting), processing (in progress), completed (done), failed (error - will retry)';



CREATE OR REPLACE FUNCTION "public"."claim_pending_knowledge_jobs"("job_limit" integer DEFAULT 5, "max_retries" integer DEFAULT 3) RETURNS SETOF "public"."knowledge_files"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM knowledge_files
    WHERE processing_status IN ('pending', 'failed')
      AND (retry_count IS NULL OR retry_count < max_retries)
    ORDER BY
      CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END,  -- Retry failed first
      created_at ASC
    LIMIT job_limit
    FOR UPDATE SKIP LOCKED  -- Atomic lock, skip if locked by another worker
  )
  UPDATE knowledge_files f
  SET processing_status = 'processing',
      updated_at = NOW()
  FROM claimed c
  WHERE f.id = c.id
  RETURNING f.*;
END;
$$;


ALTER FUNCTION "public"."claim_pending_knowledge_jobs"("job_limit" integer, "max_retries" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_knowledge_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_size" bigint,
    "mime_type" "text",
    "file_type" "text" DEFAULT 'upload'::"text" NOT NULL,
    "sync_status" "text" DEFAULT 'pending'::"text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "external_id" "text",
    "name" "text",
    "path" "text",
    "processing_status" "text" DEFAULT 'pending'::"text",
    "retry_count" integer DEFAULT 0,
    "last_error" "text",
    "error_timestamp" timestamp with time zone,
    "embedding_count" integer DEFAULT 0,
    "is_indexed" boolean DEFAULT false,
    "last_indexed" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "project_knowledge_files_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."project_knowledge_files" OWNER TO "postgres";


COMMENT ON COLUMN "public"."project_knowledge_files"."processing_status" IS 'Job status: pending (waiting), processing (in progress), completed (done), failed (error - will retry)';



CREATE OR REPLACE FUNCTION "public"."claim_pending_project_knowledge_jobs"("job_limit" integer DEFAULT 5, "max_retries" integer DEFAULT 3) RETURNS SETOF "public"."project_knowledge_files"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM project_knowledge_files
    WHERE processing_status IN ('pending', 'failed')
      AND (retry_count IS NULL OR retry_count < max_retries)
    ORDER BY
      CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END,  -- Retry failed first
      created_at ASC
    LIMIT job_limit
    FOR UPDATE SKIP LOCKED  -- Atomic lock, skip if locked by another worker
  )
  UPDATE project_knowledge_files f
  SET processing_status = 'processing',
      updated_at = NOW()
  FROM claimed c
  WHERE f.id = c.id
  RETURNING f.*;
END;
$$;


ALTER FUNCTION "public"."claim_pending_project_knowledge_jobs"("job_limit" integer, "max_retries" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_keyword_suggestions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.keyword_suggestions
  WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_keyword_suggestions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_user_quota"("p_user_id" "uuid") RETURNS "public"."image_user_quotas"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_quota public.image_user_quotas;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_quota
  FROM public.image_user_quotas
  WHERE user_id = p_user_id;

  -- If no record exists, create one
  IF v_quota IS NULL THEN
    INSERT INTO public.image_user_quotas (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING * INTO v_quota;

    -- Handle race condition - re-fetch if insert was no-op
    IF v_quota IS NULL THEN
      SELECT * INTO v_quota
      FROM public.image_user_quotas
      WHERE user_id = p_user_id;
    END IF;
  END IF;

  RETURN v_quota;
END;
$$;


ALTER FUNCTION "public"."ensure_user_quota"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_leader_slug"("leader_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  base_slug := lower(trim(regexp_replace(leader_name, '[^a-zA-Z0-9\s-]', '', 'g')));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM thought_leaders WHERE url_slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;


ALTER FUNCTION "public"."generate_leader_slug"("leader_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;


ALTER FUNCTION "public"."get_current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_image_children"("p_image_id" "uuid") RETURNS TABLE("id" "uuid", "parent_id" "uuid", "version_number" integer, "prompt" "text", "edit_instruction" "text", "image_url" "text", "storage_path" "text", "created_at" timestamp with time zone, "generation_status" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE children AS (
    -- Base case: direct children
    SELECT
      img.id,
      img.parent_id,
      img.version_number,
      img.prompt,
      img.edit_instruction,
      img.image_url,
      img.storage_path,
      img.created_at,
      img.generation_status
    FROM public.ai_generated_images img
    WHERE img.parent_id = p_image_id
    AND img.deleted_at IS NULL

    UNION ALL

    -- Recursive case: children of children
    SELECT
      child.id,
      child.parent_id,
      child.version_number,
      child.prompt,
      child.edit_instruction,
      child.image_url,
      child.storage_path,
      child.created_at,
      child.generation_status
    FROM public.ai_generated_images child
    INNER JOIN children c ON child.parent_id = c.id
    WHERE child.deleted_at IS NULL
  )
  SELECT * FROM children
  ORDER BY version_number ASC;
END;
$$;


ALTER FUNCTION "public"."get_image_children"("p_image_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_image_version_chain"("p_image_id" "uuid") RETURNS TABLE("id" "uuid", "parent_id" "uuid", "version_number" integer, "prompt" "text", "edit_instruction" "text", "image_url" "text", "storage_path" "text", "created_at" timestamp with time zone, "generation_status" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE version_chain AS (
    -- Base case: find the root (earliest version)
    SELECT
      img.id,
      img.parent_id,
      img.version_number,
      img.prompt,
      img.edit_instruction,
      img.image_url,
      img.storage_path,
      img.created_at,
      img.generation_status
    FROM public.ai_generated_images img
    WHERE img.id = p_image_id

    UNION ALL

    -- Recursive case: find parent versions
    SELECT
      parent.id,
      parent.parent_id,
      parent.version_number,
      parent.prompt,
      parent.edit_instruction,
      parent.image_url,
      parent.storage_path,
      parent.created_at,
      parent.generation_status
    FROM public.ai_generated_images parent
    INNER JOIN version_chain vc ON parent.id = vc.parent_id
    WHERE parent.deleted_at IS NULL
  )
  SELECT * FROM version_chain
  ORDER BY version_number ASC;
END;
$$;


ALTER FUNCTION "public"."get_image_version_chain"("p_image_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_projects_with_sync_counts"() RETURNS TABLE("id" "uuid", "name" "text", "activecollab_project_id" "text", "activecollab_sync_at" timestamp with time zone, "task_count" bigint, "comment_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    p.id,
    p.name,
    p.activecollab_project_id,
    p.activecollab_sync_at,
    COUNT(DISTINCT pt.id) as task_count,
    COUNT(DISTINCT ptc.id) as comment_count
  FROM projects p
  LEFT JOIN project_tasks pt ON pt.project_id = p.id
  LEFT JOIN project_task_comments ptc ON ptc.task_id = pt.id
  WHERE p.activecollab_project_id IS NOT NULL
  GROUP BY p.id, p.name, p.activecollab_project_id, p.activecollab_sync_at
  ORDER BY p.name;
$$;


ALTER FUNCTION "public"."get_projects_with_sync_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (id, email, status, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'active', now(), now())
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hub_consolidate_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer DEFAULT 7) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.hub_agent_memories
  SET memory_type = 'long_term', consolidated = true
  WHERE
    agent_id = p_agent_id
    AND user_id = p_user_id
    AND memory_type = 'short_term'
    AND is_active = true
    AND access_count >= 1
    AND importance_score >= 0.3
    AND created_at < now() - (p_days_old || ' days')::interval;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."hub_consolidate_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hub_generate_conversation_title"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.role = 'user' THEN
    UPDATE public.hub_conversations
    SET title = CASE
      WHEN title IS NULL OR title = ''
      THEN LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END
      ELSE title
    END
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."hub_generate_conversation_title"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hub_get_relevant_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer DEFAULT 5, "p_threshold" double precision DEFAULT 0.6) RETURNS TABLE("id" "uuid", "content" "text", "memory_category" "text", "memory_type" "text", "importance_score" double precision, "similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    m.id,
    m.content,
    m.memory_category,
    m.memory_type,
    m.importance_score,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM public.hub_agent_memories m
  WHERE
    m.agent_id = p_agent_id
    AND m.user_id = p_user_id
    AND m.is_active = true
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> p_query_embedding) >= p_threshold
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."hub_get_relevant_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer, "p_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hub_increment_memory_access"("p_memory_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.hub_agent_memories
  SET
    access_count = access_count + 1,
    last_accessed_at = now()
  WHERE id = ANY(p_memory_ids);
$$;


ALTER FUNCTION "public"."hub_increment_memory_access"("p_memory_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hub_prune_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer DEFAULT 30, "p_importance_threshold" double precision DEFAULT 0.2) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.hub_agent_memories
  SET is_active = false
  WHERE
    agent_id = p_agent_id
    AND user_id = p_user_id
    AND memory_type = 'short_term'
    AND is_active = true
    AND access_count = 0
    AND importance_score < p_importance_threshold
    AND created_at < now() - (p_days_old || ' days')::interval;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."hub_prune_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer, "p_importance_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hub_update_conversation_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.hub_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  IF NEW.role = 'user' THEN
    UPDATE public.hub_agents
    SET usage_count = usage_count + 1
    WHERE id = (
      SELECT agent_id FROM public.hub_conversations WHERE id = NEW.conversation_id
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."hub_update_conversation_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_image_quota"("p_user_id" "uuid") RETURNS SETOF "public"."image_user_quotas"
    LANGUAGE "sql"
    AS $$
  UPDATE public.image_user_quotas
  SET
    current_daily_count = current_daily_count + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND (current_daily_count < daily_limit OR has_unlimited = true)
  RETURNING *;
$$;


ALTER FUNCTION "public"."increment_image_quota"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_image_quota"("p_user_id" "uuid") IS 'Atomically increment quota count, returns empty if quota exceeded';



CREATE OR REPLACE FUNCTION "public"."is_admin_or_superadmin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('super_admin'::app_role, 'manager'::app_role)
  )
$$;


ALTER FUNCTION "public"."is_admin_or_superadmin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
    AND role = 'super_admin'::app_role
  )
$$;


ALTER FUNCTION "public"."is_superadmin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_task_assigned_to"("task_id" "uuid", "user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_tasks
    WHERE id = task_id AND assigned_to = user_id
  );
$$;


ALTER FUNCTION "public"."is_task_assigned_to"("task_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_agent_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "content" "text", "memory_type" "text", "score" real, "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    m.id,
    m.content,
    m.memory_type,
    1 - (m.embedding <=> p_query_embedding) as score,
    m.metadata,
    m.created_at
  FROM public.agent_memories m
  WHERE m.agent_id = p_agent_id
    AND (m.user_id = p_user_id OR m.user_id IS NULL)
    AND (m.expires_at IS NULL OR m.expires_at > now())
  ORDER BY m.embedding <-> p_query_embedding
  LIMIT p_match_count;
$$;


ALTER FUNCTION "public"."match_agent_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_brand_knowledge_embeddings"("p_brand_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) RETURNS TABLE("file_id" "uuid", "chunk_index" integer, "chunk_text" "text", "score" double precision, "metadata" "jsonb")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    e.file_id,
    e.chunk_index,
    e.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    e.metadata
  FROM public.brand_knowledge_embeddings e
  WHERE e.brand_id = p_brand_id
  ORDER BY e.embedding <-> p_query_embedding
  LIMIT p_match_count;
$$;


ALTER FUNCTION "public"."match_brand_knowledge_embeddings"("p_brand_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_knowledge_embeddings"("p_category_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) RETURNS TABLE("file_id" "uuid", "score" double precision, "metadata" "jsonb")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    e.file_id,
    1 - (e.embedding <=> p_query_embedding) as score,
    e.metadata
  FROM public.knowledge_embeddings e
  WHERE e.category_id = p_category_id
  ORDER BY e.embedding <-> p_query_embedding
  LIMIT p_match_count;
$$;


ALTER FUNCTION "public"."match_knowledge_embeddings"("p_category_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_project_knowledge_embeddings"("p_project_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer DEFAULT 5) RETURNS TABLE("file_id" "uuid", "chunk_index" integer, "chunk_text" "text", "score" real, "metadata" "jsonb")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    e.file_id,
    e.chunk_index,
    e.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    e.metadata
  FROM public.project_knowledge_embeddings e
  WHERE e.project_id = p_project_id
  ORDER BY e.embedding <-> p_query_embedding
  LIMIT p_match_count;
$$;


ALTER FUNCTION "public"."match_project_knowledge_embeddings"("p_project_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_current_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_current_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_leader_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.url_slug IS NULL OR NEW.url_slug = '' THEN
    NEW.url_slug := generate_leader_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_leader_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."store_old_task_assigned_to"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM set_config('app.old_task_assigned_to', COALESCE(OLD.assigned_to::text, ''), true);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."store_old_task_assigned_to"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_bearer_token_from_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Auto-set bearer_token to email_base64 if not explicitly provided
  IF NEW.bearer_token IS NULL AND NEW.email_base64 IS NOT NULL THEN
    NEW.bearer_token := NEW.email_base64;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_bearer_token_from_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_user_login"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only insert if no login in the last 5 minutes for this user
  IF NOT EXISTS (
    SELECT 1 FROM public.user_login_tracking
    WHERE user_id = p_user_id
      AND login_at > now() - INTERVAL '5 minutes'
  ) THEN
    INSERT INTO public.user_login_tracking (user_id, login_at)
    VALUES (p_user_id, now());
  END IF;
END;
$$;


ALTER FUNCTION "public"."track_user_login"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_agent_memory_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_agent_memory_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_analytics_api_keys_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_analytics_api_keys_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_feedback_upvotes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback_reports 
    SET upvotes = upvotes + 1 
    WHERE id = NEW.feedback_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback_reports 
    SET upvotes = upvotes - 1 
    WHERE id = OLD.feedback_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_feedback_upvotes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_project_meetings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_project_meetings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_project_task"("p_task_id" "uuid", "p_updates" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_task RECORD;
  v_result JSONB;
  v_has_permission BOOLEAN := FALSE;
BEGIN
  -- Fetch the existing task (bypasses RLS due to SECURITY DEFINER)
  SELECT * INTO v_task FROM project_tasks WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  -- Permission check: mirrors the USING clause of the RLS policy
  -- Super admin, manager, or PM
  IF has_role(v_user_id, 'super_admin')
     OR has_role(v_user_id, 'manager')
     OR has_role(v_user_id, 'pm') THEN
    v_has_permission := TRUE;
  END IF;

  -- Currently assigned to the user
  IF NOT v_has_permission AND v_task.assigned_to = v_user_id THEN
    v_has_permission := TRUE;
  END IF;

  -- Created by the user
  IF NOT v_has_permission AND v_task.created_by = v_user_id THEN
    v_has_permission := TRUE;
  END IF;

  -- Project team member
  IF NOT v_has_permission AND v_task.project_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = v_task.project_id
        AND (p.project_manager = v_user_id OR v_user_id = ANY(p.assigned_team))
    ) THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  -- Brand access
  IF NOT v_has_permission AND v_task.brand_id IS NOT NULL THEN
    IF user_has_brand_access(v_user_id, v_task.brand_id) THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  -- Client access
  IF NOT v_has_permission AND v_task.client_id IS NOT NULL THEN
    IF user_has_client_access(v_user_id, v_task.client_id) THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Perform the update with only the provided fields
  UPDATE project_tasks SET
    title = COALESCE(p_updates->>'title', title),
    description = COALESCE(p_updates->>'description', description),
    status = COALESCE(p_updates->>'status', status),
    priority = COALESCE(p_updates->>'priority', priority),
    category = COALESCE(p_updates->>'category', category),
    brand_id = CASE
      WHEN p_updates ? 'brand_id' THEN (p_updates->>'brand_id')::UUID
      ELSE brand_id
    END,
    client_id = CASE
      WHEN p_updates ? 'client_id' THEN (p_updates->>'client_id')::UUID
      ELSE client_id
    END,
    assigned_to = CASE
      WHEN p_updates ? 'assigned_to' THEN (p_updates->>'assigned_to')::UUID
      ELSE assigned_to
    END,
    estimated_hours = CASE
      WHEN p_updates ? 'estimated_hours' THEN (p_updates->>'estimated_hours')::NUMERIC
      ELSE estimated_hours
    END,
    actual_hours = CASE
      WHEN p_updates ? 'actual_hours' THEN (p_updates->>'actual_hours')::NUMERIC
      ELSE actual_hours
    END,
    due_date = CASE
      WHEN p_updates ? 'due_date' THEN (p_updates->>'due_date')::TIMESTAMPTZ
      ELSE due_date
    END,
    completed_at = CASE
      WHEN p_updates ? 'completed_at' THEN (p_updates->>'completed_at')::TIMESTAMPTZ
      ELSE completed_at
    END
  WHERE id = p_task_id
  RETURNING to_jsonb(project_tasks.*) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_project_task"("p_task_id" "uuid", "p_updates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_role_permissions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_role_permissions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_seo_blog_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_seo_blog_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_testimonials_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_testimonials_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_brand_access"("_user_id" "uuid", "_brand_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brands
    WHERE id = _brand_id
      AND (
        owner_id = _user_id
        OR co_owner_id = _user_id
        OR _user_id = ANY(team_members)
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.user_brands
    WHERE user_id = _user_id
      AND brand_id = _brand_id
  )
$$;


ALTER FUNCTION "public"."user_has_brand_access"("_user_id" "uuid", "_brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_client_access"("_user_id" "uuid", "_client_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND (
        c.assigned_manager = _user_id
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.client_id = _client_id
            AND (
              p.project_manager = _user_id
              OR _user_id = ANY(p.assigned_team)
            )
        )
      )
  )
$$;


ALTER FUNCTION "public"."user_has_client_access"("_user_id" "uuid", "_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_project_access"("_user_id" "uuid", "_project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = _project_id
    AND (
      p.project_manager = _user_id
      OR _user_id = ANY(p.assigned_team)
    )
  );
$$;


ALTER FUNCTION "public"."user_has_project_access"("_user_id" "uuid", "_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_marketing_or_manager"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('super_admin'::app_role, 'manager'::app_role)
  );
$$;


ALTER FUNCTION "public"."user_is_marketing_or_manager"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wc_decide_round_winner"("p_round_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total INTEGER;
  v_unfinished INTEGER;
  v_winner RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM public.wc_round_winners WHERE round_key = p_round_key) THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status <> 'FINISHED' OR scored_at IS NULL)
  INTO v_total, v_unfinished
  FROM public.wc_matches
  WHERE round_key = p_round_key;

  IF v_total = 0 OR v_unfinished > 0 THEN
    RETURN NULL;
  END IF;

  WITH standings AS (
    SELECT
      p.user_id,
      COALESCE(SUM(p.points_awarded), 0)::INTEGER AS total_points,
      COUNT(*) FILTER (
        WHERE p.predicted_home = m.home_score AND p.predicted_away = m.away_score
      )::INTEGER AS exact_count,
      MAX(p.updated_at) AS last_pick_at
    FROM public.wc_predictions p
    JOIN public.wc_matches m ON m.id = p.match_id
    WHERE m.round_key = p_round_key AND m.status = 'FINISHED'
    GROUP BY p.user_id
  ),
  ranked AS (
    SELECT
      s.*,
      COALESCE(w.wins, 0) AS prior_wins,
      ROW_NUMBER() OVER (
        ORDER BY s.total_points DESC, s.exact_count DESC, COALESCE(w.wins, 0) ASC, s.last_pick_at ASC
      ) AS rn
    FROM standings s
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS wins
      FROM public.wc_round_winners
      GROUP BY user_id
    ) w ON w.user_id = s.user_id
  )
  SELECT
    f.user_id,
    f.total_points,
    f.exact_count,
    CASE
      WHEN r.user_id IS NULL OR f.total_points <> r.total_points THEN 'points'
      WHEN f.exact_count <> r.exact_count THEN 'exact_count'
      WHEN f.prior_wins <> r.prior_wins THEN 'fewest_past_wins'
      ELSE 'earliest_picks'
    END AS tiebreak_used
  INTO v_winner
  FROM ranked f
  LEFT JOIN ranked r ON r.rn = 2
  WHERE f.rn = 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.wc_round_winners (round_key, user_id, total_points, exact_count, tiebreak_used)
  VALUES (p_round_key, v_winner.user_id, v_winner.total_points, v_winner.exact_count, v_winner.tiebreak_used);

  RETURN v_winner.user_id;
END;
$$;


ALTER FUNCTION "public"."wc_decide_round_winner"("p_round_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wc_score_match"("p_match_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_match public.wc_matches%ROWTYPE;
  v_points_exact INTEGER;
  v_points_result INTEGER;
  v_scored INTEGER;
BEGIN
  SELECT * INTO v_match FROM public.wc_matches WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found', p_match_id;
  END IF;

  IF v_match.status <> 'FINISHED' OR v_match.home_score IS NULL OR v_match.away_score IS NULL THEN
    RAISE EXCEPTION 'Match % is not finished or has no result', p_match_id;
  END IF;

  SELECT points_exact, points_result INTO v_points_exact, v_points_result
  FROM public.wc_settings
  LIMIT 1;

  v_points_exact := COALESCE(v_points_exact, 3);
  v_points_result := COALESCE(v_points_result, 1);

  UPDATE public.wc_predictions p
  SET points_awarded = CASE
    WHEN p.predicted_home = v_match.home_score AND p.predicted_away = v_match.away_score
      THEN v_points_exact
    WHEN sign(p.predicted_home - p.predicted_away) = sign(v_match.home_score - v_match.away_score)
      THEN v_points_result
    ELSE 0
  END,
  updated_at = now()
  WHERE p.match_id = p_match_id;

  GET DIAGNOSTICS v_scored = ROW_COUNT;

  UPDATE public.wc_matches SET scored_at = now(), updated_at = now() WHERE id = p_match_id;

  RETURN v_scored;
END;
$$;


ALTER FUNCTION "public"."wc_score_match"("p_match_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."wc_score_match"("p_match_id" "uuid") IS 'Recomputes prediction points for a finished match; idempotent; service role only';



CREATE TABLE IF NOT EXISTS "public"."activecollab_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "password_encrypted" "text" NOT NULL,
    "api_url" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bearer_token" json,
    "email" "text"
);


ALTER TABLE "public"."activecollab_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activecollab_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_type" "text" NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_count" integer DEFAULT 0,
    "error_message" "text",
    "triggered_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activecollab_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activecollab_task_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_task_id" "text" NOT NULL,
    "project_id" "uuid",
    "task_name" "text" NOT NULL,
    "assignee_id" "uuid",
    "status" "text",
    "last_comment" "text",
    "last_comment_date" timestamp with time zone,
    "hours_logged" numeric DEFAULT 0,
    "sync_date" "date" NOT NULL,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activecollab_task_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "deal_id" "uuid",
    "hubspot_id" "text",
    "activity_type" "text" NOT NULL,
    "subject" "text",
    "body" "text",
    "outcome" "text",
    "activity_date" timestamp with time zone,
    "duration_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activities_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['email'::"text", 'meeting'::"text", 'call'::"text", 'note'::"text", 'task'::"text"])))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_google_drive_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "folder_id" "text" NOT NULL,
    "category" "text",
    "last_synced" timestamp with time zone,
    "file_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."admin_google_drive_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agent_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "executed_by" "uuid",
    "execution_context" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_tasks" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'completed'::"text",
    "approval_status" "text" DEFAULT 'pending'::"text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "category" "text",
    "title" "text",
    "business_context" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "cost_usd" numeric(10,6),
    "total_tokens" integer,
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "model_provider" "text",
    "model_version" "text",
    "execution_time_ms" integer
);


ALTER TABLE "public"."ai_agent_runs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."agent_cost_summary" AS
 SELECT "executed_by",
    "count"(*) AS "total_runs",
    COALESCE("sum"("cost_usd"), (0)::numeric) AS "total_cost_usd",
        CASE
            WHEN ("count"(*) > 0) THEN (COALESCE("sum"("cost_usd"), (0)::numeric) / ("count"(*))::numeric)
            ELSE (0)::numeric
        END AS "avg_cost_per_run",
    "date_trunc"('day'::"text", "now"()) AS "report_date"
   FROM "public"."ai_agent_runs"
  WHERE ("created_at" >= ("now"() - '30 days'::interval))
  GROUP BY "executed_by";


ALTER VIEW "public"."agent_cost_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."agent_daily_cost_stats" AS
 SELECT ("date_trunc"('day'::"text", "created_at"))::"date" AS "day",
    "count"(*) AS "total_runs",
    COALESCE("sum"("cost_usd"), (0)::numeric) AS "total_cost_usd",
    COALESCE("sum"("total_tokens"), (0)::bigint) AS "total_tokens",
    "count"(DISTINCT "executed_by") AS "unique_users"
   FROM "public"."ai_agent_runs"
  WHERE ("created_at" >= ("now"() - '90 days'::interval))
  GROUP BY ("date_trunc"('day'::"text", "created_at"));


ALTER VIEW "public"."agent_daily_cost_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_execution_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "step_number" integer NOT NULL,
    "action_type" "text" NOT NULL,
    "tool_name" "text",
    "tool_input" "jsonb",
    "tool_result" "jsonb",
    "reasoning" "text",
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cost_usd" numeric(10,6),
    "tokens_used" integer,
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "model_used" "text",
    CONSTRAINT "agent_execution_steps_action_type_check" CHECK (("action_type" = ANY (ARRAY['think'::"text", 'tool_call'::"text", 'tool_result'::"text", 'human_approval'::"text", 'complete'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."agent_execution_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "memory_type" "text" DEFAULT 'conversation'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_pending_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "step_id" "uuid",
    "action_type" "text" NOT NULL,
    "action_payload" "jsonb" NOT NULL,
    "risk_level" "text" DEFAULT 'medium'::"text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "requested_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution" "text",
    "resolution_notes" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval),
    CONSTRAINT "agent_pending_approvals_resolution_check" CHECK (("resolution" = ANY (ARRAY['approved'::"text", 'rejected'::"text", 'expired'::"text", 'auto_approved'::"text"]))),
    CONSTRAINT "agent_pending_approvals_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."agent_pending_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_session_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "user_id" "uuid",
    "memory_key" "text" NOT NULL,
    "memory_value" "jsonb" NOT NULL,
    "memory_type" "text" DEFAULT 'context'::"text",
    "importance_score" real DEFAULT 0.5,
    "access_count" integer DEFAULT 0,
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_session_memory_memory_type_check" CHECK (("memory_type" = ANY (ARRAY['context'::"text", 'preference'::"text", 'pattern'::"text", 'blocker'::"text", 'trend'::"text"])))
);


ALTER TABLE "public"."agent_session_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_tool_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tool_name" "text" NOT NULL,
    "trigger_type" "text" NOT NULL,
    "input" "text" NOT NULL,
    "result_json" "jsonb" NOT NULL,
    "brand_id" "uuid",
    "project_id" "uuid",
    "agent_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "execution_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_tool_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_tool_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "tool_name" "text" NOT NULL,
    "tool_description" "text" NOT NULL,
    "tool_category" "text" DEFAULT 'general'::"text",
    "parameters_schema" "jsonb" NOT NULL,
    "requires_approval" boolean DEFAULT false,
    "is_enabled" boolean DEFAULT true,
    "usage_count" integer DEFAULT 0,
    "avg_execution_time_ms" real,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_tool_definitions_tool_category_check" CHECK (("tool_category" = ANY (ARRAY['read'::"text", 'write'::"text", 'external'::"text", 'approval_required'::"text"])))
);


ALTER TABLE "public"."agent_tool_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agent_knowledge_selection" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "priority" integer DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_agent_knowledge_selection_priority_check" CHECK ((("priority" >= 0) AND ("priority" <= 10)))
);


ALTER TABLE "public"."ai_agent_knowledge_selection" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_agent_knowledge_selection" IS 'Tracks which knowledge categories each AI agent can access, with priority weighting for relevance';



COMMENT ON COLUMN "public"."ai_agent_knowledge_selection"."priority" IS 'Priority level from 0-10, where 10 is highest importance for the agent';



CREATE TABLE IF NOT EXISTS "public"."ai_agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "data_sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "required_role" "public"."app_role" DEFAULT 'manager'::"public"."app_role",
    "schedule_config" "jsonb" DEFAULT '{}'::"jsonb",
    "output_actions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "scope" "text" DEFAULT 'global'::"text",
    "config" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."ai_agents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ai_agents"."scope" IS 'Defines where this agent can be run: brand, project, operations, or global';



CREATE TABLE IF NOT EXISTS "public"."ai_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "configuration_type" "text" NOT NULL,
    "configuration_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."ai_configurations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_generated_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prompt" "text" NOT NULL,
    "size" "text" DEFAULT '1024x1024'::"text",
    "style" "text",
    "image_url" "text",
    "provider" "text" DEFAULT 'Gemini'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    "error_type" "text",
    "error_message" "text",
    "error_details" "jsonb",
    "status" "text" DEFAULT 'completed'::"text",
    "parent_id" "uuid",
    "version_number" integer DEFAULT 1,
    "edit_instruction" "text",
    "generation_status" "text" DEFAULT 'pending'::"text",
    "request_id" "uuid",
    "cost_cents" numeric(10,6) DEFAULT 0,
    "generation_time_ms" integer,
    "model_name" "text" DEFAULT 'gemini-2.5-flash-image'::"text",
    "storage_path" "text",
    "storage_bucket" "text" DEFAULT 'ai-images'::"text",
    "synthid_embedded" boolean DEFAULT true,
    "aspect_ratio" "text",
    "safety_scores" "jsonb",
    "is_shared" boolean DEFAULT false,
    "shared_folder_id" "uuid",
    "deleted_at" timestamp with time zone,
    "image_hash" "text",
    "override_used" boolean DEFAULT false,
    "override_by" "uuid",
    CONSTRAINT "ai_generated_images_generation_status_check" CHECK (("generation_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "ai_generated_images_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'failed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."ai_generated_images" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ai_generated_images"."error_type" IS 'Type of error: content_safety, api_error, quota_exceeded, validation_error, unexpected_error';



COMMENT ON COLUMN "public"."ai_generated_images"."error_message" IS 'User-friendly error message';



COMMENT ON COLUMN "public"."ai_generated_images"."error_details" IS 'Full error details from Gemini API for debugging';



COMMENT ON COLUMN "public"."ai_generated_images"."status" IS 'Generation status: completed, failed, or blocked';



COMMENT ON COLUMN "public"."ai_generated_images"."parent_id" IS 'Reference to parent image for edit chains';



COMMENT ON COLUMN "public"."ai_generated_images"."version_number" IS 'Version number in edit chain (1 = original)';



COMMENT ON COLUMN "public"."ai_generated_images"."edit_instruction" IS 'User instruction for this edit';



COMMENT ON COLUMN "public"."ai_generated_images"."generation_status" IS 'Current generation status: pending, processing, completed, failed';



COMMENT ON COLUMN "public"."ai_generated_images"."request_id" IS 'Client-generated UUID for idempotency';



COMMENT ON COLUMN "public"."ai_generated_images"."cost_cents" IS 'Generation cost in cents (resolution-based)';



COMMENT ON COLUMN "public"."ai_generated_images"."storage_path" IS 'Path in Supabase Storage bucket (never store blobs in DB)';



COMMENT ON COLUMN "public"."ai_generated_images"."synthid_embedded" IS 'Whether SynthID watermark is present';



COMMENT ON COLUMN "public"."ai_generated_images"."deleted_at" IS 'Soft delete timestamp';



COMMENT ON COLUMN "public"."ai_generated_images"."image_hash" IS 'SHA256 hash for deduplication';



CREATE TABLE IF NOT EXISTS "public"."ai_shared_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_name" "text" NOT NULL,
    "openai_resource_id" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."ai_shared_resources" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_shared_resources" IS 'Stores shared AI resources like vector stores for multi-agent systems';



COMMENT ON COLUMN "public"."ai_shared_resources"."openai_resource_id" IS 'OpenAI resource ID (e.g., vs_xxx for vector stores)';



CREATE TABLE IF NOT EXISTS "public"."analytics_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_name" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "rate_limit_per_minute" integer DEFAULT 100,
    "allowed_actions" "text"[] DEFAULT '{}'::"text"[],
    "last_used_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."analytics_api_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytics_api_keys" IS 'API keys for external analytics API access (hashed, revocable, per-client rate limits)';



COMMENT ON COLUMN "public"."analytics_api_keys"."key_hash" IS 'SHA-256 hex hash of the raw API key — raw key is never stored';



COMMENT ON COLUMN "public"."analytics_api_keys"."allowed_actions" IS 'Empty array = all actions allowed; otherwise restricts to listed actions';



COMMENT ON COLUMN "public"."analytics_api_keys"."expires_at" IS 'Optional expiry timestamp. NULL = never expires. Expired keys return 401.';



CREATE TABLE IF NOT EXISTS "public"."api_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_key_hash" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_analytics_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "integration_id" "uuid",
    "data_type" "text" NOT NULL,
    "date_range_start" "date" NOT NULL,
    "date_range_end" "date" NOT NULL,
    "metrics" "jsonb" NOT NULL,
    "dimensions" "jsonb" DEFAULT '{}'::"jsonb",
    "raw_data" "jsonb",
    "received_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_analytics_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_analytics_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "integration_type" "text" DEFAULT 'n8n_analytics'::"text" NOT NULL,
    "webhook_url" "text" NOT NULL,
    "webhook_secret" "text",
    "n8n_workflow_id" "text",
    "is_active" boolean DEFAULT true,
    "last_sync_at" timestamp with time zone,
    "sync_frequency" "text" DEFAULT 'daily'::"text",
    "data_sources" "jsonb" DEFAULT '{"google_analytics": true}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "ga4_property_id" "text",
    "access_token_encrypted" "text",
    "refresh_token_encrypted" "text",
    "token_expires_at" timestamp with time zone,
    "service_account_email" "text",
    "service_account_key_encrypted" "text",
    "metrics_config" "jsonb" DEFAULT '{"users": true, "sessions": true, "pageviews": true, "conversions": true}'::"jsonb"
);


ALTER TABLE "public"."brand_analytics_integrations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."brand_analytics_integrations_safe" AS
 SELECT "id",
    "brand_id",
    "integration_type",
    "webhook_url",
    "n8n_workflow_id",
    "is_active",
    "last_sync_at",
    "sync_frequency",
    "data_sources",
    "ga4_property_id",
    "token_expires_at",
    "service_account_email",
    "metrics_config",
    "metadata",
    "created_at",
    "updated_at",
    "created_by"
   FROM "public"."brand_analytics_integrations";


ALTER VIEW "public"."brand_analytics_integrations_safe" OWNER TO "postgres";


COMMENT ON VIEW "public"."brand_analytics_integrations_safe" IS 'Safe view of brand_analytics_integrations excluding sensitive columns: webhook_secret, access_token_encrypted, refresh_token_encrypted, service_account_key_encrypted. Only admin/superadmin can access the base table.';



CREATE TABLE IF NOT EXISTS "public"."brand_file_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_file_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_generated_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "leader_id" "uuid",
    "source_type" "text" NOT NULL,
    "source_reference" "uuid",
    "post_title" "text" NOT NULL,
    "post_body" "text" NOT NULL,
    "extra_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_generated_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_knowledge_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "chunk_index" integer DEFAULT 0 NOT NULL,
    "chunk_text" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_knowledge_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_knowledge_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_summary" "text",
    "file_type" "text" DEFAULT 'upload'::"text" NOT NULL,
    "file_size" bigint,
    "mime_type" "text",
    "openai_file_id" "text",
    "openai_vector_store_id" "text",
    "file_indexed_at" timestamp with time zone,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding_count" integer DEFAULT 0,
    "reindex_required" boolean DEFAULT false
);


ALTER TABLE "public"."brand_knowledge_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_kpis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "description" "text",
    "current_value" numeric DEFAULT 0 NOT NULL,
    "target_value" numeric,
    "source" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "brand_kpis_type_check" CHECK (("type" = ANY (ARRAY['number'::"text", 'percentage'::"text", 'currency'::"text"])))
);


ALTER TABLE "public"."brand_kpis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "logo_url" "text",
    "website_url" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" DEFAULT 'internal'::"text",
    "owner_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true,
    "team_members" "uuid"[] DEFAULT '{}'::"uuid"[],
    "active_integrations" "text"[] DEFAULT '{}'::"text"[],
    "monthly_budget" numeric,
    "co_owner_id" "uuid",
    "linkedin_settings" "jsonb",
    CONSTRAINT "brands_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'archived'::"text"]))),
    CONSTRAINT "brands_type_check" CHECK (("type" = ANY (ARRAY['internal'::"text", 'client'::"text"])))
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


COMMENT ON COLUMN "public"."brands"."owner_id" IS 'Required: Every brand must have an owner (manager or super_admin)';



COMMENT ON COLUMN "public"."brands"."co_owner_id" IS 'Optional secondary owner of the brand';



COMMENT ON COLUMN "public"."brands"."linkedin_settings" IS 'LinkedIn generator voice/audience settings (app-enforced shape).';



CREATE TABLE IF NOT EXISTS "public"."client_communications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "type" "text" DEFAULT 'email'::"text" NOT NULL,
    "subject" "text",
    "content" "text",
    "direction" "text" DEFAULT 'outbound'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_communications_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"]))),
    CONSTRAINT "client_communications_type_check" CHECK (("type" = ANY (ARRAY['email'::"text", 'call'::"text", 'meeting'::"text", 'note'::"text"])))
);


ALTER TABLE "public"."client_communications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_testimonials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "brand_id" "uuid",
    "project_id" "uuid",
    "type" "text" DEFAULT 'written_quote'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending_outreach'::"text" NOT NULL,
    "content" "text",
    "video_url" "text",
    "external_url" "text",
    "client_name" "text" NOT NULL,
    "client_title" "text",
    "company_name" "text",
    "sentiment_score" integer,
    "detected_from" "text",
    "source_reference" "text",
    "positive_signals" "text"[],
    "last_signal" "text",
    "assigned_to" "uuid",
    "requested_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_testimonials_sentiment_score_check" CHECK ((("sentiment_score" >= 0) AND ("sentiment_score" <= 100))),
    CONSTRAINT "client_testimonials_status_check" CHECK (("status" = ANY (ARRAY['pending_outreach'::"text", 'requested'::"text", 'received'::"text", 'approved'::"text", 'published'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "client_testimonials_type_check" CHECK (("type" = ANY (ARRAY['google_review'::"text", 'written_quote'::"text", 'video'::"text", 'linkedin'::"text", 'case_study'::"text"])))
);


ALTER TABLE "public"."client_testimonials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "company" "text",
    "website" "text",
    "contact_person" "text",
    "address" "text",
    "city" "text",
    "country" "text",
    "industry" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "satisfaction_score" integer,
    "total_revenue" numeric(10,2) DEFAULT 0,
    "assigned_manager" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hubspot_id" "text",
    "hubspot_sync_status" "text" DEFAULT 'never_synced'::"text",
    "hubspot_last_sync" timestamp with time zone,
    "hubspot_sync_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "source" "text" DEFAULT 'manual'::"text",
    "data_completeness_score" numeric(5,2),
    "company_revenue" numeric(15,2),
    "monthly_billing" numeric(15,2),
    "team_size" integer,
    "founded_year" integer,
    "state" "text",
    CONSTRAINT "clients_data_completeness_score_check" CHECK ((("data_completeness_score" >= (0)::numeric) AND ("data_completeness_score" <= (100)::numeric))),
    CONSTRAINT "clients_hubspot_sync_status_check" CHECK (("hubspot_sync_status" = ANY (ARRAY['never_synced'::"text", 'synced'::"text", 'error'::"text", 'pending'::"text"]))),
    CONSTRAINT "clients_satisfaction_score_check" CHECK ((("satisfaction_score" >= 0) AND ("satisfaction_score" <= 100))),
    CONSTRAINT "clients_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'hubspot'::"text", 'import'::"text"]))),
    CONSTRAINT "clients_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'prospect'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."code_analysis_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid" NOT NULL,
    "analysis_type" "text" NOT NULL,
    "file_path" "text",
    "findings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "severity" "text",
    "status" "text" DEFAULT 'active'::"text",
    "agent_run_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "code_analysis_results_analysis_type_check" CHECK (("analysis_type" = ANY (ARRAY['architecture'::"text", 'quality'::"text", 'security'::"text", 'performance'::"text", 'documentation'::"text"]))),
    CONSTRAINT "code_analysis_results_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'critical'::"text"]))),
    CONSTRAINT "code_analysis_results_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'resolved'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."code_analysis_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."code_generation_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "template_content" "text" NOT NULL,
    "variables" "jsonb" DEFAULT '{}'::"jsonb",
    "framework" "text",
    "language" "text" DEFAULT 'typescript'::"text",
    "is_active" boolean DEFAULT true,
    "usage_count" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "code_generation_templates_category_check" CHECK (("category" = ANY (ARRAY['component'::"text", 'hook'::"text", 'api'::"text", 'test'::"text", 'utility'::"text", 'page'::"text"])))
);


ALTER TABLE "public"."code_generation_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."code_repositories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "repository_url" "text",
    "branch" "text" DEFAULT 'main'::"text",
    "language" "text",
    "framework" "text",
    "last_analyzed_at" timestamp with time zone,
    "analysis_status" "text" DEFAULT 'pending'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "code_repositories_analysis_status_check" CHECK (("analysis_status" = ANY (ARRAY['pending'::"text", 'analyzing'::"text", 'completed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."code_repositories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "hubspot_id" "text",
    "hubspot_sync_status" "text" DEFAULT 'never_synced'::"text",
    "hubspot_last_sync" timestamp with time zone,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "job_title" "text",
    "title" "text",
    "lifecycle_stage" "text",
    "lead_status" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contacts_hubspot_sync_status_check" CHECK (("hubspot_sync_status" = ANY (ARRAY['never_synced'::"text", 'synced'::"text", 'error'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_performance_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "leader_id" "uuid",
    "engagement_score" integer DEFAULT 0,
    "reach_count" integer DEFAULT 0,
    "impressions" integer DEFAULT 0,
    "comment_quality_score" integer,
    "conversion_actions" integer DEFAULT 0,
    "hook_style" "text",
    "post_type" "text",
    "posted_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "audience" "text",
    "post_url" "text",
    CONSTRAINT "content_performance_metrics_comment_quality_score_check" CHECK ((("comment_quality_score" >= 1) AND ("comment_quality_score" <= 10)))
);


ALTER TABLE "public"."content_performance_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_repurpose_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pack_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "asset_type" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "edited_content" "text",
    "quality_score" numeric,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_repurpose_assets_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'needs_review'::"text", 'approved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."content_repurpose_assets" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_repurpose_assets" IS 'Generated marketing assets per repurposing pack.';



CREATE TABLE IF NOT EXISTS "public"."content_repurpose_packs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "context_type" "text" NOT NULL,
    "brand_id" "uuid",
    "project_id" "uuid",
    "title" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_content" "text",
    "source_url" "text",
    "source_file_path" "text",
    "source_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "angles" "jsonb" DEFAULT '[]'::"jsonb",
    "selected_angles" "jsonb" DEFAULT '[]'::"jsonb",
    "options" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "quality_review" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_repurpose_packs_context_check" CHECK (((("context_type" = 'brand'::"text") AND ("brand_id" IS NOT NULL) AND ("project_id" IS NULL)) OR (("context_type" = 'project'::"text") AND ("project_id" IS NOT NULL) AND ("brand_id" IS NULL)))),
    CONSTRAINT "content_repurpose_packs_context_type_check" CHECK (("context_type" = ANY (ARRAY['brand'::"text", 'project'::"text"]))),
    CONSTRAINT "content_repurpose_packs_source_type_check" CHECK (("source_type" = ANY (ARRAY['text'::"text", 'url'::"text", 'file'::"text"]))),
    CONSTRAINT "content_repurpose_packs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'analyzed'::"text", 'generating'::"text", 'review'::"text", 'approved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."content_repurpose_packs" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_repurpose_packs" IS 'Content repurposing projects: one source in, many channel assets out.';



CREATE TABLE IF NOT EXISTS "public"."content_repurpose_performance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "leads" integer DEFAULT 0,
    "engagement_rate" numeric,
    "notes" "text",
    "published_at" timestamp with time zone,
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_repurpose_performance" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_repurpose_performance" IS 'Manual or imported performance metrics for published repurposed assets.';



CREATE TABLE IF NOT EXISTS "public"."control_tower_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_name" "text" NOT NULL,
    "api_key_encrypted" "text" NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone,
    "rate_limit_per_hour" integer DEFAULT 1000
);


ALTER TABLE "public"."control_tower_api_keys" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."control_tower_api_keys_safe" AS
 SELECT "id",
    "key_name",
    "scopes",
    "is_active",
    "created_by",
    "created_at",
    "updated_at",
    "last_used_at",
    "rate_limit_per_hour"
   FROM "public"."control_tower_api_keys";


ALTER VIEW "public"."control_tower_api_keys_safe" OWNER TO "postgres";


COMMENT ON VIEW "public"."control_tower_api_keys_safe" IS 'Safe view of control_tower_api_keys excluding api_key_encrypted. Only superadmin can access the base table.';



CREATE TABLE IF NOT EXISTS "public"."control_tower_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_type" "text" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "records_fetched" integer DEFAULT 0,
    "records_synced" integer DEFAULT 0,
    "records_failed" integer DEFAULT 0,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "triggered_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."control_tower_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_head_starts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "goals" "text",
    "priorities" "text"[],
    "blockers" "text",
    "mood" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_head_starts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "hubspot_id" "text",
    "hubspot_created_at" timestamp with time zone,
    "hubspot_updated_at" timestamp with time zone,
    "name" "text" NOT NULL,
    "amount" numeric(15,2),
    "stage" "text",
    "pipeline" "text",
    "probability" numeric(5,2),
    "close_date" "date",
    "deal_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "deals_probability_check" CHECK ((("probability" >= (0)::numeric) AND ("probability" <= (100)::numeric)))
);


ALTER TABLE "public"."deals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deep_research_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid",
    "project_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "query" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "result_json" "jsonb" NOT NULL,
    "tokens_used" integer,
    "execution_ms" integer,
    "saved_to_kb" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deep_research_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documentation_output_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "formats" "text"[] DEFAULT ARRAY['markdown'::"text"],
    "save_to_repo" boolean DEFAULT false,
    "save_to_knowledge_base" boolean DEFAULT true,
    "output_path" "text" DEFAULT 'docs/generated/'::"text",
    "include_code_examples" boolean DEFAULT true,
    "include_diagrams" boolean DEFAULT false,
    "verbosity_level" "text" DEFAULT 'standard'::"text",
    "target_audience" "text" DEFAULT 'developers'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "documentation_output_config_target_audience_check" CHECK (("target_audience" = ANY (ARRAY['developers'::"text", 'end-users'::"text", 'both'::"text"]))),
    CONSTRAINT "documentation_output_config_verbosity_level_check" CHECK (("verbosity_level" = ANY (ARRAY['concise'::"text", 'standard'::"text", 'detailed'::"text"])))
);


ALTER TABLE "public"."documentation_output_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."documentation_output_config" IS 'Output configuration settings';



CREATE TABLE IF NOT EXISTS "public"."documentation_repository_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "repository_id" "uuid",
    "target_branch" "text" DEFAULT 'main'::"text",
    "include_patterns" "text"[] DEFAULT ARRAY['**/*.ts'::"text", '**/*.tsx'::"text", '**/*.js'::"text", '**/*.jsx'::"text"],
    "exclude_patterns" "text"[] DEFAULT ARRAY['node_modules/**'::"text", '**/*.test.*'::"text", '**/*.spec.*'::"text", 'dist/**'::"text"],
    "auto_sync" boolean DEFAULT false,
    "last_synced_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."documentation_repository_links" OWNER TO "postgres";


COMMENT ON TABLE "public"."documentation_repository_links" IS 'Links between Documentation Generator and code repositories';



CREATE TABLE IF NOT EXISTS "public"."documentation_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "rule_name" "text" NOT NULL,
    "rule_type" "text" NOT NULL,
    "rule_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "documentation_rules_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['required_sections'::"text", 'forbidden_words'::"text", 'conventions'::"text", 'cross_references'::"text"])))
);


ALTER TABLE "public"."documentation_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."documentation_rules" IS 'Custom rules and conventions for documentation generation';



CREATE TABLE IF NOT EXISTS "public"."documentation_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_name" "text" NOT NULL,
    "doc_category" "text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "output_format" "text" DEFAULT 'markdown'::"text",
    "sections_template" "jsonb" DEFAULT '[]'::"jsonb",
    "example_output" "text",
    "variables" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "usage_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "documentation_templates_doc_category_check" CHECK (("doc_category" = ANY (ARRAY['api'::"text", 'component'::"text", 'architecture'::"text", 'setup'::"text", 'readme'::"text", 'changelog'::"text", 'inline_comments'::"text", 'tutorial'::"text", 'brand_voice'::"text", 'playbook'::"text", 'campaign'::"text", 'sop'::"text", 'social_guidelines'::"text", 'onboarding'::"text"]))),
    CONSTRAINT "documentation_templates_output_format_check" CHECK (("output_format" = ANY (ARRAY['markdown'::"text", 'html'::"text", 'jsdoc'::"text", 'openapi'::"text", 'docusaurus'::"text"])))
);


ALTER TABLE "public"."documentation_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."documentation_templates" IS 'Templates for different types of documentation';



CREATE TABLE IF NOT EXISTS "public"."email_notifications_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_email" "text" NOT NULL,
    "recipient_user_id" "uuid",
    "email_type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "error_message" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."email_notifications_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_send_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_email" "text" NOT NULL,
    "recipient_user_id" "uuid",
    "email_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider" "text" DEFAULT 'sendgrid'::"text" NOT NULL,
    "provider_message_id" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_send_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_user_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_user_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "text" NOT NULL,
    "email" "text",
    "first_name" "text",
    "last_name" "text",
    "full_name" "text" GENERATED ALWAYS AS ((("first_name" || ' '::"text") || "last_name")) STORED,
    "title" "text",
    "department" "text",
    "location" "text",
    "phone" "text",
    "role" "text",
    "reporting_manager_id" "text",
    "reporting_manager_email" "text",
    "reporting_manager_name" "text",
    "dotted_line_manager_email" "text",
    "is_active" boolean DEFAULT true,
    "api_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimate_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "estimate_id" "uuid",
    "service_id" "uuid",
    "service_name" "text" NOT NULL,
    "base_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "effort_hours" numeric(6,2) DEFAULT 0 NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "final_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "requirements_html" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "estimate_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."estimate_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_name" "text",
    "project_name" "text" NOT NULL,
    "billing_type" "text" DEFAULT 'one_time'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "total_hours" numeric(8,2) DEFAULT 0,
    "total_price" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "is_template" boolean DEFAULT false,
    "template_name" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "estimates_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['one_time'::"text", 'monthly'::"text"]))),
    CONSTRAINT "estimates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'approved'::"text", 'rejected'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."estimates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gemini_videos" (
    "id" "text" NOT NULL,
    "operation_name" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "duration" integer,
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "video_url" "text",
    "thumbnail_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "error" "jsonb",
    "user_id" "uuid",
    "aspect_ratio" "text" DEFAULT '16:9'::"text",
    "resolution" "text" DEFAULT '720p'::"text",
    "negative_prompt" "text",
    "has_audio" boolean DEFAULT true,
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."gemini_videos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sora_videos" (
    "id" "text" NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "brand_id" "uuid",
    "prompt" "text" NOT NULL,
    "model" "text" DEFAULT 'sora-2'::"text",
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "video_url" "text",
    "thumbnail_url" "text",
    "duration" integer,
    "aspect_ratio" "text",
    "resolution" "text",
    "has_audio" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "error" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "storage_path" "text",
    "file_size_bytes" bigint,
    "thumbnail_storage_path" "text"
);


ALTER TABLE "public"."sora_videos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sora_videos"."video_url" IS 'Permanent Supabase Storage URL';



COMMENT ON COLUMN "public"."sora_videos"."thumbnail_url" IS 'Permanent Supabase Storage URL for thumbnail';



COMMENT ON COLUMN "public"."sora_videos"."storage_path" IS 'Storage bucket path: {user_id}/{video_id}.mp4';



COMMENT ON COLUMN "public"."sora_videos"."thumbnail_storage_path" IS 'Storage bucket path for thumbnail';



CREATE OR REPLACE VIEW "public"."feature_usage_summary" AS
 SELECT "feature",
    "sum"("usage_count") AS "usage_count",
    "sum"("cost_usd") AS "cost_usd"
   FROM ( SELECT
                CASE
                    WHEN ("a"."slug" ~~ 'linkedin%'::"text") THEN 'LinkedIn Content'::"text"
                    WHEN (("a"."slug" ~~ 'seo%'::"text") OR ("a"."slug" ~~ '%blog%'::"text")) THEN 'SEO Blog'::"text"
                    WHEN ("a"."slug" ~~ '%newsletter%'::"text") THEN 'Newsletter'::"text"
                    WHEN (("a"."slug" ~~ '%email%'::"text") OR ("a"."slug" ~~ '%client%'::"text")) THEN 'Client Email'::"text"
                    ELSE 'Other AI Agents'::"text"
                END AS "feature",
            "count"(*) AS "usage_count",
            COALESCE("sum"("r"."cost_usd"), (0)::numeric) AS "cost_usd"
           FROM ("public"."ai_agent_runs" "r"
             JOIN "public"."ai_agents" "a" ON (("a"."id" = "r"."agent_id")))
          WHERE ("r"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY
                CASE
                    WHEN ("a"."slug" ~~ 'linkedin%'::"text") THEN 'LinkedIn Content'::"text"
                    WHEN (("a"."slug" ~~ 'seo%'::"text") OR ("a"."slug" ~~ '%blog%'::"text")) THEN 'SEO Blog'::"text"
                    WHEN ("a"."slug" ~~ '%newsletter%'::"text") THEN 'Newsletter'::"text"
                    WHEN (("a"."slug" ~~ '%email%'::"text") OR ("a"."slug" ~~ '%client%'::"text")) THEN 'Client Email'::"text"
                    ELSE 'Other AI Agents'::"text"
                END
        UNION ALL
         SELECT 'Image Generation'::"text" AS "feature",
            "count"(*) AS "usage_count",
            0 AS "cost_usd"
           FROM "public"."ai_generated_images"
          WHERE ("ai_generated_images"."created_at" >= ("now"() - '90 days'::interval))
        UNION ALL
         SELECT 'Video (Sora)'::"text" AS "feature",
            "count"(*) AS "usage_count",
            0 AS "cost_usd"
           FROM "public"."sora_videos"
          WHERE ("sora_videos"."created_at" >= ("now"() - '90 days'::interval))
        UNION ALL
         SELECT 'Video (Gemini Veo)'::"text" AS "feature",
            "count"(*) AS "usage_count",
            0 AS "cost_usd"
           FROM "public"."gemini_videos"
          WHERE ("gemini_videos"."created_at" >= ("now"() - '90 days'::interval))) "features"
  GROUP BY "feature";


ALTER VIEW "public"."feature_usage_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feedback_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "email" "text",
    "attachment_url" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "feedback_number" integer NOT NULL,
    "module" "text" DEFAULT 'General'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "upvotes" integer DEFAULT 0,
    "converted_task_id" "uuid",
    CONSTRAINT "feedback_reports_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "feedback_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_review'::"text", 'resolved'::"text", 'closed'::"text"]))),
    CONSTRAINT "feedback_reports_type_check" CHECK (("type" = ANY (ARRAY['bug'::"text", 'feature'::"text"])))
);


ALTER TABLE "public"."feedback_reports" OWNER TO "postgres";


COMMENT ON COLUMN "public"."feedback_reports"."converted_task_id" IS 'Reference to the project_task created from this feedback item. Prevents duplicate conversions.';



CREATE SEQUENCE IF NOT EXISTS "public"."feedback_reports_feedback_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."feedback_reports_feedback_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."feedback_reports_feedback_number_seq" OWNED BY "public"."feedback_reports"."feedback_number";



CREATE TABLE IF NOT EXISTS "public"."feedback_upvotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feedback_upvotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leader_id" "uuid" NOT NULL,
    "source_type" "public"."linkedin_post_source" DEFAULT 'custom'::"public"."linkedin_post_source" NOT NULL,
    "source_reference" "uuid",
    "post_title" "text" NOT NULL,
    "post_body" "text" NOT NULL,
    "extra_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "post_type" "text",
    "scheduled_for" timestamp with time zone,
    "published_at" timestamp with time zone,
    "linkedin_post_url" "text",
    CONSTRAINT "generated_posts_post_type_check" CHECK (("post_type" = ANY (ARRAY['teaching'::"text", 'opinion'::"text", 'how_to'::"text"]))),
    CONSTRAINT "generated_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."generated_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gohighlevel_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "contact_id" "text" NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gohighlevel_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gohighlevel_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "api_key_encrypted" "text" NOT NULL,
    "location_id" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gohighlevel_integrations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."gohighlevel_integrations_safe" AS
 SELECT "id",
    "user_id",
    "location_id",
    "is_active",
    "created_at",
    "updated_at"
   FROM "public"."gohighlevel_integrations";


ALTER VIEW "public"."gohighlevel_integrations_safe" OWNER TO "postgres";


COMMENT ON VIEW "public"."gohighlevel_integrations_safe" IS 'Safe view of gohighlevel_integrations excluding api_key_encrypted. Only admin/superadmin can access the base table.';



CREATE TABLE IF NOT EXISTS "public"."google_drive_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_account_json" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."google_drive_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hackathon_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "registration_deadline" timestamp with time zone,
    "max_team_size" integer DEFAULT 5,
    "min_team_size" integer DEFAULT 1,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "rules" "jsonb" DEFAULT '{}'::"jsonb",
    "prizes" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "hackathon_events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."hackathon_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hackathon_judges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "decision" "text",
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hackathon_judges_decision_check" CHECK (("decision" = ANY (ARRAY['accept'::"text", 'decline'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."hackathon_judges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hackathon_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'invited'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "registered_at" timestamp with time zone,
    "onboarding_completed" boolean DEFAULT false,
    "skills" "jsonb" DEFAULT '[]'::"jsonb",
    "interests" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hackathon_participants_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'registered'::"text", 'confirmed'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."hackathon_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hackathon_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "judge_id" "uuid" NOT NULL,
    "criteria" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "total_score" numeric(5,2),
    "comments" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hackathon_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hackathon_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "project_title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "demo_video_url" "text",
    "github_url" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "submitted_at" timestamp with time zone,
    "submitted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hackathon_submissions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."hackathon_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hackathon_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hackathon_team_members_role_check" CHECK (("role" = ANY (ARRAY['captain'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."hackathon_team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hackathon_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "team_name" "text" NOT NULL,
    "description" "text",
    "captain_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'forming'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hackathon_teams_status_check" CHECK (("status" = ANY (ARRAY['forming'::"text", 'confirmed'::"text", 'disbanded'::"text"])))
);


ALTER TABLE "public"."hackathon_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hero_section_generation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hero_generation_id" "uuid" NOT NULL,
    "step_number" integer NOT NULL,
    "step_name" "text" NOT NULL,
    "attempt_number" integer NOT NULL,
    "input_data" "jsonb" DEFAULT '{}'::"jsonb",
    "output_data" "jsonb" DEFAULT '{}'::"jsonb",
    "model_used" "text",
    "tokens_used" integer DEFAULT 0,
    "prompt_tokens" integer DEFAULT 0,
    "completion_tokens" integer DEFAULT 0,
    "execution_time_ms" integer DEFAULT 0,
    "cost_usd" numeric(10,4) DEFAULT 0.0000,
    "status" "text" DEFAULT 'completed'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hero_section_generation_logs_attempt_number_check" CHECK ((("attempt_number" >= 1) AND ("attempt_number" <= 3))),
    CONSTRAINT "hero_section_generation_logs_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "hero_section_generation_logs_step_name_check" CHECK (("step_name" = ANY (ARRAY['normalize_input'::"text", 'decide_strategy'::"text", 'generate_hero'::"text", 'evaluate'::"text", 'refine'::"text"]))),
    CONSTRAINT "hero_section_generation_logs_step_number_check" CHECK ((("step_number" >= 1) AND ("step_number" <= 5)))
);


ALTER TABLE "public"."hero_section_generation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hero_section_generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_run_id" "uuid",
    "product_service" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "goal" "text" NOT NULL,
    "industry" "text" NOT NULL,
    "brand_tone" "text",
    "price_point" "text",
    "traffic_source" "text",
    "additional_context" "text",
    "audience_type" "text",
    "awareness_level" "text",
    "buying_intent" "text",
    "attention_span" "text",
    "strategy_used" "text" NOT NULL,
    "strategy_reasoning" "text",
    "headline" "text" NOT NULL,
    "subheadline" "text" NOT NULL,
    "primary_cta" "text" NOT NULL,
    "secondary_line" "text",
    "clarity_score" integer,
    "benefit_strength_score" integer,
    "specificity_score" integer,
    "evaluation_feedback" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_attempts" integer DEFAULT 1,
    "confidence_score" numeric(3,2),
    "brand_context_used" "text",
    "llm_model_generation" "text" DEFAULT 'gpt-4o'::"text",
    "llm_model_evaluation" "text" DEFAULT 'gpt-4o-mini'::"text",
    "total_tokens_used" integer DEFAULT 0,
    "prompt_tokens" integer DEFAULT 0,
    "completion_tokens" integer DEFAULT 0,
    "cost_usd" numeric(10,4) DEFAULT 0.0000,
    "generation_time_ms" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hero_section_generations_attention_span_check" CHECK ((("attention_span" IS NULL) OR ("attention_span" = ANY (ARRAY['short'::"text", 'medium'::"text", 'long'::"text"])))),
    CONSTRAINT "hero_section_generations_audience_type_check" CHECK ((("audience_type" IS NULL) OR ("audience_type" = ANY (ARRAY['B2B'::"text", 'B2C'::"text", 'hybrid'::"text"])))),
    CONSTRAINT "hero_section_generations_awareness_level_check" CHECK ((("awareness_level" IS NULL) OR ("awareness_level" = ANY (ARRAY['problem-aware'::"text", 'solution-aware'::"text", 'product-aware'::"text"])))),
    CONSTRAINT "hero_section_generations_benefit_strength_score_check" CHECK ((("benefit_strength_score" >= 1) AND ("benefit_strength_score" <= 10))),
    CONSTRAINT "hero_section_generations_buying_intent_check" CHECK ((("buying_intent" IS NULL) OR ("buying_intent" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))),
    CONSTRAINT "hero_section_generations_clarity_score_check" CHECK ((("clarity_score" >= 1) AND ("clarity_score" <= 10))),
    CONSTRAINT "hero_section_generations_confidence_score_check" CHECK ((("confidence_score" >= 0.00) AND ("confidence_score" <= 1.00))),
    CONSTRAINT "hero_section_generations_generation_attempts_check" CHECK ((("generation_attempts" >= 1) AND ("generation_attempts" <= 3))),
    CONSTRAINT "hero_section_generations_goal_check" CHECK (("goal" = ANY (ARRAY['signup'::"text", 'demo'::"text", 'purchase'::"text", 'contact'::"text"]))),
    CONSTRAINT "hero_section_generations_price_point_check" CHECK ((("price_point" IS NULL) OR ("price_point" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'enterprise'::"text"])))),
    CONSTRAINT "hero_section_generations_specificity_score_check" CHECK ((("specificity_score" >= 1) AND ("specificity_score" <= 10))),
    CONSTRAINT "hero_section_generations_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'generating'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "hero_section_generations_strategy_used_check" CHECK (("strategy_used" = ANY (ARRAY['outcome-first'::"text", 'problem-solution'::"text", 'social-proof'::"text", 'speed-ease'::"text", 'authority-led'::"text"]))),
    CONSTRAINT "hero_section_generations_traffic_source_check" CHECK ((("traffic_source" IS NULL) OR ("traffic_source" = ANY (ARRAY['organic'::"text", 'paid-ads'::"text", 'social'::"text", 'direct'::"text", 'referral'::"text", 'mixed'::"text"]))))
);


ALTER TABLE "public"."hero_section_generations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_agent_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "memory_type" "text" DEFAULT 'short_term'::"text" NOT NULL,
    "memory_category" "text",
    "content" "text" NOT NULL,
    "summary" "text",
    "embedding" "public"."vector"(1536),
    "source_type" "text" DEFAULT 'conversation'::"text",
    "source_id" "uuid",
    "importance_score" double precision DEFAULT 0.5,
    "access_count" integer DEFAULT 0,
    "last_accessed_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "consolidated" boolean DEFAULT false,
    "superseded_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hub_agent_memories_memory_category_check" CHECK (("memory_category" = ANY (ARRAY['fact'::"text", 'preference'::"text", 'summary'::"text", 'decision'::"text", 'pattern'::"text"]))),
    CONSTRAINT "hub_agent_memories_memory_type_check" CHECK (("memory_type" = ANY (ARRAY['short_term'::"text", 'long_term'::"text", 'episodic'::"text", 'semantic'::"text"])))
);


ALTER TABLE "public"."hub_agent_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_agent_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "input" "text",
    "output" "text",
    "token_metrics" "jsonb" DEFAULT '{}'::"jsonb",
    "latency_ms" integer,
    "provider_used" "text",
    "model_used" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hub_agent_runs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."hub_agent_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "provider_config" "jsonb" DEFAULT '{}'::"jsonb",
    "is_enabled" boolean DEFAULT true,
    "memory_enabled" boolean DEFAULT false,
    "avatar" character varying(255),
    "welcome_message" "text",
    "conversation_starters" "jsonb" DEFAULT '[]'::"jsonb",
    "is_default" boolean DEFAULT false,
    "usage_count" integer DEFAULT 0,
    "tool_code_interpreter" boolean DEFAULT false,
    "tool_file_search" boolean DEFAULT false,
    "tool_web_search" boolean DEFAULT false,
    "tool_image_generation" boolean DEFAULT false,
    "tool_mcp" boolean DEFAULT false,
    "mcp_server_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "tools_config" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hub_agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(255),
    "summary" "text",
    "is_archived" boolean DEFAULT false,
    "is_pinned" boolean DEFAULT false,
    "message_count" integer DEFAULT 0,
    "last_message_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hub_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" character varying(20) NOT NULL,
    "content" "text" NOT NULL,
    "model_used" character varying(100),
    "provider_used" character varying(50),
    "tokens_input" integer,
    "tokens_output" integer,
    "latency_ms" integer,
    "tool_calls" "jsonb",
    "tool_results" "jsonb",
    "citations" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hub_messages_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['user'::character varying, 'assistant'::character varying, 'system'::character varying, 'tool'::character varying])::"text"[])))
);


ALTER TABLE "public"."hub_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_personalizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "additional_prompt" "text",
    "attached_knowledge_files" "uuid"[],
    "use_all_knowledge" boolean DEFAULT false,
    "max_context_files" integer DEFAULT 5,
    "relevance_threshold" numeric DEFAULT 0.7,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hub_personalizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_aspect_ratios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "width" integer NOT NULL,
    "height" integer NOT NULL,
    "display_label" "text" NOT NULL,
    "icon_name" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "cost_multiplier" numeric(4,2) DEFAULT 1.00,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image_aspect_ratios" OWNER TO "postgres";


COMMENT ON TABLE "public"."image_aspect_ratios" IS 'Supported aspect ratios with dimensions and cost multipliers';



COMMENT ON COLUMN "public"."image_aspect_ratios"."cost_multiplier" IS 'Cost multiplier relative to 1024x1024 base resolution';



CREATE TABLE IF NOT EXISTS "public"."image_generation_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "user_id" "uuid",
    "total_generations" integer DEFAULT 0,
    "successful_generations" integer DEFAULT 0,
    "failed_generations" integer DEFAULT 0,
    "blocked_generations" integer DEFAULT 0,
    "total_cost_cents" numeric(12,6) DEFAULT 0,
    "avg_generation_time_ms" integer,
    "model_name" "text",
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image_generation_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."image_generation_stats" IS 'Pre-aggregated daily stats computed by cron job';



CREATE TABLE IF NOT EXISTS "public"."image_prompt_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "prompt_template" "text" NOT NULL,
    "category" "text",
    "usage_count" integer DEFAULT 0,
    "avg_success_rate" numeric(5,4),
    "is_active" boolean DEFAULT true,
    "is_featured" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image_prompt_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."image_prompt_templates" IS 'Reusable prompt templates for common use cases';



CREATE TABLE IF NOT EXISTS "public"."image_safety_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "image_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "prompt" "text" NOT NULL,
    "blocked_categories" "jsonb" NOT NULL,
    "safety_scores" "jsonb",
    "admin_status" "text" DEFAULT 'pending'::"text",
    "override_by" "uuid",
    "override_at" timestamp with time zone,
    "admin_notes" "text",
    "user_appeal_reason" "text",
    "appealed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "image_safety_blocks_admin_status_check" CHECK (("admin_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."image_safety_blocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."image_safety_blocks" IS 'Safety block events with admin appeal workflow';



CREATE TABLE IF NOT EXISTS "public"."image_shared_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "is_public" boolean DEFAULT false,
    "team_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image_shared_folders" OWNER TO "postgres";


COMMENT ON TABLE "public"."image_shared_folders" IS 'Team asset organization folders for sharing generated images';



CREATE OR REPLACE VIEW "public"."image_stats_summary" AS
 SELECT "date",
    "sum"("total_generations") AS "total_generations",
    "sum"("successful_generations") AS "successful_generations",
    "sum"("failed_generations") AS "failed_generations",
    "sum"("blocked_generations") AS "blocked_generations",
    "sum"("total_cost_cents") AS "total_cost_cents",
    ("avg"("avg_generation_time_ms"))::integer AS "avg_generation_time_ms",
    "count"(DISTINCT "user_id") AS "unique_users"
   FROM "public"."image_generation_stats"
  GROUP BY "date"
  ORDER BY "date" DESC;


ALTER VIEW "public"."image_stats_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."image_stats_summary" IS 'Daily aggregated stats for admin dashboard';



CREATE TABLE IF NOT EXISTS "public"."image_style_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "prompt_modifier" "text",
    "thumbnail_url" "text",
    "category" "text" DEFAULT 'general'::"text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "usage_count" integer DEFAULT 0,
    "avg_success_rate" numeric(5,4),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image_style_presets" OWNER TO "postgres";


COMMENT ON TABLE "public"."image_style_presets" IS 'Style presets for image generation with prompt modifiers';



COMMENT ON COLUMN "public"."image_style_presets"."prompt_modifier" IS 'Text appended to user prompt for this style';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "public"."citext" NOT NULL,
    "first_name" character varying(100),
    "last_name" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "title" character varying(255),
    "department" character varying(255),
    "is_marketing" boolean DEFAULT false,
    "activecollab_username" "text",
    "activecollab_password" "text",
    "is_wc_only" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."is_wc_only" IS 'True when the user was provisioned via Control Tower SSO solely to play the World Cup prediction game. UI restricts these users to /world-cup.';



CREATE OR REPLACE VIEW "public"."image_top_users" AS
 SELECT "s"."user_id",
    "concat"("u"."first_name", ' ', "u"."last_name") AS "full_name",
    "u"."email",
    "sum"("s"."total_generations") AS "total_generations",
    "sum"("s"."successful_generations") AS "successful_generations",
    "sum"("s"."total_cost_cents") AS "total_cost_cents",
    "max"("s"."date") AS "last_generation_date"
   FROM ("public"."image_generation_stats" "s"
     LEFT JOIN "public"."users" "u" ON (("s"."user_id" = "u"."id")))
  WHERE ("s"."date" >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY "s"."user_id", "u"."first_name", "u"."last_name", "u"."email"
  ORDER BY ("sum"("s"."total_generations")) DESC;


ALTER VIEW "public"."image_top_users" OWNER TO "postgres";


COMMENT ON VIEW "public"."image_top_users" IS 'Top users by generation count in last 30 days';



CREATE TABLE IF NOT EXISTS "public"."influencer_style_library" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "influencer_name" "text" NOT NULL,
    "platform" "text" DEFAULT 'linkedin'::"text",
    "style_description" "text",
    "key_characteristics" "jsonb" DEFAULT '{}'::"jsonb",
    "sample_posts" "text"[],
    "document_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."influencer_style_library" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "request_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "response_data" "jsonb",
    "status" "text" NOT NULL,
    "execution_time_ms" integer,
    "error_message" "text",
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "integration_logs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."integration_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."keyword_blog_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "keyword_id" "uuid" NOT NULL,
    "blog_id" "uuid" NOT NULL,
    "keyword_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "keyword_blog_usage_keyword_type_check" CHECK (("keyword_type" = ANY (ARRAY['primary'::"text", 'secondary'::"text", 'third'::"text"])))
);


ALTER TABLE "public"."keyword_blog_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."keyword_ranking_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "keyword_id" "uuid" NOT NULL,
    "rank" integer NOT NULL,
    "search_volume" integer,
    "page_url" "text",
    "checked_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."keyword_ranking_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."keyword_research" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "keyword" "text" NOT NULL,
    "keyword_normalized" "text" NOT NULL,
    "search_volume" integer,
    "competition" "text",
    "difficulty_score" integer,
    "current_rank" integer,
    "target_rank" integer,
    "priority" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'tracking'::"text",
    "tags" "text"[],
    "notes" "text",
    "used_in_blog_count" integer DEFAULT 0,
    "last_used_in_blog" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_checked_at" timestamp with time zone,
    CONSTRAINT "keyword_research_competition_check" CHECK (("competition" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "keyword_research_difficulty_score_check" CHECK ((("difficulty_score" >= 0) AND ("difficulty_score" <= 100))),
    CONSTRAINT "keyword_research_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "keyword_research_status_check" CHECK (("status" = ANY (ARRAY['tracking'::"text", 'targeting'::"text", 'achieved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."keyword_research" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."keyword_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "seed_keyword" "text" NOT NULL,
    "suggestions" "jsonb" NOT NULL,
    "model_used" "text" DEFAULT 'perplexity'::"text",
    "prompt_used" "text",
    "tokens_used" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "project_id" "uuid"
);


ALTER TABLE "public"."keyword_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_base" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "knowledge_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "keywords" "text"[],
    "is_active" boolean DEFAULT true,
    "version" integer DEFAULT 1,
    "effective_date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "migrated_to_file_id" "uuid",
    CONSTRAINT "company_knowledge_base_knowledge_type_check" CHECK (("knowledge_type" = ANY (ARRAY['about_company'::"text", 'vision'::"text", 'services'::"text", 'goals'::"text", 'culture'::"text", 'achievements'::"text", 'team'::"text", 'clients'::"text", 'content_guidelines'::"text"])))
);


ALTER TABLE "public"."knowledge_base" OWNER TO "postgres";


COMMENT ON COLUMN "public"."knowledge_base"."migrated_to_file_id" IS 'References the knowledge_files record this entry was migrated to in the unified system';



CREATE TABLE IF NOT EXISTS "public"."knowledge_base_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "collection_key" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_synced" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "scope" "text" DEFAULT 'global'::"text",
    "brand_id" "uuid",
    CONSTRAINT "check_brand_category_has_brand_id" CHECK (((("scope" = 'global'::"text") AND ("brand_id" IS NULL)) OR (("scope" = 'brand'::"text") AND ("brand_id" IS NOT NULL)))),
    CONSTRAINT "knowledge_base_categories_scope_check" CHECK (("scope" = ANY (ARRAY['global'::"text", 'brand'::"text"])))
);


ALTER TABLE "public"."knowledge_base_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_base_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "knowledge_id" "uuid",
    "knowledge_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "openai_file_id" "text",
    "file_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_base_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."knowledge_base_files" IS 'Tracks company knowledge entries uploaded to OpenAI for vector store';



COMMENT ON COLUMN "public"."knowledge_base_files"."openai_file_id" IS 'OpenAI file ID for indexed knowledge';



CREATE OR REPLACE VIEW "public"."knowledge_base_usage" AS
 SELECT "u"."id" AS "user_id",
    "u"."email",
    COALESCE(((("u"."first_name")::"text" || ' '::"text") || ("u"."last_name")::"text"), ("u"."email")::"text") AS "full_name",
    COALESCE("bk"."brand_files", (0)::bigint) AS "brand_knowledge_uploads",
    COALESCE("pk"."project_files", (0)::bigint) AS "project_knowledge_uploads",
    (COALESCE("bk"."brand_files", (0)::bigint) + COALESCE("pk"."project_files", (0)::bigint)) AS "total_uploads"
   FROM (("public"."users" "u"
     LEFT JOIN ( SELECT "brand_knowledge_files"."uploaded_by",
            "count"(*) AS "brand_files"
           FROM "public"."brand_knowledge_files"
          WHERE ("brand_knowledge_files"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY "brand_knowledge_files"."uploaded_by") "bk" ON (("bk"."uploaded_by" = "u"."id")))
     LEFT JOIN ( SELECT "project_knowledge_files"."uploaded_by",
            "count"(*) AS "project_files"
           FROM "public"."project_knowledge_files"
          WHERE ("project_knowledge_files"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY "project_knowledge_files"."uploaded_by") "pk" ON (("pk"."uploaded_by" = "u"."id")))
  WHERE ((COALESCE("bk"."brand_files", (0)::bigint) + COALESCE("pk"."project_files", (0)::bigint)) > 0);


ALTER VIEW "public"."knowledge_base_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "embedding" "public"."vector"(1536) NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "chunk_index" integer
);


ALTER TABLE "public"."knowledge_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "last_synced" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "brand_id" "uuid",
    CONSTRAINT "knowledge_sources_brand_or_category_check" CHECK (((("brand_id" IS NOT NULL) AND ("category_id" IS NULL)) OR (("brand_id" IS NULL) AND ("category_id" IS NOT NULL)))),
    CONSTRAINT "knowledge_sources_type_check" CHECK (("type" = ANY (ARRAY['manual'::"text", 'google_drive'::"text", 'supabase'::"text", 'api'::"text"])))
);


ALTER TABLE "public"."knowledge_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leader_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leader_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "file_type" "text" DEFAULT 'url'::"text" NOT NULL,
    "file_size" bigint,
    "mime_type" "text",
    "openai_file_id" "text",
    "openai_vector_store_id" "text",
    "file_indexed_at" timestamp with time zone,
    "source_type" "text" DEFAULT 'manual'::"text",
    CONSTRAINT "leader_uploads_file_type_check" CHECK (("file_type" = ANY (ARRAY['url'::"text", 'upload'::"text"])))
);


ALTER TABLE "public"."leader_uploads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leader_uploads"."openai_file_id" IS 'OpenAI Files API ID for file_search tool';



COMMENT ON COLUMN "public"."leader_uploads"."file_indexed_at" IS 'Timestamp when file was uploaded to OpenAI';



COMMENT ON COLUMN "public"."leader_uploads"."source_type" IS 'Origin of file: manual, perplexity, url_scrape';



CREATE TABLE IF NOT EXISTS "public"."linkedin_agent_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_name" "text" NOT NULL,
    "role_category" "text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "persona_tone" "text" NOT NULL,
    "formatting_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "voice_characteristics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "cta_styles" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "target_audiences" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "influencer_references" "jsonb" DEFAULT '[]'::"jsonb",
    "forbidden_words" "text"[] DEFAULT ARRAY['elevate'::"text", 'leverage'::"text", 'resonate'::"text", 'testament'::"text", 'delve'::"text", 'enrich'::"text", 'foster'::"text", 'beacon'::"text"],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "linkedin_agent_templates_role_category_check" CHECK (("role_category" = ANY (ARRAY['executive'::"text", 'technical'::"text", 'marketing'::"text", 'sales'::"text", 'operations'::"text"])))
);


ALTER TABLE "public"."linkedin_agent_templates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."model_cost_breakdown" AS
 SELECT COALESCE("model_provider", 'unknown'::"text") AS "model_provider",
    COALESCE("model_version", 'unknown'::"text") AS "model_version",
    "count"(*) AS "total_runs",
    COALESCE("sum"("cost_usd"), (0)::numeric) AS "total_cost_usd",
    COALESCE("sum"("total_tokens"), (0)::bigint) AS "total_tokens",
    COALESCE("sum"("prompt_tokens"), (0)::bigint) AS "prompt_tokens",
    COALESCE("sum"("completion_tokens"), (0)::bigint) AS "completion_tokens",
        CASE
            WHEN ("count"(*) > 0) THEN (COALESCE("sum"("cost_usd"), (0)::numeric) / ("count"(*))::numeric)
            ELSE (0)::numeric
        END AS "avg_cost_per_run"
   FROM "public"."ai_agent_runs"
  WHERE ("created_at" >= ("now"() - '90 days'::interval))
  GROUP BY "model_provider", "model_version";


ALTER VIEW "public"."model_cost_breakdown" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."n8n_workflow_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_name" "text" NOT NULL,
    "workflow_slug" "text" NOT NULL,
    "base_url" "text" NOT NULL,
    "is_enabled" boolean DEFAULT false,
    "api_key_encrypted" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."n8n_workflow_configs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."n8n_workflow_configs_safe" AS
 SELECT "id",
    "workflow_name",
    "workflow_slug",
    "base_url",
    "is_enabled",
    "metadata",
    "created_by",
    "created_at",
    "updated_at"
   FROM "public"."n8n_workflow_configs";


ALTER VIEW "public"."n8n_workflow_configs_safe" OWNER TO "postgres";


COMMENT ON VIEW "public"."n8n_workflow_configs_safe" IS 'Safe view of n8n_workflow_configs excluding api_key_encrypted. Only superadmin can access the base table.';



CREATE TABLE IF NOT EXISTS "public"."newsletter_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "feed_url" "text" NOT NULL,
    "category" "text" NOT NULL,
    "keywords" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."newsletter_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "connected" boolean DEFAULT false,
    "last_checked_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perplexity_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "default_prompt" "text" DEFAULT 'Find the top 5 trending LinkedIn topics this week for {audience}. Explain why each topic resonates with the audience and how {leader_name} could add insight. Respond with JSON using the structure {"topics": [{"title": string, "summary": string, "score": number}]}.'::"text" NOT NULL,
    "model" "text" DEFAULT 'llama-3.1-sonar-small-128k-online'::"text" NOT NULL,
    "temperature" numeric DEFAULT 0.4 NOT NULL,
    "max_tokens" integer DEFAULT 1000 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."perplexity_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_login_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "login_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_login_tracking" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."platform_activity_daily" AS
 SELECT "d"."day",
    COALESCE("ar"."agent_runs", (0)::bigint) AS "agent_runs",
    COALESCE("ar"."agent_cost_usd", (0)::numeric) AS "agent_cost_usd",
    COALESCE("ar"."agent_tokens", (0)::bigint) AS "agent_tokens",
    COALESCE("ar"."unique_agent_users", (0)::bigint) AS "unique_agent_users",
    COALESCE("img"."image_generations", (0)::bigint) AS "image_generations",
    COALESCE("vid"."video_generations", (0)::bigint) AS "video_generations",
    COALESCE("lt"."logins", (0)::bigint) AS "logins",
    COALESCE("lt"."unique_login_users", (0)::bigint) AS "unique_login_users"
   FROM ((((( SELECT ("generate_series"(((("now"() - '90 days'::interval))::"date")::timestamp with time zone, (("now"())::"date")::timestamp with time zone, '1 day'::interval))::"date" AS "day") "d"
     LEFT JOIN ( SELECT ("date_trunc"('day'::"text", "ai_agent_runs"."created_at"))::"date" AS "day",
            "count"(*) AS "agent_runs",
            COALESCE("sum"("ai_agent_runs"."cost_usd"), (0)::numeric) AS "agent_cost_usd",
            COALESCE("sum"("ai_agent_runs"."total_tokens"), (0)::bigint) AS "agent_tokens",
            "count"(DISTINCT "ai_agent_runs"."executed_by") AS "unique_agent_users"
           FROM "public"."ai_agent_runs"
          WHERE ("ai_agent_runs"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY ("date_trunc"('day'::"text", "ai_agent_runs"."created_at"))) "ar" ON (("ar"."day" = "d"."day")))
     LEFT JOIN ( SELECT ("date_trunc"('day'::"text", "ai_generated_images"."created_at"))::"date" AS "day",
            "count"(*) AS "image_generations"
           FROM "public"."ai_generated_images"
          WHERE ("ai_generated_images"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY ("date_trunc"('day'::"text", "ai_generated_images"."created_at"))) "img" ON (("img"."day" = "d"."day")))
     LEFT JOIN ( SELECT ("date_trunc"('day'::"text", "all_videos"."created_at"))::"date" AS "day",
            "count"(*) AS "video_generations"
           FROM ( SELECT "sora_videos"."created_at"
                   FROM "public"."sora_videos"
                  WHERE ("sora_videos"."created_at" >= ("now"() - '90 days'::interval))
                UNION ALL
                 SELECT "gemini_videos"."created_at"
                   FROM "public"."gemini_videos"
                  WHERE ("gemini_videos"."created_at" >= ("now"() - '90 days'::interval))) "all_videos"
          GROUP BY ("date_trunc"('day'::"text", "all_videos"."created_at"))) "vid" ON (("vid"."day" = "d"."day")))
     LEFT JOIN ( SELECT ("date_trunc"('day'::"text", "user_login_tracking"."login_at"))::"date" AS "day",
            "count"(*) AS "logins",
            "count"(DISTINCT "user_login_tracking"."user_id") AS "unique_login_users"
           FROM "public"."user_login_tracking"
          WHERE ("user_login_tracking"."login_at" >= ("now"() - '90 days'::interval))
          GROUP BY ("date_trunc"('day'::"text", "user_login_tracking"."login_at"))) "lt" ON (("lt"."day" = "d"."day")));


ALTER VIEW "public"."platform_activity_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pod_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pod_id" "text" NOT NULL,
    "employee_id" "text" NOT NULL,
    "user_id" "text",
    "joined_at" timestamp with time zone,
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pod_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pod_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text",
    "is_active" boolean DEFAULT true,
    "member_count" integer DEFAULT 0,
    "api_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_agent_references" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "external_agent_id" "uuid" NOT NULL,
    "agent_name" "text" NOT NULL,
    "agent_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_agent_references" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_knowledge_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "chunk_index" integer DEFAULT 0 NOT NULL,
    "chunk_text" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_knowledge_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_knowledge_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "project_knowledge_sources_source_type_check" CHECK (("source_type" = ANY (ARRAY['manual'::"text", 'google_drive'::"text", 'supabase'::"text"])))
);


ALTER TABLE "public"."project_knowledge_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "meeting_id" "text" NOT NULL,
    "meeting_title" "text" NOT NULL,
    "meeting_description" "text",
    "meeting_type" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "location" "text",
    "attendees" "text"[],
    "organizer" "text",
    "meeting_link" "text",
    "meeting_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_task_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "activecollab_comment_id" "text" NOT NULL,
    "comment_body" "text",
    "created_by_name" "text",
    "created_by_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."project_task_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "assigned_to" "uuid",
    "estimated_hours" numeric(5,2),
    "actual_hours" numeric(5,2) DEFAULT 0,
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "imported_hours" numeric DEFAULT 0,
    "last_hours_import" timestamp with time zone,
    "external_task_id" "text",
    "activecollab_task_id" "text",
    "activecollab_sync_at" timestamp with time zone,
    "activecollab_created_on" timestamp with time zone,
    "activecollab_updated_on" timestamp with time zone,
    "category" "text" DEFAULT 'general'::"text",
    "brand_id" "uuid",
    "client_id" "uuid",
    "created_by" "uuid",
    "past_assignees" "uuid"[] DEFAULT '{}'::"uuid"[],
    CONSTRAINT "project_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "project_tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'in_progress'::"text", 'review'::"text", 'completed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."project_tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."project_tasks"."activecollab_created_on" IS 'Original creation timestamp from ActiveCollab API';



COMMENT ON COLUMN "public"."project_tasks"."activecollab_updated_on" IS 'Last update timestamp from ActiveCollab API';



COMMENT ON COLUMN "public"."project_tasks"."created_by" IS 'User ID of the person who created this task';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'planning'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "budget" numeric(10,2),
    "actual_cost" numeric(10,2) DEFAULT 0,
    "start_date" "date",
    "end_date" "date",
    "deadline" "date",
    "progress" integer DEFAULT 0,
    "assigned_team" "uuid"[],
    "project_manager" "uuid",
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_logged_hours" numeric DEFAULT 0,
    "last_hours_import" timestamp with time zone,
    "external_project_id" "text",
    "activecollab_project_id" "text",
    "activecollab_sync_at" timestamp with time zone,
    "activecollab_budget" numeric,
    "activecollab_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "control_tower_project_id" "uuid",
    "control_tower_last_synced_at" timestamp with time zone,
    "linkedin_settings" "jsonb",
    CONSTRAINT "projects_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "projects_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['planning'::"text", 'in_progress'::"text", 'on_hold'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."control_tower_project_id" IS 'UUID from external Control Tower system for tracking imported projects';



COMMENT ON COLUMN "public"."projects"."control_tower_last_synced_at" IS 'Timestamp of last sync from Control Tower system';



COMMENT ON COLUMN "public"."projects"."linkedin_settings" IS 'LinkedIn generator voice/audience settings (app-enforced shape).';



CREATE TABLE IF NOT EXISTS "public"."reel_hook_generation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reel_hook_generation_id" "uuid" NOT NULL,
    "step_name" "text" NOT NULL,
    "attempt_number" integer NOT NULL,
    "input_data" "jsonb" DEFAULT '{}'::"jsonb",
    "output_data" "jsonb" DEFAULT '{}'::"jsonb",
    "model_used" "text",
    "tokens_used" integer DEFAULT 0,
    "prompt_tokens" integer DEFAULT 0,
    "completion_tokens" integer DEFAULT 0,
    "execution_time_ms" integer DEFAULT 0,
    "cost_usd" numeric(10,4) DEFAULT 0.0000,
    "status" "text" DEFAULT 'completed'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reel_hook_generation_logs_attempt_number_check" CHECK ((("attempt_number" >= 1) AND ("attempt_number" <= 3))),
    CONSTRAINT "reel_hook_generation_logs_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "reel_hook_generation_logs_step_name_check" CHECK (("step_name" = ANY (ARRAY['validate_input'::"text", 'generate_hooks'::"text", 'score_hooks'::"text", 'regenerate'::"text"])))
);


ALTER TABLE "public"."reel_hook_generation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reel_hook_generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_run_id" "uuid",
    "topic" "text" NOT NULL,
    "target_audience" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "primary_goal" "text" NOT NULL,
    "tone" "text" NOT NULL,
    "hook_length" "text",
    "competitor_hooks" "text"[],
    "past_performing_hooks" "text"[],
    "content_format" "text",
    "urgency_level" "text",
    "creator_persona" "text",
    "additional_context" "text",
    "primary_hook_category" "text" NOT NULL,
    "secondary_hook_category" "text",
    "strategy_reasoning" "text",
    "awareness_level" "text",
    "scroll_state" "text",
    "trust_level" "text",
    "top_hooks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ab_test_suggestion" "jsonb" DEFAULT '{}'::"jsonb",
    "strategy_used" "text" NOT NULL,
    "platform_note" "text",
    "avg_quality_score" numeric(3,1),
    "scroll_stop_avg" numeric(3,1),
    "clarity_avg" numeric(3,1),
    "emotional_pull_avg" numeric(3,1),
    "specificity_avg" numeric(3,1),
    "generation_attempts" integer DEFAULT 1,
    "regeneration_reason" "text",
    "llm_model_generation" "text" DEFAULT 'gpt-4o'::"text",
    "llm_model_scoring" "text" DEFAULT 'gpt-4o-mini'::"text",
    "total_tokens_used" integer DEFAULT 0,
    "prompt_tokens" integer DEFAULT 0,
    "completion_tokens" integer DEFAULT 0,
    "cost_usd" numeric(10,4) DEFAULT 0.0000,
    "generation_time_ms" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reel_hook_generations_avg_quality_score_check" CHECK ((("avg_quality_score" >= 0.0) AND ("avg_quality_score" <= 10.0))),
    CONSTRAINT "reel_hook_generations_awareness_level_check" CHECK ((("awareness_level" IS NULL) OR ("awareness_level" = ANY (ARRAY['unaware'::"text", 'problem_aware'::"text", 'solution_aware'::"text", 'product_aware'::"text"])))),
    CONSTRAINT "reel_hook_generations_clarity_avg_check" CHECK ((("clarity_avg" >= 0.0) AND ("clarity_avg" <= 10.0))),
    CONSTRAINT "reel_hook_generations_content_format_check" CHECK ((("content_format" IS NULL) OR ("content_format" = ANY (ARRAY['talking_head'::"text", 'broll'::"text", 'text_overlay'::"text", 'mixed'::"text"])))),
    CONSTRAINT "reel_hook_generations_creator_persona_check" CHECK ((("creator_persona" IS NULL) OR ("creator_persona" = ANY (ARRAY['expert'::"text", 'peer'::"text", 'entertainer'::"text", 'educator'::"text"])))),
    CONSTRAINT "reel_hook_generations_emotional_pull_avg_check" CHECK ((("emotional_pull_avg" >= 0.0) AND ("emotional_pull_avg" <= 10.0))),
    CONSTRAINT "reel_hook_generations_generation_attempts_check" CHECK ((("generation_attempts" >= 1) AND ("generation_attempts" <= 3))),
    CONSTRAINT "reel_hook_generations_hook_length_check" CHECK ((("hook_length" IS NULL) OR ("hook_length" = ANY (ARRAY['short'::"text", 'medium'::"text", 'long'::"text"])))),
    CONSTRAINT "reel_hook_generations_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'youtube_shorts'::"text", 'tiktok'::"text", 'facebook'::"text"]))),
    CONSTRAINT "reel_hook_generations_primary_goal_check" CHECK (("primary_goal" = ANY (ARRAY['views'::"text", 'saves'::"text", 'follows'::"text", 'clicks'::"text"]))),
    CONSTRAINT "reel_hook_generations_scroll_state_check" CHECK ((("scroll_state" IS NULL) OR ("scroll_state" = ANY (ARRAY['passive'::"text", 'active_searching'::"text", 'end_of_session'::"text"])))),
    CONSTRAINT "reel_hook_generations_scroll_stop_avg_check" CHECK ((("scroll_stop_avg" >= 0.0) AND ("scroll_stop_avg" <= 10.0))),
    CONSTRAINT "reel_hook_generations_specificity_avg_check" CHECK ((("specificity_avg" >= 0.0) AND ("specificity_avg" <= 10.0))),
    CONSTRAINT "reel_hook_generations_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'generating'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "reel_hook_generations_trust_level_check" CHECK ((("trust_level" IS NULL) OR ("trust_level" = ANY (ARRAY['cold'::"text", 'warm'::"text", 'hot'::"text"])))),
    CONSTRAINT "reel_hook_generations_urgency_level_check" CHECK ((("urgency_level" IS NULL) OR ("urgency_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))))
);


ALTER TABLE "public"."reel_hook_generations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."role_permissions" IS 'Stores custom permission configurations for each role';



COMMENT ON COLUMN "public"."role_permissions"."role" IS 'The role this configuration applies to';



COMMENT ON COLUMN "public"."role_permissions"."permissions" IS 'JSON object containing permission flags (e.g., {"users.view": true, "users.create": false})';



COMMENT ON COLUMN "public"."role_permissions"."updated_by" IS 'User ID of the admin who last updated these permissions';



CREATE TABLE IF NOT EXISTS "public"."seo_blog_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "primary_keyword" "text" NOT NULL,
    "primary_reference" "text" NOT NULL,
    "brand_name" "text" NOT NULL,
    "tone" "text" DEFAULT 'informative'::"text",
    "audience" "text" DEFAULT 'general business audience'::"text",
    "primary_reference_summary" "text",
    "title" "text",
    "paragraphs" "text"[],
    "validation_result" "jsonb" DEFAULT '{}'::"jsonb",
    "is_valid" boolean DEFAULT false,
    "validation_errors" "text"[] DEFAULT ARRAY[]::"text"[],
    "validation_warnings" "text"[] DEFAULT ARRAY[]::"text"[],
    "generation_attempts" integer DEFAULT 0,
    "total_tokens_used" integer DEFAULT 0,
    "prompt_tokens" integer DEFAULT 0,
    "completion_tokens" integer DEFAULT 0,
    "cost_usd" numeric(10,6) DEFAULT 0,
    "generation_time_ms" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_notes" "text",
    "secondary_keyword" "text",
    "third_keyword" "text",
    "leader_id" "uuid",
    CONSTRAINT "seo_blog_content_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'generating'::"text", 'validated'::"text", 'failed'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."seo_blog_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."seo_blog_content" IS 'Stores SEO-optimized blog posts generated with strict validation rules. Uses primary keyword with strict placement, plus optional additional keywords for context.';



COMMENT ON COLUMN "public"."seo_blog_content"."additional_notes" IS 'User provided additional requirements or instructions for blog generation. These will be included in the AI prompt as additional instructions.';



COMMENT ON COLUMN "public"."seo_blog_content"."secondary_keyword" IS 'Optional additional keyword phrase for AI context. No strict placement requirements.';



COMMENT ON COLUMN "public"."seo_blog_content"."third_keyword" IS 'Optional additional keyword phrase for AI context. No strict placement requirements.';



COMMENT ON COLUMN "public"."seo_blog_content"."leader_id" IS 'Link to thought leader who authored the blog';



CREATE TABLE IF NOT EXISTS "public"."seo_blog_generation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blog_id" "uuid" NOT NULL,
    "attempt_number" integer NOT NULL,
    "attempt_type" "text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "user_prompt" "text" NOT NULL,
    "llm_response" "text" NOT NULL,
    "llm_raw_response" "jsonb" DEFAULT '{}'::"jsonb",
    "validation_errors" "text"[] DEFAULT ARRAY[]::"text"[],
    "validation_warnings" "text"[] DEFAULT ARRAY[]::"text"[],
    "was_valid" boolean DEFAULT false,
    "tokens_used" integer DEFAULT 0,
    "prompt_tokens" integer DEFAULT 0,
    "completion_tokens" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "seo_blog_generation_logs_attempt_type_check" CHECK (("attempt_type" = ANY (ARRAY['initial'::"text", 'repair'::"text"])))
);


ALTER TABLE "public"."seo_blog_generation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seo_reference_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference_url" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "tokens_used" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."seo_reference_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "requirements_html" "text",
    "base_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "effort_hours" numeric(6,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_daily_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "summary_date" "date" NOT NULL,
    "ai_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tasks_completed" integer DEFAULT 0,
    "hours_logged" numeric DEFAULT 0,
    "productivity_score" numeric,
    "key_accomplishments" "text"[] DEFAULT '{}'::"text"[],
    "concerns" "text"[] DEFAULT '{}'::"text"[],
    "eod_submission_id" "uuid",
    "agent_run_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_daily_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_eod_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "submission_date" "date" NOT NULL,
    "task_links" "text"[] DEFAULT '{}'::"text"[],
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_eod_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "is_captain" boolean DEFAULT false,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."testimonial_submission_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "testimonial_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."testimonial_submission_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thought_leaders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "department" "text",
    "linkedin_url" "text",
    "target_audience" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "persona_tone" "text" NOT NULL,
    "default_prompt" "text" NOT NULL,
    "guide_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "agent_template_id" "uuid",
    "personal_context" "jsonb" DEFAULT '{}'::"jsonb",
    "style_overrides" "jsonb" DEFAULT '{}'::"jsonb",
    "target_client_segments" "text"[],
    "url_slug" "text",
    "brand_id" "uuid",
    "openai_vector_store_id" "text",
    "user_id" "uuid",
    "niche_keyword" "text",
    "niche_domain" "text",
    "content_phase" "text" DEFAULT 'teach'::"text",
    "weekly_rhythm" "jsonb" DEFAULT '{"how_to": 1, "opinion": 1, "teaching": 2}'::"jsonb",
    "posts_this_week" "jsonb" DEFAULT '{"how_to": 0, "opinion": 0, "teaching": 0}'::"jsonb",
    "posts_week_start" "date" DEFAULT CURRENT_DATE,
    "ai_pipeline_config" "jsonb" DEFAULT '{"writing_model": "claude", "research_depth": "standard", "research_model": "gemini", "use_dual_model": true}'::"jsonb",
    "content_phase_start_date" "date" DEFAULT CURRENT_DATE,
    CONSTRAINT "thought_leaders_content_phase_check" CHECK (("content_phase" = ANY (ARRAY['teach'::"text", 'own_problem'::"text", 'contextual_mention'::"text"])))
);


ALTER TABLE "public"."thought_leaders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."thought_leaders"."openai_vector_store_id" IS 'OpenAI vector store ID for this leader''s indexed knowledge files';



COMMENT ON COLUMN "public"."thought_leaders"."ai_pipeline_config" IS 'Configuration for the dual-model AI pipeline: research (Gemini) + writing (Claude/GPT-5)';



CREATE TABLE IF NOT EXISTS "public"."tournament_email_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_key" "text" NOT NULL,
    "tournament_name" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "sender_email" "text" NOT NULL,
    "reply_to" "text" NOT NULL,
    "subject_template" "text" NOT NULL,
    "intro_html" "text" DEFAULT ''::"text" NOT NULL,
    "outro_html" "text" DEFAULT ''::"text" NOT NULL,
    "sections_enabled" "jsonb" DEFAULT '{"standings": true, "user_score": true, "upcoming_matches": true}'::"jsonb" NOT NULL,
    "schedule_cron" "text" DEFAULT '0 3 * * 1'::"text" NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Kolkata'::"text" NOT NULL,
    "predict_url" "text" DEFAULT 'https://marketing.sjinnovation.us/world-cup'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_email_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_email_sends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_key" "text" NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "week_no" integer NOT NULL,
    "recipients_count" integer DEFAULT 0 NOT NULL,
    "delivered_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "error_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tournament_email_sends_status_check" CHECK (("status" = ANY (ARRAY['skipped'::"text", 'dry_run'::"text", 'completed'::"text", 'partial'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."tournament_email_sends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_accountability_chart" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "serial_number" integer NOT NULL,
    "type_of_work" "text" NOT NULL,
    "responsibilities" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_accountability_chart" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_activecollab_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activecollab_username" "text" NOT NULL,
    "activecollab_password" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_activecollab_settings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_activity_summary" WITH ("security_barrier"='true') AS
 SELECT "u"."id" AS "user_id",
    "u"."email",
    COALESCE(((("u"."first_name")::"text" || ' '::"text") || ("u"."last_name")::"text"), ("u"."email")::"text") AS "full_name",
    COALESCE("ar"."total_runs", (0)::bigint) AS "total_agent_runs",
    COALESCE("ar"."total_cost_usd", (0)::numeric) AS "total_agent_cost_usd",
    COALESCE("ar"."total_tokens", (0)::bigint) AS "total_tokens",
    COALESCE("img"."total_images", (0)::bigint) AS "total_images",
    COALESCE("sv"."total_sora_videos", (0)::bigint) AS "total_sora_videos",
    COALESCE("gv"."total_gemini_videos", (0)::bigint) AS "total_gemini_videos",
    COALESCE("lt"."login_count", (0)::bigint) AS "login_count",
    "lt"."last_login",
    COALESCE("kb"."kb_uploads", (0)::bigint) AS "kb_uploads"
   FROM (((((("public"."users" "u"
     LEFT JOIN ( SELECT "ai_agent_runs"."executed_by",
            "count"(*) AS "total_runs",
            COALESCE("sum"("ai_agent_runs"."cost_usd"), (0)::numeric) AS "total_cost_usd",
            COALESCE("sum"("ai_agent_runs"."total_tokens"), (0)::bigint) AS "total_tokens"
           FROM "public"."ai_agent_runs"
          WHERE ("ai_agent_runs"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY "ai_agent_runs"."executed_by") "ar" ON (("ar"."executed_by" = "u"."id")))
     LEFT JOIN ( SELECT "ai_generated_images"."user_id",
            "count"(*) AS "total_images"
           FROM "public"."ai_generated_images"
          WHERE ("ai_generated_images"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY "ai_generated_images"."user_id") "img" ON (("img"."user_id" = "u"."id")))
     LEFT JOIN ( SELECT "sora_videos"."user_id",
            "count"(*) AS "total_sora_videos"
           FROM "public"."sora_videos"
          WHERE ("sora_videos"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY "sora_videos"."user_id") "sv" ON (("sv"."user_id" = "u"."id")))
     LEFT JOIN ( SELECT "gemini_videos"."user_id",
            "count"(*) AS "total_gemini_videos"
           FROM "public"."gemini_videos"
          WHERE ("gemini_videos"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY "gemini_videos"."user_id") "gv" ON (("gv"."user_id" = "u"."id")))
     LEFT JOIN ( SELECT "user_login_tracking"."user_id",
            "count"(*) AS "login_count",
            "max"("user_login_tracking"."login_at") AS "last_login"
           FROM "public"."user_login_tracking"
          WHERE ("user_login_tracking"."login_at" >= ("now"() - '90 days'::interval))
          GROUP BY "user_login_tracking"."user_id") "lt" ON (("lt"."user_id" = "u"."id")))
     LEFT JOIN ( SELECT "brand_knowledge_files"."uploaded_by",
            "count"(*) AS "kb_uploads"
           FROM "public"."brand_knowledge_files"
          WHERE ("brand_knowledge_files"."created_at" >= ("now"() - '90 days'::interval))
          GROUP BY "brand_knowledge_files"."uploaded_by") "kb" ON (("kb"."uploaded_by" = "u"."id")));


ALTER VIEW "public"."user_activity_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_agent_breakdown" AS
 SELECT "r"."executed_by" AS "user_id",
    "u"."email",
    COALESCE(((("u"."first_name")::"text" || ' '::"text") || ("u"."last_name")::"text"), ("u"."email")::"text") AS "full_name",
    "r"."agent_id",
    "a"."name" AS "agent_name",
    "a"."slug" AS "agent_slug",
    "a"."category" AS "agent_category",
    "count"(*) AS "run_count",
    COALESCE("sum"("r"."cost_usd"), (0)::numeric) AS "total_cost_usd",
    COALESCE("sum"("r"."total_tokens"), (0)::bigint) AS "total_tokens",
    COALESCE("sum"("r"."prompt_tokens"), (0)::bigint) AS "prompt_tokens",
    COALESCE("sum"("r"."completion_tokens"), (0)::bigint) AS "completion_tokens",
    "max"("r"."created_at") AS "last_run_at"
   FROM (("public"."ai_agent_runs" "r"
     JOIN "public"."ai_agents" "a" ON (("a"."id" = "r"."agent_id")))
     LEFT JOIN "public"."users" "u" ON (("u"."id" = "r"."executed_by")))
  WHERE ("r"."created_at" >= ("now"() - '90 days'::interval))
  GROUP BY "r"."executed_by", "u"."email", "u"."first_name", "u"."last_name", "r"."agent_id", "a"."name", "a"."slug", "a"."category";


ALTER VIEW "public"."user_agent_breakdown" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "access_level" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "can_manage_team" boolean DEFAULT false NOT NULL,
    "can_manage_settings" boolean DEFAULT false NOT NULL,
    "can_view_analytics" boolean DEFAULT true NOT NULL,
    "can_manage_content" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_brands_access_level_check" CHECK (("access_level" = ANY (ARRAY['viewer'::"text", 'member'::"text", 'owner'::"text"])))
);


ALTER TABLE "public"."user_brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_google_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_google_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "module_name" "text" NOT NULL,
    "can_view" boolean DEFAULT false NOT NULL,
    "can_create" boolean DEFAULT false NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "can_delete" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vision_examples" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_slug" "text" NOT NULL,
    "agent_name" "text" NOT NULL,
    "example_input" "text" NOT NULL,
    "example_output" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "category" "text" DEFAULT 'global'::"text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vision_examples" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wc_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_name" "text" NOT NULL,
    "api_key_hash" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wc_api_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."wc_api_keys" IS 'API keys for the read-only world-cup-api edge function (leaderboards/matches for external tools)';



COMMENT ON COLUMN "public"."wc_api_keys"."api_key_hash" IS 'SHA-256 hex of the key; plaintext is shown once at creation and never stored';



CREATE TABLE IF NOT EXISTS "public"."wc_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_id" bigint NOT NULL,
    "stage" "text" NOT NULL,
    "group_name" "text",
    "matchday" integer,
    "round_key" "text" NOT NULL,
    "kickoff_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'TIMED'::"text" NOT NULL,
    "home_team_name" "text" DEFAULT 'TBD'::"text" NOT NULL,
    "away_team_name" "text" DEFAULT 'TBD'::"text" NOT NULL,
    "home_team_tla" "text",
    "away_team_tla" "text",
    "home_crest_url" "text",
    "away_crest_url" "text",
    "home_score" integer,
    "away_score" integer,
    "result_source" "text" DEFAULT 'api'::"text" NOT NULL,
    "scored_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wc_matches_result_source_check" CHECK (("result_source" = ANY (ARRAY['api'::"text", 'manual'::"text"]))),
    CONSTRAINT "wc_matches_status_check" CHECK (("status" = ANY (ARRAY['SCHEDULED'::"text", 'TIMED'::"text", 'IN_PLAY'::"text", 'PAUSED'::"text", 'FINISHED'::"text", 'POSTPONED'::"text", 'SUSPENDED'::"text", 'CANCELLED'::"text", 'AWARDED'::"text"])))
);


ALTER TABLE "public"."wc_matches" OWNER TO "postgres";


COMMENT ON TABLE "public"."wc_matches" IS 'World Cup 2026 fixtures and results synced from football-data.org';



CREATE TABLE IF NOT EXISTS "public"."wc_predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "predicted_home" smallint NOT NULL,
    "predicted_away" smallint NOT NULL,
    "points_awarded" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wc_predictions_predicted_away_check" CHECK ((("predicted_away" >= 0) AND ("predicted_away" <= 20))),
    CONSTRAINT "wc_predictions_predicted_home_check" CHECK ((("predicted_home" >= 0) AND ("predicted_home" <= 20)))
);


ALTER TABLE "public"."wc_predictions" OWNER TO "postgres";


COMMENT ON TABLE "public"."wc_predictions" IS 'Employee score predictions, locked at kickoff via RLS';



CREATE OR REPLACE VIEW "public"."wc_leaderboard_overall" WITH ("security_invoker"='on') AS
 SELECT "p"."user_id",
    COALESCE(NULLIF(TRIM(BOTH FROM "concat"("u"."first_name", ' ', "u"."last_name")), ''::"text"), ("u"."email")::"text") AS "display_name",
    (COALESCE("sum"("p"."points_awarded"), (0)::bigint))::integer AS "total_points",
    ("count"(*) FILTER (WHERE (("p"."predicted_home" = "m"."home_score") AND ("p"."predicted_away" = "m"."away_score") AND ("m"."status" = 'FINISHED'::"text"))))::integer AS "exact_count",
    ("count"(*))::integer AS "predictions_count",
    "max"("p"."updated_at") AS "last_pick_at"
   FROM (("public"."wc_predictions" "p"
     JOIN "public"."wc_matches" "m" ON (("m"."id" = "p"."match_id")))
     JOIN "public"."users" "u" ON (("u"."id" = "p"."user_id")))
  GROUP BY "p"."user_id", "u"."first_name", "u"."last_name", "u"."email";


ALTER VIEW "public"."wc_leaderboard_overall" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wc_leaderboard_rounds" WITH ("security_invoker"='on') AS
 SELECT "m"."round_key",
    "p"."user_id",
    COALESCE(NULLIF(TRIM(BOTH FROM "concat"("u"."first_name", ' ', "u"."last_name")), ''::"text"), ("u"."email")::"text") AS "display_name",
    (COALESCE("sum"("p"."points_awarded"), (0)::bigint))::integer AS "total_points",
    ("count"(*) FILTER (WHERE (("p"."predicted_home" = "m"."home_score") AND ("p"."predicted_away" = "m"."away_score") AND ("m"."status" = 'FINISHED'::"text"))))::integer AS "exact_count",
    ("count"(*))::integer AS "predictions_count",
    "max"("p"."updated_at") AS "last_pick_at"
   FROM (("public"."wc_predictions" "p"
     JOIN "public"."wc_matches" "m" ON (("m"."id" = "p"."match_id")))
     JOIN "public"."users" "u" ON (("u"."id" = "p"."user_id")))
  GROUP BY "m"."round_key", "p"."user_id", "u"."first_name", "u"."last_name", "u"."email";


ALTER VIEW "public"."wc_leaderboard_rounds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wc_round_winners" (
    "round_key" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "total_points" integer NOT NULL,
    "exact_count" integer NOT NULL,
    "tiebreak_used" "text" DEFAULT 'points'::"text" NOT NULL,
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wc_round_winners" OWNER TO "postgres";


COMMENT ON TABLE "public"."wc_round_winners" IS 'Exactly one winner per completed round, decided by wc_decide_round_winner; prizes are never split';



CREATE TABLE IF NOT EXISTS "public"."wc_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "points_exact" integer DEFAULT 3 NOT NULL,
    "points_result" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_sync_at" timestamp with time zone,
    "last_sync_status" "text",
    "last_sync_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "prize_round" "text",
    "prize_overall" "text",
    CONSTRAINT "wc_settings_points_exact_check" CHECK (("points_exact" >= 0)),
    CONSTRAINT "wc_settings_points_result_check" CHECK (("points_result" >= 0))
);


ALTER TABLE "public"."wc_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."wc_settings" IS 'Prediction game configuration (singleton row)';



COMMENT ON COLUMN "public"."wc_settings"."prize_round" IS 'Prize for each weekly round winner (free text, shown on the game page)';



COMMENT ON COLUMN "public"."wc_settings"."prize_overall" IS 'Prize for the overall tournament champion (free text, shown on the game page)';



CREATE TABLE IF NOT EXISTS "public"."wc_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "triggered_by" "text" DEFAULT 'cron'::"text" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "matches_upserted" integer DEFAULT 0,
    "matches_scored" integer DEFAULT 0,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wc_sync_logs_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "wc_sync_logs_triggered_by_check" CHECK (("triggered_by" = ANY (ARRAY['cron'::"text", 'manual'::"text", 'override'::"text"])))
);


ALTER TABLE "public"."wc_sync_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."wc_sync_logs" IS 'Audit trail for world-cup-sync edge function runs';



CREATE TABLE IF NOT EXISTS "public"."weekly_trends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leader_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "topic_title" "text" NOT NULL,
    "topic_summary" "text" NOT NULL,
    "relevance_score" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "source_url" "text",
    "created_by" "uuid",
    "idea_source" "text" DEFAULT 'curated'::"text",
    CONSTRAINT "weekly_trends_idea_source_check" CHECK (("idea_source" = ANY (ARRAY['curated'::"text", 'personal'::"text", 'ai_suggested'::"text"])))
);


ALTER TABLE "public"."weekly_trends" OWNER TO "postgres";


COMMENT ON COLUMN "public"."weekly_trends"."status" IS 'Workflow status: draft, ready, in_progress, used';



COMMENT ON COLUMN "public"."weekly_trends"."source_url" IS 'Source URL if content came from web research';



COMMENT ON COLUMN "public"."weekly_trends"."created_by" IS 'User who created this trend (marketing team member)';



ALTER TABLE ONLY "public"."feedback_reports" ALTER COLUMN "feedback_number" SET DEFAULT "nextval"('"public"."feedback_reports_feedback_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."activecollab_credentials"
    ADD CONSTRAINT "activecollab_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activecollab_sync_logs"
    ADD CONSTRAINT "activecollab_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activecollab_task_data"
    ADD CONSTRAINT "activecollab_task_data_external_task_id_key" UNIQUE ("external_task_id");



ALTER TABLE ONLY "public"."activecollab_task_data"
    ADD CONSTRAINT "activecollab_task_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_hubspot_id_key" UNIQUE ("hubspot_id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_google_drive_folders"
    ADD CONSTRAINT "admin_google_drive_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_execution_steps"
    ADD CONSTRAINT "agent_execution_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_memories"
    ADD CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_pending_approvals"
    ADD CONSTRAINT "agent_pending_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_session_memory"
    ADD CONSTRAINT "agent_session_memory_agent_id_user_id_memory_key_key" UNIQUE ("agent_id", "user_id", "memory_key");



ALTER TABLE ONLY "public"."agent_session_memory"
    ADD CONSTRAINT "agent_session_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_tool_calls"
    ADD CONSTRAINT "agent_tool_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_tool_definitions"
    ADD CONSTRAINT "agent_tool_definitions_agent_id_tool_name_key" UNIQUE ("agent_id", "tool_name");



ALTER TABLE ONLY "public"."agent_tool_definitions"
    ADD CONSTRAINT "agent_tool_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agent_knowledge_selection"
    ADD CONSTRAINT "ai_agent_knowledge_selection_agent_id_category_id_key" UNIQUE ("agent_id", "category_id");



ALTER TABLE ONLY "public"."ai_agent_knowledge_selection"
    ADD CONSTRAINT "ai_agent_knowledge_selection_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agent_runs"
    ADD CONSTRAINT "ai_agent_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ai_configurations"
    ADD CONSTRAINT "ai_configurations_configuration_type_key" UNIQUE ("configuration_type");



ALTER TABLE ONLY "public"."ai_configurations"
    ADD CONSTRAINT "ai_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_generated_images"
    ADD CONSTRAINT "ai_generated_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_generated_images"
    ADD CONSTRAINT "ai_generated_images_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."ai_shared_resources"
    ADD CONSTRAINT "ai_shared_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_shared_resources"
    ADD CONSTRAINT "ai_shared_resources_resource_name_key" UNIQUE ("resource_name");



ALTER TABLE ONLY "public"."ai_shared_resources"
    ADD CONSTRAINT "ai_shared_resources_resource_type_resource_name_key" UNIQUE ("resource_type", "resource_name");



ALTER TABLE ONLY "public"."analytics_api_keys"
    ADD CONSTRAINT "analytics_api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."analytics_api_keys"
    ADD CONSTRAINT "analytics_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_analytics_data"
    ADD CONSTRAINT "brand_analytics_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_analytics_integrations"
    ADD CONSTRAINT "brand_analytics_integrations_brand_id_integration_type_key" UNIQUE ("brand_id", "integration_type");



ALTER TABLE ONLY "public"."brand_analytics_integrations"
    ADD CONSTRAINT "brand_analytics_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_file_comments"
    ADD CONSTRAINT "brand_file_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_generated_posts"
    ADD CONSTRAINT "brand_generated_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_knowledge_embeddings"
    ADD CONSTRAINT "brand_knowledge_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_knowledge_files"
    ADD CONSTRAINT "brand_knowledge_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_kpis"
    ADD CONSTRAINT "brand_kpis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."client_communications"
    ADD CONSTRAINT "client_communications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_testimonials"
    ADD CONSTRAINT "client_testimonials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_hubspot_id_key" UNIQUE ("hubspot_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."code_analysis_results"
    ADD CONSTRAINT "code_analysis_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."code_generation_templates"
    ADD CONSTRAINT "code_generation_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."code_repositories"
    ADD CONSTRAINT "code_repositories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_base"
    ADD CONSTRAINT "company_knowledge_base_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_base_categories"
    ADD CONSTRAINT "company_knowledge_categories_chroma_collection_key" UNIQUE ("collection_key");



ALTER TABLE ONLY "public"."knowledge_base_categories"
    ADD CONSTRAINT "company_knowledge_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_base_files"
    ADD CONSTRAINT "company_knowledge_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_hubspot_id_key" UNIQUE ("hubspot_id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_performance_metrics"
    ADD CONSTRAINT "content_performance_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_repurpose_assets"
    ADD CONSTRAINT "content_repurpose_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_repurpose_packs"
    ADD CONSTRAINT "content_repurpose_packs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_repurpose_performance"
    ADD CONSTRAINT "content_repurpose_performance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."control_tower_api_keys"
    ADD CONSTRAINT "control_tower_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."control_tower_sync_logs"
    ADD CONSTRAINT "control_tower_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_head_starts"
    ADD CONSTRAINT "daily_head_starts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_head_starts"
    ADD CONSTRAINT "daily_head_starts_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_hubspot_id_key" UNIQUE ("hubspot_id");



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deep_research_results"
    ADD CONSTRAINT "deep_research_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentation_output_config"
    ADD CONSTRAINT "documentation_output_config_agent_id_key" UNIQUE ("agent_id");



ALTER TABLE ONLY "public"."documentation_output_config"
    ADD CONSTRAINT "documentation_output_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentation_repository_links"
    ADD CONSTRAINT "documentation_repository_links_agent_id_repository_id_key" UNIQUE ("agent_id", "repository_id");



ALTER TABLE ONLY "public"."documentation_repository_links"
    ADD CONSTRAINT "documentation_repository_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentation_rules"
    ADD CONSTRAINT "documentation_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentation_templates"
    ADD CONSTRAINT "documentation_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentation_templates"
    ADD CONSTRAINT "documentation_templates_template_name_key" UNIQUE ("template_name");



ALTER TABLE ONLY "public"."email_notifications_log"
    ADD CONSTRAINT "email_notifications_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_send_log"
    ADD CONSTRAINT "email_send_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_user_mapping"
    ADD CONSTRAINT "employee_user_mapping_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."employee_user_mapping"
    ADD CONSTRAINT "employee_user_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_user_mapping"
    ADD CONSTRAINT "employee_user_mapping_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimate_items"
    ADD CONSTRAINT "estimate_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_comments"
    ADD CONSTRAINT "feedback_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_reports"
    ADD CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_upvotes"
    ADD CONSTRAINT "feedback_upvotes_feedback_id_user_id_key" UNIQUE ("feedback_id", "user_id");



ALTER TABLE ONLY "public"."feedback_upvotes"
    ADD CONSTRAINT "feedback_upvotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gemini_videos"
    ADD CONSTRAINT "gemini_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generated_posts"
    ADD CONSTRAINT "generated_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gohighlevel_contacts"
    ADD CONSTRAINT "gohighlevel_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gohighlevel_integrations"
    ADD CONSTRAINT "gohighlevel_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_drive_settings"
    ADD CONSTRAINT "google_drive_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hackathon_events"
    ADD CONSTRAINT "hackathon_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hackathon_judges"
    ADD CONSTRAINT "hackathon_judges_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."hackathon_judges"
    ADD CONSTRAINT "hackathon_judges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hackathon_participants"
    ADD CONSTRAINT "hackathon_participants_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."hackathon_participants"
    ADD CONSTRAINT "hackathon_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hackathon_scores"
    ADD CONSTRAINT "hackathon_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hackathon_scores"
    ADD CONSTRAINT "hackathon_scores_submission_id_judge_id_key" UNIQUE ("submission_id", "judge_id");



ALTER TABLE ONLY "public"."hackathon_submissions"
    ADD CONSTRAINT "hackathon_submissions_event_id_team_id_key" UNIQUE ("event_id", "team_id");



ALTER TABLE ONLY "public"."hackathon_submissions"
    ADD CONSTRAINT "hackathon_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hackathon_team_members"
    ADD CONSTRAINT "hackathon_team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hackathon_team_members"
    ADD CONSTRAINT "hackathon_team_members_team_id_participant_id_key" UNIQUE ("team_id", "participant_id");



ALTER TABLE ONLY "public"."hackathon_teams"
    ADD CONSTRAINT "hackathon_teams_event_id_team_name_key" UNIQUE ("event_id", "team_name");



ALTER TABLE ONLY "public"."hackathon_teams"
    ADD CONSTRAINT "hackathon_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hero_section_generation_logs"
    ADD CONSTRAINT "hero_section_generation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hero_section_generations"
    ADD CONSTRAINT "hero_section_generations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_agent_memories"
    ADD CONSTRAINT "hub_agent_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_agent_runs"
    ADD CONSTRAINT "hub_agent_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_agents"
    ADD CONSTRAINT "hub_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_agents"
    ADD CONSTRAINT "hub_agents_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."hub_conversations"
    ADD CONSTRAINT "hub_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_messages"
    ADD CONSTRAINT "hub_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_personalizations"
    ADD CONSTRAINT "hub_personalizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_personalizations"
    ADD CONSTRAINT "hub_personalizations_user_id_agent_id_key" UNIQUE ("user_id", "agent_id");



ALTER TABLE ONLY "public"."image_aspect_ratios"
    ADD CONSTRAINT "image_aspect_ratios_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."image_aspect_ratios"
    ADD CONSTRAINT "image_aspect_ratios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_generation_stats"
    ADD CONSTRAINT "image_generation_stats_date_user_id_model_name_key" UNIQUE ("date", "user_id", "model_name");



ALTER TABLE ONLY "public"."image_generation_stats"
    ADD CONSTRAINT "image_generation_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_prompt_templates"
    ADD CONSTRAINT "image_prompt_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_safety_blocks"
    ADD CONSTRAINT "image_safety_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_shared_folders"
    ADD CONSTRAINT "image_shared_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_style_presets"
    ADD CONSTRAINT "image_style_presets_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."image_style_presets"
    ADD CONSTRAINT "image_style_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_user_quotas"
    ADD CONSTRAINT "image_user_quotas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_user_quotas"
    ADD CONSTRAINT "image_user_quotas_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."influencer_style_library"
    ADD CONSTRAINT "influencer_style_library_influencer_name_key" UNIQUE ("influencer_name");



ALTER TABLE ONLY "public"."influencer_style_library"
    ADD CONSTRAINT "influencer_style_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_logs"
    ADD CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."control_tower_api_keys"
    ADD CONSTRAINT "key_name_unique" UNIQUE ("key_name");



ALTER TABLE ONLY "public"."keyword_blog_usage"
    ADD CONSTRAINT "keyword_blog_usage_blog_id_keyword_type_key" UNIQUE ("blog_id", "keyword_type");



ALTER TABLE ONLY "public"."keyword_blog_usage"
    ADD CONSTRAINT "keyword_blog_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."keyword_ranking_history"
    ADD CONSTRAINT "keyword_ranking_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."keyword_research"
    ADD CONSTRAINT "keyword_research_brand_id_keyword_normalized_key" UNIQUE ("brand_id", "keyword_normalized");



ALTER TABLE ONLY "public"."keyword_research"
    ADD CONSTRAINT "keyword_research_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."keyword_suggestions"
    ADD CONSTRAINT "keyword_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_embeddings"
    ADD CONSTRAINT "knowledge_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_files"
    ADD CONSTRAINT "knowledge_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_sources"
    ADD CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leader_uploads"
    ADD CONSTRAINT "leader_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."linkedin_agent_templates"
    ADD CONSTRAINT "linkedin_agent_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."linkedin_agent_templates"
    ADD CONSTRAINT "linkedin_agent_templates_template_name_key" UNIQUE ("template_name");



ALTER TABLE ONLY "public"."n8n_workflow_configs"
    ADD CONSTRAINT "n8n_workflow_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."n8n_workflow_configs"
    ADD CONSTRAINT "n8n_workflow_configs_workflow_slug_key" UNIQUE ("workflow_slug");



ALTER TABLE ONLY "public"."newsletter_sources"
    ADD CONSTRAINT "newsletter_sources_feed_url_key" UNIQUE ("feed_url");



ALTER TABLE ONLY "public"."newsletter_sources"
    ADD CONSTRAINT "newsletter_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_integrations"
    ADD CONSTRAINT "organization_integrations_integration_key" UNIQUE ("integration");



ALTER TABLE ONLY "public"."organization_integrations"
    ADD CONSTRAINT "organization_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perplexity_settings"
    ADD CONSTRAINT "perplexity_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perplexity_settings"
    ADD CONSTRAINT "perplexity_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."pod_members"
    ADD CONSTRAINT "pod_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pod_members"
    ADD CONSTRAINT "pod_members_pod_id_employee_id_key" UNIQUE ("pod_id", "employee_id");



ALTER TABLE ONLY "public"."pods"
    ADD CONSTRAINT "pods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pods"
    ADD CONSTRAINT "pods_pod_id_key" UNIQUE ("pod_id");



ALTER TABLE ONLY "public"."post_agent_references"
    ADD CONSTRAINT "post_agent_references_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_knowledge_embeddings"
    ADD CONSTRAINT "project_knowledge_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_knowledge_files"
    ADD CONSTRAINT "project_knowledge_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_knowledge_files"
    ADD CONSTRAINT "project_knowledge_files_source_file_unique" UNIQUE ("source_id", "file_name");



ALTER TABLE ONLY "public"."project_knowledge_sources"
    ADD CONSTRAINT "project_knowledge_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_meetings"
    ADD CONSTRAINT "project_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_meetings"
    ADD CONSTRAINT "project_meetings_project_id_meeting_id_key" UNIQUE ("project_id", "meeting_id");



ALTER TABLE ONLY "public"."project_task_comments"
    ADD CONSTRAINT "project_task_comments_activecollab_comment_id_key" UNIQUE ("activecollab_comment_id");



ALTER TABLE ONLY "public"."project_task_comments"
    ADD CONSTRAINT "project_task_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_activecollab_task_id_key" UNIQUE ("activecollab_task_id");



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reel_hook_generation_logs"
    ADD CONSTRAINT "reel_hook_generation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reel_hook_generations"
    ADD CONSTRAINT "reel_hook_generations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_key" UNIQUE ("role");



ALTER TABLE ONLY "public"."seo_blog_content"
    ADD CONSTRAINT "seo_blog_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seo_blog_generation_logs"
    ADD CONSTRAINT "seo_blog_generation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seo_reference_summaries"
    ADD CONSTRAINT "seo_reference_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seo_reference_summaries"
    ADD CONSTRAINT "seo_reference_summaries_reference_url_key" UNIQUE ("reference_url");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."sora_videos"
    ADD CONSTRAINT "sora_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_daily_summaries"
    ADD CONSTRAINT "team_daily_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_daily_summaries"
    ADD CONSTRAINT "team_daily_summaries_user_id_summary_date_key" UNIQUE ("user_id", "summary_date");



ALTER TABLE ONLY "public"."team_eod_submissions"
    ADD CONSTRAINT "team_eod_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_eod_submissions"
    ADD CONSTRAINT "team_eod_submissions_user_id_submission_date_key" UNIQUE ("user_id", "submission_date");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_employee_id_key" UNIQUE ("team_id", "employee_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testimonial_submission_tokens"
    ADD CONSTRAINT "testimonial_submission_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testimonial_submission_tokens"
    ADD CONSTRAINT "testimonial_submission_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."thought_leaders"
    ADD CONSTRAINT "thought_leaders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thought_leaders"
    ADD CONSTRAINT "thought_leaders_url_slug_key" UNIQUE ("url_slug");



ALTER TABLE ONLY "public"."tournament_email_config"
    ADD CONSTRAINT "tournament_email_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_email_config"
    ADD CONSTRAINT "tournament_email_config_tournament_key_key" UNIQUE ("tournament_key");



ALTER TABLE ONLY "public"."tournament_email_sends"
    ADD CONSTRAINT "tournament_email_sends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "unique_key_window" UNIQUE ("api_key_hash", "window_start");



ALTER TABLE ONLY "public"."user_accountability_chart"
    ADD CONSTRAINT "user_accountability_chart_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_accountability_chart"
    ADD CONSTRAINT "user_accountability_chart_user_id_serial_number_key" UNIQUE ("user_id", "serial_number");



ALTER TABLE ONLY "public"."user_activecollab_settings"
    ADD CONSTRAINT "user_activecollab_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_activecollab_settings"
    ADD CONSTRAINT "user_activecollab_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_brands"
    ADD CONSTRAINT "user_brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_brands"
    ADD CONSTRAINT "user_brands_user_id_brand_id_key" UNIQUE ("user_id", "brand_id");



ALTER TABLE ONLY "public"."user_google_tokens"
    ADD CONSTRAINT "user_google_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_google_tokens"
    ADD CONSTRAINT "user_google_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_login_tracking"
    ADD CONSTRAINT "user_login_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_module_name_key" UNIQUE ("user_id", "module_name");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vision_examples"
    ADD CONSTRAINT "vision_examples_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wc_api_keys"
    ADD CONSTRAINT "wc_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wc_api_keys"
    ADD CONSTRAINT "wc_api_keys_unique_hash" UNIQUE ("api_key_hash");



ALTER TABLE ONLY "public"."wc_api_keys"
    ADD CONSTRAINT "wc_api_keys_unique_name" UNIQUE ("key_name");



ALTER TABLE ONLY "public"."wc_matches"
    ADD CONSTRAINT "wc_matches_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."wc_matches"
    ADD CONSTRAINT "wc_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wc_predictions"
    ADD CONSTRAINT "wc_predictions_match_id_user_id_key" UNIQUE ("match_id", "user_id");



ALTER TABLE ONLY "public"."wc_predictions"
    ADD CONSTRAINT "wc_predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wc_round_winners"
    ADD CONSTRAINT "wc_round_winners_pkey" PRIMARY KEY ("round_key");



ALTER TABLE ONLY "public"."wc_settings"
    ADD CONSTRAINT "wc_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wc_sync_logs"
    ADD CONSTRAINT "wc_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_trends"
    ADD CONSTRAINT "weekly_trends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_trends"
    ADD CONSTRAINT "weekly_trends_unique_topic" UNIQUE ("leader_id", "week_start", "topic_title");



CREATE INDEX "idx_activecollab_assignee" ON "public"."activecollab_task_data" USING "btree" ("assignee_id");



CREATE INDEX "idx_activecollab_sync_date" ON "public"."activecollab_task_data" USING "btree" ("sync_date" DESC);



CREATE INDEX "idx_activecollab_task_data_project_id" ON "public"."activecollab_task_data" USING "btree" ("project_id");



COMMENT ON INDEX "public"."idx_activecollab_task_data_project_id" IS 'Index for FK activecollab_task_data.project_id -> projects(id)';



CREATE INDEX "idx_activities_activity_type" ON "public"."activities" USING "btree" ("activity_type");



CREATE INDEX "idx_activities_client_id" ON "public"."activities" USING "btree" ("client_id");



CREATE INDEX "idx_activities_deal_id" ON "public"."activities" USING "btree" ("deal_id");



COMMENT ON INDEX "public"."idx_activities_deal_id" IS 'Index for FK activities.deal_id -> deals(id)';



CREATE INDEX "idx_activities_hubspot_id" ON "public"."activities" USING "btree" ("hubspot_id");



CREATE INDEX "idx_admin_google_drive_folders_created_by" ON "public"."admin_google_drive_folders" USING "btree" ("created_by");



CREATE INDEX "idx_admin_google_drive_folders_folder_id" ON "public"."admin_google_drive_folders" USING "btree" ("folder_id");



CREATE INDEX "idx_agent_approvals_pending" ON "public"."agent_pending_approvals" USING "btree" ("resolution") WHERE ("resolution" IS NULL);



CREATE INDEX "idx_agent_approvals_requested_by" ON "public"."agent_pending_approvals" USING "btree" ("requested_by");



CREATE INDEX "idx_agent_approvals_run_id" ON "public"."agent_pending_approvals" USING "btree" ("run_id");



CREATE INDEX "idx_agent_execution_steps_created_at" ON "public"."agent_execution_steps" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_agent_execution_steps_run_id" ON "public"."agent_execution_steps" USING "btree" ("run_id");



CREATE INDEX "idx_agent_memories_agent_id" ON "public"."agent_memories" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_memories_user_id" ON "public"."agent_memories" USING "btree" ("user_id");



CREATE INDEX "idx_agent_memory_importance" ON "public"."agent_session_memory" USING "btree" ("importance_score" DESC);



CREATE INDEX "idx_agent_memory_lookup" ON "public"."agent_session_memory" USING "btree" ("agent_id", "user_id", "memory_key");



CREATE INDEX "idx_agent_memory_type" ON "public"."agent_session_memory" USING "btree" ("agent_id", "memory_type");



CREATE INDEX "idx_agent_templates_active" ON "public"."linkedin_agent_templates" USING "btree" ("is_active");



CREATE INDEX "idx_agent_templates_category" ON "public"."linkedin_agent_templates" USING "btree" ("role_category");



CREATE INDEX "idx_agent_tool_calls_brand_id" ON "public"."agent_tool_calls" USING "btree" ("brand_id");



CREATE INDEX "idx_agent_tool_calls_created_by" ON "public"."agent_tool_calls" USING "btree" ("created_by");



CREATE INDEX "idx_agent_tool_calls_tool_name" ON "public"."agent_tool_calls" USING "btree" ("tool_name");



CREATE INDEX "idx_ai_agent_runs_agent_created" ON "public"."ai_agent_runs" USING "btree" ("agent_id", "created_at" DESC);



CREATE INDEX "idx_ai_agent_runs_created_at" ON "public"."ai_agent_runs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_agent_runs_created_at_desc" ON "public"."ai_agent_runs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_agent_runs_provider_created" ON "public"."ai_agent_runs" USING "btree" ("model_provider", "created_at" DESC);



CREATE INDEX "idx_ai_agent_runs_status_created" ON "public"."ai_agent_runs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_ai_agent_runs_user_time" ON "public"."ai_agent_runs" USING "btree" ("executed_by", "created_at" DESC);



CREATE INDEX "idx_ai_generated_images_user_time" ON "public"."ai_generated_images" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_ai_images_created_at" ON "public"."ai_generated_images" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_images_deleted" ON "public"."ai_generated_images" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_ai_images_error_type" ON "public"."ai_generated_images" USING "btree" ("error_type") WHERE ("error_type" IS NOT NULL);



CREATE INDEX "idx_ai_images_hash" ON "public"."ai_generated_images" USING "btree" ("image_hash") WHERE ("image_hash" IS NOT NULL);



CREATE INDEX "idx_ai_images_model" ON "public"."ai_generated_images" USING "btree" ("model_name");



CREATE INDEX "idx_ai_images_parent_id" ON "public"."ai_generated_images" USING "btree" ("parent_id");



CREATE INDEX "idx_ai_images_provider_created" ON "public"."ai_generated_images" USING "btree" ("provider", "created_at" DESC);



CREATE INDEX "idx_ai_images_request_id" ON "public"."ai_generated_images" USING "btree" ("request_id");



CREATE INDEX "idx_ai_images_shared" ON "public"."ai_generated_images" USING "btree" ("is_shared") WHERE ("is_shared" = true);



CREATE INDEX "idx_ai_images_status" ON "public"."ai_generated_images" USING "btree" ("status");



CREATE INDEX "idx_ai_images_status_created" ON "public"."ai_generated_images" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_ai_images_user_created" ON "public"."ai_generated_images" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_ai_shared_resources_type_name" ON "public"."ai_shared_resources" USING "btree" ("resource_type", "resource_name");



CREATE INDEX "idx_analytics_api_keys_hash" ON "public"."analytics_api_keys" USING "btree" ("key_hash") WHERE ("is_active" = true);



CREATE INDEX "idx_api_rate_limits_lookup" ON "public"."api_rate_limits" USING "btree" ("api_key_hash", "window_start");



CREATE INDEX "idx_aspect_ratios_active" ON "public"."image_aspect_ratios" USING "btree" ("is_active", "sort_order");



CREATE INDEX "idx_brand_analytics_brand_date" ON "public"."brand_analytics_data" USING "btree" ("brand_id", "date_range_start" DESC);



CREATE INDEX "idx_brand_analytics_data_brand_date" ON "public"."brand_analytics_data" USING "btree" ("brand_id", "date_range_start" DESC);



CREATE INDEX "idx_brand_analytics_ga4_property" ON "public"."brand_analytics_integrations" USING "btree" ("ga4_property_id") WHERE ("ga4_property_id" IS NOT NULL);



CREATE INDEX "idx_brand_analytics_integrations_brand" ON "public"."brand_analytics_integrations" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_analytics_integrations_brand_id" ON "public"."brand_analytics_integrations" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_analytics_type_date" ON "public"."brand_analytics_data" USING "btree" ("data_type", "date_range_start" DESC);



CREATE INDEX "idx_brand_file_comments_file" ON "public"."brand_file_comments" USING "btree" ("file_id");



CREATE INDEX "idx_brand_file_comments_user" ON "public"."brand_file_comments" USING "btree" ("user_id");



CREATE INDEX "idx_brand_knowledge_brand" ON "public"."brand_knowledge_files" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_knowledge_embeddings_brand_id" ON "public"."brand_knowledge_embeddings" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_knowledge_embeddings_chunk" ON "public"."brand_knowledge_embeddings" USING "btree" ("file_id", "chunk_index");



CREATE INDEX "idx_brand_knowledge_embeddings_file_id" ON "public"."brand_knowledge_embeddings" USING "btree" ("file_id");



CREATE UNIQUE INDEX "idx_brand_knowledge_embeddings_unique_file_chunk" ON "public"."brand_knowledge_embeddings" USING "btree" ("file_id", "chunk_index");



CREATE INDEX "idx_brand_knowledge_embeddings_vector" ON "public"."brand_knowledge_embeddings" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_brand_knowledge_indexed" ON "public"."brand_knowledge_files" USING "btree" ("openai_file_id") WHERE ("openai_file_id" IS NOT NULL);



CREATE INDEX "idx_brand_kpis_brand_id" ON "public"."brand_kpis" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_kpis_display_order" ON "public"."brand_kpis" USING "btree" ("brand_id", "display_order");



CREATE INDEX "idx_brand_posts_brand" ON "public"."brand_generated_posts" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_posts_leader" ON "public"."brand_generated_posts" USING "btree" ("leader_id");



CREATE INDEX "idx_brands_co_owner_id" ON "public"."brands" USING "btree" ("co_owner_id");



CREATE INDEX "idx_brands_owner_id" ON "public"."brands" USING "btree" ("owner_id");



CREATE INDEX "idx_brands_status" ON "public"."brands" USING "btree" ("status");



CREATE INDEX "idx_brands_type" ON "public"."brands" USING "btree" ("type");



CREATE INDEX "idx_client_communications_client_id" ON "public"."client_communications" USING "btree" ("client_id");



CREATE INDEX "idx_client_communications_project_id" ON "public"."client_communications" USING "btree" ("project_id");



CREATE INDEX "idx_clients_assigned_manager" ON "public"."clients" USING "btree" ("assigned_manager");



CREATE INDEX "idx_clients_hubspot_id" ON "public"."clients" USING "btree" ("hubspot_id");



CREATE INDEX "idx_clients_hubspot_sync_status" ON "public"."clients" USING "btree" ("hubspot_sync_status");



CREATE INDEX "idx_clients_source" ON "public"."clients" USING "btree" ("source");



CREATE INDEX "idx_clients_status" ON "public"."clients" USING "btree" ("status");



CREATE INDEX "idx_code_analysis_results_repository_id" ON "public"."code_analysis_results" USING "btree" ("repository_id");



CREATE INDEX "idx_code_analysis_results_type" ON "public"."code_analysis_results" USING "btree" ("analysis_type");



CREATE INDEX "idx_code_generation_templates_category" ON "public"."code_generation_templates" USING "btree" ("category");



CREATE INDEX "idx_code_generation_templates_framework" ON "public"."code_generation_templates" USING "btree" ("framework");



CREATE INDEX "idx_code_repositories_created_by" ON "public"."code_repositories" USING "btree" ("created_by");



CREATE INDEX "idx_code_repositories_status" ON "public"."code_repositories" USING "btree" ("analysis_status");



CREATE INDEX "idx_company_knowledge_base_migrated" ON "public"."knowledge_base" USING "btree" ("migrated_to_file_id");



CREATE INDEX "idx_company_knowledge_files_knowledge_id" ON "public"."knowledge_base_files" USING "btree" ("knowledge_id");



CREATE INDEX "idx_company_knowledge_files_openai_file" ON "public"."knowledge_base_files" USING "btree" ("openai_file_id") WHERE ("openai_file_id" IS NOT NULL);



CREATE INDEX "idx_contacts_client_id" ON "public"."contacts" USING "btree" ("client_id");



CREATE INDEX "idx_contacts_hubspot_id" ON "public"."contacts" USING "btree" ("hubspot_id");



CREATE INDEX "idx_contacts_is_primary" ON "public"."contacts" USING "btree" ("is_primary");



CREATE INDEX "idx_content_perf_leader_posted" ON "public"."content_performance_metrics" USING "btree" ("leader_id", "posted_date" DESC);



CREATE INDEX "idx_content_perf_posted_date" ON "public"."content_performance_metrics" USING "btree" ("posted_date" DESC);



CREATE INDEX "idx_content_perf_type_posted" ON "public"."content_performance_metrics" USING "btree" ("post_type", "posted_date" DESC);



CREATE INDEX "idx_content_performance_audience" ON "public"."content_performance_metrics" USING "btree" ("leader_id", "audience");



CREATE INDEX "idx_content_performance_post_url" ON "public"."content_performance_metrics" USING "btree" ("post_url");



CREATE INDEX "idx_content_repurpose_assets_pack" ON "public"."content_repurpose_assets" USING "btree" ("pack_id", "channel", "position");



CREATE INDEX "idx_content_repurpose_packs_context" ON "public"."content_repurpose_packs" USING "btree" ("context_type", "brand_id", "project_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_content_repurpose_packs_created_by" ON "public"."content_repurpose_packs" USING "btree" ("created_by", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_content_repurpose_packs_status" ON "public"."content_repurpose_packs" USING "btree" ("status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_content_repurpose_performance_asset" ON "public"."content_repurpose_performance" USING "btree" ("asset_id");



CREATE INDEX "idx_control_tower_api_keys_created_by" ON "public"."control_tower_api_keys" USING "btree" ("created_by");



CREATE INDEX "idx_control_tower_api_keys_is_active" ON "public"."control_tower_api_keys" USING "btree" ("is_active");



CREATE INDEX "idx_daily_summaries_date" ON "public"."team_daily_summaries" USING "btree" ("summary_date" DESC);



CREATE INDEX "idx_daily_summaries_user_date" ON "public"."team_daily_summaries" USING "btree" ("user_id", "summary_date" DESC);



CREATE INDEX "idx_deals_client_id" ON "public"."deals" USING "btree" ("client_id");



CREATE INDEX "idx_deals_hubspot_id" ON "public"."deals" USING "btree" ("hubspot_id");



CREATE INDEX "idx_deals_stage" ON "public"."deals" USING "btree" ("stage");



CREATE INDEX "idx_deep_research_created_by" ON "public"."deep_research_results" USING "btree" ("created_by");



CREATE INDEX "idx_documentation_output_config_agent" ON "public"."documentation_output_config" USING "btree" ("agent_id");



CREATE INDEX "idx_documentation_repository_links_agent" ON "public"."documentation_repository_links" USING "btree" ("agent_id");



CREATE INDEX "idx_documentation_repository_links_repo" ON "public"."documentation_repository_links" USING "btree" ("repository_id");



CREATE INDEX "idx_documentation_rules_agent" ON "public"."documentation_rules" USING "btree" ("agent_id");



CREATE INDEX "idx_documentation_rules_type" ON "public"."documentation_rules" USING "btree" ("rule_type");



CREATE INDEX "idx_documentation_templates_active" ON "public"."documentation_templates" USING "btree" ("is_active");



CREATE INDEX "idx_documentation_templates_category" ON "public"."documentation_templates" USING "btree" ("doc_category");



CREATE INDEX "idx_email_send_log_recipient_created" ON "public"."email_send_log" USING "btree" ("recipient_email", "created_at" DESC);



CREATE INDEX "idx_email_send_log_type_created" ON "public"."email_send_log" USING "btree" ("email_type", "created_at" DESC);



CREATE INDEX "idx_employee_user_mapping_employee" ON "public"."employee_user_mapping" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_user_mapping_user" ON "public"."employee_user_mapping" USING "btree" ("user_id");



CREATE INDEX "idx_employees_department" ON "public"."employees" USING "btree" ("department");



CREATE INDEX "idx_employees_email" ON "public"."employees" USING "btree" ("email");



CREATE INDEX "idx_employees_employee_id" ON "public"."employees" USING "btree" ("employee_id");



CREATE INDEX "idx_employees_is_active" ON "public"."employees" USING "btree" ("is_active");



CREATE INDEX "idx_employees_synced_at" ON "public"."employees" USING "btree" ("synced_at");



CREATE INDEX "idx_eod_submissions_date" ON "public"."team_eod_submissions" USING "btree" ("submission_date" DESC);



CREATE INDEX "idx_eod_submissions_user_date" ON "public"."team_eod_submissions" USING "btree" ("user_id", "submission_date" DESC);



CREATE INDEX "idx_estimate_items_estimate" ON "public"."estimate_items" USING "btree" ("estimate_id");



CREATE INDEX "idx_estimate_items_service" ON "public"."estimate_items" USING "btree" ("service_id");



CREATE INDEX "idx_estimates_created_at" ON "public"."estimates" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_estimates_created_by" ON "public"."estimates" USING "btree" ("created_by");



CREATE INDEX "idx_estimates_is_template" ON "public"."estimates" USING "btree" ("is_template");



CREATE INDEX "idx_estimates_status" ON "public"."estimates" USING "btree" ("status");



CREATE INDEX "idx_feedback_reports_converted_task_id" ON "public"."feedback_reports" USING "btree" ("converted_task_id") WHERE ("converted_task_id" IS NOT NULL);



CREATE INDEX "idx_feedback_reports_feedback_number" ON "public"."feedback_reports" USING "btree" ("feedback_number");



CREATE INDEX "idx_feedback_reports_status" ON "public"."feedback_reports" USING "btree" ("status");



CREATE INDEX "idx_feedback_reports_type" ON "public"."feedback_reports" USING "btree" ("type");



CREATE INDEX "idx_feedback_upvotes_feedback_id" ON "public"."feedback_upvotes" USING "btree" ("feedback_id");



CREATE INDEX "idx_feedback_upvotes_user_id" ON "public"."feedback_upvotes" USING "btree" ("user_id");



CREATE INDEX "idx_gemini_videos_created_at" ON "public"."gemini_videos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_gemini_videos_status" ON "public"."gemini_videos" USING "btree" ("status");



CREATE INDEX "idx_gemini_videos_status_created" ON "public"."gemini_videos" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_gemini_videos_user_created" ON "public"."gemini_videos" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_gemini_videos_user_id" ON "public"."gemini_videos" USING "btree" ("user_id");



CREATE INDEX "idx_gemini_videos_user_status" ON "public"."gemini_videos" USING "btree" ("user_id", "status");



CREATE INDEX "idx_gen_stats_date" ON "public"."image_generation_stats" USING "btree" ("date" DESC);



CREATE INDEX "idx_gen_stats_user_date" ON "public"."image_generation_stats" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_generated_posts_leader" ON "public"."generated_posts" USING "btree" ("leader_id");



CREATE INDEX "idx_generated_posts_scheduled" ON "public"."generated_posts" USING "btree" ("scheduled_for") WHERE ("scheduled_for" IS NOT NULL);



CREATE INDEX "idx_generated_posts_status" ON "public"."generated_posts" USING "btree" ("status");



CREATE INDEX "idx_gohighlevel_contacts_integration_id" ON "public"."gohighlevel_contacts" USING "btree" ("integration_id");



COMMENT ON INDEX "public"."idx_gohighlevel_contacts_integration_id" IS 'Index for FK gohighlevel_contacts.integration_id -> gohighlevel_integrations(id)';



CREATE INDEX "idx_hackathon_participants_employee" ON "public"."hackathon_participants" USING "btree" ("employee_id");



CREATE INDEX "idx_hackathon_participants_event_user" ON "public"."hackathon_participants" USING "btree" ("event_id", "user_id");



CREATE INDEX "idx_hackathon_submissions_event" ON "public"."hackathon_submissions" USING "btree" ("event_id");



CREATE INDEX "idx_hackathon_submissions_team" ON "public"."hackathon_submissions" USING "btree" ("team_id");



CREATE INDEX "idx_hackathon_team_members_participant_id" ON "public"."hackathon_team_members" USING "btree" ("participant_id");



COMMENT ON INDEX "public"."idx_hackathon_team_members_participant_id" IS 'Index for FK hackathon_team_members.participant_id -> hackathon_participants(id)';



CREATE INDEX "idx_hackathon_team_members_team" ON "public"."hackathon_team_members" USING "btree" ("team_id");



CREATE INDEX "idx_hackathon_teams_event" ON "public"."hackathon_teams" USING "btree" ("event_id");



CREATE INDEX "idx_hero_generations_brand_id" ON "public"."hero_section_generations" USING "btree" ("brand_id");



CREATE INDEX "idx_hero_generations_created_at" ON "public"."hero_section_generations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_hero_generations_status" ON "public"."hero_section_generations" USING "btree" ("status");



CREATE INDEX "idx_hero_generations_strategy" ON "public"."hero_section_generations" USING "btree" ("strategy_used");



CREATE INDEX "idx_hero_generations_user_id" ON "public"."hero_section_generations" USING "btree" ("user_id");



CREATE INDEX "idx_hero_logs_created_at" ON "public"."hero_section_generation_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_hero_logs_generation_id" ON "public"."hero_section_generation_logs" USING "btree" ("hero_generation_id");



CREATE INDEX "idx_hero_logs_step_name" ON "public"."hero_section_generation_logs" USING "btree" ("step_name");



CREATE INDEX "idx_hub_agent_runs_agent" ON "public"."hub_agent_runs" USING "btree" ("agent_id");



CREATE INDEX "idx_hub_agent_runs_created" ON "public"."hub_agent_runs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_hub_agent_runs_status" ON "public"."hub_agent_runs" USING "btree" ("status");



CREATE INDEX "idx_hub_agent_runs_user" ON "public"."hub_agent_runs" USING "btree" ("user_id");



CREATE INDEX "idx_hub_agents_category" ON "public"."hub_agents" USING "btree" ("category");



CREATE INDEX "idx_hub_agents_enabled" ON "public"."hub_agents" USING "btree" ("is_enabled");



CREATE INDEX "idx_hub_agents_slug" ON "public"."hub_agents" USING "btree" ("slug");



CREATE INDEX "idx_hub_conversations_agent_user" ON "public"."hub_conversations" USING "btree" ("agent_id", "user_id");



CREATE INDEX "idx_hub_conversations_last_message" ON "public"."hub_conversations" USING "btree" ("last_message_at" DESC NULLS LAST);



CREATE INDEX "idx_hub_conversations_user" ON "public"."hub_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_hub_memories_active" ON "public"."hub_agent_memories" USING "btree" ("is_active");



CREATE INDEX "idx_hub_memories_agent_user" ON "public"."hub_agent_memories" USING "btree" ("agent_id", "user_id");



CREATE INDEX "idx_hub_memories_created" ON "public"."hub_agent_memories" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_hub_memories_embedding" ON "public"."hub_agent_memories" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_hub_memories_type" ON "public"."hub_agent_memories" USING "btree" ("memory_type");



CREATE INDEX "idx_hub_messages_conversation" ON "public"."hub_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_hub_messages_created" ON "public"."hub_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_hub_personalizations_user_agent" ON "public"."hub_personalizations" USING "btree" ("user_id", "agent_id");



CREATE INDEX "idx_influencer_active" ON "public"."influencer_style_library" USING "btree" ("is_active");



CREATE INDEX "idx_integration_logs_created_at" ON "public"."integration_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_integration_logs_performed_by" ON "public"."integration_logs" USING "btree" ("performed_by");



CREATE INDEX "idx_integration_logs_status_created" ON "public"."integration_logs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_integration_logs_type" ON "public"."integration_logs" USING "btree" ("integration_type");



CREATE INDEX "idx_integration_logs_type_created" ON "public"."integration_logs" USING "btree" ("integration_type", "created_at" DESC);



CREATE INDEX "idx_keyword_blog_usage_blog_id" ON "public"."keyword_blog_usage" USING "btree" ("blog_id");



CREATE INDEX "idx_keyword_blog_usage_keyword_id" ON "public"."keyword_blog_usage" USING "btree" ("keyword_id");



CREATE INDEX "idx_keyword_ranking_history_checked_at" ON "public"."keyword_ranking_history" USING "btree" ("checked_at" DESC);



CREATE INDEX "idx_keyword_ranking_history_keyword_id" ON "public"."keyword_ranking_history" USING "btree" ("keyword_id");



CREATE INDEX "idx_keyword_research_brand_id" ON "public"."keyword_research" USING "btree" ("brand_id");



CREATE INDEX "idx_keyword_research_brand_priority" ON "public"."keyword_research" USING "btree" ("brand_id", "priority");



CREATE INDEX "idx_keyword_research_priority" ON "public"."keyword_research" USING "btree" ("priority");



CREATE INDEX "idx_keyword_research_status" ON "public"."keyword_research" USING "btree" ("status");



CREATE INDEX "idx_keyword_suggestions_brand_id" ON "public"."keyword_suggestions" USING "btree" ("brand_id");



CREATE INDEX "idx_keyword_suggestions_expires" ON "public"."keyword_suggestions" USING "btree" ("expires_at");



CREATE INDEX "idx_keyword_suggestions_project_id" ON "public"."keyword_suggestions" USING "btree" ("project_id");



CREATE INDEX "idx_knowledge_active" ON "public"."knowledge_base" USING "btree" ("is_active", "effective_date");



CREATE INDEX "idx_knowledge_base_categories_brand" ON "public"."knowledge_base_categories" USING "btree" ("brand_id", "scope") WHERE ("brand_id" IS NOT NULL);



CREATE INDEX "idx_knowledge_category_active" ON "public"."knowledge_base_categories" USING "btree" ("is_active");



CREATE INDEX "idx_knowledge_embeddings_category_id" ON "public"."knowledge_embeddings" USING "btree" ("category_id");



CREATE INDEX "idx_knowledge_embeddings_file_id" ON "public"."knowledge_embeddings" USING "btree" ("file_id");



CREATE INDEX "idx_knowledge_embeddings_vec_cosine" ON "public"."knowledge_embeddings" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_knowledge_files_brand_id" ON "public"."knowledge_files" USING "btree" ("brand_id");



CREATE INDEX "idx_knowledge_files_brand_status" ON "public"."knowledge_files" USING "btree" ("brand_id", "processing_status") WHERE ("brand_id" IS NOT NULL);



CREATE INDEX "idx_knowledge_files_indexed" ON "public"."knowledge_files" USING "btree" ("is_indexed");



CREATE INDEX "idx_knowledge_files_processing_queue" ON "public"."knowledge_files" USING "btree" ("processing_status", "retry_count", "created_at") WHERE ("processing_status" = ANY (ARRAY['pending'::"public"."processing_status", 'failed'::"public"."processing_status"]));



CREATE INDEX "idx_knowledge_files_source" ON "public"."knowledge_files" USING "btree" ("source_id");



CREATE INDEX "idx_knowledge_files_uploaded_by" ON "public"."knowledge_files" USING "btree" ("uploaded_by");



COMMENT ON INDEX "public"."idx_knowledge_files_uploaded_by" IS 'Index for FK knowledge_files.uploaded_by -> users(id)';



CREATE INDEX "idx_knowledge_keywords" ON "public"."knowledge_base" USING "gin" ("keywords");



CREATE INDEX "idx_knowledge_source_category" ON "public"."knowledge_sources" USING "btree" ("category_id");



CREATE INDEX "idx_knowledge_source_type" ON "public"."knowledge_sources" USING "btree" ("type");



CREATE INDEX "idx_knowledge_sources_brand_id" ON "public"."knowledge_sources" USING "btree" ("brand_id");



CREATE INDEX "idx_knowledge_type" ON "public"."knowledge_base" USING "btree" ("knowledge_type");



CREATE INDEX "idx_leader_uploads_leader" ON "public"."leader_uploads" USING "btree" ("leader_id");



CREATE INDEX "idx_leader_uploads_leader_type" ON "public"."leader_uploads" USING "btree" ("leader_id", "file_type");



CREATE INDEX "idx_leader_uploads_openai_file" ON "public"."leader_uploads" USING "btree" ("openai_file_id") WHERE ("openai_file_id" IS NOT NULL);



CREATE INDEX "idx_leader_uploads_type" ON "public"."leader_uploads" USING "btree" ("file_type");



CREATE INDEX "idx_leaders_template" ON "public"."thought_leaders" USING "btree" ("agent_template_id");



CREATE INDEX "idx_organization_integrations_integration" ON "public"."organization_integrations" USING "btree" ("integration");



CREATE INDEX "idx_performance_date" ON "public"."content_performance_metrics" USING "btree" ("posted_date");



CREATE INDEX "idx_performance_leader" ON "public"."content_performance_metrics" USING "btree" ("leader_id");



CREATE INDEX "idx_performance_post" ON "public"."content_performance_metrics" USING "btree" ("post_id");



CREATE INDEX "idx_pod_members_employee_id" ON "public"."pod_members" USING "btree" ("employee_id");



CREATE INDEX "idx_pod_members_pod_id" ON "public"."pod_members" USING "btree" ("pod_id");



CREATE INDEX "idx_pods_is_active" ON "public"."pods" USING "btree" ("is_active");



CREATE INDEX "idx_pods_pod_id" ON "public"."pods" USING "btree" ("pod_id");



CREATE INDEX "idx_pods_synced_at" ON "public"."pods" USING "btree" ("synced_at");



CREATE INDEX "idx_post_agent_references_agent_id" ON "public"."post_agent_references" USING "btree" ("external_agent_id");



CREATE INDEX "idx_post_agent_references_post_id" ON "public"."post_agent_references" USING "btree" ("post_id");



CREATE INDEX "idx_project_knowledge_embeddings_chunk" ON "public"."project_knowledge_embeddings" USING "btree" ("file_id", "chunk_index");



CREATE INDEX "idx_project_knowledge_embeddings_file_id" ON "public"."project_knowledge_embeddings" USING "btree" ("file_id");



CREATE INDEX "idx_project_knowledge_embeddings_project_id" ON "public"."project_knowledge_embeddings" USING "btree" ("project_id");



CREATE UNIQUE INDEX "idx_project_knowledge_embeddings_unique_file_chunk" ON "public"."project_knowledge_embeddings" USING "btree" ("file_id", "chunk_index");



CREATE INDEX "idx_project_knowledge_embeddings_vector" ON "public"."project_knowledge_embeddings" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_project_knowledge_files_processing_queue" ON "public"."project_knowledge_files" USING "btree" ("processing_status", "retry_count", "created_at") WHERE ("processing_status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));



CREATE INDEX "idx_project_knowledge_files_project_id" ON "public"."project_knowledge_files" USING "btree" ("project_id");



CREATE INDEX "idx_project_knowledge_files_source_id" ON "public"."project_knowledge_files" USING "btree" ("source_id");



CREATE INDEX "idx_project_knowledge_sources_project_id" ON "public"."project_knowledge_sources" USING "btree" ("project_id");



CREATE INDEX "idx_project_meetings_meeting_id" ON "public"."project_meetings" USING "btree" ("meeting_id");



CREATE INDEX "idx_project_meetings_project_id" ON "public"."project_meetings" USING "btree" ("project_id");



CREATE INDEX "idx_project_meetings_start_time" ON "public"."project_meetings" USING "btree" ("start_time" DESC);



CREATE INDEX "idx_project_task_comments_activecollab_id" ON "public"."project_task_comments" USING "btree" ("activecollab_comment_id");



CREATE INDEX "idx_project_task_comments_is_deleted" ON "public"."project_task_comments" USING "btree" ("task_id", "is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "idx_project_task_comments_task_id" ON "public"."project_task_comments" USING "btree" ("task_id");



CREATE INDEX "idx_project_tasks_activecollab_created_on" ON "public"."project_tasks" USING "btree" ("activecollab_created_on");



CREATE INDEX "idx_project_tasks_activecollab_id" ON "public"."project_tasks" USING "btree" ("activecollab_task_id");



CREATE INDEX "idx_project_tasks_assigned_to" ON "public"."project_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_project_tasks_brand_id" ON "public"."project_tasks" USING "btree" ("brand_id");



CREATE INDEX "idx_project_tasks_category" ON "public"."project_tasks" USING "btree" ("category");



CREATE INDEX "idx_project_tasks_client_id" ON "public"."project_tasks" USING "btree" ("client_id");



COMMENT ON INDEX "public"."idx_project_tasks_client_id" IS 'Index for FK project_tasks.client_id -> clients(id)';



CREATE INDEX "idx_project_tasks_created_by" ON "public"."project_tasks" USING "btree" ("created_by");



COMMENT ON INDEX "public"."idx_project_tasks_created_by" IS 'Index for FK project_tasks.created_by -> users(id)';



CREATE INDEX "idx_project_tasks_external_id" ON "public"."project_tasks" USING "btree" ("external_task_id");



CREATE INDEX "idx_project_tasks_project_id" ON "public"."project_tasks" USING "btree" ("project_id");



CREATE INDEX "idx_project_tasks_status" ON "public"."project_tasks" USING "btree" ("status");



CREATE INDEX "idx_projects_activecollab_id" ON "public"."projects" USING "btree" ("activecollab_project_id");



CREATE INDEX "idx_projects_client_id" ON "public"."projects" USING "btree" ("client_id");



CREATE INDEX "idx_projects_control_tower_id" ON "public"."projects" USING "btree" ("control_tower_project_id");



CREATE INDEX "idx_projects_external_id" ON "public"."projects" USING "btree" ("external_project_id");



CREATE INDEX "idx_projects_project_manager" ON "public"."projects" USING "btree" ("project_manager");



COMMENT ON INDEX "public"."idx_projects_project_manager" IS 'Index for FK projects.project_manager -> users(id)';



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("status");



CREATE INDEX "idx_prompt_templates_category" ON "public"."image_prompt_templates" USING "btree" ("category", "is_active");



CREATE INDEX "idx_prompt_templates_featured" ON "public"."image_prompt_templates" USING "btree" ("is_featured", "is_active") WHERE ("is_featured" = true);



CREATE INDEX "idx_reel_hook_generations_brand_id" ON "public"."reel_hook_generations" USING "btree" ("brand_id");



CREATE INDEX "idx_reel_hook_generations_created_at" ON "public"."reel_hook_generations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reel_hook_generations_goal" ON "public"."reel_hook_generations" USING "btree" ("primary_goal");



CREATE INDEX "idx_reel_hook_generations_platform" ON "public"."reel_hook_generations" USING "btree" ("platform");



CREATE INDEX "idx_reel_hook_generations_status" ON "public"."reel_hook_generations" USING "btree" ("status");



CREATE INDEX "idx_reel_hook_generations_user_id" ON "public"."reel_hook_generations" USING "btree" ("user_id");



CREATE INDEX "idx_reel_hook_logs_created_at" ON "public"."reel_hook_generation_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reel_hook_logs_generation_id" ON "public"."reel_hook_generation_logs" USING "btree" ("reel_hook_generation_id");



CREATE INDEX "idx_reel_hook_logs_step_name" ON "public"."reel_hook_generation_logs" USING "btree" ("step_name");



CREATE INDEX "idx_role_permissions_role" ON "public"."role_permissions" USING "btree" ("role");



CREATE INDEX "idx_safety_blocks_pending" ON "public"."image_safety_blocks" USING "btree" ("admin_status", "created_at" DESC) WHERE ("admin_status" = 'pending'::"text");



CREATE INDEX "idx_safety_blocks_status" ON "public"."image_safety_blocks" USING "btree" ("admin_status");



CREATE INDEX "idx_safety_blocks_user" ON "public"."image_safety_blocks" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_seo_blog_content_brand_id" ON "public"."seo_blog_content" USING "btree" ("brand_id");



CREATE INDEX "idx_seo_blog_content_created_at" ON "public"."seo_blog_content" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_seo_blog_content_leader" ON "public"."seo_blog_content" USING "btree" ("leader_id");



CREATE INDEX "idx_seo_blog_content_status" ON "public"."seo_blog_content" USING "btree" ("status");



CREATE INDEX "idx_seo_blog_content_user_id" ON "public"."seo_blog_content" USING "btree" ("user_id");



CREATE INDEX "idx_seo_blog_generation_logs_blog_id" ON "public"."seo_blog_generation_logs" USING "btree" ("blog_id");



CREATE INDEX "idx_seo_reference_summaries_url" ON "public"."seo_reference_summaries" USING "btree" ("reference_url");



CREATE INDEX "idx_service_categories_active_sort" ON "public"."service_categories" USING "btree" ("is_active", "sort_order");



CREATE INDEX "idx_services_active_sort" ON "public"."services" USING "btree" ("is_active", "sort_order");



CREATE INDEX "idx_services_category" ON "public"."services" USING "btree" ("category_id");



CREATE INDEX "idx_services_created_by" ON "public"."services" USING "btree" ("created_by");



CREATE INDEX "idx_shared_folders_created_by" ON "public"."image_shared_folders" USING "btree" ("created_by");



CREATE INDEX "idx_sora_videos_brand_created" ON "public"."sora_videos" USING "btree" ("brand_id", "created_at" DESC);



CREATE INDEX "idx_sora_videos_brand_id" ON "public"."sora_videos" USING "btree" ("brand_id");



CREATE INDEX "idx_sora_videos_created_at" ON "public"."sora_videos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sora_videos_status" ON "public"."sora_videos" USING "btree" ("status");



CREATE INDEX "idx_sora_videos_status_created" ON "public"."sora_videos" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_sora_videos_user_created" ON "public"."sora_videos" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_sora_videos_user_id" ON "public"."sora_videos" USING "btree" ("user_id");



CREATE INDEX "idx_style_presets_active" ON "public"."image_style_presets" USING "btree" ("is_active", "sort_order");



CREATE INDEX "idx_style_presets_category" ON "public"."image_style_presets" USING "btree" ("category");



CREATE INDEX "idx_sync_logs_started_at" ON "public"."control_tower_sync_logs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_sync_logs_status" ON "public"."control_tower_sync_logs" USING "btree" ("status");



CREATE INDEX "idx_sync_logs_sync_type" ON "public"."control_tower_sync_logs" USING "btree" ("sync_type");



CREATE INDEX "idx_task_comments_task_id" ON "public"."task_comments" USING "btree" ("task_id");



CREATE INDEX "idx_task_comments_user_id" ON "public"."task_comments" USING "btree" ("user_id");



CREATE INDEX "idx_team_daily_summaries_agent_run_id" ON "public"."team_daily_summaries" USING "btree" ("agent_run_id");



COMMENT ON INDEX "public"."idx_team_daily_summaries_agent_run_id" IS 'Index for FK team_daily_summaries.agent_run_id -> ai_agent_runs(id)';



CREATE INDEX "idx_team_daily_summaries_eod_submission_id" ON "public"."team_daily_summaries" USING "btree" ("eod_submission_id");



COMMENT ON INDEX "public"."idx_team_daily_summaries_eod_submission_id" IS 'Index for FK team_daily_summaries.eod_submission_id -> team_eod_submissions(id)';



CREATE INDEX "idx_testimonial_tokens_expires" ON "public"."testimonial_submission_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_testimonial_tokens_token" ON "public"."testimonial_submission_tokens" USING "btree" ("token");



CREATE INDEX "idx_testimonials_assigned" ON "public"."client_testimonials" USING "btree" ("assigned_to");



CREATE INDEX "idx_testimonials_brand" ON "public"."client_testimonials" USING "btree" ("brand_id");



CREATE INDEX "idx_testimonials_client" ON "public"."client_testimonials" USING "btree" ("client_id");



CREATE INDEX "idx_testimonials_status" ON "public"."client_testimonials" USING "btree" ("status");



CREATE INDEX "idx_testimonials_type" ON "public"."client_testimonials" USING "btree" ("type");



CREATE INDEX "idx_thought_leaders_brand" ON "public"."thought_leaders" USING "btree" ("brand_id");



CREATE INDEX "idx_thought_leaders_user_id" ON "public"."thought_leaders" USING "btree" ("user_id");



CREATE INDEX "idx_tournament_email_sends_key_run" ON "public"."tournament_email_sends" USING "btree" ("tournament_key", "run_at" DESC);



CREATE INDEX "idx_user_accountability_chart_user_id" ON "public"."user_accountability_chart" USING "btree" ("user_id");



CREATE INDEX "idx_user_brands_brand_id" ON "public"."user_brands" USING "btree" ("brand_id");



CREATE INDEX "idx_user_brands_user_id" ON "public"."user_brands" USING "btree" ("user_id");



CREATE INDEX "idx_user_login_tracking_user_time" ON "public"."user_login_tracking" USING "btree" ("user_id", "login_at" DESC);



CREATE INDEX "idx_user_permissions_module" ON "public"."user_permissions" USING "btree" ("module_name");



CREATE INDEX "idx_user_permissions_user_id" ON "public"."user_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_user_quotas_user" ON "public"."image_user_quotas" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



COMMENT ON INDEX "public"."idx_user_roles_user_id" IS 'Index for FK user_roles.user_id -> auth.users(id)';



CREATE INDEX "idx_users_status" ON "public"."users" USING "btree" ("status");



CREATE INDEX "idx_vision_examples_active" ON "public"."vision_examples" USING "btree" ("is_active");



CREATE INDEX "idx_vision_examples_agent_slug" ON "public"."vision_examples" USING "btree" ("agent_slug");



CREATE INDEX "idx_wc_api_keys_active" ON "public"."wc_api_keys" USING "btree" ("api_key_hash") WHERE ("is_active" = true);



CREATE INDEX "idx_wc_matches_kickoff" ON "public"."wc_matches" USING "btree" ("kickoff_at");



CREATE INDEX "idx_wc_matches_round_key" ON "public"."wc_matches" USING "btree" ("round_key");



CREATE INDEX "idx_wc_matches_status" ON "public"."wc_matches" USING "btree" ("status");



CREATE INDEX "idx_wc_predictions_match" ON "public"."wc_predictions" USING "btree" ("match_id");



CREATE INDEX "idx_wc_predictions_user" ON "public"."wc_predictions" USING "btree" ("user_id");



CREATE INDEX "idx_wc_sync_logs_started" ON "public"."wc_sync_logs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_weekly_trends_idea_source" ON "public"."weekly_trends" USING "btree" ("idea_source");



CREATE INDEX "idx_weekly_trends_leader_status" ON "public"."weekly_trends" USING "btree" ("leader_id", "status");



CREATE INDEX "idx_weekly_trends_leader_week" ON "public"."weekly_trends" USING "btree" ("leader_id", "week_start" DESC);



CREATE INDEX "idx_weekly_trends_status" ON "public"."weekly_trends" USING "btree" ("status");



CREATE UNIQUE INDEX "project_knowledge_files_source_external_unique" ON "public"."project_knowledge_files" USING "btree" ("source_id", "external_id") WHERE ("external_id" IS NOT NULL);



CREATE UNIQUE INDEX "uniq_brand_google_analytics" ON "public"."brand_analytics_integrations" USING "btree" ("brand_id") WHERE ("integration_type" = 'google_analytics'::"text");



COMMENT ON INDEX "public"."uniq_brand_google_analytics" IS 'Ensures each brand can only have one google_analytics integration type. Multiple legacy types (ga4, n8n_analytics) may still exist but new configs use google_analytics.';



CREATE OR REPLACE TRIGGER "before_update_store_assigned_to" BEFORE UPDATE ON "public"."project_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."store_old_task_assigned_to"();



CREATE OR REPLACE TRIGGER "content_repurpose_assets_set_updated_at" BEFORE UPDATE ON "public"."content_repurpose_assets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "content_repurpose_packs_set_updated_at" BEFORE UPDATE ON "public"."content_repurpose_packs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "content_repurpose_performance_set_updated_at" BEFORE UPDATE ON "public"."content_repurpose_performance" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "hub_auto_generate_conversation_title" AFTER INSERT ON "public"."hub_messages" FOR EACH ROW EXECUTE FUNCTION "public"."hub_generate_conversation_title"();



CREATE OR REPLACE TRIGGER "hub_update_conversation_stats_on_message" AFTER INSERT ON "public"."hub_messages" FOR EACH ROW EXECUTE FUNCTION "public"."hub_update_conversation_stats"();



CREATE OR REPLACE TRIGGER "on_auth_user_created_link_leader" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."auto_link_thought_leader"();



CREATE OR REPLACE TRIGGER "set_leader_slug_trigger" BEFORE INSERT OR UPDATE ON "public"."thought_leaders" FOR EACH ROW EXECUTE FUNCTION "public"."set_leader_slug"();



CREATE OR REPLACE TRIGGER "set_organization_integrations_updated_at" BEFORE UPDATE ON "public"."organization_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."control_tower_api_keys" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_user_activecollab_settings" BEFORE UPDATE ON "public"."user_activecollab_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "sync_bearer_token_on_insert" BEFORE INSERT ON "public"."activecollab_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."sync_bearer_token_from_email"();



CREATE OR REPLACE TRIGGER "tournament_email_config_updated_at" BEFORE UPDATE ON "public"."tournament_email_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_users_set_timestamp" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_analytics_api_keys_updated_at" BEFORE UPDATE ON "public"."analytics_api_keys" FOR EACH ROW EXECUTE FUNCTION "public"."update_analytics_api_keys_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_feedback_upvotes" AFTER INSERT OR DELETE ON "public"."feedback_upvotes" FOR EACH ROW EXECUTE FUNCTION "public"."update_feedback_upvotes_count"();



CREATE OR REPLACE TRIGGER "update_activecollab_credentials_updated_at" BEFORE UPDATE ON "public"."activecollab_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activecollab_task_data_updated_at" BEFORE UPDATE ON "public"."activecollab_task_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_admin_google_drive_folders_updated_at" BEFORE UPDATE ON "public"."admin_google_drive_folders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agent_session_memory_updated_at" BEFORE UPDATE ON "public"."agent_session_memory" FOR EACH ROW EXECUTE FUNCTION "public"."update_agent_memory_timestamp"();



CREATE OR REPLACE TRIGGER "update_agent_tool_definitions_updated_at" BEFORE UPDATE ON "public"."agent_tool_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."update_agent_memory_timestamp"();



CREATE OR REPLACE TRIGGER "update_ai_agent_knowledge_selection_updated_at" BEFORE UPDATE ON "public"."ai_agent_knowledge_selection" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_brand_analytics_integrations_updated_at" BEFORE UPDATE ON "public"."brand_analytics_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_brand_kpis_updated_at" BEFORE UPDATE ON "public"."brand_kpis" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_brands_updated_at" BEFORE UPDATE ON "public"."brands" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_testimonials_updated_at" BEFORE UPDATE ON "public"."client_testimonials" FOR EACH ROW EXECUTE FUNCTION "public"."update_testimonials_updated_at"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_code_analysis_results_updated_at" BEFORE UPDATE ON "public"."code_analysis_results" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_code_generation_templates_updated_at" BEFORE UPDATE ON "public"."code_generation_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_code_repositories_updated_at" BEFORE UPDATE ON "public"."code_repositories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_knowledge_categories_updated_at" BEFORE UPDATE ON "public"."knowledge_base_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_daily_head_starts_updated_at" BEFORE UPDATE ON "public"."daily_head_starts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_deals_updated_at" BEFORE UPDATE ON "public"."deals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_documentation_output_config_updated_at" BEFORE UPDATE ON "public"."documentation_output_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_documentation_repository_links_updated_at" BEFORE UPDATE ON "public"."documentation_repository_links" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_documentation_rules_updated_at" BEFORE UPDATE ON "public"."documentation_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_documentation_templates_updated_at" BEFORE UPDATE ON "public"."documentation_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_eod_submissions_updated_at" BEFORE UPDATE ON "public"."team_eod_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_estimates_updated_at" BEFORE UPDATE ON "public"."estimates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_feedback_reports_updated_at" BEFORE UPDATE ON "public"."feedback_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_generated_posts_updated_at" BEFORE UPDATE ON "public"."generated_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hub_agent_runs_updated_at" BEFORE UPDATE ON "public"."hub_agent_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hub_agents_updated_at" BEFORE UPDATE ON "public"."hub_agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hub_conversations_updated_at" BEFORE UPDATE ON "public"."hub_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hub_personalizations_updated_at" BEFORE UPDATE ON "public"."hub_personalizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_keyword_research_updated_at" BEFORE UPDATE ON "public"."keyword_research" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_knowledge_files_updated_at" BEFORE UPDATE ON "public"."knowledge_files" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_knowledge_sources_updated_at" BEFORE UPDATE ON "public"."knowledge_sources" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_n8n_workflow_configs_updated_at" BEFORE UPDATE ON "public"."n8n_workflow_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_newsletter_sources_updated_at" BEFORE UPDATE ON "public"."newsletter_sources" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_perplexity_settings_updated_at" BEFORE UPDATE ON "public"."perplexity_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_knowledge_embeddings_updated_at" BEFORE UPDATE ON "public"."project_knowledge_embeddings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_knowledge_files_updated_at" BEFORE UPDATE ON "public"."project_knowledge_files" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_knowledge_sources_updated_at" BEFORE UPDATE ON "public"."project_knowledge_sources" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_meetings_updated_at_trigger" BEFORE UPDATE ON "public"."project_meetings" FOR EACH ROW EXECUTE FUNCTION "public"."update_project_meetings_updated_at"();



CREATE OR REPLACE TRIGGER "update_project_tasks_updated_at" BEFORE UPDATE ON "public"."project_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_role_permissions_updated_at" BEFORE UPDATE ON "public"."role_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_role_permissions_updated_at"();



CREATE OR REPLACE TRIGGER "update_seo_blog_content_updated_at" BEFORE UPDATE ON "public"."seo_blog_content" FOR EACH ROW EXECUTE FUNCTION "public"."update_seo_blog_updated_at"();



CREATE OR REPLACE TRIGGER "update_service_categories_updated_at" BEFORE UPDATE ON "public"."service_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_services_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_comments_updated_at" BEFORE UPDATE ON "public"."task_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_team_daily_summaries_updated_at" BEFORE UPDATE ON "public"."team_daily_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_thought_leaders_updated_at" BEFORE UPDATE ON "public"."thought_leaders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_accountability_chart_updated_at" BEFORE UPDATE ON "public"."user_accountability_chart" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_brands_updated_at" BEFORE UPDATE ON "public"."user_brands" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_google_tokens_updated_at" BEFORE UPDATE ON "public"."user_google_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_permissions_updated_at" BEFORE UPDATE ON "public"."user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vision_examples_updated_at" BEFORE UPDATE ON "public"."vision_examples" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "wc_api_keys_updated_at" BEFORE UPDATE ON "public"."wc_api_keys" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "wc_matches_updated_at" BEFORE UPDATE ON "public"."wc_matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "wc_predictions_updated_at" BEFORE UPDATE ON "public"."wc_predictions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "wc_settings_updated_at" BEFORE UPDATE ON "public"."wc_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activecollab_credentials"
    ADD CONSTRAINT "activecollab_credentials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."activecollab_credentials"
    ADD CONSTRAINT "activecollab_credentials_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."activecollab_sync_logs"
    ADD CONSTRAINT "activecollab_sync_logs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."activecollab_task_data"
    ADD CONSTRAINT "activecollab_task_data_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activecollab_task_data"
    ADD CONSTRAINT "activecollab_task_data_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_google_drive_folders"
    ADD CONSTRAINT "admin_google_drive_folders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agent_execution_steps"
    ADD CONSTRAINT "agent_execution_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."ai_agent_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_memories"
    ADD CONSTRAINT "agent_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_pending_approvals"
    ADD CONSTRAINT "agent_pending_approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agent_pending_approvals"
    ADD CONSTRAINT "agent_pending_approvals_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agent_pending_approvals"
    ADD CONSTRAINT "agent_pending_approvals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."ai_agent_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_pending_approvals"
    ADD CONSTRAINT "agent_pending_approvals_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."agent_execution_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_session_memory"
    ADD CONSTRAINT "agent_session_memory_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_session_memory"
    ADD CONSTRAINT "agent_session_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_tool_calls"
    ADD CONSTRAINT "agent_tool_calls_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_tool_calls"
    ADD CONSTRAINT "agent_tool_calls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agent_tool_calls"
    ADD CONSTRAINT "agent_tool_calls_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_tool_definitions"
    ADD CONSTRAINT "agent_tool_definitions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agent_knowledge_selection"
    ADD CONSTRAINT "ai_agent_knowledge_selection_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agent_knowledge_selection"
    ADD CONSTRAINT "ai_agent_knowledge_selection_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_base_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_agent_runs"
    ADD CONSTRAINT "ai_agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id");



ALTER TABLE ONLY "public"."ai_generated_images"
    ADD CONSTRAINT "ai_generated_images_override_by_fkey" FOREIGN KEY ("override_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ai_generated_images"
    ADD CONSTRAINT "ai_generated_images_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_generated_images"("id");



ALTER TABLE ONLY "public"."ai_generated_images"
    ADD CONSTRAINT "ai_generated_images_shared_folder_id_fkey" FOREIGN KEY ("shared_folder_id") REFERENCES "public"."image_shared_folders"("id");



ALTER TABLE ONLY "public"."ai_generated_images"
    ADD CONSTRAINT "ai_generated_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_shared_resources"
    ADD CONSTRAINT "ai_shared_resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."analytics_api_keys"
    ADD CONSTRAINT "analytics_api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_analytics_data"
    ADD CONSTRAINT "brand_analytics_data_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_analytics_data"
    ADD CONSTRAINT "brand_analytics_data_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."brand_analytics_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_analytics_integrations"
    ADD CONSTRAINT "brand_analytics_integrations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_analytics_integrations"
    ADD CONSTRAINT "brand_analytics_integrations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."brand_file_comments"
    ADD CONSTRAINT "brand_file_comments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."brand_knowledge_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_file_comments"
    ADD CONSTRAINT "brand_file_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."brand_generated_posts"
    ADD CONSTRAINT "brand_generated_posts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_generated_posts"
    ADD CONSTRAINT "brand_generated_posts_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."thought_leaders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_knowledge_embeddings"
    ADD CONSTRAINT "brand_knowledge_embeddings_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_knowledge_embeddings"
    ADD CONSTRAINT "brand_knowledge_embeddings_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."knowledge_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_knowledge_files"
    ADD CONSTRAINT "brand_knowledge_files_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_knowledge_files"
    ADD CONSTRAINT "brand_knowledge_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."brand_kpis"
    ADD CONSTRAINT "brand_kpis_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_co_owner_id_fkey" FOREIGN KEY ("co_owner_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."client_testimonials"
    ADD CONSTRAINT "client_testimonials_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_testimonials"
    ADD CONSTRAINT "client_testimonials_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_testimonials"
    ADD CONSTRAINT "client_testimonials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_testimonials"
    ADD CONSTRAINT "client_testimonials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."knowledge_base"
    ADD CONSTRAINT "company_knowledge_base_migrated_to_file_id_fkey" FOREIGN KEY ("migrated_to_file_id") REFERENCES "public"."knowledge_files"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."knowledge_base"
    ADD CONSTRAINT "company_knowledge_base_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."knowledge_base_files"
    ADD CONSTRAINT "company_knowledge_files_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "public"."knowledge_base"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_performance_metrics"
    ADD CONSTRAINT "content_performance_metrics_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."thought_leaders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_performance_metrics"
    ADD CONSTRAINT "content_performance_metrics_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."generated_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_repurpose_assets"
    ADD CONSTRAINT "content_repurpose_assets_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."content_repurpose_packs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_repurpose_packs"
    ADD CONSTRAINT "content_repurpose_packs_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_repurpose_packs"
    ADD CONSTRAINT "content_repurpose_packs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_repurpose_packs"
    ADD CONSTRAINT "content_repurpose_packs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_repurpose_performance"
    ADD CONSTRAINT "content_repurpose_performance_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."content_repurpose_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_repurpose_performance"
    ADD CONSTRAINT "content_repurpose_performance_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."control_tower_api_keys"
    ADD CONSTRAINT "control_tower_api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_head_starts"
    ADD CONSTRAINT "daily_head_starts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deep_research_results"
    ADD CONSTRAINT "deep_research_results_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deep_research_results"
    ADD CONSTRAINT "deep_research_results_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."deep_research_results"
    ADD CONSTRAINT "deep_research_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentation_output_config"
    ADD CONSTRAINT "documentation_output_config_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentation_repository_links"
    ADD CONSTRAINT "documentation_repository_links_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentation_repository_links"
    ADD CONSTRAINT "documentation_repository_links_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."code_repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentation_rules"
    ADD CONSTRAINT "documentation_rules_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentation_templates"
    ADD CONSTRAINT "documentation_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_notifications_log"
    ADD CONSTRAINT "email_notifications_log_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."employee_user_mapping"
    ADD CONSTRAINT "employee_user_mapping_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_user_mapping"
    ADD CONSTRAINT "employee_user_mapping_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_items"
    ADD CONSTRAINT "estimate_items_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_items"
    ADD CONSTRAINT "estimate_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."feedback_comments"
    ADD CONSTRAINT "feedback_comments_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_comments"
    ADD CONSTRAINT "feedback_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."feedback_reports"
    ADD CONSTRAINT "feedback_reports_converted_task_id_fkey" FOREIGN KEY ("converted_task_id") REFERENCES "public"."project_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_reports"
    ADD CONSTRAINT "feedback_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."feedback_reports"
    ADD CONSTRAINT "feedback_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."feedback_upvotes"
    ADD CONSTRAINT "feedback_upvotes_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_upvotes"
    ADD CONSTRAINT "feedback_upvotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gohighlevel_integrations"
    ADD CONSTRAINT "fk_ghl_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gemini_videos"
    ADD CONSTRAINT "gemini_videos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_posts"
    ADD CONSTRAINT "generated_posts_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."thought_leaders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gohighlevel_contacts"
    ADD CONSTRAINT "gohighlevel_contacts_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."gohighlevel_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_events"
    ADD CONSTRAINT "hackathon_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."hackathon_judges"
    ADD CONSTRAINT "hackathon_judges_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."hackathon_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_judges"
    ADD CONSTRAINT "hackathon_judges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_participants"
    ADD CONSTRAINT "hackathon_participants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_participants"
    ADD CONSTRAINT "hackathon_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."hackathon_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_participants"
    ADD CONSTRAINT "hackathon_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_scores"
    ADD CONSTRAINT "hackathon_scores_judge_id_fkey" FOREIGN KEY ("judge_id") REFERENCES "public"."hackathon_judges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_scores"
    ADD CONSTRAINT "hackathon_scores_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."hackathon_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_submissions"
    ADD CONSTRAINT "hackathon_submissions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."hackathon_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_submissions"
    ADD CONSTRAINT "hackathon_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."hackathon_participants"("id");



ALTER TABLE ONLY "public"."hackathon_submissions"
    ADD CONSTRAINT "hackathon_submissions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."hackathon_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_team_members"
    ADD CONSTRAINT "hackathon_team_members_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."hackathon_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_team_members"
    ADD CONSTRAINT "hackathon_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."hackathon_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hackathon_teams"
    ADD CONSTRAINT "hackathon_teams_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "public"."hackathon_participants"("id");



ALTER TABLE ONLY "public"."hackathon_teams"
    ADD CONSTRAINT "hackathon_teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."hackathon_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hero_section_generation_logs"
    ADD CONSTRAINT "hero_section_generation_logs_hero_generation_id_fkey" FOREIGN KEY ("hero_generation_id") REFERENCES "public"."hero_section_generations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hero_section_generations"
    ADD CONSTRAINT "hero_section_generations_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "public"."ai_agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hero_section_generations"
    ADD CONSTRAINT "hero_section_generations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hero_section_generations"
    ADD CONSTRAINT "hero_section_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_agent_memories"
    ADD CONSTRAINT "hub_agent_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."hub_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_agent_memories"
    ADD CONSTRAINT "hub_agent_memories_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."hub_agent_memories"("id");



ALTER TABLE ONLY "public"."hub_agent_memories"
    ADD CONSTRAINT "hub_agent_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_agent_runs"
    ADD CONSTRAINT "hub_agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."hub_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_agent_runs"
    ADD CONSTRAINT "hub_agent_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_conversations"
    ADD CONSTRAINT "hub_conversations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."hub_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_conversations"
    ADD CONSTRAINT "hub_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_messages"
    ADD CONSTRAINT "hub_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."hub_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_personalizations"
    ADD CONSTRAINT "hub_personalizations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."hub_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_personalizations"
    ADD CONSTRAINT "hub_personalizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."image_generation_stats"
    ADD CONSTRAINT "image_generation_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."image_prompt_templates"
    ADD CONSTRAINT "image_prompt_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."image_safety_blocks"
    ADD CONSTRAINT "image_safety_blocks_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."ai_generated_images"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."image_safety_blocks"
    ADD CONSTRAINT "image_safety_blocks_override_by_fkey" FOREIGN KEY ("override_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."image_safety_blocks"
    ADD CONSTRAINT "image_safety_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."image_shared_folders"
    ADD CONSTRAINT "image_shared_folders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."image_user_quotas"
    ADD CONSTRAINT "image_user_quotas_override_by_fkey" FOREIGN KEY ("override_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."image_user_quotas"
    ADD CONSTRAINT "image_user_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_logs"
    ADD CONSTRAINT "integration_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."keyword_blog_usage"
    ADD CONSTRAINT "keyword_blog_usage_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "public"."seo_blog_content"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."keyword_blog_usage"
    ADD CONSTRAINT "keyword_blog_usage_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "public"."keyword_research"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."keyword_ranking_history"
    ADD CONSTRAINT "keyword_ranking_history_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "public"."keyword_research"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."keyword_research"
    ADD CONSTRAINT "keyword_research_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."keyword_research"
    ADD CONSTRAINT "keyword_research_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."keyword_suggestions"
    ADD CONSTRAINT "keyword_suggestions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."keyword_suggestions"
    ADD CONSTRAINT "keyword_suggestions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."keyword_suggestions"
    ADD CONSTRAINT "keyword_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_base_categories"
    ADD CONSTRAINT "knowledge_base_categories_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_embeddings"
    ADD CONSTRAINT "knowledge_embeddings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_base_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_embeddings"
    ADD CONSTRAINT "knowledge_embeddings_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."knowledge_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_files"
    ADD CONSTRAINT "knowledge_files_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_files"
    ADD CONSTRAINT "knowledge_files_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_files"
    ADD CONSTRAINT "knowledge_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."knowledge_sources"
    ADD CONSTRAINT "knowledge_sources_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_sources"
    ADD CONSTRAINT "knowledge_sources_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_base_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leader_uploads"
    ADD CONSTRAINT "leader_uploads_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."thought_leaders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."linkedin_agent_templates"
    ADD CONSTRAINT "linkedin_agent_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."n8n_workflow_configs"
    ADD CONSTRAINT "n8n_workflow_configs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_integrations"
    ADD CONSTRAINT "organization_integrations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."perplexity_settings"
    ADD CONSTRAINT "perplexity_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_members"
    ADD CONSTRAINT "pod_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_members"
    ADD CONSTRAINT "pod_members_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "public"."pods"("pod_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_agent_references"
    ADD CONSTRAINT "post_agent_references_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."brand_generated_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_knowledge_embeddings"
    ADD CONSTRAINT "project_knowledge_embeddings_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."project_knowledge_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_knowledge_embeddings"
    ADD CONSTRAINT "project_knowledge_embeddings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_knowledge_files"
    ADD CONSTRAINT "project_knowledge_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_knowledge_files"
    ADD CONSTRAINT "project_knowledge_files_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."project_knowledge_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_knowledge_sources"
    ADD CONSTRAINT "project_knowledge_sources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_meetings"
    ADD CONSTRAINT "project_meetings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_task_comments"
    ADD CONSTRAINT "project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reel_hook_generation_logs"
    ADD CONSTRAINT "reel_hook_generation_logs_reel_hook_generation_id_fkey" FOREIGN KEY ("reel_hook_generation_id") REFERENCES "public"."reel_hook_generations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reel_hook_generations"
    ADD CONSTRAINT "reel_hook_generations_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "public"."ai_agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reel_hook_generations"
    ADD CONSTRAINT "reel_hook_generations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reel_hook_generations"
    ADD CONSTRAINT "reel_hook_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."seo_blog_content"
    ADD CONSTRAINT "seo_blog_content_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seo_blog_content"
    ADD CONSTRAINT "seo_blog_content_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."thought_leaders"("id");



ALTER TABLE ONLY "public"."seo_blog_content"
    ADD CONSTRAINT "seo_blog_content_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seo_blog_generation_logs"
    ADD CONSTRAINT "seo_blog_generation_logs_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "public"."seo_blog_content"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sora_videos"
    ADD CONSTRAINT "sora_videos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_daily_summaries"
    ADD CONSTRAINT "team_daily_summaries_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "public"."ai_agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_daily_summaries"
    ADD CONSTRAINT "team_daily_summaries_eod_submission_id_fkey" FOREIGN KEY ("eod_submission_id") REFERENCES "public"."team_eod_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_daily_summaries"
    ADD CONSTRAINT "team_daily_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_eod_submissions"
    ADD CONSTRAINT "team_eod_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."testimonial_submission_tokens"
    ADD CONSTRAINT "testimonial_submission_tokens_testimonial_id_fkey" FOREIGN KEY ("testimonial_id") REFERENCES "public"."client_testimonials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thought_leaders"
    ADD CONSTRAINT "thought_leaders_agent_template_id_fkey" FOREIGN KEY ("agent_template_id") REFERENCES "public"."linkedin_agent_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."thought_leaders"
    ADD CONSTRAINT "thought_leaders_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."thought_leaders"
    ADD CONSTRAINT "thought_leaders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_email_sends"
    ADD CONSTRAINT "tournament_email_sends_tournament_key_fkey" FOREIGN KEY ("tournament_key") REFERENCES "public"."tournament_email_config"("tournament_key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_accountability_chart"
    ADD CONSTRAINT "user_accountability_chart_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_activecollab_settings"
    ADD CONSTRAINT "user_activecollab_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_brands"
    ADD CONSTRAINT "user_brands_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_brands"
    ADD CONSTRAINT "user_brands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_google_tokens"
    ADD CONSTRAINT "user_google_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_login_tracking"
    ADD CONSTRAINT "user_login_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wc_api_keys"
    ADD CONSTRAINT "wc_api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wc_predictions"
    ADD CONSTRAINT "wc_predictions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."wc_matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wc_predictions"
    ADD CONSTRAINT "wc_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wc_round_winners"
    ADD CONSTRAINT "wc_round_winners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_trends"
    ADD CONSTRAINT "weekly_trends_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."weekly_trends"
    ADD CONSTRAINT "weekly_trends_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."thought_leaders"("id") ON DELETE CASCADE;



CREATE POLICY "Admins and managers can view integration logs" ON "public"."integration_logs" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can delete ActiveCollab settings" ON "public"."user_activecollab_settings" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_superadmin"("auth"."uid"()));



CREATE POLICY "Admins can delete project tasks" ON "public"."project_tasks" FOR DELETE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can delete reference summaries" ON "public"."seo_reference_summaries" FOR DELETE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can insert ActiveCollab settings" ON "public"."user_activecollab_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_superadmin"("auth"."uid"()));



CREATE POLICY "Admins can manage GoHighLevel integrations" ON "public"."gohighlevel_integrations" TO "authenticated" USING ("public"."is_admin_or_superadmin"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_superadmin"("auth"."uid"()));



CREATE POLICY "Admins can manage Google Drive settings" ON "public"."google_drive_settings" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage agent knowledge selections" ON "public"."ai_agent_knowledge_selection" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage all folders" ON "public"."image_shared_folders" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage all quotas" ON "public"."image_user_quotas" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage all safety blocks" ON "public"."image_safety_blocks" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage all templates" ON "public"."image_prompt_templates" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage aspect ratios" ON "public"."image_aspect_ratios" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage brand analytics integrations" ON "public"."brand_analytics_integrations" TO "authenticated" USING ("public"."is_admin_or_superadmin"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_superadmin"("auth"."uid"()));



CREATE POLICY "Admins can manage categories" ON "public"."knowledge_base_categories" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage events" ON "public"."hackathon_events" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage judges" ON "public"."hackathon_judges" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage knowledge embeddings" ON "public"."knowledge_embeddings" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage mappings" ON "public"."employee_user_mapping" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage matches" ON "public"."wc_matches" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins can manage participants" ON "public"."hackathon_participants" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage predictions" ON "public"."wc_predictions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins can manage style presets" ON "public"."image_style_presets" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage team members" ON "public"."team_members" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can manage teams" ON "public"."teams" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can read email send log" ON "public"."email_send_log" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can read tournament email config" ON "public"."tournament_email_config" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can read tournament email sends" ON "public"."tournament_email_sends" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can update ActiveCollab settings" ON "public"."user_activecollab_settings" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_superadmin"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_superadmin"("auth"."uid"()));



CREATE POLICY "Admins can update reference summaries" ON "public"."seo_reference_summaries" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can update settings" ON "public"."wc_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins can view ActiveCollab settings" ON "public"."user_activecollab_settings" FOR SELECT TO "authenticated" USING ("public"."is_admin_or_superadmin"("auth"."uid"()));



CREATE POLICY "Admins can view WC API keys" ON "public"."wc_api_keys" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins can view all blog content" ON "public"."seo_blog_content" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can view all employees" ON "public"."employees" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Admins can view all generated images" ON "public"."ai_generated_images" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can view all generation logs" ON "public"."seo_blog_generation_logs" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can view all head starts" ON "public"."daily_head_starts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins can view all pods" ON "public"."pods" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Admins can view all stats" ON "public"."image_generation_stats" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can view email logs" ON "public"."email_notifications_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins can view pod members" ON "public"."pod_members" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Admins can view sync logs" ON "public"."activecollab_sync_logs" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Admins can view sync logs" ON "public"."control_tower_sync_logs" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins can view sync logs" ON "public"."wc_sync_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins can write tournament email config" ON "public"."tournament_email_config" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins manage all content repurpose assets" ON "public"."content_repurpose_assets" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Admins manage all content repurpose packs" ON "public"."content_repurpose_packs" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "All authenticated users can add comments" ON "public"."feedback_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "All authenticated users can read reference summaries" ON "public"."seo_reference_summaries" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users can update feedback" ON "public"."feedback_reports" FOR UPDATE TO "authenticated" USING (("deleted_at" IS NULL)) WITH CHECK (("deleted_at" IS NULL));



CREATE POLICY "All authenticated users can view comments" ON "public"."feedback_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All authenticated users can view feedback" ON "public"."feedback_reports" FOR SELECT TO "authenticated" USING (("deleted_at" IS NULL));



CREATE POLICY "All authenticated users can view upvotes" ON "public"."feedback_upvotes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All authenticated users can view vision examples" ON "public"."vision_examples" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow insert via service role" ON "public"."brand_analytics_data" FOR INSERT TO "authenticated" WITH CHECK (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Anyone can validate tokens" ON "public"."testimonial_submission_tokens" FOR SELECT USING ((("expires_at" > "now"()) AND ("used_at" IS NULL)));



CREATE POLICY "Anyone can view active aspect ratios" ON "public"."image_aspect_ratios" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active style presets" ON "public"."image_style_presets" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active templates" ON "public"."image_prompt_templates" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view published events" ON "public"."hackathon_events" FOR SELECT USING (("status" = ANY (ARRAY['published'::"text", 'active'::"text", 'completed'::"text"])));



CREATE POLICY "Anyone can view tool definitions" ON "public"."agent_tool_definitions" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can add team members" ON "public"."team_members" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can create teams" ON "public"."teams" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert generation logs" ON "public"."seo_blog_generation_logs" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Authenticated users can insert logs" ON "public"."integration_logs" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Authenticated users can view active newsletter sources" ON "public"."newsletter_sources" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("is_active" = true)));



CREATE POLICY "Authenticated users can view active team members" ON "public"."users" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("status" = 'active'::"text")));



CREATE POLICY "Authenticated users can view all projects" ON "public"."projects" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view matches" ON "public"."wc_matches" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view settings" ON "public"."wc_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view team members" ON "public"."team_members" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view teams" ON "public"."teams" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Content creators can delete own uploads" ON "public"."leader_uploads" FOR DELETE TO "authenticated" USING ((("leader_id" IN ( SELECT "thought_leaders"."id"
   FROM "public"."thought_leaders"
  WHERE ("thought_leaders"."user_id" = "auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Content creators can insert own generated posts" ON "public"."generated_posts" FOR INSERT TO "authenticated" WITH CHECK ((("leader_id" IN ( SELECT "thought_leaders"."id"
   FROM "public"."thought_leaders"
  WHERE ("thought_leaders"."user_id" = "auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Content creators can insert own uploads" ON "public"."leader_uploads" FOR INSERT TO "authenticated" WITH CHECK ((("leader_id" IN ( SELECT "thought_leaders"."id"
   FROM "public"."thought_leaders"
  WHERE ("thought_leaders"."user_id" = "auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Content creators can update own leader profile" ON "public"."thought_leaders" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Content creators can update own uploads" ON "public"."leader_uploads" FOR UPDATE TO "authenticated" USING ((("leader_id" IN ( SELECT "thought_leaders"."id"
   FROM "public"."thought_leaders"
  WHERE ("thought_leaders"."user_id" = "auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Content creators can view own generated posts" ON "public"."generated_posts" FOR SELECT TO "authenticated" USING ((("leader_id" IN ( SELECT "thought_leaders"."id"
   FROM "public"."thought_leaders"
  WHERE ("thought_leaders"."user_id" = "auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Content creators can view own leader profile" ON "public"."thought_leaders" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Content creators can view own trends" ON "public"."weekly_trends" FOR SELECT TO "authenticated" USING ((("leader_id" IN ( SELECT "thought_leaders"."id"
   FROM "public"."thought_leaders"
  WHERE ("thought_leaders"."user_id" = "auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'marketing'::"public"."app_role")));



CREATE POLICY "Content creators can view own uploads" ON "public"."leader_uploads" FOR SELECT TO "authenticated" USING ((("leader_id" IN ( SELECT "thought_leaders"."id"
   FROM "public"."thought_leaders"
  WHERE ("thought_leaders"."user_id" = "auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Delete own knowledge files" ON "public"."knowledge_files" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR (("brand_id" IS NOT NULL) AND ("uploaded_by" = "auth"."uid"()) AND "public"."user_has_brand_access"("auth"."uid"(), "brand_id"))));



CREATE POLICY "Judges can manage their scores" ON "public"."hackathon_scores" USING ((EXISTS ( SELECT 1
   FROM "public"."hackathon_judges" "hj"
  WHERE (("hj"."id" = "hackathon_scores"."judge_id") AND ("hj"."user_id" = "auth"."uid"())))));



CREATE POLICY "Judges can update their responses" ON "public"."hackathon_judges" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Judges can view submissions" ON "public"."hackathon_submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hackathon_judges" "hj"
  WHERE (("hj"."event_id" = "hackathon_submissions"."event_id") AND ("hj"."user_id" = "auth"."uid"())))));



CREATE POLICY "Judges can view their assignments" ON "public"."hackathon_judges" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Knowledge files accessible by brand or role" ON "public"."knowledge_files" FOR SELECT USING ((("brand_id" IS NULL) OR "public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Leaders can update blogs by leader_id" ON "public"."seo_blog_content" FOR UPDATE TO "authenticated" USING (("leader_id" IN ( SELECT "thought_leaders"."id"
   FROM "public"."thought_leaders"
  WHERE ("thought_leaders"."user_id" = "auth"."uid"()))));



CREATE POLICY "Leaders can view blogs by leader_id" ON "public"."seo_blog_content" FOR SELECT TO "authenticated" USING (("leader_id" IN ( SELECT "thought_leaders"."id"
   FROM "public"."thought_leaders"
  WHERE ("thought_leaders"."user_id" = "auth"."uid"()))));



CREATE POLICY "Managers and PMs can view and edit projects" ON "public"."projects" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Managers and above can delete testimonials" ON "public"."client_testimonials" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Managers and super admins can view all approvals" ON "public"."agent_pending_approvals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Managers can manage all accountability charts" ON "public"."user_accountability_chart" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Managers can manage assigned clients" ON "public"."clients" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND "public"."user_has_client_access"("auth"."uid"(), "id"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND "public"."user_has_client_access"("auth"."uid"(), "id")));



CREATE POLICY "Managers can resolve any approval" ON "public"."agent_pending_approvals" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Managers can view all EOD submissions" ON "public"."team_eod_submissions" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Managers can view all accountability charts" ON "public"."user_accountability_chart" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Managers can view all brand KPIs" ON "public"."brand_kpis" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Managers can view all brands" ON "public"."brands" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Managers can view all summaries" ON "public"."team_daily_summaries" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Managers can view all task comments" ON "public"."project_task_comments" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Managers can view all task data" ON "public"."activecollab_task_data" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Managers can view manager level and below" ON "public"."users" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Marketing can delete trends" ON "public"."weekly_trends" FOR DELETE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'marketing'::"public"."app_role")));



CREATE POLICY "Marketing can insert trends" ON "public"."weekly_trends" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'marketing'::"public"."app_role")));



CREATE POLICY "Marketing can manage blogs" ON "public"."seo_blog_content" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'marketing'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'marketing'::"public"."app_role"));



CREATE POLICY "Marketing can update trends" ON "public"."weekly_trends" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'marketing'::"public"."app_role")));



CREATE POLICY "Marketing team can view brand analytics data" ON "public"."brand_analytics_data" FOR SELECT USING (("public"."user_is_marketing_or_manager"("auth"."uid"()) OR "public"."user_has_brand_access"("auth"."uid"(), "brand_id")));



CREATE POLICY "Only super admin can delete feedback" ON "public"."feedback_reports" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Only super_admin can delete vision examples" ON "public"."vision_examples" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Only super_admin can insert vision examples" ON "public"."vision_examples" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Only super_admin can manage employees" ON "public"."employees" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Only super_admin can update vision examples" ON "public"."vision_examples" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Only super_admin can view employees" ON "public"."employees" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "PMs and above can insert testimonials" ON "public"."client_testimonials" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role", 'pm'::"public"."app_role"]))))));



CREATE POLICY "PMs and above can update testimonials" ON "public"."client_testimonials" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role", 'pm'::"public"."app_role"]))))));



CREATE POLICY "PMs and above can view testimonials" ON "public"."client_testimonials" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role", 'pm'::"public"."app_role"]))))));



CREATE POLICY "PMs can insert tokens" ON "public"."testimonial_submission_tokens" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role", 'pm'::"public"."app_role"]))))));



CREATE POLICY "PMs can manage all clients" ON "public"."clients" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role"));



CREATE POLICY "PMs can update tokens" ON "public"."testimonial_submission_tokens" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role", 'pm'::"public"."app_role"]))))));



CREATE POLICY "Participants can create teams" ON "public"."hackathon_teams" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."hackathon_participants" "hp"
  WHERE (("hp"."id" = "hackathon_teams"."captain_id") AND ("hp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Participants can view teams in their events" ON "public"."hackathon_teams" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hackathon_participants" "hp"
  WHERE (("hp"."event_id" = "hackathon_teams"."event_id") AND ("hp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Players can view round winners" ON "public"."wc_round_winners" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role can insert ranking history" ON "public"."keyword_ranking_history" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage blog usage" ON "public"."keyword_blog_usage" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage email send log" ON "public"."email_send_log" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage employees" ON "public"."employees" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage pod members" ON "public"."pod_members" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage pods" ON "public"."pods" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage summaries" ON "public"."team_daily_summaries" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage sync logs" ON "public"."activecollab_sync_logs" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage sync logs" ON "public"."control_tower_sync_logs" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage task comments" ON "public"."project_task_comments" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage task data" ON "public"."activecollab_task_data" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage tournament email sends" ON "public"."tournament_email_sends" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Super admin can delete comments" ON "public"."feedback_comments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins and managers can delete Google Drive folders" ON "public"."admin_google_drive_folders" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Super admins and managers can insert Google Drive folders" ON "public"."admin_google_drive_folders" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Super admins and managers can update Google Drive folders" ON "public"."admin_google_drive_folders" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Super admins and managers can view Google Drive folders" ON "public"."admin_google_drive_folders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Super admins can delete WC API keys" ON "public"."wc_api_keys" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can delete analytics API keys" ON "public"."analytics_api_keys" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can insert WC API keys" ON "public"."wc_api_keys" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can insert analytics API keys" ON "public"."analytics_api_keys" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can insert users" ON "public"."users" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage ActiveCollab credentials" ON "public"."activecollab_credentials" TO "authenticated" USING ("public"."is_superadmin"("auth"."uid"())) WITH CHECK ("public"."is_superadmin"("auth"."uid"()));



CREATE POLICY "Super admins can manage all activities" ON "public"."activities" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all brand KPIs" ON "public"."brand_kpis" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all brands" ON "public"."brands" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all clients" ON "public"."clients" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all communications" ON "public"."client_communications" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all contacts" ON "public"."contacts" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all deals" ON "public"."deals" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all project tasks" ON "public"."project_tasks" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all projects" ON "public"."projects" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all roles" ON "public"."user_roles" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all user brand assignments" ON "public"."user_brands" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage all user permissions" ON "public"."user_permissions" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage control tower API keys" ON "public"."control_tower_api_keys" TO "authenticated" USING ("public"."is_superadmin"("auth"."uid"())) WITH CHECK ("public"."is_superadmin"("auth"."uid"()));



CREATE POLICY "Super admins can manage n8n workflow configs" ON "public"."n8n_workflow_configs" TO "authenticated" USING ("public"."is_superadmin"("auth"."uid"())) WITH CHECK ("public"."is_superadmin"("auth"."uid"()));



CREATE POLICY "Super admins can manage organization integrations" ON "public"."organization_integrations" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage tool definitions" ON "public"."agent_tool_definitions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can update WC API keys" ON "public"."wc_api_keys" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can update analytics API keys" ON "public"."analytics_api_keys" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can update any user" ON "public"."users" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can view all execution steps" ON "public"."agent_execution_steps" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can view all login tracking" ON "public"."user_login_tracking" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can view all memories" ON "public"."agent_session_memory" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins can view all roles" ON "public"."user_roles" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can view all user brand assignments" ON "public"."user_brands" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can view all user permissions" ON "public"."user_permissions" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can view all users" ON "public"."users" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can view analytics API keys" ON "public"."analytics_api_keys" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins have full access to newsletter sources" ON "public"."newsletter_sources" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admins read all tool calls" ON "public"."agent_tool_calls" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Team captains can manage members" ON "public"."hackathon_team_members" USING ((EXISTS ( SELECT 1
   FROM ("public"."hackathon_teams" "ht"
     JOIN "public"."hackathon_participants" "hp" ON (("hp"."id" = "ht"."captain_id")))
  WHERE (("ht"."id" = "hackathon_team_members"."team_id") AND ("hp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Team captains can update their teams" ON "public"."hackathon_teams" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."hackathon_participants" "hp"
  WHERE (("hp"."id" = "hackathon_teams"."captain_id") AND ("hp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Team members can add comments to brand files" ON "public"."brand_file_comments" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."brand_knowledge_files" "bkf"
  WHERE (("bkf"."id" = "brand_file_comments"."file_id") AND ("public"."user_has_brand_access"("auth"."uid"(), "bkf"."brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")))))));



CREATE POLICY "Team members can create brand posts" ON "public"."brand_generated_posts" FOR INSERT WITH CHECK (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can create post agent references" ON "public"."post_agent_references" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."brand_generated_posts" "bgp"
  WHERE (("bgp"."id" = "post_agent_references"."post_id") AND ("public"."user_has_brand_access"("auth"."uid"(), "bgp"."brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))))));



CREATE POLICY "Team members can create submissions" ON "public"."hackathon_submissions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."hackathon_team_members" "htm"
     JOIN "public"."hackathon_participants" "hp" ON (("hp"."id" = "htm"."participant_id")))
  WHERE (("htm"."team_id" = "hackathon_submissions"."team_id") AND ("hp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Team members can delete brand knowledge" ON "public"."brand_knowledge_files" FOR DELETE USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can delete brand posts" ON "public"."brand_generated_posts" FOR DELETE USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can delete post agent references" ON "public"."post_agent_references" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."brand_generated_posts" "bgp"
  WHERE (("bgp"."id" = "post_agent_references"."post_id") AND ("public"."user_has_brand_access"("auth"."uid"(), "bgp"."brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))))));



CREATE POLICY "Team members can manage brand embeddings" ON "public"."brand_knowledge_embeddings" USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can update brand knowledge" ON "public"."brand_knowledge_files" FOR UPDATE USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can update brand posts" ON "public"."brand_generated_posts" FOR UPDATE USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can update their submissions" ON "public"."hackathon_submissions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."hackathon_team_members" "htm"
     JOIN "public"."hackathon_participants" "hp" ON (("hp"."id" = "htm"."participant_id")))
  WHERE (("htm"."team_id" = "hackathon_submissions"."team_id") AND ("hp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Team members can upload brand knowledge" ON "public"."brand_knowledge_files" FOR INSERT WITH CHECK (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can view assigned projects" ON "public"."projects" FOR SELECT USING ((("project_manager" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("assigned_team")) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "Team members can view brand embeddings" ON "public"."brand_knowledge_embeddings" FOR SELECT USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can view brand knowledge" ON "public"."brand_knowledge_files" FOR SELECT USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can view brand posts" ON "public"."brand_generated_posts" FOR SELECT USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Team members can view comments on brand files" ON "public"."brand_file_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."brand_knowledge_files" "bkf"
  WHERE (("bkf"."id" = "brand_file_comments"."file_id") AND ("public"."user_has_brand_access"("auth"."uid"(), "bkf"."brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))))));



CREATE POLICY "Team members can view post agent references" ON "public"."post_agent_references" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."brand_generated_posts" "bgp"
  WHERE (("bgp"."id" = "post_agent_references"."post_id") AND ("public"."user_has_brand_access"("auth"."uid"(), "bgp"."brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))))));



CREATE POLICY "Team members can view scores for their submissions" ON "public"."hackathon_scores" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."hackathon_submissions" "hs"
     JOIN "public"."hackathon_team_members" "htm" ON (("htm"."team_id" = "hs"."team_id")))
     JOIN "public"."hackathon_participants" "hp" ON (("hp"."id" = "htm"."participant_id")))
  WHERE (("hs"."id" = "hackathon_scores"."submission_id") AND ("hp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Team members can view their submissions" ON "public"."hackathon_submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."hackathon_team_members" "htm"
     JOIN "public"."hackathon_participants" "hp" ON (("hp"."id" = "htm"."participant_id")))
  WHERE (("htm"."team_id" = "hackathon_submissions"."team_id") AND ("hp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Team members can view their team" ON "public"."hackathon_team_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hackathon_participants" "hp"
  WHERE (("hp"."id" = "hackathon_team_members"."participant_id") AND ("hp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Update own knowledge files" ON "public"."knowledge_files" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR (("brand_id" IS NOT NULL) AND ("uploaded_by" = "auth"."uid"()) AND "public"."user_has_brand_access"("auth"."uid"(), "brand_id")))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR (("brand_id" IS NOT NULL) AND ("uploaded_by" = "auth"."uid"()) AND "public"."user_has_brand_access"("auth"."uid"(), "brand_id"))));



CREATE POLICY "Upload knowledge files within access" ON "public"."knowledge_files" FOR INSERT WITH CHECK (((("brand_id" IS NOT NULL) AND ("uploaded_by" = "auth"."uid"()) AND "public"."user_has_brand_access"("auth"."uid"(), "brand_id")) OR (("brand_id" IS NULL) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Users can add own upvotes" ON "public"."feedback_upvotes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can appeal their own blocks" ON "public"."image_safety_blocks" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create feedback (no impersonation)" ON "public"."feedback_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can create folders" ON "public"."image_shared_folders" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can create hero section generation logs" ON "public"."hero_section_generation_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."hero_section_generations"
  WHERE (("hero_section_generations"."id" = "hero_section_generation_logs"."hero_generation_id") AND ("hero_section_generations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create hero section generations" ON "public"."hero_section_generations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create predictions before kickoff" ON "public"."wc_predictions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."wc_matches" "m"
  WHERE (("m"."id" = "wc_predictions"."match_id") AND ("m"."kickoff_at" > "now"()))))));



CREATE POLICY "Users can create project suggestions" ON "public"."keyword_suggestions" FOR INSERT WITH CHECK ((("project_id" IS NOT NULL) AND ("auth"."uid"() = "user_id")));



CREATE POLICY "Users can create project tasks" ON "public"."project_tasks" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR (("auth"."uid"() IS NOT NULL) AND (("created_by" IS NULL) OR ("created_by" = "auth"."uid"()))) OR (("project_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_tasks"."project_id") AND (("p"."project_manager" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("p"."assigned_team"))))))) OR (("brand_id" IS NOT NULL) AND "public"."user_has_brand_access"("auth"."uid"(), "brand_id")) OR (("client_id" IS NOT NULL) AND "public"."user_has_client_access"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can create reel hook generation logs" ON "public"."reel_hook_generation_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."reel_hook_generations"
  WHERE (("reel_hook_generations"."id" = "reel_hook_generation_logs"."reel_hook_generation_id") AND ("reel_hook_generations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create reel hook generations" ON "public"."reel_hook_generations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create sources within their access" ON "public"."knowledge_sources" FOR INSERT WITH CHECK (((("brand_id" IS NULL) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) OR (("brand_id" IS NOT NULL) AND ("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")))));



CREATE POLICY "Users can create suggestions" ON "public"."keyword_suggestions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create task comments" ON "public"."task_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create templates" ON "public"."image_prompt_templates" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can create their own head starts" ON "public"."daily_head_starts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete accessible sources" ON "public"."knowledge_sources" FOR DELETE USING (((("brand_id" IS NULL) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) OR (("brand_id" IS NOT NULL) AND ("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")))));



CREATE POLICY "Users can delete own comments" ON "public"."task_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own ActiveCollab settings" ON "public"."user_activecollab_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own blog content" ON "public"."seo_blog_content" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."brand_file_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own folders" ON "public"."image_shared_folders" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete their own hero section generations" ON "public"."hero_section_generations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own reel hook generations" ON "public"."reel_hook_generations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own sora videos" ON "public"."sora_videos" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own videos" ON "public"."gemini_videos" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own login tracking" ON "public"."user_login_tracking" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own tool calls" ON "public"."agent_tool_calls" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert reference summaries" ON "public"."seo_reference_summaries" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Users can insert their own ActiveCollab settings" ON "public"."user_activecollab_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own EOD submissions" ON "public"."team_eod_submissions" FOR INSERT WITH CHECK ((("user_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can insert their own Google tokens" ON "public"."user_google_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own blog content" ON "public"."seo_blog_content" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own image logs" ON "public"."ai_generated_images" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own sora videos" ON "public"."sora_videos" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own videos" ON "public"."gemini_videos" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage activities for their clients" ON "public"."activities" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")) AND "public"."user_has_client_access"("auth"."uid"(), "client_id")))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")) AND "public"."user_has_client_access"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can manage brand keywords" ON "public"."keyword_research" USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Users can manage communications for their clients" ON "public"."client_communications" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")) AND "public"."user_has_client_access"("auth"."uid"(), "client_id")))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")) AND "public"."user_has_client_access"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can manage contacts for their clients" ON "public"."contacts" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")) AND "public"."user_has_client_access"("auth"."uid"(), "client_id")))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")) AND "public"."user_has_client_access"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can manage deals for their clients" ON "public"."deals" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")) AND "public"."user_has_client_access"("auth"."uid"(), "client_id")))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR (("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")) AND "public"."user_has_client_access"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can manage files for their projects" ON "public"."project_knowledge_files" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_knowledge_files"."project_id") AND ("p"."project_manager" = "auth"."uid"()))))));



CREATE POLICY "Users can manage project embeddings" ON "public"."project_knowledge_embeddings" USING (("public"."user_has_project_access"("auth"."uid"(), "project_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Users can manage sources for their projects" ON "public"."project_knowledge_sources" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_knowledge_sources"."project_id") AND ("p"."project_manager" = "auth"."uid"()))))));



CREATE POLICY "Users can manage their own accountability chart" ON "public"."user_accountability_chart" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own agent memories" ON "public"."agent_session_memory" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own memories" ON "public"."agent_memories" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Users can manage their own settings" ON "public"."perplexity_settings" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Users can read own tool calls" ON "public"."agent_tool_calls" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can remove own upvotes" ON "public"."feedback_upvotes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can resolve their own approval requests" ON "public"."agent_pending_approvals" FOR UPDATE USING (("requested_by" = "auth"."uid"())) WITH CHECK (("requested_by" = "auth"."uid"()));



CREATE POLICY "Users can update accessible sources" ON "public"."knowledge_sources" FOR UPDATE USING (((("brand_id" IS NULL) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) OR (("brand_id" IS NOT NULL) AND ("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))))) WITH CHECK (((("brand_id" IS NULL) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) OR (("brand_id" IS NOT NULL) AND ("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")))));



CREATE POLICY "Users can update own comments" ON "public"."feedback_comments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own comments" ON "public"."task_comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update predictions before kickoff" ON "public"."wc_predictions" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."wc_matches" "m"
  WHERE (("m"."id" = "wc_predictions"."match_id") AND ("m"."kickoff_at" > "now"())))))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."wc_matches" "m"
  WHERE (("m"."id" = "wc_predictions"."match_id") AND ("m"."kickoff_at" > "now"()))))));



CREATE POLICY "Users can update project tasks" ON "public"."project_tasks" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR ("assigned_to" = "auth"."uid"()) OR ("created_by" = "auth"."uid"()) OR (("project_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_tasks"."project_id") AND (("p"."project_manager" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("p"."assigned_team"))))))) OR (("brand_id" IS NOT NULL) AND "public"."user_has_brand_access"("auth"."uid"(), "brand_id")) OR (("client_id" IS NOT NULL) AND "public"."user_has_client_access"("auth"."uid"(), "client_id")))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR ("created_by" = "auth"."uid"()) OR "public"."is_task_assigned_to"("id", "auth"."uid"()) OR (("project_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_tasks"."project_id") AND (("p"."project_manager" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("p"."assigned_team"))))))) OR (("brand_id" IS NOT NULL) AND "public"."user_has_brand_access"("auth"."uid"(), "brand_id")) OR (("client_id" IS NOT NULL) AND "public"."user_has_client_access"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can update their own ActiveCollab settings" ON "public"."user_activecollab_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own EOD submissions" ON "public"."team_eod_submissions" FOR UPDATE USING ((("user_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can update their own Google tokens" ON "public"."user_google_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own blog content" ON "public"."seo_blog_content" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own folders" ON "public"."image_shared_folders" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update their own head starts" ON "public"."daily_head_starts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own hero section generations" ON "public"."hero_section_generations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own participation" ON "public"."hackathon_participants" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own reel hook generations" ON "public"."reel_hook_generations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own sora videos" ON "public"."sora_videos" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own templates" ON "public"."image_prompt_templates" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update their own videos" ON "public"."gemini_videos" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view accessible sources" ON "public"."knowledge_sources" FOR SELECT USING (((("brand_id" IS NULL) AND ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) OR (("brand_id" IS NOT NULL) AND ("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")))));



CREATE POLICY "Users can view blog usage" ON "public"."keyword_blog_usage" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."keyword_research"
  WHERE (("keyword_research"."id" = "keyword_blog_usage"."keyword_id") AND ("public"."user_has_brand_access"("auth"."uid"(), "keyword_research"."brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))))));



CREATE POLICY "Users can view brand suggestions" ON "public"."keyword_suggestions" FOR SELECT USING (("public"."user_has_brand_access"("auth"."uid"(), "brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Users can view comments for accessible tasks" ON "public"."project_task_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."project_tasks" "pt"
     LEFT JOIN "public"."projects" "p" ON (("p"."id" = "pt"."project_id")))
  WHERE (("pt"."id" = "project_task_comments"."task_id") AND (("pt"."assigned_to" = "auth"."uid"()) OR ("p"."project_manager" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("p"."assigned_team")) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role"))))));



CREATE POLICY "Users can view contacts for their clients" ON "public"."contacts" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."user_has_client_access"("auth"."uid"(), "client_id")));



CREATE POLICY "Users can view execution steps for their runs" ON "public"."agent_execution_steps" FOR SELECT USING (("run_id" IN ( SELECT "ai_agent_runs"."id"
   FROM "public"."ai_agent_runs"
  WHERE ("ai_agent_runs"."executed_by" = "auth"."uid"()))));



CREATE POLICY "Users can view files for their projects" ON "public"."project_knowledge_files" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_knowledge_files"."project_id") AND (("p"."project_manager" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("p"."assigned_team"))))))));



CREATE POLICY "Users can view logs for their blogs" ON "public"."seo_blog_generation_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."seo_blog_content"
  WHERE (("seo_blog_content"."id" = "seo_blog_generation_logs"."blog_id") AND ("seo_blog_content"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own images" ON "public"."ai_generated_images" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own or kicked-off predictions" ON "public"."wc_predictions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."wc_matches" "m"
  WHERE (("m"."id" = "wc_predictions"."match_id") AND ("m"."kickoff_at" <= "now"()))))));



CREATE POLICY "Users can view project embeddings" ON "public"."project_knowledge_embeddings" FOR SELECT USING (("public"."user_has_project_access"("auth"."uid"(), "project_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Users can view project suggestions" ON "public"."keyword_suggestions" FOR SELECT USING ((("project_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "keyword_suggestions"."project_id") AND (("p"."project_manager" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("p"."assigned_team"))))))));



CREATE POLICY "Users can view project tasks" ON "public"."project_tasks" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR ("assigned_to" = "auth"."uid"()) OR ("created_by" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("past_assignees")) OR (("project_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_tasks"."project_id") AND (("p"."project_manager" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("p"."assigned_team"))))))) OR (("brand_id" IS NOT NULL) AND "public"."user_has_brand_access"("auth"."uid"(), "brand_id")) OR (("client_id" IS NOT NULL) AND "public"."user_has_client_access"("auth"."uid"(), "client_id"))));



CREATE POLICY "Users can view public folders" ON "public"."image_shared_folders" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Users can view ranking history" ON "public"."keyword_ranking_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."keyword_research"
  WHERE (("keyword_research"."id" = "keyword_ranking_history"."keyword_id") AND ("public"."user_has_brand_access"("auth"."uid"(), "keyword_research"."brand_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))))));



CREATE POLICY "Users can view reference summaries" ON "public"."seo_reference_summaries" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Users can view shared images v2" ON "public"."ai_generated_images" FOR SELECT USING ((("is_shared" = true) AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view sources for their projects" ON "public"."project_knowledge_sources" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_knowledge_sources"."project_id") AND (("p"."project_manager" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("p"."assigned_team"))))))));



CREATE POLICY "Users can view task comments" ON "public"."task_comments" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view tasks assigned to them" ON "public"."activecollab_task_data" FOR SELECT USING ((("assignee_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can view their approval requests" ON "public"."agent_pending_approvals" FOR SELECT USING (("requested_by" = "auth"."uid"()));



CREATE POLICY "Users can view their assigned brands" ON "public"."brands" FOR SELECT TO "authenticated" USING ("public"."user_has_brand_access"("auth"."uid"(), "id"));



CREATE POLICY "Users can view their hero section generation logs" ON "public"."hero_section_generation_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hero_section_generations"
  WHERE (("hero_section_generations"."id" = "hero_section_generation_logs"."hero_generation_id") AND ("hero_section_generations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own ActiveCollab settings" ON "public"."user_activecollab_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own EOD submissions" ON "public"."team_eod_submissions" FOR SELECT USING ((("user_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can view their own Google tokens" ON "public"."user_google_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own accountability chart" ON "public"."user_accountability_chart" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own blog content" ON "public"."seo_blog_content" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own brand assignments" ON "public"."user_brands" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own folders" ON "public"."image_shared_folders" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can view their own generated images" ON "public"."ai_generated_images" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own head starts" ON "public"."daily_head_starts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own hero section generations" ON "public"."hero_section_generations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own mapping" ON "public"."employee_user_mapping" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own memories" ON "public"."agent_memories" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Users can view their own participation" ON "public"."hackathon_participants" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own permissions" ON "public"."user_permissions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own quota" ON "public"."image_user_quotas" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own reel hook generations" ON "public"."reel_hook_generations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own safety blocks" ON "public"."image_safety_blocks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own settings" ON "public"."perplexity_settings" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Users can view their own sora videos" ON "public"."sora_videos" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own stats" ON "public"."image_generation_stats" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own summaries" ON "public"."team_daily_summaries" FOR SELECT USING ((("user_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can view their own videos" ON "public"."gemini_videos" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their reel hook generation logs" ON "public"."reel_hook_generation_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."reel_hook_generations"
  WHERE (("reel_hook_generations"."id" = "reel_hook_generation_logs"."reel_hook_generation_id") AND ("reel_hook_generations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users delete own content repurpose packs" ON "public"."content_repurpose_packs" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users insert content repurpose assets for own packs" ON "public"."content_repurpose_assets" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."content_repurpose_packs" "p"
  WHERE (("p"."id" = "content_repurpose_assets"."pack_id") AND ("p"."created_by" = "auth"."uid"())))));



CREATE POLICY "Users insert own content repurpose packs" ON "public"."content_repurpose_packs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users insert own results" ON "public"."deep_research_results" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users manage content repurpose performance" ON "public"."content_repurpose_performance" TO "authenticated" USING ((("auth"."uid"() = "recorded_by") OR ("recorded_by" IS NULL))) WITH CHECK (("auth"."uid"() = "recorded_by"));



CREATE POLICY "Users read own results" ON "public"."deep_research_results" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users update content repurpose assets for own packs" ON "public"."content_repurpose_assets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."content_repurpose_packs" "p"
  WHERE (("p"."id" = "content_repurpose_assets"."pack_id") AND ("p"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."content_repurpose_packs" "p"
  WHERE (("p"."id" = "content_repurpose_assets"."pack_id") AND ("p"."created_by" = "auth"."uid"())))));



CREATE POLICY "Users update own content repurpose packs" ON "public"."content_repurpose_packs" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users view content repurpose assets" ON "public"."content_repurpose_assets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."content_repurpose_packs" "p"
  WHERE (("p"."id" = "content_repurpose_assets"."pack_id") AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "Users view content repurpose packs" ON "public"."content_repurpose_packs" FOR SELECT TO "authenticated" USING (("deleted_at" IS NULL));



CREATE POLICY "Users view content repurpose performance" ON "public"."content_repurpose_performance" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users with pm role can delete project meetings" ON "public"."project_meetings" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['pm'::"public"."app_role", 'manager'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Users with pm role can insert project meetings" ON "public"."project_meetings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['pm'::"public"."app_role", 'manager'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Users with pm role can update project meetings" ON "public"."project_meetings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['pm'::"public"."app_role", 'manager'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Users with pm role can view project meetings" ON "public"."project_meetings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['pm'::"public"."app_role", 'manager'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



ALTER TABLE "public"."activecollab_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activecollab_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activecollab_task_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_google_drive_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_execution_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_pending_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_session_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tool_calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tool_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agent_knowledge_selection" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agent_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_agent_runs_user_access" ON "public"."ai_agent_runs" USING ((("executed_by" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



ALTER TABLE "public"."ai_agents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_agents_modify_access" ON "public"."ai_agents" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "ai_agents_select_access" ON "public"."ai_agents" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."ai_configurations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_configurations_user_access" ON "public"."ai_configurations" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



ALTER TABLE "public"."ai_generated_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_shared_resources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_shared_resources_manage" ON "public"."ai_shared_resources" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "ai_shared_resources_read" ON "public"."ai_shared_resources" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."analytics_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_analytics_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_analytics_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_file_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_generated_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_knowledge_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_knowledge_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_kpis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_communications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_testimonials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."code_analysis_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "code_analysis_results_user_access" ON "public"."code_analysis_results" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."code_repositories" "cr"
  WHERE (("cr"."id" = "code_analysis_results"."repository_id") AND ("cr"."created_by" = "auth"."uid"()))))));



ALTER TABLE "public"."code_generation_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "code_generation_templates_user_access" ON "public"."code_generation_templates" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."code_repositories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "code_repositories_user_access" ON "public"."code_repositories" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role") OR ("created_by" = "auth"."uid"())));



CREATE POLICY "company_knowledge_files_manage" ON "public"."knowledge_base_files" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "company_knowledge_files_read" ON "public"."knowledge_base_files" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_performance_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_repurpose_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_repurpose_packs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_repurpose_performance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."control_tower_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."control_tower_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_head_starts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deep_research_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documentation_output_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documentation_output_config_manage" ON "public"."documentation_output_config" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "documentation_output_config_read" ON "public"."documentation_output_config" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."documentation_repository_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documentation_repository_links_manage" ON "public"."documentation_repository_links" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "documentation_repository_links_read" ON "public"."documentation_repository_links" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."documentation_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documentation_rules_manage" ON "public"."documentation_rules" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "documentation_rules_read" ON "public"."documentation_rules" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."documentation_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documentation_templates_manage" ON "public"."documentation_templates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "documentation_templates_read" ON "public"."documentation_templates" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."email_notifications_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_send_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_user_mapping" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estimate_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estimate_items_own_estimate" ON "public"."estimate_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."estimates"
  WHERE (("estimates"."id" = "estimate_items"."estimate_id") AND ("estimates"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."estimates"
  WHERE (("estimates"."id" = "estimate_items"."estimate_id") AND ("estimates"."created_by" = "auth"."uid"())))));



CREATE POLICY "estimate_items_super_admin" ON "public"."estimate_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



ALTER TABLE "public"."estimates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estimates_authenticated_delete" ON "public"."estimates" FOR DELETE TO "authenticated" USING (((("created_by" = "auth"."uid"()) AND ("status" = 'draft'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role"))))));



CREATE POLICY "estimates_authenticated_insert" ON "public"."estimates" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "estimates_authenticated_select_own" ON "public"."estimates" FOR SELECT TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "estimates_authenticated_update_own" ON "public"."estimates" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "estimates_super_admin_select_all" ON "public"."estimates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



ALTER TABLE "public"."feedback_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_upvotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gemini_videos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "generated_posts_access" ON "public"."generated_posts" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "ghl_contacts_user_access" ON "public"."gohighlevel_contacts" USING ((EXISTS ( SELECT 1
   FROM "public"."gohighlevel_integrations" "gi"
  WHERE (("gi"."id" = "gohighlevel_contacts"."integration_id") AND (("gi"."user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"))))));



ALTER TABLE "public"."gohighlevel_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gohighlevel_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_drive_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hackathon_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hackathon_judges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hackathon_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hackathon_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hackathon_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hackathon_team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hackathon_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hero_section_generation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hero_section_generations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_agent_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_agent_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_agents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hub_agents_modify_access" ON "public"."hub_agents" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "hub_agents_select_access" ON "public"."hub_agents" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."hub_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hub_conversations_admin_select" ON "public"."hub_conversations" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "hub_conversations_user_delete" ON "public"."hub_conversations" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "hub_conversations_user_insert" ON "public"."hub_conversations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "hub_conversations_user_select" ON "public"."hub_conversations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "hub_conversations_user_update" ON "public"."hub_conversations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "hub_memories_admin_select" ON "public"."hub_agent_memories" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "hub_memories_user_access" ON "public"."hub_agent_memories" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."hub_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hub_messages_admin_select" ON "public"."hub_messages" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "hub_messages_user_insert" ON "public"."hub_messages" FOR INSERT TO "authenticated" WITH CHECK (("conversation_id" IN ( SELECT "hub_conversations"."id"
   FROM "public"."hub_conversations"
  WHERE ("hub_conversations"."user_id" = "auth"."uid"()))));



CREATE POLICY "hub_messages_user_select" ON "public"."hub_messages" FOR SELECT TO "authenticated" USING (("conversation_id" IN ( SELECT "hub_conversations"."id"
   FROM "public"."hub_conversations"
  WHERE ("hub_conversations"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."hub_personalizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hub_personalizations_admin_access" ON "public"."hub_personalizations" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "hub_personalizations_user_access" ON "public"."hub_personalizations" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "hub_runs_admin_select" ON "public"."hub_agent_runs" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "hub_runs_user_insert" ON "public"."hub_agent_runs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "hub_runs_user_select" ON "public"."hub_agent_runs" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "hub_runs_user_update" ON "public"."hub_agent_runs" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."image_aspect_ratios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_generation_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_prompt_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_safety_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_shared_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_style_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_user_quotas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "influencer_library_manage" ON "public"."influencer_style_library" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "influencer_library_read" ON "public"."influencer_style_library" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."influencer_style_library" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."keyword_blog_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."keyword_ranking_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."keyword_research" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."keyword_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_base" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_base_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_base_files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "knowledge_base_manage" ON "public"."knowledge_base" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "knowledge_base_read" ON "public"."knowledge_base" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."knowledge_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leader_uploads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leader_uploads_access" ON "public"."leader_uploads" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."linkedin_agent_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "linkedin_agent_templates_manage" ON "public"."linkedin_agent_templates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "linkedin_agent_templates_read" ON "public"."linkedin_agent_templates" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "linkedin_content_manage" ON "public"."thought_leaders" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



CREATE POLICY "linkedin_content_read" ON "public"."thought_leaders" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."n8n_workflow_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "performance_metrics_access" ON "public"."content_performance_metrics" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



ALTER TABLE "public"."perplexity_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pod_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_agent_references" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_knowledge_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_knowledge_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_knowledge_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_task_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reel_hook_generation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reel_hook_generations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seo_blog_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seo_blog_generation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seo_reference_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_categories_authenticated_read" ON "public"."service_categories" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "service_categories_super_admin_all" ON "public"."service_categories" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_authenticated_read" ON "public"."services" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "services_super_admin_all" ON "public"."services" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



ALTER TABLE "public"."sora_videos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admins_can_delete_role_permissions" ON "public"."role_permissions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "super_admins_can_insert_role_permissions" ON "public"."role_permissions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "super_admins_can_update_role_permissions" ON "public"."role_permissions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "super_admins_can_view_role_permissions" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



ALTER TABLE "public"."task_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_daily_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_eod_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."testimonial_submission_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thought_leaders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_email_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_email_sends" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_accountability_chart" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_activecollab_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_google_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_login_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vision_examples" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wc_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wc_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wc_predictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wc_round_winners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wc_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wc_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_trends" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_trends_access" ON "public"."weekly_trends" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'pm'::"public"."app_role")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."image_user_quotas" TO "anon";
GRANT ALL ON TABLE "public"."image_user_quotas" TO "authenticated";
GRANT ALL ON TABLE "public"."image_user_quotas" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_image_cost"("p_user_id" "uuid", "p_cost_cents" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."add_image_cost"("p_user_id" "uuid", "p_cost_cents" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_image_cost"("p_user_id" "uuid", "p_cost_cents" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."aggregate_image_stats_for_date"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."aggregate_image_stats_for_date"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aggregate_image_stats_for_date"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_link_thought_leader"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_link_thought_leader"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_link_thought_leader"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_image_stats"("p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_image_stats"("p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_image_stats"("p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_analytics_api_rate_limit"("p_api_key_hash" "text", "p_max_requests" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_analytics_api_rate_limit"("p_api_key_hash" "text", "p_max_requests" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_analytics_api_rate_limit"("p_api_key_hash" "text", "p_max_requests" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_image_quota"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_image_quota"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_image_quota"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_files" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_files" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_files" TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_pending_knowledge_jobs"("job_limit" integer, "max_retries" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_pending_knowledge_jobs"("job_limit" integer, "max_retries" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_pending_knowledge_jobs"("job_limit" integer, "max_retries" integer) TO "service_role";



GRANT ALL ON TABLE "public"."project_knowledge_files" TO "anon";
GRANT ALL ON TABLE "public"."project_knowledge_files" TO "authenticated";
GRANT ALL ON TABLE "public"."project_knowledge_files" TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_pending_project_knowledge_jobs"("job_limit" integer, "max_retries" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_pending_project_knowledge_jobs"("job_limit" integer, "max_retries" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_pending_project_knowledge_jobs"("job_limit" integer, "max_retries" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_keyword_suggestions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_keyword_suggestions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_keyword_suggestions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_user_quota"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_user_quota"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_user_quota"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_leader_slug"("leader_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_leader_slug"("leader_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_leader_slug"("leader_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_image_children"("p_image_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_image_children"("p_image_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_image_children"("p_image_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_image_version_chain"("p_image_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_image_version_chain"("p_image_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_image_version_chain"("p_image_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_projects_with_sync_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_projects_with_sync_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_projects_with_sync_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."hub_consolidate_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."hub_consolidate_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hub_consolidate_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."hub_generate_conversation_title"() TO "anon";
GRANT ALL ON FUNCTION "public"."hub_generate_conversation_title"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hub_generate_conversation_title"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hub_get_relevant_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer, "p_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."hub_get_relevant_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer, "p_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hub_get_relevant_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_limit" integer, "p_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."hub_increment_memory_access"("p_memory_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."hub_increment_memory_access"("p_memory_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hub_increment_memory_access"("p_memory_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."hub_prune_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer, "p_importance_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."hub_prune_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer, "p_importance_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hub_prune_short_term_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_days_old" integer, "p_importance_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."hub_update_conversation_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."hub_update_conversation_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hub_update_conversation_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_image_quota"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_image_quota"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_image_quota"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_superadmin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_superadmin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_superadmin"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_task_assigned_to"("task_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_task_assigned_to"("task_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_task_assigned_to"("task_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_agent_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_agent_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_agent_memories"("p_agent_id" "uuid", "p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_brand_knowledge_embeddings"("p_brand_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_brand_knowledge_embeddings"("p_brand_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_brand_knowledge_embeddings"("p_brand_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_knowledge_embeddings"("p_category_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_knowledge_embeddings"("p_category_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_knowledge_embeddings"("p_category_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_project_knowledge_embeddings"("p_project_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_project_knowledge_embeddings"("p_project_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_project_knowledge_embeddings"("p_project_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_current_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_current_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_current_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_leader_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_leader_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_leader_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."store_old_task_assigned_to"() TO "anon";
GRANT ALL ON FUNCTION "public"."store_old_task_assigned_to"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_old_task_assigned_to"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_bearer_token_from_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_bearer_token_from_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_bearer_token_from_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_user_login"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."track_user_login"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_user_login"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_agent_memory_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_agent_memory_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_agent_memory_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_analytics_api_keys_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_analytics_api_keys_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_analytics_api_keys_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_feedback_upvotes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_feedback_upvotes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_feedback_upvotes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_project_meetings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_project_meetings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_project_meetings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_project_task"("p_task_id" "uuid", "p_updates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_project_task"("p_task_id" "uuid", "p_updates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_project_task"("p_task_id" "uuid", "p_updates" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_role_permissions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_role_permissions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_role_permissions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_seo_blog_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_seo_blog_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_seo_blog_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_testimonials_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_testimonials_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_testimonials_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_brand_access"("_user_id" "uuid", "_brand_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_brand_access"("_user_id" "uuid", "_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_brand_access"("_user_id" "uuid", "_brand_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_client_access"("_user_id" "uuid", "_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_client_access"("_user_id" "uuid", "_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_client_access"("_user_id" "uuid", "_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_project_access"("_user_id" "uuid", "_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_project_access"("_user_id" "uuid", "_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_project_access"("_user_id" "uuid", "_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_marketing_or_manager"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_marketing_or_manager"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_marketing_or_manager"("_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wc_decide_round_winner"("p_round_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wc_decide_round_winner"("p_round_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wc_score_match"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wc_score_match"("p_match_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."activecollab_credentials" TO "anon";
GRANT ALL ON TABLE "public"."activecollab_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."activecollab_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."activecollab_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."activecollab_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activecollab_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."activecollab_task_data" TO "anon";
GRANT ALL ON TABLE "public"."activecollab_task_data" TO "authenticated";
GRANT ALL ON TABLE "public"."activecollab_task_data" TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."admin_google_drive_folders" TO "anon";
GRANT ALL ON TABLE "public"."admin_google_drive_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_google_drive_folders" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agent_runs" TO "anon";
GRANT ALL ON TABLE "public"."ai_agent_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agent_runs" TO "service_role";



GRANT ALL ON TABLE "public"."agent_cost_summary" TO "anon";
GRANT ALL ON TABLE "public"."agent_cost_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_cost_summary" TO "service_role";



GRANT ALL ON TABLE "public"."agent_daily_cost_stats" TO "anon";
GRANT ALL ON TABLE "public"."agent_daily_cost_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_daily_cost_stats" TO "service_role";



GRANT ALL ON TABLE "public"."agent_execution_steps" TO "anon";
GRANT ALL ON TABLE "public"."agent_execution_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_execution_steps" TO "service_role";



GRANT ALL ON TABLE "public"."agent_memories" TO "anon";
GRANT ALL ON TABLE "public"."agent_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_memories" TO "service_role";



GRANT ALL ON TABLE "public"."agent_pending_approvals" TO "anon";
GRANT ALL ON TABLE "public"."agent_pending_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_pending_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."agent_session_memory" TO "anon";
GRANT ALL ON TABLE "public"."agent_session_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_session_memory" TO "service_role";



GRANT ALL ON TABLE "public"."agent_tool_calls" TO "anon";
GRANT ALL ON TABLE "public"."agent_tool_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tool_calls" TO "service_role";



GRANT ALL ON TABLE "public"."agent_tool_definitions" TO "anon";
GRANT ALL ON TABLE "public"."agent_tool_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tool_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agent_knowledge_selection" TO "anon";
GRANT ALL ON TABLE "public"."ai_agent_knowledge_selection" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agent_knowledge_selection" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents" TO "anon";
GRANT ALL ON TABLE "public"."ai_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents" TO "service_role";



GRANT ALL ON TABLE "public"."ai_configurations" TO "anon";
GRANT ALL ON TABLE "public"."ai_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_generated_images" TO "anon";
GRANT ALL ON TABLE "public"."ai_generated_images" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_generated_images" TO "service_role";



GRANT ALL ON TABLE "public"."ai_shared_resources" TO "anon";
GRANT ALL ON TABLE "public"."ai_shared_resources" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_shared_resources" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."analytics_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."api_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."api_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."api_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."brand_analytics_data" TO "anon";
GRANT ALL ON TABLE "public"."brand_analytics_data" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_analytics_data" TO "service_role";



GRANT ALL ON TABLE "public"."brand_analytics_integrations" TO "anon";
GRANT ALL ON TABLE "public"."brand_analytics_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_analytics_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."brand_analytics_integrations_safe" TO "anon";
GRANT ALL ON TABLE "public"."brand_analytics_integrations_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_analytics_integrations_safe" TO "service_role";



GRANT ALL ON TABLE "public"."brand_file_comments" TO "anon";
GRANT ALL ON TABLE "public"."brand_file_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_file_comments" TO "service_role";



GRANT ALL ON TABLE "public"."brand_generated_posts" TO "anon";
GRANT ALL ON TABLE "public"."brand_generated_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_generated_posts" TO "service_role";



GRANT ALL ON TABLE "public"."brand_knowledge_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."brand_knowledge_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_knowledge_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."brand_knowledge_files" TO "anon";
GRANT ALL ON TABLE "public"."brand_knowledge_files" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_knowledge_files" TO "service_role";



GRANT ALL ON TABLE "public"."brand_kpis" TO "anon";
GRANT ALL ON TABLE "public"."brand_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."client_communications" TO "anon";
GRANT ALL ON TABLE "public"."client_communications" TO "authenticated";
GRANT ALL ON TABLE "public"."client_communications" TO "service_role";



GRANT ALL ON TABLE "public"."client_testimonials" TO "anon";
GRANT ALL ON TABLE "public"."client_testimonials" TO "authenticated";
GRANT ALL ON TABLE "public"."client_testimonials" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."code_analysis_results" TO "anon";
GRANT ALL ON TABLE "public"."code_analysis_results" TO "authenticated";
GRANT ALL ON TABLE "public"."code_analysis_results" TO "service_role";



GRANT ALL ON TABLE "public"."code_generation_templates" TO "anon";
GRANT ALL ON TABLE "public"."code_generation_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."code_generation_templates" TO "service_role";



GRANT ALL ON TABLE "public"."code_repositories" TO "anon";
GRANT ALL ON TABLE "public"."code_repositories" TO "authenticated";
GRANT ALL ON TABLE "public"."code_repositories" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."content_performance_metrics" TO "anon";
GRANT ALL ON TABLE "public"."content_performance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."content_performance_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."content_repurpose_assets" TO "anon";
GRANT ALL ON TABLE "public"."content_repurpose_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."content_repurpose_assets" TO "service_role";



GRANT ALL ON TABLE "public"."content_repurpose_packs" TO "anon";
GRANT ALL ON TABLE "public"."content_repurpose_packs" TO "authenticated";
GRANT ALL ON TABLE "public"."content_repurpose_packs" TO "service_role";



GRANT ALL ON TABLE "public"."content_repurpose_performance" TO "anon";
GRANT ALL ON TABLE "public"."content_repurpose_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."content_repurpose_performance" TO "service_role";



GRANT ALL ON TABLE "public"."control_tower_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."control_tower_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."control_tower_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."control_tower_api_keys_safe" TO "anon";
GRANT ALL ON TABLE "public"."control_tower_api_keys_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."control_tower_api_keys_safe" TO "service_role";



GRANT ALL ON TABLE "public"."control_tower_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."control_tower_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."control_tower_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."daily_head_starts" TO "anon";
GRANT ALL ON TABLE "public"."daily_head_starts" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_head_starts" TO "service_role";



GRANT ALL ON TABLE "public"."deals" TO "anon";
GRANT ALL ON TABLE "public"."deals" TO "authenticated";
GRANT ALL ON TABLE "public"."deals" TO "service_role";



GRANT ALL ON TABLE "public"."deep_research_results" TO "anon";
GRANT ALL ON TABLE "public"."deep_research_results" TO "authenticated";
GRANT ALL ON TABLE "public"."deep_research_results" TO "service_role";



GRANT ALL ON TABLE "public"."documentation_output_config" TO "anon";
GRANT ALL ON TABLE "public"."documentation_output_config" TO "authenticated";
GRANT ALL ON TABLE "public"."documentation_output_config" TO "service_role";



GRANT ALL ON TABLE "public"."documentation_repository_links" TO "anon";
GRANT ALL ON TABLE "public"."documentation_repository_links" TO "authenticated";
GRANT ALL ON TABLE "public"."documentation_repository_links" TO "service_role";



GRANT ALL ON TABLE "public"."documentation_rules" TO "anon";
GRANT ALL ON TABLE "public"."documentation_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."documentation_rules" TO "service_role";



GRANT ALL ON TABLE "public"."documentation_templates" TO "anon";
GRANT ALL ON TABLE "public"."documentation_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."documentation_templates" TO "service_role";



GRANT ALL ON TABLE "public"."email_notifications_log" TO "anon";
GRANT ALL ON TABLE "public"."email_notifications_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_notifications_log" TO "service_role";



GRANT ALL ON TABLE "public"."email_send_log" TO "anon";
GRANT ALL ON TABLE "public"."email_send_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_send_log" TO "service_role";



GRANT ALL ON TABLE "public"."employee_user_mapping" TO "anon";
GRANT ALL ON TABLE "public"."employee_user_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_user_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."estimate_items" TO "anon";
GRANT ALL ON TABLE "public"."estimate_items" TO "authenticated";
GRANT ALL ON TABLE "public"."estimate_items" TO "service_role";



GRANT ALL ON TABLE "public"."estimates" TO "anon";
GRANT ALL ON TABLE "public"."estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."estimates" TO "service_role";



GRANT ALL ON TABLE "public"."gemini_videos" TO "anon";
GRANT ALL ON TABLE "public"."gemini_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."gemini_videos" TO "service_role";



GRANT ALL ON TABLE "public"."sora_videos" TO "anon";
GRANT ALL ON TABLE "public"."sora_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."sora_videos" TO "service_role";



GRANT ALL ON TABLE "public"."feature_usage_summary" TO "anon";
GRANT ALL ON TABLE "public"."feature_usage_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_usage_summary" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_comments" TO "anon";
GRANT ALL ON TABLE "public"."feedback_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_comments" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_reports" TO "anon";
GRANT ALL ON TABLE "public"."feedback_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."feedback_reports_feedback_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."feedback_reports_feedback_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."feedback_reports_feedback_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_upvotes" TO "anon";
GRANT ALL ON TABLE "public"."feedback_upvotes" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_upvotes" TO "service_role";



GRANT ALL ON TABLE "public"."generated_posts" TO "anon";
GRANT ALL ON TABLE "public"."generated_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_posts" TO "service_role";



GRANT ALL ON TABLE "public"."gohighlevel_contacts" TO "anon";
GRANT ALL ON TABLE "public"."gohighlevel_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."gohighlevel_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."gohighlevel_integrations" TO "anon";
GRANT ALL ON TABLE "public"."gohighlevel_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."gohighlevel_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."gohighlevel_integrations_safe" TO "anon";
GRANT ALL ON TABLE "public"."gohighlevel_integrations_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."gohighlevel_integrations_safe" TO "service_role";



GRANT ALL ON TABLE "public"."google_drive_settings" TO "anon";
GRANT ALL ON TABLE "public"."google_drive_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."google_drive_settings" TO "service_role";



GRANT ALL ON TABLE "public"."hackathon_events" TO "anon";
GRANT ALL ON TABLE "public"."hackathon_events" TO "authenticated";
GRANT ALL ON TABLE "public"."hackathon_events" TO "service_role";



GRANT ALL ON TABLE "public"."hackathon_judges" TO "anon";
GRANT ALL ON TABLE "public"."hackathon_judges" TO "authenticated";
GRANT ALL ON TABLE "public"."hackathon_judges" TO "service_role";



GRANT ALL ON TABLE "public"."hackathon_participants" TO "anon";
GRANT ALL ON TABLE "public"."hackathon_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."hackathon_participants" TO "service_role";



GRANT ALL ON TABLE "public"."hackathon_scores" TO "anon";
GRANT ALL ON TABLE "public"."hackathon_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."hackathon_scores" TO "service_role";



GRANT ALL ON TABLE "public"."hackathon_submissions" TO "anon";
GRANT ALL ON TABLE "public"."hackathon_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."hackathon_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."hackathon_team_members" TO "anon";
GRANT ALL ON TABLE "public"."hackathon_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."hackathon_team_members" TO "service_role";



GRANT ALL ON TABLE "public"."hackathon_teams" TO "anon";
GRANT ALL ON TABLE "public"."hackathon_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."hackathon_teams" TO "service_role";



GRANT ALL ON TABLE "public"."hero_section_generation_logs" TO "anon";
GRANT ALL ON TABLE "public"."hero_section_generation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."hero_section_generation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."hero_section_generations" TO "anon";
GRANT ALL ON TABLE "public"."hero_section_generations" TO "authenticated";
GRANT ALL ON TABLE "public"."hero_section_generations" TO "service_role";



GRANT ALL ON TABLE "public"."hub_agent_memories" TO "anon";
GRANT ALL ON TABLE "public"."hub_agent_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_agent_memories" TO "service_role";



GRANT ALL ON TABLE "public"."hub_agent_runs" TO "anon";
GRANT ALL ON TABLE "public"."hub_agent_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_agent_runs" TO "service_role";



GRANT ALL ON TABLE "public"."hub_agents" TO "anon";
GRANT ALL ON TABLE "public"."hub_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_agents" TO "service_role";



GRANT ALL ON TABLE "public"."hub_conversations" TO "anon";
GRANT ALL ON TABLE "public"."hub_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."hub_messages" TO "anon";
GRANT ALL ON TABLE "public"."hub_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_messages" TO "service_role";



GRANT ALL ON TABLE "public"."hub_personalizations" TO "anon";
GRANT ALL ON TABLE "public"."hub_personalizations" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_personalizations" TO "service_role";



GRANT ALL ON TABLE "public"."image_aspect_ratios" TO "anon";
GRANT ALL ON TABLE "public"."image_aspect_ratios" TO "authenticated";
GRANT ALL ON TABLE "public"."image_aspect_ratios" TO "service_role";



GRANT ALL ON TABLE "public"."image_generation_stats" TO "anon";
GRANT ALL ON TABLE "public"."image_generation_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."image_generation_stats" TO "service_role";



GRANT ALL ON TABLE "public"."image_prompt_templates" TO "anon";
GRANT ALL ON TABLE "public"."image_prompt_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."image_prompt_templates" TO "service_role";



GRANT ALL ON TABLE "public"."image_safety_blocks" TO "anon";
GRANT ALL ON TABLE "public"."image_safety_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."image_safety_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."image_shared_folders" TO "anon";
GRANT ALL ON TABLE "public"."image_shared_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."image_shared_folders" TO "service_role";



GRANT ALL ON TABLE "public"."image_stats_summary" TO "anon";
GRANT ALL ON TABLE "public"."image_stats_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."image_stats_summary" TO "service_role";



GRANT ALL ON TABLE "public"."image_style_presets" TO "anon";
GRANT ALL ON TABLE "public"."image_style_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."image_style_presets" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."image_top_users" TO "anon";
GRANT ALL ON TABLE "public"."image_top_users" TO "authenticated";
GRANT ALL ON TABLE "public"."image_top_users" TO "service_role";



GRANT ALL ON TABLE "public"."influencer_style_library" TO "anon";
GRANT ALL ON TABLE "public"."influencer_style_library" TO "authenticated";
GRANT ALL ON TABLE "public"."influencer_style_library" TO "service_role";



GRANT ALL ON TABLE "public"."integration_logs" TO "anon";
GRANT ALL ON TABLE "public"."integration_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_logs" TO "service_role";



GRANT ALL ON TABLE "public"."keyword_blog_usage" TO "anon";
GRANT ALL ON TABLE "public"."keyword_blog_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."keyword_blog_usage" TO "service_role";



GRANT ALL ON TABLE "public"."keyword_ranking_history" TO "anon";
GRANT ALL ON TABLE "public"."keyword_ranking_history" TO "authenticated";
GRANT ALL ON TABLE "public"."keyword_ranking_history" TO "service_role";



GRANT ALL ON TABLE "public"."keyword_research" TO "anon";
GRANT ALL ON TABLE "public"."keyword_research" TO "authenticated";
GRANT ALL ON TABLE "public"."keyword_research" TO "service_role";



GRANT ALL ON TABLE "public"."keyword_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."keyword_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."keyword_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_base" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_base" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_base" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_base_categories" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_base_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_base_categories" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_base_files" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_base_files" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_base_files" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_base_usage" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_base_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_base_usage" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_sources" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_sources" TO "service_role";



GRANT ALL ON TABLE "public"."leader_uploads" TO "anon";
GRANT ALL ON TABLE "public"."leader_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."leader_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."linkedin_agent_templates" TO "anon";
GRANT ALL ON TABLE "public"."linkedin_agent_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."linkedin_agent_templates" TO "service_role";



GRANT ALL ON TABLE "public"."model_cost_breakdown" TO "anon";
GRANT ALL ON TABLE "public"."model_cost_breakdown" TO "authenticated";
GRANT ALL ON TABLE "public"."model_cost_breakdown" TO "service_role";



GRANT ALL ON TABLE "public"."n8n_workflow_configs" TO "anon";
GRANT ALL ON TABLE "public"."n8n_workflow_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."n8n_workflow_configs" TO "service_role";



GRANT ALL ON TABLE "public"."n8n_workflow_configs_safe" TO "anon";
GRANT ALL ON TABLE "public"."n8n_workflow_configs_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."n8n_workflow_configs_safe" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_sources" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_sources" TO "service_role";



GRANT ALL ON TABLE "public"."organization_integrations" TO "anon";
GRANT ALL ON TABLE "public"."organization_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."perplexity_settings" TO "anon";
GRANT ALL ON TABLE "public"."perplexity_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."perplexity_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_login_tracking" TO "anon";
GRANT ALL ON TABLE "public"."user_login_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."user_login_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."platform_activity_daily" TO "anon";
GRANT ALL ON TABLE "public"."platform_activity_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_activity_daily" TO "service_role";



GRANT ALL ON TABLE "public"."pod_members" TO "anon";
GRANT ALL ON TABLE "public"."pod_members" TO "authenticated";
GRANT ALL ON TABLE "public"."pod_members" TO "service_role";



GRANT ALL ON TABLE "public"."pods" TO "anon";
GRANT ALL ON TABLE "public"."pods" TO "authenticated";
GRANT ALL ON TABLE "public"."pods" TO "service_role";



GRANT ALL ON TABLE "public"."post_agent_references" TO "anon";
GRANT ALL ON TABLE "public"."post_agent_references" TO "authenticated";
GRANT ALL ON TABLE "public"."post_agent_references" TO "service_role";



GRANT ALL ON TABLE "public"."project_knowledge_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."project_knowledge_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."project_knowledge_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."project_knowledge_sources" TO "anon";
GRANT ALL ON TABLE "public"."project_knowledge_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."project_knowledge_sources" TO "service_role";



GRANT ALL ON TABLE "public"."project_meetings" TO "anon";
GRANT ALL ON TABLE "public"."project_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."project_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."project_task_comments" TO "anon";
GRANT ALL ON TABLE "public"."project_task_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_task_comments" TO "service_role";



GRANT ALL ON TABLE "public"."project_tasks" TO "anon";
GRANT ALL ON TABLE "public"."project_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."project_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."reel_hook_generation_logs" TO "anon";
GRANT ALL ON TABLE "public"."reel_hook_generation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."reel_hook_generation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."reel_hook_generations" TO "anon";
GRANT ALL ON TABLE "public"."reel_hook_generations" TO "authenticated";
GRANT ALL ON TABLE "public"."reel_hook_generations" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."seo_blog_content" TO "anon";
GRANT ALL ON TABLE "public"."seo_blog_content" TO "authenticated";
GRANT ALL ON TABLE "public"."seo_blog_content" TO "service_role";



GRANT ALL ON TABLE "public"."seo_blog_generation_logs" TO "anon";
GRANT ALL ON TABLE "public"."seo_blog_generation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."seo_blog_generation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."seo_reference_summaries" TO "anon";
GRANT ALL ON TABLE "public"."seo_reference_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."seo_reference_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."task_comments" TO "anon";
GRANT ALL ON TABLE "public"."task_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_comments" TO "service_role";



GRANT ALL ON TABLE "public"."team_daily_summaries" TO "anon";
GRANT ALL ON TABLE "public"."team_daily_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."team_daily_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."team_eod_submissions" TO "anon";
GRANT ALL ON TABLE "public"."team_eod_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."team_eod_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."testimonial_submission_tokens" TO "anon";
GRANT ALL ON TABLE "public"."testimonial_submission_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."testimonial_submission_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."thought_leaders" TO "anon";
GRANT ALL ON TABLE "public"."thought_leaders" TO "authenticated";
GRANT ALL ON TABLE "public"."thought_leaders" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_email_config" TO "anon";
GRANT ALL ON TABLE "public"."tournament_email_config" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_email_config" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_email_sends" TO "anon";
GRANT ALL ON TABLE "public"."tournament_email_sends" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_email_sends" TO "service_role";



GRANT ALL ON TABLE "public"."user_accountability_chart" TO "anon";
GRANT ALL ON TABLE "public"."user_accountability_chart" TO "authenticated";
GRANT ALL ON TABLE "public"."user_accountability_chart" TO "service_role";



GRANT ALL ON TABLE "public"."user_activecollab_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_activecollab_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activecollab_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_activity_summary" TO "anon";
GRANT ALL ON TABLE "public"."user_activity_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activity_summary" TO "service_role";



GRANT ALL ON TABLE "public"."user_agent_breakdown" TO "anon";
GRANT ALL ON TABLE "public"."user_agent_breakdown" TO "authenticated";
GRANT ALL ON TABLE "public"."user_agent_breakdown" TO "service_role";



GRANT ALL ON TABLE "public"."user_brands" TO "anon";
GRANT ALL ON TABLE "public"."user_brands" TO "authenticated";
GRANT ALL ON TABLE "public"."user_brands" TO "service_role";



GRANT ALL ON TABLE "public"."user_google_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_google_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_google_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."vision_examples" TO "anon";
GRANT ALL ON TABLE "public"."vision_examples" TO "authenticated";
GRANT ALL ON TABLE "public"."vision_examples" TO "service_role";



GRANT ALL ON TABLE "public"."wc_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."wc_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."wc_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."wc_matches" TO "anon";
GRANT ALL ON TABLE "public"."wc_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."wc_matches" TO "service_role";



GRANT ALL ON TABLE "public"."wc_predictions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."wc_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."wc_predictions" TO "service_role";



GRANT INSERT("id") ON TABLE "public"."wc_predictions" TO "authenticated";



GRANT INSERT("match_id"),UPDATE("match_id") ON TABLE "public"."wc_predictions" TO "authenticated";



GRANT INSERT("user_id"),UPDATE("user_id") ON TABLE "public"."wc_predictions" TO "authenticated";



GRANT INSERT("predicted_home"),UPDATE("predicted_home") ON TABLE "public"."wc_predictions" TO "authenticated";



GRANT INSERT("predicted_away"),UPDATE("predicted_away") ON TABLE "public"."wc_predictions" TO "authenticated";



GRANT ALL ON TABLE "public"."wc_leaderboard_overall" TO "anon";
GRANT ALL ON TABLE "public"."wc_leaderboard_overall" TO "authenticated";
GRANT ALL ON TABLE "public"."wc_leaderboard_overall" TO "service_role";



GRANT ALL ON TABLE "public"."wc_leaderboard_rounds" TO "anon";
GRANT ALL ON TABLE "public"."wc_leaderboard_rounds" TO "authenticated";
GRANT ALL ON TABLE "public"."wc_leaderboard_rounds" TO "service_role";



GRANT ALL ON TABLE "public"."wc_round_winners" TO "anon";
GRANT ALL ON TABLE "public"."wc_round_winners" TO "authenticated";
GRANT ALL ON TABLE "public"."wc_round_winners" TO "service_role";



GRANT ALL ON TABLE "public"."wc_settings" TO "anon";
GRANT ALL ON TABLE "public"."wc_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."wc_settings" TO "service_role";



GRANT ALL ON TABLE "public"."wc_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."wc_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."wc_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_trends" TO "anon";
GRANT ALL ON TABLE "public"."weekly_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_trends" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







