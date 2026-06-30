# Integration Points

> **Last Updated:** 2026-01-02  
> **Status:** Verified against codebase

## Related Documentation
- [Project Architecture](./project_architecture.md) - Complete system architecture
- [Database Schema](./database_schema.md) - Integration data storage
- [AI Agent System](./ai_agent_system.md) - AI provider integrations
- [Vector Embeddings System](./vector-embeddings-system.md) - Embedding integrations

---

## Overview

The platform integrates with 11+ external services across categories including AI providers, project management, CRM, analytics, workflow automation, and document storage. All integrations feature health monitoring, error tracking, and secure credential storage.

### Integration Categories

1. **AI Providers** - OpenAI, Google Gemini, Anthropic Claude, Perplexity AI
2. **Project Management** - ActiveCollab
3. **Document Storage** - Google Drive
4. **Analytics** - Google Analytics
5. **CRM** - HubSpot, GoHighLevel
6. **Workflow Automation** - n8n
7. **External AI Agents** - CollabAI

---

## 1. ActiveCollab (Project Management)

### Overview

**Purpose:** Sync projects, tasks, and time tracking data

**Integration Type:** REST API with dual authentication

**Edge Functions:**
- `activecollab-projects` - Project synchronization
- `activecollab-tasks` - Task synchronization
- `activecollab-time-tracking` - Time entry synchronization
- `activecollab-scheduled-sync` - Automated periodic sync

### Authentication

**Dual Auth Strategy:**
```typescript
// Location: supabase/functions/_shared/activecollab-client.ts

class ActiveCollabClient {
  // Basic Auth for most endpoints
  private getBasicAuthHeader(): string {
    const credentials = `${username}:${password}`;
    return `Basic ${btoa(credentials)}`;
  }

  // Bearer Token for SQL API endpoints (e.g., comments)
  private getBearerAuthHeader(): string {
    return `Bearer ${token}`;
  }

  // Auto-select auth method based on endpoint
  private getAuthHeader(endpoint: string): string {
    if (endpoint.includes('comments') || endpoint.includes('sql')) {
      return this.getBearerAuthHeader();
    }
    return this.getBasicAuthHeader();
  }
}
```

### Credential Encryption

**Table:** `activecollab_credentials`

**Encryption Method:** AES-GCM

**Storage:**
```typescript
// Location: supabase/functions/_shared/encryption.ts

async function encryptValue(plaintext: string): Promise<string> {
  // 1. Get encryption key from environment
  const key = await getEncryptionKey();

  // 2. Generate random IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt with AES-GCM
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  // 4. Combine IV + ciphertext and base64 encode
  return base64Encode(concatenate(iv, encrypted));
}

async function decryptValue(ciphertext: string): Promise<string> {
  const decoded = base64Decode(ciphertext);
  const iv = decoded.slice(0, 12);
  const data = decoded.slice(12);

  const key = await getEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}
```

**Setup Guide:** See `.agent/SOP/activecollab-encryption-setup.md`

### API Operations

**Fetch Projects:**
```typescript
async function syncProjects(client: SupabaseClient) {
  // 1. Get credentials
  const { data: creds } = await client
    .from('activecollab_credentials')
    .select('*')
    .eq('is_active', true)
    .single();

  // 2. Decrypt password
  const password = await decryptValue(creds.password);

  // 3. Initialize client
  const acClient = new ActiveCollabClient(
    creds.api_url,
    creds.username,
    password
  );

  // 4. Fetch projects from ActiveCollab API
  const projects = await acClient.get('/projects');

  // 5. Upsert to local database
  for (const project of projects) {
    await client.from('projects').upsert({
      activecollab_id: project.id,
      name: project.name,
      status: project.is_completed ? 'completed' : 'active',
      client_id: await mapClientId(project.client_id),
      // ... other fields
    }, { onConflict: 'activecollab_id' });
  }

  // 6. Log sync
  await client.from('activecollab_sync_logs').insert({
    sync_type: 'projects',
    status: 'success',
    records_synced: projects.length
  });
}
```

**Fetch Task Comments:**
```typescript
// Uses SQL API with Bearer Token
async function getTaskComments(taskId: number) {
  const response = await acClient.post('/sql', {
    query: `
      SELECT * FROM comments
      WHERE parent_type = 'Task' AND parent_id = ?
      ORDER BY created_on DESC
    `,
    params: [taskId]
  }, {
    headers: {
      'Authorization': getBearerAuthHeader()
    }
  });

  return response.data;
}
```

### Scheduled Sync

**Function:** `activecollab-scheduled-sync`

