/**
 * Minimal authless MCP HTTP server for i420 Agent Builder testing.
 * Compatible with supabase/functions/_shared/mcp-client.ts (JSON-RPC over POST /mcp).
 *
 * Deploy: npm run deploy → https://<worker>.<subdomain>.workers.dev/mcp
 * Local:  npm start      → http://localhost:8788/mcp
 */

const MCP_PROTOCOL = "2024-11-05";

const TOOLS = [
  {
    name: "echo",
    description: "Echo a message back to verify tools/call round-trip",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Text to echo" } },
      required: ["message"],
    },
  },
  {
    name: "get_client_sample",
    description: "Return a fake CRM client record for demo workflows",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Optional client id" } },
    },
  },
];

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id",
    },
  });
}

function handleToolsCall(name: string, args: Record<string, unknown>) {
  if (name === "echo") {
    const message = String(args.message ?? "");
    return { content: [{ type: "text", text: `Echo: ${message}` }] };
  }

  if (name === "get_client_sample") {
    const id = Number(args.id ?? 1);
    const client = {
      id,
      name: "Acme Corp",
      email: "contact@acme.example",
      status: "active",
      industry: "SaaS",
    };
    return { content: [{ type: "text", text: JSON.stringify(client, null, 2) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id",
        },
      });
    }

    if (url.pathname !== "/mcp") {
      return new Response("i420 MCP test server — POST /mcp", { status: 404 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body: JsonRpcRequest;
    try {
      body = (await request.json()) as JsonRpcRequest;
    } catch {
      return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
    }

    const { id = null, method, params = {} } = body;

    try {
      switch (method) {
        case "initialize":
          return jsonResponse({
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: MCP_PROTOCOL,
              capabilities: { tools: {} },
              serverInfo: { name: "i420-mcp-test-server", version: "1.0.0" },
            },
          });

        case "notifications/initialized":
          return jsonResponse({ jsonrpc: "2.0", id, result: {} });

        case "tools/list":
          return jsonResponse({ jsonrpc: "2.0", id, result: { tools: TOOLS } });

        case "tools/call": {
          const toolName = String(params.name ?? "");
          const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;
          const result = handleToolsCall(toolName, toolArgs);
          return jsonResponse({ jsonrpc: "2.0", id, result });
        }

        default:
          return jsonResponse({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return jsonResponse({
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message },
      });
    }
  },
};
