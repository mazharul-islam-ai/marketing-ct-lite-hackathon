import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Plus, RefreshCw, Trash2, Plug, CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ab } from "./agentBuilderTheme";

interface McpServer {
  id: string;
  name: string;
  description: string | null;
  url: string;
  transport: string;
  auth_type: string;
  status: string;
  status_message: string | null;
  is_active: boolean;
  last_sync_at: string | null;
}

interface McpTool {
  server_id: string;
  tool_name: string;
  description: string | null;
  input_schema: Record<string, unknown>;
}

export function McpServersPanel() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [authType, setAuthType] = useState<"none" | "bearer" | "api_key">("none");
  const [authToken, setAuthToken] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mcp-manage", { method: "GET" });
      if (error) throw error;
      setServers((data?.servers as McpServer[]) ?? []);
      setTools((data?.tools as McpTool[]) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load MCP servers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim() || !url.trim()) {
      toast.error("Name and URL are required");
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("mcp-manage?action=create", {
        body: {
          action: "create",
          name: name.trim(),
          url: url.trim(),
          description: description.trim() || undefined,
          auth_type: authType,
          auth_token: authToken || undefined,
        },
      });
      if (error) throw error;
      if (data?.sync && !data.sync.ok) {
        toast.warning(`Server saved but sync failed: ${data.sync.error ?? "unknown error"}`);
      } else {
        toast.success("MCP server connected");
      }
      setShowForm(false);
      setName("");
      setUrl("");
      setDescription("");
      setAuthToken("");
      setAuthType("none");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add MCP server");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSync(serverId: string) {
    setSyncingId(serverId);
    try {
      const { data, error } = await supabase.functions.invoke("mcp-manage?action=sync", {
        body: { action: "sync", server_id: serverId },
      });
      if (error) throw error;
      if (!data?.sync?.ok) {
        toast.error(data?.sync?.error ?? "Sync failed");
      } else {
        toast.success(`Synced ${data.sync.tools?.length ?? 0} tools`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(serverId: string) {
    try {
      const { error } = await supabase.functions.invoke("mcp-manage?action=delete", {
        body: { action: "delete", server_id: serverId },
      });
      if (error) throw error;
      toast.success("MCP server removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const toolsByServer = tools.reduce<Record<string, McpTool[]>>((acc, t) => {
    (acc[t.server_id] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-slate-500 max-w-xl">
          Register external MCP servers (HTTP/SSE transport). Tools are synced and available to the
          flow compiler as <code className="text-[10px]">mcp_tool</code> nodes. Credentials are encrypted at rest.
        </p>
        <Button size="sm" className="text-xs h-8 shrink-0" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add server
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[hsl(250_18%_90%)] bg-[hsl(250_28%_96%)] p-4 space-y-3 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Linear MCP" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Server URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-xs" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Auth type</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as typeof authType)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer token</SelectItem>
                  <SelectItem value="api_key">API key header</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {authType !== "none" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Auth token</Label>
                <Input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} className="h-8 text-xs" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" className="text-xs h-8" onClick={handleCreate} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Connect & sync tools
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : servers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(250_18%_90%)] p-8 text-center text-xs text-slate-500">
          <Plug className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No MCP servers registered yet.
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => {
            const serverTools = toolsByServer[server.id] ?? [];
            const expanded = expandedId === server.id;
            const connected = server.status === "connected";
            return (
              <div key={server.id} className="rounded-xl border border-[hsl(250_18%_90%)] bg-[hsl(250_28%_96%)] overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 p-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", connected ? ab.accentMuted : "bg-muted")}>
                    <Plug className={cn("w-4 h-4", connected ? ab.accentText : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{server.name}</span>
                      {connected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" /> {serverTools.length} tools
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-2.5 h-2.5" /> {server.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{server.url}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">id: {server.id}</p>
                    {server.status_message && (
                      <p className="text-[10px] text-amber-600 mt-1">{server.status_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSync(server.id)} disabled={syncingId === server.id}>
                      {syncingId === server.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(server.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expanded ? null : server.id)}>
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-[hsl(250_18%_90%)] px-4 py-3 bg-white/40">
                    {serverTools.length === 0 ? (
                      <p className="text-xs text-slate-500">No tools synced. Click refresh to retry.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {serverTools.map((t) => (
                          <li key={t.tool_name} className="text-xs">
                            <span className="font-mono font-medium text-slate-700">{t.tool_name}</span>
                            {t.description && <span className="text-slate-500"> — {t.description}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