**Schedule:** Configured via cron (e.g., every 6 hours)

**Process:**
```typescript
export default async function handler(req: Request) {
  const client = createClient();

  // 1. Sync projects
  await syncProjects(client);

  // 2. Sync tasks
  await syncTasks(client);

  // 3. Sync time tracking
  await syncTimeTracking(client);

  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString()
  }));
}
```

### Database Tables

**`activecollab_credentials`:**
```sql
id                UUID PRIMARY KEY
organization_id   UUID
api_url           TEXT NOT NULL
username          TEXT NOT NULL
password          TEXT  -- Encrypted with AES-GCM
token             TEXT  -- Bearer token for SQL API
is_active         BOOLEAN DEFAULT true
```

**`activecollab_sync_logs`:**
```sql
id                UUID PRIMARY KEY
sync_type         TEXT  -- 'projects', 'tasks', 'time_tracking'
status            TEXT  -- 'success', 'failed', 'partial'
records_synced    INTEGER
error_message     TEXT
started_at        TIMESTAMPTZ
completed_at      TIMESTAMPTZ
```

---

## 2. Google Drive (Document Storage)

### Overview

**Purpose:** Access and sync documents for knowledge base

**Integration Type:** OAuth 2.0

**Edge Functions:**
- `google-drive-oauth-init` - Initiates OAuth flow
- `google-drive-oauth-callback` - Handles OAuth redirect
- `admin-google-drive-sync` - Admin-level document sync
- `test-google-drive` - Connection testing

### OAuth Flow

**Step 1: Initialize OAuth**
```typescript
// Function: google-drive-oauth-init
export default async function handler(req: Request) {
  const { userId } = await req.json();

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ],
    state: userId  // Pass userId for callback
  });

  return new Response(JSON.stringify({ authUrl }));
}
```

**Step 2: Handle Callback**
```typescript
// Function: google-drive-oauth-callback
export default async function handler(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');  // userId

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);

  // Store tokens in database
  const client = createClient();
  await client.from('user_google_tokens').upsert({
    user_id: state,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date
  });

  // Redirect back to app
  return Response.redirect('/adminpanel/knowledgebase?success=true');
}
```

### Document Sync

**Function:** `admin-google-drive-sync`

**Process:**
```typescript
async function syncGoogleDriveDocuments(userId: string) {
  const client = createClient();

  // 1. Get user's OAuth tokens
  const { data: tokens } = await client
    .from('user_google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  // 2. Initialize Drive API client
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // 3. Fetch folder configuration
  const { data: folderConfig } = await client
    .from('admin_google_drive_folders')
    .select('*')
    .eq('user_id', userId);

  // 4. List files in configured folders
  for (const folder of folderConfig) {
    const response = await drive.files.list({
      q: `'${folder.folder_id}' in parents and mimeType='text/plain'`,
      fields: 'files(id, name, mimeType, modifiedTime)'
    });

    // 5. Download and index each file
    for (const file of response.data.files) {
      const content = await drive.files.get({
        fileId: file.id,
        alt: 'media'
      });

      // 6. Store in knowledge base
      await indexKnowledgeFile(
        client,
        file.name,
        content.data,
        folder.category_id
      );
    }
  }
}
```

### Token Refresh

**Automatic Refresh:**
```typescript
async function refreshGoogleTokens(userId: string) {
  const { data: tokens } = await client
    .from('user_google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (new Date() > new Date(tokens.expiry_date)) {
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: tokens.refresh_token
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    await client.from('user_google_tokens').update({
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date
    }).eq('user_id', userId);
  }
}
```

### Database Tables

**`user_google_tokens`:**
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES users(id)
access_token      TEXT NOT NULL
refresh_token     TEXT
expiry_date       TIMESTAMPTZ
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`google_drive_settings`:**
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES users(id)
folder_id         TEXT
folder_name       TEXT
sync_enabled      BOOLEAN DEFAULT true
```

**`admin_google_drive_folders`:**
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES users(id)
folder_id         TEXT NOT NULL
folder_name       TEXT
category_id       UUID REFERENCES knowledge_base_categories(id)
auto_sync         BOOLEAN DEFAULT true
```

**Setup Guide:** See `.agent/SOP/integrations/google-drive-oauth-setup.md`

---

## 3. Google Analytics (Metrics)

### Overview

**Purpose:** Fetch brand performance metrics

**Integration Type:** Google Analytics Data API (GA4)

**Edge Functions:**
- `google-analytics-direct` - Direct GA4 API integration
- `fetch-google-analytics` - Fetch analytics data

