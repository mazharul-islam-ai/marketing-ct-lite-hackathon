import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Group } from "three";
import type { FlowJSON } from "../types";
import {
  PIPELINE_END,
  PIPELINE_START,
  PIPELINE_Y,
  flowNodesForSkeleton,
  pipelinePositions,
} from "./skeletonShared";
import { i4203d } from "./i4203dTheme";
import { GroundShadow, SceneLighting } from "./SceneLighting";
import { NodeGlyph3d, type PipelineVariant } from "./nodeGlyph3d";

interface FlowPipelineSceneProps {
  flowJson: FlowJSON | null;
  variant?: PipelineVariant;
  isRunActive?: boolean;
  reducedMotion?: boolean;
}

function FlowPipelineScene({
  flowJson,
  variant = "agent",
  isRunActive = false,
  reducedMotion = false,
}: FlowPipelineSceneProps) {
  const pulseRef = useRef<Group>(null);
  const nodes = useMemo(() => flowNodesForSkeleton(flowJson), [flowJson]);
  const positions = useMemo(
    () => pipelinePositions(nodes.length, PIPELINE_START, PIPELINE_END, PIPELINE_Y),
    [nodes.length],
  );

  const linePoints = useMemo(
    () => positions.map((p) => [p[0], p[1], p[2]] as [number, number, number]),
    [positions],
  );

  const baseEmissive = isRunActive ? 0.52 : 0.32;
  const keyColor = variant === "automation" ? i4203d.teal : i4203d.indigo;
  const lineColor = variant === "automation" ? i4203d.teal : i4203d.indigo;

  useFrame(({ clock }) => {
    if (!pulseRef.current || !isRunActive || reducedMotion) return;
    const pulse = 0.48 + Math.sin(clock.getElapsedTime() * 2.5) * 0.08;
    pulseRef.current.scale.setScalar(1 + pulse * 0.02);
  });

  if (nodes.length === 0) {
    return (
      <>
        <SceneLighting keyColor={keyColor} />
        <GroundShadow />
        <mesh position={[0, PIPELINE_Y, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.06]} />
          <meshStandardMaterial color={i4203d.grid} opacity={0.45} transparent />
        </mesh>
      </>
    );
  }

  return (
    <>
      <SceneLighting keyColor={keyColor} />
      <GroundShadow />

      <group ref={pulseRef}>
        {linePoints.length > 1 && (
          <Line
            points={linePoints}
            color={lineColor}
            lineWidth={1.5}
            transparent
            opacity={0.45}
          />
        )}

        {positions.map((pos, i) => {
          const node = nodes[i];
          if (!node) return null;
          return (
            <group key={node.id} position={pos}>
              <NodeGlyph3d
                node={node}
                variant={variant}
                emissiveIntensity={baseEmissive}
              />
            </group>
          );
        })}
      </group>
    </>
  );
}

export default memo(FlowPipelineScene);
