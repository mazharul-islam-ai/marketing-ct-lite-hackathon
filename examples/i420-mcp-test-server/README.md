# i420 MCP Test Server (Cloudflare Workers)

Free, authless MCP HTTP server for testing i420 Agent Builder MCP integration.

Compatible with:
- [`supabase/functions/_shared/mcp-client.ts`](../../supabase/functions/_shared/mcp-client.ts)
- [`supabase/functions/mcp-manage`](../../supabase/functions/mcp-manage/index.ts)
- [`trigger/agent-flow/mcp-client.ts`](../../trigger/agent-flow/mcp-client.ts)

## Tools

| Tool | Description |
|------|-------------|
| `echo` | `{ "message": "hello" }` → `"Echo: hello"` |
| `get_client_sample` | Optional `{ "id": 1 }` → fake CRM JSON |

## Local development

```bash
cd examples/i420-mcp-test-server
npm install
npm start
# → http://localhost:8788/mcp
node test-mcp-client.mjs
```

Test with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest
# Connect to http://localhost:8788/mcp
```

Or via i420 Settings → MCP Servers → **Test connection** (requires tunnel for remote Supabase).

## Deploy to Cloudflare (free tier)

```bash
export CLOUDFLARE_API_TOKEN=your_token   # required in CI/non-interactive env
npx wrangler login                         # or use token above
npm run deploy
# → https://i420-mcp-test-server.<your-subdomain>.workers.dev/mcp
node test-mcp-client.mjs https://i420-mcp-test-server.<subdomain>.workers.dev/mcp
```

## Register in i420

1. Open `/i420/settings` → **MCP Servers**
2. **Test connection** with your deployed `/mcp` URL
3. **Connect & sync tools**
4. In Design chat, build a flow using `mcp_tool` with `tool_name: "echo"`

## E2E checklist

- [ ] Test connection lists `echo` and `get_client_sample`
- [ ] Sync shows status **connected**
- [ ] Compiled flow contains valid `server_id` + `tool_name`
- [ ] Runtime `mcp_tool` step returns non-empty result (requires Trigger.dev deploy)

Official Cloudflare guide: https://developers.cloudflare.com/agents/guides/remote-mcp-server/
