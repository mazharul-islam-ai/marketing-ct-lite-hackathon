/**
 * MCP HTTP client for Trigger.dev runtime (Node.js).
 * Mirrors supabase/functions/_shared/mcp-client.ts
 */

import { webcrypto } from "node:crypto";

export const MCP_PROTOCOL_VERSION = "2024-11-05";

export interface McpServerConnection {
  url: string;
  authType?: "none" | "bearer" | "api_key";
  authToken?: string;
  authHeaderName?: string;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const IV_LENGTH = 12;

async function deriveKey(keyString: string): Promise<CryptoKey> {
  const hash = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(keyString));
  return webcrypto.subtle.importKey("raw", hash, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}

export async function decryptValue(encryptedText: string): Promise<string> {
  if (!encryptedText) return "";
  const keyString = process.env.ENCRYPTION_KEY;
  if (!keyString) throw new Error("ENCRYPTION_KEY environment variable is not set");

  const key = await deriveKey(keyString);
  const combined = Uint8Array.from(Buffer.from(encryptedText, "base64"));
  const iv = combined.slice(0, IV_LENGTH);
  const encryptedData = combined.slice(IV_LENGTH);
  const decryptedBuffer = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedData);
  return new TextDecoder().decode(decryptedBuffer);
}

export class McpHttpClient {
  private sessionId?: string;
  private requestId = 0;
  private initialized = false;

  constructor(private readonly connection: McpServerConnection) {}

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;

    const { authType = "none", authToken, authHeaderName = "Authorization" } = this.connection;
    if (authToken && authType === "bearer") {
      headers[authHeaderName] = authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
    } else if (authToken && authType === "api_key") {
      headers[authHeaderName] = authToken;
    }
    return headers;
  }

  private async postMessage(method: string, params?: unknown): Promise<unknown> {
    const id = ++this.requestId;
    const response = await fetch(this.connection.url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} }),
      signal: AbortSignal.timeout(30_000),
    });

    const sessionHeader = response.headers.get("Mcp-Session-Id");
    if (sessionHeader) this.sessionId = sessionHeader;

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}: ${text.slice(0, 300)}`);

    if (contentType.includes("text/event-stream")) return parseSseJsonRpc(text, id);

    const parsed = JSON.parse(text) as JsonRpcResponse;
    if (parsed.error) throw new Error(`MCP error ${parsed.error.code}: ${parsed.error.message}`);
    return parsed.result;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.postMessage("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "marketing-control-tower", version: "1.0.0" },
    });
    try { await this.postMessage("notifications/initialized", {}); } catch { /* ok */ }
    this.initialized = true;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    await this.initialize();
    const result = await this.postMessage("tools/call", { name, arguments: args }) as {
      content?: unknown[];
      isError?: boolean;
    } | undefined;

    if (result?.isError) throw new Error(`MCP tool "${name}" returned an error`);

    if (Array.isArray(result?.content)) {
      const textParts = result.content
        .filter((c) => c && typeof c === "object" && (c as { type?: string }).type === "text")
        .map((c) => String((c as { text?: string }).text ?? ""));
      if (textParts.length > 0) return textParts.join("\n");
      return result.content;
    }
    return result;
  }
}

function parseSseJsonRpc(body: string, expectedId: number): unknown {
  for (const line of body.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload) as JsonRpcResponse;
      if (parsed.id === expectedId || parsed.id === undefined) {
        if (parsed.error) throw new Error(`MCP error ${parsed.error.code}: ${parsed.error.message}`);
        return parsed.result;
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("MCP error")) throw e;
    }
  }
  throw new Error("MCP SSE response did not contain a valid JSON-RPC result");
}

export async function executeMcpTool(
  connection: McpServerConnection,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const client = new McpHttpClient(connection);
  return client.callTool(toolName, args);
}
