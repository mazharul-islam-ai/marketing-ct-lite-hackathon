import type { FlowJSON, FlowNode } from "./types";

export interface FlowDiffResult {
  added: FlowNode[];
  removed: FlowNode[];
  changed: Array<{ node: FlowNode; before: FlowNode; changedKeys: string[] }>;
  unchanged: FlowNode[];
  hasChanges: boolean;
}

function collectNodes(flow: FlowJSON | null): FlowNode[] {
  if (!flow) return [];
  return [...(flow.trigger ? [flow.trigger] : []), ...flow.steps];
}

function configChangedKeys(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changed.push(k);
  }
  return changed;
}

export function diffFlows(before: FlowJSON | null, after: FlowJSON): FlowDiffResult {
  const beforeNodes = collectNodes(before);
  const afterNodes = collectNodes(after);
  const beforeById = new Map(beforeNodes.map((n) => [n.id, n]));
  const afterById = new Map(afterNodes.map((n) => [n.id, n]));

  const added: FlowNode[] = [];
  const removed: FlowNode[] = [];
  const changed: FlowDiffResult["changed"] = [];
  const unchanged: FlowNode[] = [];

  for (const node of afterNodes) {
    const prev = beforeById.get(node.id);
    if (!prev) {
      added.push(node);
      continue;
    }

    const changedKeys: string[] = [];
    if (prev.type !== node.type) changedKeys.push("type");
    if (prev.label !== node.label) changedKeys.push("label");
    changedKeys.push(...configChangedKeys(prev.config ?? {}, node.config ?? {}));

    const uniqueKeys = [...new Set(changedKeys)];
    if (uniqueKeys.length > 0) {
      changed.push({ node, before: prev, changedKeys: uniqueKeys });
    } else {
      unchanged.push(node);
    }
  }

  for (const node of beforeNodes) {
    if (!afterById.has(node.id)) removed.push(node);
  }

  return {
    added,
    removed,
    changed,
    unchanged,
    hasChanges: added.length + removed.length + changed.length > 0,
  };
}

export function summarizeDiff(diff: FlowDiffResult): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  if (diff.changed.length) parts.push(`${diff.changed.length} changed`);
  if (!parts.length) return "No structural changes";
  return parts.join(", ");
}

export function diffHighlightSets(diff: FlowDiffResult): {
  added: Set<string>;
  removed: Set<string>;
  changed: Set<string>;
} {
  return {
    added: new Set(diff.added.map((n) => n.id)),
    removed: new Set(diff.removed.map((n) => n.id)),
    changed: new Set(diff.changed.map((c) => c.node.id)),
  };
}
