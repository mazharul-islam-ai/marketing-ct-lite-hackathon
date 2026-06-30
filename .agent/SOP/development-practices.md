# DEVELOPMENT.md

Comprehensive Development Guide for the SJ Marketing AI Platform

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Architecture Deep Dive](#project-architecture-deep-dive)
- [Working with React Components](#working-with-react-components)
- [State Management](#state-management)
- [Database Operations](#database-operations)
- [Edge Functions Development](#edge-functions-development)
- [AI Integration Patterns](#ai-integration-patterns)
- [Testing & Debugging](#testing--debugging)
- [Performance Optimization](#performance-optimization)
- [Common Workflows](#common-workflows)
- [Troubleshooting Guide](#troubleshooting-guide)

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase CLI
- Git
- Code editor (VS Code recommended)
- Access to Supabase project

### Initial Setup

```bash
# Clone repository
git clone https://github.com/sjinnovation/sj-marketing-ai.git
cd sj-marketing-ai

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add Supabase credentials to .env.local
VITE_SUPABASE_URL=https://fzknasqrludvoyxdzbxl.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Start development server
npm run dev
```

**See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.**

---

## Development Environment

### Recommended VS Code Extensions

- **ESLint** - Code quality
- **Prettier** - Code formatting
- **TypeScript Vue Plugin (Volar)** - TypeScript support
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **Path Intellisense** - Path autocomplete
- **Error Lens** - Inline error display

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Environment Variables

**Frontend (.env.local):**
```bash
VITE_SUPABASE_URL=https://fzknasqrludvoyxdzbxl.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Edge Functions:**
Set via Supabase Dashboard → Settings → Edge Functions → Secrets:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `ACTIVECOLLAB_URL`
- `ACTIVECOLLAB_API_KEY`
- etc.

Access in functions: `Deno.env.get('VARIABLE_NAME')`

---

## Project Architecture Deep Dive

### Directory Structure

```
sj-marketing-ai/
├── src/
│   ├── Api/                    # API utilities
│   ├── assets/                 # Static assets
│   ├── components/            # Reusable components
│   │   ├── ui/               # shadcn-ui components
│   │   ├── admin/            # Admin components
│   │   ├── brands/           # Brand components
│   │   ├── chat/             # Chat UI
│   │   ├── linkedin/         # LinkedIn tools
│   │   └── ...
│   ├── data/                  # Static data/constants
│   ├── features/              # Feature modules
│   │   ├── ai/               # AI orchestration
│   │   ├── collabai/         # CollabAI features
│   │   └── linkedin-content/ # LinkedIn generation
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.tsx       # Authentication hook
│   │   └── ...
│   ├── integrations/          # Third-party integrations
│   │   └── supabase/         # Supabase client & types
│   ├── lib/                   # Utility libraries
│   │   ├── integrations/     # Integration helpers
│   │   └── hackathon/        # Hackathon utilities
│   ├── pages/                 # Page components
│   │   ├── admin/            # Super admin pages
│   │   ├── adminpanel/       # Admin control panel
│   │   ├── brands/           # Brand pages
│   │   ├── content/          # Content generation
│   │   ├── hackathon/        # Hackathon module
│   │   └── ...
│   ├── types/                 # TypeScript types
│   ├── utils/                 # Helper functions
│   ├── App.tsx               # Root component & routing
│   └── main.tsx              # Entry point
├── supabase/
│   ├── functions/            # Edge Functions (Deno)
│   │   ├── _shared/         # Shared utilities
│   │   │   ├── cors.ts
│   │   │   ├── supabase.ts
│   │   │   ├── openai-client.ts
│   │   │   ├── activecollab-client.ts
│   │   │   └── integrations/
│   │   │       └── pgvector.ts
│   │   ├── function-name/   # Individual functions
│   │   │   └── index.ts
│   │   └── ...
│   ├── migrations/          # Database migrations
│   └── config.toml         # Supabase configuration
├── public/
│   └── docs/               # Documentation
├── .env.local              # Environment variables
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite configuration
├── tailwind.config.ts      # Tailwind config
└── CLAUDE.md              # AI agent architecture guide
```

### Key Concepts

**Component Organization:**
- **Pages**: Top-level route components (one per URL)
- **Components**: Reusable UI building blocks
- **Features**: Business logic modules (not UI-specific)
- **Hooks**: Reusable stateful logic
- **Utils**: Pure utility functions

**Data Flow:**
1. User interacts with **Component**
2. Component uses **Hook** to manage state
3. Hook calls **Supabase Client** (via TanStack Query)
4. Supabase applies **RLS policies** and returns data
5. Component renders with data
6. Edge Functions handle complex operations

---

## Working with React Components

### Component Template

```typescript
// src/components/example/ExampleComponent.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ExampleComponentProps {
  itemId: string;
  onComplete?: () => void;
}

export function ExampleComponent({ itemId, onComplete }: ExampleComponentProps) {
  // 1. Hooks
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  // 2. Queries
  const { data: item, isLoading, error } = useQuery({
    queryKey: ['item', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!itemId, // Only run if itemId exists
  });

  // 3. Mutations
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<typeof item>) => {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate cache to refetch
      queryClient.invalidateQueries({ queryKey: ['item', itemId] });

      toast({
        title: 'Success',
        description: 'Item updated successfully',
      });

      onComplete?.();
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  // 4. Event handlers
  const handleUpdate = () => {
    updateMutation.mutate({ status: 'completed' });
  };

  // 5. Early returns
  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-destructive">
        Error: {error.message}
      </div>
    );
  }

  if (!item) {
    return <div>No item found</div>;
  }

  // 6. Render
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold">{item.name}</h3>
      <Button
        onClick={handleUpdate}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending ? 'Updating...' : 'Complete'}
      </Button>
    </div>
  );
}
```

### Component Best Practices

1. **Single Responsibility**: One component, one purpose
2. **Prop Typing**: Always define TypeScript interfaces for props
3. **Early Returns**: Handle loading/error states early
4. **Hooks First**: Declare all hooks at the top
5. **Memoization**: Use `useMemo`/`useCallback` for expensive operations
6. **Accessibility**: Include ARIA labels and keyboard navigation
7. **Responsive**: Use Tailwind responsive classes (`md:`, `lg:`, etc.)

---

## State Management

### TanStack Query (React Query)

**Primary data fetching pattern:**

```typescript
// ✅ Good - Using TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: ['brands', userId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
});

// ❌ Avoid - Manual state management
const [brands, setBrands] = useState([]);
useEffect(() => {
  async function fetchBrands() {
    const { data } = await supabase.from('brands').select('*');
    setBrands(data);
  }
  fetchBrands();
}, []);
```

**Mutations:**

```typescript
const mutation = useMutation({
  mutationFn: async (newBrand) => {
    const { data, error } = await supabase
      .from('brands')
      .insert(newBrand)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['brands'] });
  },
});

// Usage
mutation.mutate({ name: 'New Brand' });
```

### Auth Context

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, hasRole, hasMinimumRole, logout } = useAuth();

  if (!user) {
    return <div>Please log in</div>;
  }

  if (!hasMinimumRole('pm')) {
    return <div>Access denied</div>;
  }

  return <div>Welcome, {user.name}!</div>;
}
```

---

## Database Operations

### Supabase Client

```typescript
import { supabase } from '@/integrations/supabase/client';

// SELECT
const { data, error } = await supabase
  .from('brands')
  .select('id, name, users(email)') // Join with users table
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(10);

// INSERT
const { data, error } = await supabase
  .from('brands')
  .insert({ name: 'My Brand', status: 'active' })
  .select()
  .single();

// UPDATE
const { data, error } = await supabase
  .from('brands')
  .update({ status: 'inactive' })
  .eq('id', brandId)
  .select()
  .single();

// DELETE
const { error } = await supabase
  .from('brands')
  .delete()
  .eq('id', brandId);
```

### Type Safety

```typescript
import { Database } from '@/integrations/supabase/types';

type Brand = Database['public']['Tables']['brands']['Row'];
type BrandInsert = Database['public']['Tables']['brands']['Insert'];
type BrandUpdate = Database['public']['Tables']['brands']['Update'];

// Use in components
const [brand, setBrand] = useState<Brand | null>(null);
```

### RLS (Row Level Security)

Always consider RLS when querying:

- RLS policies are defined in Supabase Dashboard
- Use service role key ONLY in Edge Functions (never frontend!)
- Test RLS with different user roles

---

## Edge Functions Development

### Creating a New Edge Function

```bash
# Create function directory
mkdir -p supabase/functions/my-function

# Create index.ts
touch supabase/functions/my-function/index.ts
```

### Function Template

```typescript
// supabase/functions/my-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const { param1, param2 } = await req.json();

    // Validate inputs
    if (!param1) {
      throw new Error('param1 is required');
    }

    // Your logic here
    const result = await performOperation(param1, param2);

    // Return response
    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in my-function:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        status: error.message === 'Unauthorized' ? 401 : 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

async function performOperation(param1: string, param2?: string) {
  // Implementation
  return { result: 'success' };
}
```

### Deploying Edge Functions

```bash
# Deploy single function
supabase functions deploy my-function

# Deploy all functions
supabase functions deploy

# View logs
supabase functions logs my-function --tail

# Test locally
supabase functions serve my-function
```

### Calling from Frontend

```typescript
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { param1: 'value', param2: 'value' }
});

if (error) {
  console.error('Edge function error:', error);
}
```

---

## AI Integration Patterns

### OpenAI Integration

```typescript
// In edge function
import OpenAI from 'https://esm.sh/openai@4.20.1';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Generate completion
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.7,
  max_tokens: 2000,
});

const response = completion.choices[0].message.content;
```

### Streaming Responses

```typescript
// Edge function
const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  stream: true,
});

const encoder = new TextEncoder();
const readableStream = new ReadableStream({
  async start(controller) {
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      controller.enqueue(encoder.encode(text));
    }
    controller.close();
  },
});

return new Response(readableStream, {
  headers: {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
  },
});
```

```typescript
// Frontend
const response = await fetch(`${supabaseUrl}/functions/v1/stream-ai-response`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ prompt }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  setStreamedContent(prev => prev + text);
}
```

### Vector Search (RAG)

```typescript
// In edge function - using pgvector
import { searchKnowledgeBase } from '../_shared/integrations/pgvector.ts';

// Search brand knowledge
const relevantDocs = await searchKnowledgeBase({
  supabase,
  query: userQuery,
  brandId: brandId,
  limit: 5,
  minSimilarity: 0.7,
});

// Use in prompt
const context = relevantDocs.map(doc => doc.content).join('\n\n');
const prompt = `Context:\n${context}\n\nQuestion: ${userQuery}`;
```

---

## Testing & Debugging

### Running Tests

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Fix linting issues
npm run lint -- --fix
```

### Debugging Tips

**Frontend:**
1. Use React DevTools extension
2. Check browser console for errors
3. Use TanStack Query DevTools (automatically enabled in dev)
4. Add `console.log` statements liberally

**Edge Functions:**
```bash
# View logs in real-time
supabase functions logs function-name --tail

# Check recent logs
supabase functions logs function-name
```

**Database:**
1. Use Supabase Dashboard → Table Editor
2. Check RLS policies if queries return empty
3. Use SQL Editor for complex queries
4. Enable statement logging in development

### Common Issues

**"User not authenticated" errors:**
- Check `Authorization` header is present
- Verify token hasn't expired
- Check RLS policies

**Type errors:**
```bash
# Regenerate Supabase types
supabase gen types typescript --project-id fzknasqrludvoyxdzbxl > src/integrations/supabase/types.ts
```

**Edge function not deploying:**
- Check syntax errors
- Verify imports are valid Deno URLs
- Check `config.toml` configuration

---

## Performance Optimization

### Frontend Optimization

1. **Code Splitting:**
```typescript
// Lazy load pages
const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<div>Loading...</div>}>
  <HeavyComponent />
</Suspense>
```

2. **Query Optimization:**
```typescript
// Set appropriate stale times
const { data } = useQuery({
  queryKey: ['static-data'],
  queryFn: fetchStaticData,
  staleTime: 24 * 60 * 60 * 1000, // 24 hours
});
```

3. **Memoization:**
```typescript
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

const handleClick = useCallback(() => {
  // handler logic
}, [dependency]);
```

### Database Optimization

1. **Indexes:** Ensure frequently queried columns have indexes
2. **Limit results:** Always use `.limit()` for lists
3. **Select specific columns:** Don't use `select('*')` unless needed
4. **Batch operations:** Use `.upsert()` for bulk inserts/updates

---

## Common Workflows

### Adding a New Feature

1. **Plan:**
   - Identify required components
   - Determine database schema needs
   - Check for existing similar features

2. **Database:**
   - Create migration if schema changes needed
   - Add RLS policies
   - Regenerate types

3. **Backend (if needed):**
   - Create edge function
   - Add shared utilities
   - Configure in `config.toml`
   - Deploy and test

4. **Frontend:**
   - Create components
   - Add page (if needed)
   - Add route
   - Implement UI
   - Add error handling

5. **Test:**
   - Test happy path
   - Test error scenarios
   - Test role permissions
   - Check mobile responsive

6. **Deploy:**
   - Commit changes
   - Push to GitHub
   - Verify auto-deployment

### Debugging a Bug

1. **Reproduce:** Confirm you can reproduce the issue
2. **Isolate:** Narrow down to specific component/function
3. **Logs:** Check browser console and edge function logs
4. **Data:** Verify data structure matches expectations
5. **RLS:** Check Row Level Security policies
6. **Fix:** Implement fix
7. **Test:** Verify fix works and doesn't break other features

---

## Troubleshooting Guide

### Frontend Issues

**Module not found:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Build errors:**
```bash
rm -rf node_modules/.vite
npm run build
```

**Type errors:**
```bash
npx tsc --noEmit
# Fix errors shown
```

### Backend Issues

**Edge function errors:**
- Check function logs: `supabase functions logs function-name`
- Verify environment variables are set
- Test locally: `supabase functions serve function-name`

**Database connection issues:**
- Verify Supabase URL and keys in `.env.local`
- Check Supabase project status
- Verify RLS policies aren't blocking queries

**CORS errors:**
- Ensure using `corsHeaders` from `_shared/cors.ts`
- Handle OPTIONS preflight requests

---

## Additional Resources

- [CLAUDE.md](./CLAUDE.md) - Architecture guide for AI agents
- [AGENTS.md](./AGENTS.md) - Guidelines for AI coding agents
- [README.md](./README.md) - Project overview
- [QUICKSTART.md](./QUICKSTART.md) - Quick setup guide
- [.agent/README.md](../README.md) - Canonical project documentation
- [Supabase Documentation](https://supabase.com/docs)
- [React Query Documentation](https://tanstack.com/query/latest/docs/react/overview)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

---

**Happy Coding!**

For questions or issues, check the documentation or reach out to the team.
