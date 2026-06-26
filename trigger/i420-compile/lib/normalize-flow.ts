import type { FlowJSON } from "./types";

const TYPE_ALIASES: Record<string, string> = {
  database_query: "db_query", query_database: "db_query", sql_query: "db_query",
  fetch_data: "db_query", fetch_deals: "db_query", get_data: "db_query",
  read_data: "db_query", retrieve_data: "db_query", db_read: "db_query",
  query_db: "db_query", database_read: "db_query",
  llm_call: "openai_llm", ai_call: "openai_llm", llm: "openai_llm",
  llm_query: "openai_llm", gpt: "openai_llm", generate_text: "openai_llm",
  ai_process: "openai_llm", language_model: "openai_llm", ai_model: "openai_llm",
  generate_report: "report_generate", create_report: "report_generate",
  build_report: "report_generate", make_report: "report_generate",
  start: "manual_trigger", trigger: "manual_trigger", begin: "manual_trigger",
  initiate: "manual_trigger", on_demand: "manual_trigger",
  schedule: "cron_trigger", scheduled: "cron_trigger", cron: "cron_trigger",
  timer: "cron_trigger", recurring: "cron_trigger",
  send_report: "email_output", notify: "email_output", notification: "email_output",
  send_notification: "email_output",
  save_data: "db_write", store_data: "db_write", insert_data: "db_write",
  write_data: "db_write", persist_data: "db_write", update_data: "db_write",
  http_request: "api_call", rest_call: "api_call", external_api: "api_call",
  api_request: "api_call", web_request: "api_call",
  slack_message: "slack_notify", slack_alert: "slack_notify", send_slack: "slack_notify",
  slack_fetch: "slack_fetch_messages", fetch_slack_messages: "slack_fetch_messages",
  read_slack: "slack_fetch_messages", get_slack_messages: "slack_fetch_messages",
  send_email: "email_send", email: "email_send",
  gmail_fetch: "gmail_fetch_unread", fetch_unread_emails: "gmail_fetch_unread",
  gmail_unread: "gmail_fetch_unread", read_gmail: "gmail_fetch_unread",
  if_else: "condition", branch: "condition", decision: "condition", check: "condition",
};

const LLM_NODE_TYPES = new Set(["openai_llm", "gemini_llm", "anthropic_llm", "custom_llm"]);

const CHAT_LLM_PROMPT = "User question: {{message}}\n\nData:\n{{rows}}";
const CHAT_LLM_SYSTEM =
  "Answer the user question using the provided context JSON. Be concise and helpful. Do not ask the user to supply data that is already in the context.";

const FETCH_MIRROR_TYPES = new Set([
  "db_query", "mcp_tool", "slack_fetch_messages", "gmail_fetch_unread", "api_call",
]);

function resolveNodeType(node: Record<string, unknown>): void {
  if (!node.type && node.nodeType) node.type = node.nodeType;
  if (!node.type && node.node_type) node.type = node.node_type;
  if (!node.type && node.kind) node.type = node.kind;
  if (!node.type && node.category) node.type = node.category;
  if (node.type && typeof node.type === "string") {
    const lower = node.type.toLowerCase().replace(/[-\s]/g, "_");
    if (TYPE_ALIASES[lower]) node.type = TYPE_ALIASES[lower];
    else if (TYPE_ALIASES[node.type]) node.type = TYPE_ALIASES[node.type];
  }
}

