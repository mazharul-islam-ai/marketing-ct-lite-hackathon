\# Software Design Document (SDD)

\#\# Project: Intelligent Agent Builder & Automation Studio

\*\*Document Version:\*\* 1.0  
\*\*Target Audience:\*\* Business Stakeholders, Product Managers, and Engineering Teams

\---

\#\# 1\. Executive Summary (Non-Technical)

\#\#\# 1.1 Background

Our existing CRM platform provides users with pre-integrated AI providers (OpenAI, Gemini, Anthropic) and an agent-making system. However, the current system relies heavily on predefined rules and button-based selections. Building a truly custom agent requires developer intervention and manual coding, which creates a bottleneck for rapid deployment and user autonomy.

\#\#\# 1.2 Problem Statement

\* \*\*Developer Dependency:\*\* Users cannot create highly customized or complex workflows without writing code.  
\* \*\*Rigid Architecture:\*\* Hardcoded rules limit the flexibility of agents to adapt to unique business logic.  
\* \*\*Lack of Visibility:\*\* Users cannot visually track how an agent makes decisions or processes data.  
\* \*\*Slow Time-to-Market:\*\* Developing new agent functionalities takes days or weeks due to engineering dependencies.

\#\#\# 1.3 Proposed Solution

We propose an \*\*"Agent Builder Platform"\*\*—a no-code/low-code AI studio embedded within our CRM. It combines a conversational interface (Lovable-style) with a visual workflow editor. Users will simply type what they want (e.g., \*"Read CRM leads, score them, and send to Slack"\*), and the platform's "Meta-Builder AI" will automatically generate a fully functional, visual, node-based agent.

\#\#\# 1.4 Business Case & Value Proposition

\* \*\*Empowering Non-Technical Users:\*\* Sales, marketing, and operational teams can build their own AI workers in minutes.  
\* \*\*Cost Efficiency:\*\* Drastically reduces engineering hours spent on custom integration requests.  
\* \*\*New Revenue Streams:\*\* The platform can be monetized as an add-on or premium tier (Pay-as-you-go based on agent runs or compute time).  
\* \*\*Competitive Advantage:\*\* Transforms the product from a standard CRM into an "AI Operating System" where data is actively managed by autonomous agents.

\---

\#\# 2\. Technical Architecture

\#\#\# 2.1 Technology Stack

\* \*\*Frontend:\*\* React, Next.js, React Flow (for node-based visual graphs), TailwindCSS.  
\* \*\*Backend:\*\* Supabase (PostgreSQL), Supabase Edge Functions.  
\* \*\*Message Queue/Runtime:\*\* \`pgmq\` (PostgreSQL Message Queue) or Edge Function queues for background task execution.  
\* \*\*AI Providers:\*\* OpenAI (GPT-4o), Anthropic (Claude 3.5), Gemini.

\#\#\# 2.2 System Components

1\. \*\*Frontend Visualizer:\*\* A React Flow-powered UI showing nodes (Triggers, AI Actions, Tool Actions) and edges (connections).  
2\. \*\*Compiler Agent (Prompt-to-JSON Engine):\*\* An Edge Function that takes the user's natural language prompt and converts it into a strict JSON workflow schema.  
3\. \*\*Runtime Engine:\*\* A background worker system that reads the saved JSON schema and executes the nodes sequentially.

\#\#\# 2.3 Session Management & Flow Maintenance

To provide a seamless, Lovable-like conversational building experience:

\* \*\*Session Persistence:\*\* A \`builder\_sessions\` table in Supabase will store the \`workspace\_id\`, the current conversational context (chat history), and the current state of the \`flow\_json\`.  
\* \*\*Two-Way Synchronization:\*\* \* If a user types a prompt (\*"Add an email step"\*), the backend updates the JSON and pushes the new state to the frontend, which instantly re-renders the React Flow graph.  
\* If a user manually drags, drops, or edits a node in the UI, the frontend instantly updates the JSON state in the backend, and the AI context is updated so the bot is aware of the manual change.

\---

\#\# 3\. AI & Prompt Engineering Layer

\#\#\# 3.1 User Prompt Evaluation & Conversion

The core magic of the platform relies on converting unpredictable human language into predictable machine logic.

\* \*\*Context Injection:\*\* When a user submits a prompt, the system injects the available database schema (tables, columns) and available tools (Slack, Email, MCP) into the AI's System Prompt.  
\* \*\*Structured Outputs:\*\* We will enforce strict JSON Schema validation (e.g., OpenAI Structured Outputs). The AI will be restricted to outputting only a JSON object containing \`nodes\` and \`edges\`.

\#\#\# 3.2 Anti-Hallucination Guardrails

\* \*\*Schema Enforcement:\*\* The AI cannot invent node types. It must select from a predefined enum list (e.g., \`ai\_action\`, \`db\_trigger\`, \`api\_call\`).  
\* \*\*Tool Validation:\*\* If the user asks the agent to use a tool that is not integrated (e.g., "Send a fax"), the Compiler Agent will detect the missing tool and respond conversationally (\*"I cannot send a fax, but I can send an email. Should I update the flow?"\*) instead of hallucinating a fake "fax\_node" in the JSON.  
\* \*\*Data Mapping Integrity:\*\* Edge Functions will validate that the output of Node A matches the required input format of Node B before allowing the flow to be published.

\---

\#\# 4\. Challenges, Risks, & Mitigations

| Risk / Challenge | Impact | Mitigation Strategy |  
| \--- | \--- | \--- |  
| \*\*LLM Hallucinations in Flow Generation\*\* | Invalid JSON or impossible logic paths will crash the visual editor or runtime engine. | Use \*\*Strict JSON Schemas\*\* at the API level. Implement backend validation before saving the \`flow\_json\`. If validation fails, trigger an automatic internal retry to the LLM. |  
| \*\*Infinite Execution Loops\*\* | A poorly designed condition node could cause an agent to run endlessly, burning API credits and server compute. | Implement a \*\*Hard Run Limit\*\* (e.g., max 20 steps per execution). Add a \`total\_cost\` tracker in the \`agent\_runs\` table to automatically kill tasks that exceed the workspace budget. |  
| \*\*Data Security & Cross-Tenant Leaks\*\* | An agent from Workspace A accidentally queries data from Workspace B. | Enforce \*\*Row Level Security (RLS)\*\* in Supabase. The Runtime Worker must execute queries under the context/JWT of the specific \`workspace\_id\`. |  
| \*\*State Management & UI Sync Lag\*\* | Real-time updating of the React Flow canvas might feel sluggish if backend processing takes too long. | Implement \*\*Optimistic UI Updates\*\*. Use WebSockets (Supabase Realtime) to stream changes instantly. Show loading indicators on specific nodes being modified rather than freezing the whole canvas. |  
| \*\*Database Bloat from Execution Logs\*\* | Saving massive LLM responses or DB query results for every step will rapidly exhaust database storage. | Store small metadata directly in PostgreSQL. For large payloads (e.g., \>50KB), save the data to \*\*Supabase Storage (S3)\*\* and store only the file reference URL in the database logs. |  
| \*\*Secrets Management\*\* | Storing user API keys (e.g., OpenAI, Slack) in plain text exposes the system to severe security breaches. | Use \*\*Supabase Vault\*\* to natively encrypt and decrypt secrets at the database level. Keys are only decrypted in memory during Edge Function execution. |  