### Configuration

**Table:** `brand_analytics_integrations`

**Schema:**
```sql
id                UUID PRIMARY KEY
brand_id          UUID REFERENCES brands(id)
integration_type  TEXT  -- 'google_analytics'
property_id       TEXT  -- GA4 property ID (e.g., '123456789')
credentials       JSONB  -- Service account credentials
is_active         BOOLEAN DEFAULT true
```

### API Integration

**Fetch Metrics:**
```typescript
// Function: fetch-google-analytics
async function fetchGAMetrics(brandId: string, startDate: string, endDate: string) {
  const client = createClient();

  // 1. Get brand's GA configuration
  const { data: integration } = await client
    .from('brand_analytics_integrations')
    .select('*')
    .eq('brand_id', brandId)
    .eq('integration_type', 'google_analytics')
    .single();

  // 2. Initialize GA4 client with service account
  const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: integration.credentials
  });

  // 3. Run report
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${integration.property_id}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'pageviews' },
      { name: 'averageSessionDuration' }
    ]
  });

  // 4. Store metrics in database
  for (const row of response.rows) {
    await client.from('brand_analytics_data').insert({
      brand_id: brandId,
      metric_date: row.dimensionValues[0].value,
      source: 'google_analytics',
      metadata: {
        activeUsers: row.metricValues[0].value,
        sessions: row.metricValues[1].value,
        pageviews: row.metricValues[2].value,
        avgSessionDuration: row.metricValues[3].value
      }
    });
  }

  return response;
}
```

### Setup Process

1. Create GA4 property
2. Create service account in Google Cloud Console
3. Grant service account access to GA4 property
4. Download service account JSON credentials
5. Store credentials in `brand_analytics_integrations` table
6. Configure property ID

**Setup Guide:** See `.agent/SOP/integrations/n8n-google-analytics-setup.md`

---

## 4. HubSpot (CRM)

### Overview

**Purpose:** Import contacts and deals

**Integration Type:** HubSpot API

**Edge Function:** `hubspot-sync`

### API Integration

**Sync Contacts:**
```typescript
// Function: hubspot-sync
async function syncHubSpotContacts() {
  const client = createClient();

  // 1. Get HubSpot API key from environment
  const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');

  // 2. Fetch contacts from HubSpot
  const response = await fetch(
    'https://api.hubapi.com/crm/v3/objects/contacts?limit=100',
    {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  // 3. Store contacts in database
  for (const contact of data.results) {
    await client.from('contacts').upsert({
      hubspot_id: contact.id,
      first_name: contact.properties.firstname,
      last_name: contact.properties.lastname,
      email: contact.properties.email,
      phone: contact.properties.phone,
      company: contact.properties.company
    }, { onConflict: 'hubspot_id' });
  }

  return { synced: data.results.length };
}
```

**Sync Deals:**
```typescript
async function syncHubSpotDeals() {
  const response = await fetch(
    'https://api.hubapi.com/crm/v3/objects/deals?limit=100',
    {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  for (const deal of data.results) {
    await client.from('deals').upsert({
      hubspot_id: deal.id,
      deal_name: deal.properties.dealname,
      amount: deal.properties.amount,
      close_date: deal.properties.closedate,
      stage: deal.properties.dealstage
    }, { onConflict: 'hubspot_id' });
  }
}
```

### Database Tables

**`contacts`:**
```sql
id                UUID PRIMARY KEY
hubspot_id        TEXT UNIQUE
first_name        TEXT
last_name         TEXT
email             TEXT
phone             TEXT
company           TEXT
```

**`deals`:**
```sql
id                UUID PRIMARY KEY
hubspot_id        TEXT UNIQUE
deal_name         TEXT
amount            NUMERIC
close_date        DATE
stage             TEXT
```

---

## 5. n8n (Workflow Automation)

### Overview

**Purpose:** Webhook-based workflow triggers

**Integration Type:** Webhooks

**Edge Function:** `n8n-analytics-manage`

### Workflow Setup

**EOD Workflow:**
```typescript
// Trigger from EOD submission
async function triggerN8NEOD(submissionId: string) {
  const N8N_WEBHOOK_URL = Deno.env.get('N8N_EOD_WEBHOOK_URL');

  const { data: submission } = await client
    .from('team_eod_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submission_id: submission.id,
      user_id: submission.user_id,
      submission_date: submission.submission_date,
      wins: submission.wins,
      challenges: submission.challenges,
      tomorrow_plan: submission.tomorrow_plan
    })
  });
}
```