function nextNodeId(steps: Record<string, unknown>[]): string {
  const maxNum = steps.reduce((max, s) => {
    const m = String(s.id).match(/^n(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `n${maxNum + 1}`;
}

function nextEdgeId(edges: Record<string, unknown>[]): string {
  const maxEdge = edges.reduce((max, e) => {
    const m = String(e.id).match(/^e(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `e${maxEdge + 1}`;
}

function collectBranchNodeIds(
  startId: string,
  steps: Record<string, unknown>[],
  edges: Record<string, unknown>[],
  stopTypes: Set<string>,
): string[] {
  const nodeById = new Map(steps.map((s) => [String(s.id), s]));
  const order: string[] = [];
  const visited = new Set<string>();
  let current = startId;

  while (current && !visited.has(current)) {
    visited.add(current);
    const node = nodeById.get(current);
    if (!node) break;
    order.push(current);
    if (stopTypes.has(String(node.type))) break;
    const outEdges = edges.filter((e) => e.source === current);
    if (outEdges.length === 0) break;
    current = String(outEdges[0].target ?? "");
  }

  return order;
}

function branchHasFetchType(
  nodeIds: string[],
  steps: Record<string, unknown>[],
  fetchType: string,
): boolean {
  const idSet = new Set(nodeIds);
  return steps.some((s) => idSet.has(String(s.id)) && String(s.type) === fetchType);
}

export function normalizeChatBranch(obj: Record<string, unknown>): void {
  if (!Array.isArray(obj.steps) || !Array.isArray(obj.edges)) return;

  const steps = obj.steps as Record<string, unknown>[];
  const edges = obj.edges as Record<string, unknown>[];

  const hasChatEdge = edges.some((e) => String(e.condition ?? "").toLowerCase() === "chat");
  if (!hasChatEdge) {
    for (const step of steps) {
      if (!LLM_NODE_TYPES.has(String(step.type))) continue;
      const config = { ...(step.config as Record<string, unknown> ?? {}) };
      const prompt = String(config.prompt ?? "");
      if (!prompt.includes("{{message}}")) {
        config.prompt = CHAT_LLM_PROMPT;
      }
      const system = String(config.system_prompt ?? "");
      if (!system || system.toLowerCase().includes("cannot provide") || system.length < 30) {
        config.system_prompt = CHAT_LLM_SYSTEM;
      }
      step.config = config;
    }
    return;
  }

  const switchNode = steps.find((s) => s.type === "switch");
  if (!switchNode) return;

  const chatEdge = edges.find(
    (e) => e.source === switchNode.id && String(e.condition ?? "").toLowerCase() === "chat",
  );
  if (!chatEdge) return;

  const reportEdge = edges.find(
    (e) => e.source === switchNode.id && String(e.condition ?? "").toLowerCase() === "report",
  );

  const stopTypes = new Set(["report_generate", ...LLM_NODE_TYPES]);
  const reportNodeIds = reportEdge
    ? collectBranchNodeIds(String(reportEdge.target ?? ""), steps, edges, stopTypes)
    : [];

  const reportFetchNodes = steps.filter(
    (s) => reportNodeIds.includes(String(s.id)) && FETCH_MIRROR_TYPES.has(String(s.type)),
  );

  let chatTargetId = String(chatEdge.target ?? "");
  let chatBranchIds = collectBranchNodeIds(chatTargetId, steps, edges, stopTypes);

  for (const refNode of reportFetchNodes) {
    const fetchType = String(refNode.type);
    if (branchHasFetchType(chatBranchIds, steps, fetchType)) continue;

    const newId = nextNodeId(steps);
    const refConfig = (refNode.config as Record<string, unknown>) ?? {};
    const refPos = refNode.position as { x?: number; y?: number } | undefined;
    const chatTarget = steps.find((s) => s.id === chatTargetId);
    const chatPos = chatTarget?.position as { x?: number; y?: number } | undefined;

    const newNode: Record<string, unknown> = {
      id: newId,
      type: fetchType,
      label: String(refNode.label ?? fetchType) + " (chat)",
      config: JSON.parse(JSON.stringify(refConfig)),
      position: {
        x: (chatPos?.x ?? refPos?.x ?? 440) - 220,
        y: chatPos?.y ?? refPos?.y ?? 600,
      },
    };
    steps.push(newNode);

    chatEdge.target = newId;
    edges.push({
      id: nextEdgeId(edges),
      source: newId,
      target: chatTargetId,
    });

    chatTargetId = newId;
    chatBranchIds = collectBranchNodeIds(String(chatEdge.target ?? ""), steps, edges, stopTypes);
  }

  obj.steps = steps;
  obj.edges = edges;

  for (const step of steps) {
    if (!LLM_NODE_TYPES.has(String(step.type))) continue;
    const config = { ...(step.config as Record<string, unknown> ?? {}) };
    const prompt = String(config.prompt ?? "");
    if (!prompt.includes("{{message}}")) {
      config.prompt = CHAT_LLM_PROMPT;
    }
    const system = String(config.system_prompt ?? "");
    if (!system || system.toLowerCase().includes("cannot provide") || system.length < 30) {
      config.system_prompt = CHAT_LLM_SYSTEM;
    }
    step.config = config;
  }
}

const DEFAULT_LABELS: Record<string, string> = {
  manual_trigger: "Start",
  cron_trigger: "Schedule",
  webhook_trigger: "Webhook",
  db_query: "Query data",
  db_write: "Write data",
  openai_llm: "Chat response",
  gemini_llm: "Chat response",
  anthropic_llm: "Chat response",
  custom_llm: "Chat response",
  slack_notify: "Slack notify",
  slack_fetch_messages: "Fetch Slack messages",
  gmail_fetch_unread: "Fetch unread email",
  condition: "Condition",
  switch: "Switch",
  delay: "Delay",
  loop: "Loop",
  report_generate: "Generate report",
};

function defaultLabelForType(type: string): string {
  return DEFAULT_LABELS[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ensureNodeIdsAndLabels(obj: Record<string, unknown>): void {
  let nextId = 1;

  if (obj.trigger && typeof obj.trigger === "object") {
    const t = obj.trigger as Record<string, unknown>;
    if (!t.id) t.id = `n${nextId}`;
    nextId++;
    if (!t.label) t.label = defaultLabelForType(String(t.type ?? "manual_trigger"));
  }

  if (Array.isArray(obj.steps)) {
    obj.steps = (obj.steps as Record<string, unknown>[]).map((rawNode, index) => {
      if (!rawNode || typeof rawNode !== "object") return rawNode;
      const node = { ...rawNode };
      if (!node.id) node.id = `n${nextId + index}`;
      if (!node.label) node.label = defaultLabelForType(String(node.type ?? "step"));
      return node;
    });
    const steps = obj.steps as Record<string, unknown>[];
    const maxNum = steps.reduce((max, s) => {
      const m = String(s.id ?? "").match(/^n(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    nextId = maxNum + 1;
  }

  if (Array.isArray(obj.edges)) {
    obj.edges = (obj.edges as Record<string, unknown>[]).map((e, i) => {
      if (!e || typeof e !== "object") return e;
      const edge = { ...e };
      if (!edge.id) edge.id = `e${i + 1}`;
      return edge;
    });
  }
}

export function normalizeFlowJSON(raw: unknown): FlowJSON {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { trigger: null, steps: [], edges: [] };
  }

  const obj = { ...(raw as Record<string, unknown>) };

  const keys = Object.keys(obj);
  if (keys.length === 1 && typeof obj[keys[0]] === "object" && obj[keys[0]] !== null) {
    const inner = obj[keys[0]] as Record<string, unknown>;
    if ("steps" in inner || "edges" in inner || "trigger" in inner) {
      return normalizeFlowJSON(inner);
    }
  }

  if (obj.steps && !Array.isArray(obj.steps) && typeof obj.steps === "object") {
    obj.steps = Object.values(obj.steps as Record<string, unknown>);
  }

  if (obj.edges && !Array.isArray(obj.edges) && typeof obj.edges === "object") {
    obj.edges = Object.values(obj.edges as Record<string, unknown>);
  }

  if (Array.isArray(obj.edges)) {
    obj.edges = (obj.edges as Record<string, unknown>[]).map((e) => {
      if (!e || typeof e !== "object") return e;
      const edge = { ...e };
      if (!edge.source && edge.from) edge.source = edge.from;
      if (!edge.target && edge.to) edge.target = edge.to;
      if (!edge.source && edge.sourceId) edge.source = edge.sourceId;
      if (!edge.target && edge.targetId) edge.target = edge.targetId;
      return edge;
    }).filter((e) => e && e.source != null && e.target != null);
  }

  if (Array.isArray(obj.steps)) {
    obj.steps = (obj.steps as Record<string, unknown>[]).map((n) => {
      if (!n || typeof n !== "object") return n;
      const node = { ...n };
      if (!node.label && node.name) node.label = node.name;
      if (!node.label && node.title) node.label = node.title;
      if (!node.config) node.config = {};
      if (!node.position) node.position = { x: 200, y: 200 };
      resolveNodeType(node);
      return node;
    });
  }

  if (obj.trigger && typeof obj.trigger === "object") {
    const t = { ...(obj.trigger as Record<string, unknown>) };
    if (!t.label && t.name) t.label = t.name;
    if (!t.label && t.title) t.label = t.title;
    if (!t.config) t.config = {};
    if (!t.position) t.position = { x: 0, y: 200 };
    resolveNodeType(t);
    obj.trigger = t;
  }

  if (Array.isArray(obj.nodes) && !obj.steps) {
    const nodes = obj.nodes as Record<string, unknown>[];
    nodes.forEach((n) => resolveNodeType(n));
    const triggerNode = nodes.find((n) => String(n.type ?? "").endsWith("_trigger"));
    obj.trigger = triggerNode ?? null;
    obj.steps = nodes.filter((n) => n !== triggerNode);
    delete obj.nodes;
  }

  if (!("trigger" in obj)) {
    obj.trigger = null;
  }

  if (!Array.isArray(obj.steps)) {
    obj.steps = [];
  }
  if (!Array.isArray(obj.edges)) {
    obj.edges = [];
  }

  if (Array.isArray(obj.steps)) {
    const edges = Array.isArray(obj.edges) ? (obj.edges as Record<string, unknown>[]) : [];
    obj.steps = (obj.steps as Record<string, unknown>[]).map((rawNode) => {
      if (!rawNode || rawNode.type !== "switch") return rawNode;
      const node = { ...rawNode };
      const config = { ...(node.config as Record<string, unknown> ?? {}) };
      const outgoing = edges.filter((e) => e.source === node.id);
      const conditions = outgoing
        .map((e) => String(e.condition ?? "").trim())
        .filter(Boolean);
      const hasModeRouting = conditions.some(
        (c) => c.toLowerCase() === "report" || c.toLowerCase() === "chat",
      );
      if (hasModeRouting) {
        config.input_variable = config.input_variable ?? "mode";
        const cases: Record<string, string> = {
          ...(config.cases as Record<string, string> ?? {}),
        };
        for (const cond of conditions) {
          const lower = cond.toLowerCase();
          if (lower === "report" || lower === "chat") {
            cases[cond] = cond;
            cases[lower] = lower;
          }
        }
        config.cases = cases;
        node.config = config;
      }
      return node;
    });
  }

  normalizeChatBranch(obj);
  ensureNodeIdsAndLabels(obj);

  return {
    trigger: (obj.trigger as FlowJSON["trigger"]) ?? null,
    steps: (obj.steps as FlowJSON["steps"]) ?? [],
    edges: (obj.edges as FlowJSON["edges"]) ?? [],
    metadata: obj.metadata as FlowJSON["metadata"],
  };
}

export function extractFlowPayload(
  llmResult: unknown,
): { flow: FlowJSON; user_message: string } {
  if (!llmResult || typeof llmResult !== "object") {
    return { flow: { trigger: null, steps: [], edges: [] }, user_message: "Flow updated." };
  }

  const obj = llmResult as Record<string, unknown>;
  const userMessage = String(obj.user_message ?? obj.message ?? "Flow updated.");

  if (obj.flow && typeof obj.flow === "object") {
    return { flow: normalizeFlowJSON(obj.flow), user_message: userMessage };
  }

  if ("steps" in obj || "edges" in obj || "trigger" in obj) {
    return { flow: normalizeFlowJSON(obj), user_message: userMessage };
  }

  const keys = Object.keys(obj);
  if (keys.length === 1 && typeof obj[keys[0]] === "object" && obj[keys[0]] !== null) {
    const inner = obj[keys[0]] as Record<string, unknown>;
    if ("steps" in inner || "edges" in inner || "trigger" in inner) {
      return { flow: normalizeFlowJSON(inner), user_message: userMessage };
    }
  }

  return { flow: { trigger: null, steps: [], edges: [] }, user_message: userMessage };
}
