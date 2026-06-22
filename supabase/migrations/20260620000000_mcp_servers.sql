-- MCP server registry for Agent Builder
-- Migration: 20260620000000_mcp_servers.sql

CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID,
  name                  TEXT NOT NULL,
  description           TEXT,
  transport             TEXT NOT NULL DEFAULT 'http'
                        CHECK (transport IN ('http', 'sse')),
  url                   TEXT NOT NULL,
  auth_type             TEXT NOT NULL DEFAULT 'none'
                        CHECK (auth_type IN ('none', 'bearer', 'api_key')),
  auth_token_encrypted  TEXT,
  auth_header_name      TEXT DEFAULT 'Authorization',
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'connected', 'error', 'disabled')),
  status_message        TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  last_sync_at          TIMESTAMPTZ,
  created_by            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mcp_server_tools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  tool_name       TEXT NOT NULL,
  description     TEXT,
  input_schema    JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_workspace ON public.mcp_servers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_active    ON public.mcp_servers(is_active, status);
CREATE INDEX IF NOT EXISTS idx_mcp_server_tools_srv   ON public.mcp_server_tools(server_id);

CREATE OR REPLACE FUNCTION public.update_mcp_servers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mcp_servers_updated_at
  BEFORE UPDATE ON public.mcp_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_mcp_servers_updated_at();

ALTER TABLE public.mcp_servers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_server_tools  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcp_servers_read_authenticated"
  ON public.mcp_servers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "mcp_servers_write_admin"
  ON public.mcp_servers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

CREATE POLICY "mcp_server_tools_read_authenticated"
  ON public.mcp_server_tools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "mcp_server_tools_write_admin"
  ON public.mcp_server_tools FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

CREATE OR REPLACE VIEW public.mcp_servers_safe AS
SELECT
  id, workspace_id, name, description, transport, url,
  auth_type, auth_header_name, status, status_message,
  is_active, last_sync_at, created_by, created_at, updated_at
FROM public.mcp_servers;

COMMENT ON TABLE public.mcp_servers IS 'Registered external MCP servers for Agent Builder mcp_tool nodes';
COMMENT ON TABLE public.mcp_server_tools IS 'Cached tool catalog from connected MCP servers';
