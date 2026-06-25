import type { FlowJSON, FlowNode } from "../types";

export const MAX_SKELETON_NODES = 8;

export const SKELETON_VIEWPORT = { heightPx: 200, widthPx: 480 } as const;

export const SKELETON_CAMERA = {
  agent: { position: [0, 0.08, 1.72] as const, fov: 36 },
  automation: { position: [0, 0.04, 1.72] as const, fov: 36 },
} as const;

/** Horizontal pipeline layout (left → right) */
export const PIPELINE_START = -0.78;
export const PIPELINE_END = 0.78;
export const PIPELINE_Y = 0;

export function flowNodesForSkeleton(flowJson: FlowJSON | null): FlowNode[] {
  if (!flowJson) return [];
  const all = [...(flowJson.trigger ? [flowJson.trigger] : []), ...flowJson.steps];
  return all.slice(0, MAX_SKELETON_NODES);
}

export function pipelinePositions(
  count: number,
  startX: number,
  endX: number,
  y = PIPELINE_Y,
): [number, number, number][] {
  if (count === 0) return [];
  if (count === 1) return [[(startX + endX) / 2, y, 0]];
  const span = endX - startX;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return [startX + span * t, y, 0] as [number, number, number];
  });
}

/** @deprecated Use pipelinePositions */
export function beltPositions(
  count: number,
  startX: number,
  endX: number,
  y = PIPELINE_Y,
): [number, number, number][] {
  return pipelinePositions(count, startX, endX, y);
}