**Analytics Pipeline:**
```typescript
// Trigger analytics aggregation
async function triggerN8NAnalytics(brandId: string) {
  const N8N_ANALYTICS_WEBHOOK_URL = Deno.env.get('N8N_ANALYTICS_WEBHOOK_URL');

  await fetch(N8N_ANALYTICS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand_id: brandId,
      action: 'aggregate_weekly_metrics',
      timestamp: new Date().toISOString()
    })
  });
}
```

**Setup Guides:**
- `.agent/SOP/integrations/n8n-eod-workflow-setup.md`
- `.agent/SOP/integrations/n8n-google-analytics-setup.md`

---

## 6. GoHighLevel (CRM)

### Overview

**Purpose:** CRM integration

**Integration Type:** GoHighLevel API

**Edge Function:** `gohighlevel-manage`

### API Integration

**Sync Contacts:**
```typescript
// Function: gohighlevel-manage
async function syncGHLContacts(integrationId: string) {
  const client = createClient();

  // 1. Get integration config
  const { data: integration } = await client
    .from('gohighlevel_integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  // 2. Fetch contacts from GHL
  const response = await fetch(
    `${integration.api_url}/contacts`,
    {
      headers: {
        'Authorization': `Bearer ${integration.api_key}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  // 3. Store in database
  for (const contact of data.contacts) {
    await client.from('gohighlevel_contacts').upsert({
      ghl_contact_id: contact.id,
      integration_id: integrationId,
      first_name: contact.firstName,
      last_name: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      tags: contact.tags
    }, { onConflict: 'ghl_contact_id' });
  }
}
```

### Database Tables

**`gohighlevel_integrations`:**
```sql
id                UUID PRIMARY KEY
api_url           TEXT NOT NULL
api_key           TEXT NOT NULL
is_active         BOOLEAN DEFAULT true
```

**`gohighlevel_contacts`:**
```sql
id                UUID PRIMARY KEY
ghl_contact_id    TEXT UNIQUE
integration_id    UUID REFERENCES gohighlevel_integrations(id)
first_name        TEXT
last_name         TEXT
email             TEXT
phone             TEXT
tags              TEXT[]
```

---

## 7. CollabAI (External AI Agents)

### Overview

**Purpose:** Integrate third-party AI agents

**Integration Type:** CollabAI API

**Edge Functions:**
- `collabai-manage` - Agent management
- `fetch-external-agents` - Agent discovery

### Integration

**Fetch External Agents:**
```typescript
// Function: fetch-external-agents
async function fetchCollabAIAgents() {
  const COLLABAI_API_KEY = Deno.env.get('COLLABAI_API_KEY');

  const response = await fetch('https://api.collabai.com/agents', {
    headers: {
      'Authorization': `Bearer ${COLLABAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const agents = await response.json();

  // Store in database
  for (const agent of agents) {
    await client.from('collabai_agents').upsert({
      external_agent_id: agent.id,
      agent_name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      api_endpoint: agent.endpoint
    }, { onConflict: 'external_agent_id' });
  }
}
```

**Execute External Agent:**
```typescript
async function executeCollabAIAgent(agentId: string, prompt: string) {
  const { data: agent } = await client
    .from('collabai_agents')
    .select('*')
    .eq('id', agentId)
    .single();

  const response = await fetch(agent.api_endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COLLABAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      context: {}
    })
  });

  return await response.json();
}
```

### Database Tables

**`collabai_agents`:**
```sql
id                UUID PRIMARY KEY
external_agent_id TEXT UNIQUE
agent_name        TEXT NOT NULL
description       TEXT
capabilities      JSONB
api_endpoint      TEXT
is_active         BOOLEAN DEFAULT true
```

---

## 8. AI Provider Integrations

### OpenAI

**Primary Uses:**
- Text generation (GPT-4o, GPT-4-turbo, GPT-5-mini)
- Embeddings (text-embedding-3-small)
- Image generation (DALL-E)
- Video generation (Sora)

**Client:** `supabase/functions/_shared/openai-client.ts`

**Cost Tracking:**
```typescript
const MODEL_PRICING = {
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 }
};
```

### Google Gemini

**Uses:**
- Image generation
- Video generation (Veo)
- Alternative text generation

**Functions:**
- `gemini-image-generator`
- `gemini-veo-manager`

### Anthropic Claude

**Uses:**
- Alternative AI text generation
- Claude 3.5 Sonnet model

**Integration:**
```typescript
const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY
});

const message = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  system: systemPrompt,
  messages: [{ role: "user", content: userMessage }],
  max_tokens: 2000
});
```

### Perplexity AI

**Uses:**
- Research and reasoning
- External data source integration

**Function:** `perplexity-test`

**Integration:**
```typescript
const response = await fetch('https://api.perplexity.ai/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: "sonar-reasoning-pro",
    messages: messages,
    external_data_sources: externalSources
  })
});
```

---

## 9. Integration Health Monitoring

### Health Check Function

**Function:** `integration-health-check`

**Purpose:** Monitor all external integrations

**Process:**
```typescript
export default async function handler(req: Request) {
  const healthResults = {
    timestamp: new Date().toISOString(),
    integrations: {}
  };

  // 1. Check ActiveCollab
  healthResults.integrations.activecollab = await checkActiveCollab();

  // 2. Check Google Drive
  healthResults.integrations.google_drive = await checkGoogleDrive();

  // 3. Check Google Analytics
  healthResults.integrations.google_analytics = await checkGoogleAnalytics();

  // 4. Check HubSpot
  healthResults.integrations.hubspot = await checkHubSpot();

  // 5. Check AI Providers
  healthResults.integrations.openai = await checkOpenAI();
  healthResults.integrations.gemini = await checkGemini();
  healthResults.integrations.claude = await checkClaude();
  healthResults.integrations.perplexity = await checkPerplexity();

  // 6. Log health check
  await client.from('integration_logs').insert({
    integration_type: 'health_check',
    action: 'system_health',
    status: 'completed',
    response_data: healthResults
  });

  return new Response(JSON.stringify(healthResults));
}

async function checkActiveCollab(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${AC_API_URL}/info`, {
      headers: { 'Authorization': getBasicAuthHeader() }
    });

    return {
      status: response.ok ? 'healthy' : 'degraded',
      last_check: new Date().toISOString(),
      response_time: response.headers.get('x-response-time')
    };
  } catch (error) {
    return {
      status: 'down',
      last_check: new Date().toISOString(),
      error: error.message
    };
  }
}
```

### Metrics Tracked

**For each integration:**
- Connection status (healthy, degraded, down)
- Last successful sync
- Error rates
- Response times
- Data freshness

**Database Table:** `integration_logs`
```sql
id                UUID PRIMARY KEY
integration_type  TEXT
action            TEXT
status            TEXT
request_data      JSONB
response_data     JSONB
error_message     TEXT
created_at        TIMESTAMPTZ
```

---

## 10. Security Best Practices

### API Key Management

1. **Environment Variables Only**
   ```typescript
   const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
   const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
   ```

2. **Never Commit Keys**
   - Use `.env.local` for local development
   - Configure in Supabase dashboard for production

3. **Rotate Regularly**
   - Set expiration policies
   - Monitor for unauthorized usage

### Credential Encryption

1. **Use AES-GCM for Passwords**
   ```typescript
   const encrypted = await encryptValue(password);
   ```

2. **Store Encryption Key Securely**
   - Environment variable
   - Never in database or code

3. **Implement Access Control**
   - RLS policies on credential tables
   - Super admin only access

### OAuth Token Management

1. **Store Refresh Tokens Securely**
   - Encrypted if possible
   - RLS policies

2. **Automatic Token Refresh**
   - Check expiry before API calls
   - Refresh proactively

3. **Revocation Support**
   - Allow users to disconnect
   - Clean up tokens on revocation

---

## 11. Error Handling & Retry Logic

### Standard Error Pattern

```typescript
async function integrationWithRetry(
  operation: () => Promise<any>,
  maxRetries = 3,
  backoffMs = 1000
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        // Log final failure
        await logIntegrationError(error);
        throw error;
      }

      // Exponential backoff
      await sleep(backoffMs * Math.pow(2, attempt - 1));
    }
  }
}
```

### Error Logging

```typescript
async function logIntegrationError(error: Error, context: any) {
  await client.from('integration_logs').insert({
    integration_type: context.integration,
    action: context.action,
    status: 'failed',
    request_data: context.request,
    error_message: error.message,
    created_at: new Date().toISOString()
  });
}
```

---

## Summary

The platform's integration architecture provides:

1. **Comprehensive Coverage** - 11+ external services
2. **Secure by Default** - Encryption, OAuth, RLS
3. **Reliable** - Retry logic, health monitoring
4. **Observable** - Detailed logging and metrics
5. **Maintainable** - Shared utilities, consistent patterns
6. **Scalable** - Async processing, scheduled syncs

Each integration follows established patterns for authentication, error handling, and data storage, making it easy to add new integrations or troubleshoot existing ones.
