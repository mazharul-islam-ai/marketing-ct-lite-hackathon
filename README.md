# SJ Marketing AI Platform

React-based marketing AI platform for content generation, client management, analytics integration, and team collaboration.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn-ui
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **State:** TanStack Query v5
- **AI:** OpenAI, Anthropic Claude, Google Gemini, Perplexity

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template and fill in values
cp .env.example .env

# Start dev server (http://localhost:8080)
npm run dev
```

### Supabase Setup

1. Link your Supabase project: `npx supabase link`
2. Apply migrations: `npx supabase db push`
3. Deploy edge functions as needed: `npx supabase functions deploy <function-name>`

See [.agent/SOP/local-environment-setup.md](.agent/SOP/local-environment-setup.md) for full setup instructions.

## Demo Credentials

On the login page (`/login`), use the **Demo Credentials** section in the Password tab:

| Account | Email | Password | Role |
|---------|-------|----------|------|
| Admin | `demo.admin@sjinnovation.com` | `demo-password-123` | `super_admin` |
| User | `demo.user@sjinnovation.com` | `demo-password-123` | `user` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

## Documentation

Full project documentation lives in [.agent/README.md](.agent/README.md):

- **System** — architecture, database schema, AI agents, integrations
- **SOP** — setup guides, development practices, integration procedures
- **Tasks** — feature PRDs and implementation plans

## MCP Test Server

For testing Agent Builder MCP integration locally:

```bash
cd examples/i420-mcp-test-server
npm install
npm start
```

See [examples/i420-mcp-test-server/README.md](examples/i420-mcp-test-server/README.md) for deployment details.

## License

See [LICENSE](LICENSE).
