export interface ConversationState {
  workflowHints: string[];
  workflowHint: string | null;
  resolvedParams: Record<string, string>;
  userExclusions: string[];
}

const WORKFLOW_HINT_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /\b(slack|channel)\b/i, hint: "slack" },
  { pattern: /\b(gmail|email\s+inbox|unread\s+email)\b/i, hint: "gmail" },
  { pattern: /\b(send\s+email|email\s+(report|summary|me))\b/i, hint: "email_send" },
  { pattern: /\b(mcp\s+tool|mcp\s+server|external\s+mcp)\b/i, hint: "mcp" },
  { pattern: /\b(db_query|database|query\s+(the\s+)?table|from\s+(the\s+)?table|clients?\s+from)\b/i, hint: "db" },
  { pattern: /\bchat\b/i, hint: "chat" },
];

const EXCLUSION_PATTERNS: Array<RegExp> = [
  /\b(no\s+slack|without\s+slack|didn'?t\s+tell\s+you\s+slack|not\s+slack)\b/i,
  /\b(chat\s+and\s+db\s+only|db\s+and\s+chat\s+only|only\s+chat\s+and\s+db)\b/i,
  /\b(no\s+need\s+(?:to\s+)?(?:store|save|use)?\s*(?:in\s+)?(?:db|database|table))\b/i,
  /\b(don['']?t\s+(?:store|save|use)\s+(?:in\s+)?(?:db|database|table))\b/i,
  /\b(no\s+(?:db|database|table|storage))\b/i,
];

export function extractConversationState(
  chatHistory: Array<{ role: string; content: string }>,
  currentPrompt?: string,
): ConversationState {
  const state: ConversationState = {
    workflowHints: [],
    workflowHint: null,
    resolvedParams: {},
    userExclusions: [],
  };

  const historyText = chatHistory.map((m) => m.content).join("\n");
  const allText = currentPrompt ? `${historyText}\n${currentPrompt}` : historyText;

  for (const { pattern, hint } of WORKFLOW_HINT_PATTERNS) {
    if (pattern.test(allText) && !state.workflowHints.includes(hint)) {
      state.workflowHints.push(hint);
    }
  }
  state.workflowHint = state.workflowHints[0] ?? null;

  for (const pattern of EXCLUSION_PATTERNS) {
    for (const msg of chatHistory) {
      if (msg.role === "user" && pattern.test(msg.content)) {
        const match = msg.content.match(pattern);
        if (match) state.userExclusions.push(match[0].trim());
      }
    }
    if (currentPrompt && pattern.test(currentPrompt)) {
      const match = currentPrompt.match(pattern);
      if (match) state.userExclusions.push(match[0].trim());
    }
  }

  return state;
}

export function buildResolvedContextBlock(state: ConversationState): string {
  const lines: string[] = [];
  if (state.workflowHints.length > 0) {
    lines.push(`- Workflow hints detected: ${state.workflowHints.join(", ")}`);
  }
  for (const exclusion of state.userExclusions) {
    lines.push(`- User explicitly said they do NOT want: "${exclusion}"`);
  }
  if (userExcludedIntegration(state, "slack")) {
    lines.push("- User excluded Slack — do NOT add slack_notify or slack_fetch_messages.");
  }
  if (lines.length === 0) return "";
  return `RESOLVED CONTEXT (already confirmed — do NOT re-ask):\n${lines.join("\n")}`;
}

export function userExcludedIntegration(state: ConversationState, name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === "slack") {
    return state.userExclusions.some((e) => /slack/i.test(e))
      || (state.workflowHints.includes("chat") && state.workflowHints.includes("db") && !state.workflowHints.includes("slack"));
  }
  if (lower === "gmail") {
    return state.userExclusions.some((e) => /gmail|email/i.test(e));
  }
  return false;
}

export function isChatDbOnlyIntent(state: ConversationState): boolean {
  const hasChat = state.workflowHints.includes("chat") || /\bchat\b/i.test(state.userExclusions.join(" "));
  const hasDb = state.workflowHints.includes("db");
  const wantsSlack = state.workflowHints.includes("slack") && !userExcludedIntegration(state, "slack");
  return hasChat && hasDb && !wantsSlack;
}
