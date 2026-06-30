/**
 * Smoke test — mirrors supabase/functions/_shared/mcp-client.ts protocol.
 * Usage: node test-mcp-client.mjs [url]
 * Default: http://localhost:8788/mcp
 */

const MCP_URL = process.argv[2] ?? "http://localhost:8788/mcp";
const PROTOCOL = "2024-11-05";

async function rpc(id, method, params = {}) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  if (data.error) throw new Error(`RPC ${data.error.code}: ${data.error.message}`);
  return data.result;
}

async function main() {
  console.log(`Testing MCP at ${MCP_URL}`);

  const init = await rpc(1, "initialize", {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: "i420-test", version: "1.0.0" },
  });
  console.log("initialize:", init.serverInfo?.name ?? init);

  try {
    await rpc(2, "notifications/initialized", {});
  } catch {
    /* optional */
  }

  const list = await rpc(3, "tools/list", {});
  const tools = list.tools ?? [];
  console.log("tools:", tools.map((t) => t.name).join(", "));
  if (!tools.some((t) => t.name === "echo")) throw new Error("Missing echo tool");

  const echo = await rpc(4, "tools/call", {
    name: "echo",
    arguments: { message: "hello from i420" },
  });
  const echoText = echo.content?.[0]?.text ?? JSON.stringify(echo);
  console.log("echo result:", echoText);
  if (!String(echoText).includes("hello from i420")) throw new Error("Unexpected echo output");

  const sample = await rpc(5, "tools/call", {
    name: "get_client_sample",
    arguments: { id: 42 },
  });
  console.log("get_client_sample:", sample.content?.[0]?.text?.slice(0, 80) + "...");

  console.log("\nAll MCP smoke tests passed.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
