import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Torus } from "@react-three/drei";
import type { Mesh } from "three";
import type { FlowJSON, FlowNode } from "../types";
import { isLlmNodeType } from "../extractFlowModels";
import {
  BELT_END,
  BELT_START,
  BELT_Y,
  TOKEN_Y,
  beltPositions,
  flowNodesForSkeleton,
} from "./skeletonShared";
import { i4203d } from "./i4203dTheme";
import { GroundShadow, SceneLighting } from "./SceneLighting";

const LOGIC_TYPES = new Set(["condition", "switch", "loop", "delay"]);

interface AutomationSkeletonSceneProps {
  flowJson: FlowJSON | null;
  isRunActive?: boolean;
  reducedMotion?: boolean;
}

function AutomationSkeletonScene({
  flowJson,
  isRunActive = false,
  reducedMotion = false,
}: AutomationSkeletonSceneProps) {
  const gearRef = useRef<Mesh>(null);

  const nodes = useMemo(() => flowNodesForSkeleton(flowJson), [flowJson]);
  const tokenPositions = useMemo(
    () => beltPositions(nodes.length, BELT_START + 0.28, BELT_END - 0.12, TOKEN_Y),
    [nodes.length],
  );

  const hasCronTrigger = flowJson?.trigger?.type === "cron_trigger";
  const animate = isRunActive && !reducedMotion;
  const emissiveIntensity = isRunActive ? 0.5 : 0.28;

  useFrame((_, delta) => {
    if (!gearRef.current || !animate) return;
    gearRef.current.rotation.z += delta * 1.2;
  });

  if (nodes.length === 0) {
    return (
      <>
        <SceneLighting keyColor={i4203d.teal} keyIntensity={0.85} />
        <GroundShadow />
        <mesh position={[0, BELT_Y, 0]}>
          <boxGeometry args={[1.6, 0.06, 0.28]} />
          <meshStandardMaterial color={i4203d.grid} opacity={0.4} transparent />
        </mesh>
      </>
    );
  }

  return (
    <>
      <SceneLighting keyColor={i4203d.teal} keyIntensity={0.85} />
      <GroundShadow />

      <group>
        <mesh position={[0, BELT_Y, 0]}>
          <boxGeometry args={[1.65, 0.07, 0.32]} />
          <meshStandardMaterial color={i4203d.stone} metalness={0.2} roughness={0.65} />
        </mesh>

        {[-0.65, -0.32, 0, 0.32, 0.65].map((x) => (
          <mesh key={x} position={[x, BELT_Y - 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.34, 10]} />
            <meshStandardMaterial color={i4203d.warmGray} metalness={0.25} roughness={0.5} />
          </mesh>
        ))}

        {hasCronTrigger && (
          <group position={[BELT_START + 0.06, TOKEN_Y + 0.02, 0]}>
            <mesh ref={gearRef}>
              <torusGeometry args={[0.12, 0.022, 8, 24]} />
              <meshStandardMaterial
                color={i4203d.teal}
                emissive={i4203d.emerald}
                emissiveIntensity={emissiveIntensity}
                metalness={0.4}
                roughness={0.35}
              />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <cylinderGeometry args={[0.035, 0.035, 0.18, 6]} />
              <meshStandardMaterial color={i4203d.stone} metalness={0.3} roughness={0.5} />
            </mesh>
          </group>
        )}

        <mesh position={[BELT_END + 0.1, BELT_Y + 0.02, 0]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.1, 0.16, 0.08]} />
          <meshStandardMaterial color={i4203d.teal} emissive={i4203d.emerald} emissiveIntensity={0.2} />
        </mesh>

        {tokenPositions.map((pos, i) => {
          const node = nodes[i] as FlowNode | undefined;
          const isLogic = node && LOGIC_TYPES.has(node.type);
          const isAi = node && isLlmNodeType(node.type);

          if (isLogic) {
            return (
              <group key={node?.id ?? i} position={pos}>
                <Torus args={[0.065, 0.014, 6, 12]} rotation={[Math.PI / 2, 0, 0]}>
                  <meshStandardMaterial
                    color={i4203d.stone}
                    emissive={i4203d.teal}
                    emissiveIntensity={emissiveIntensity * 0.8}
                    metalness={0.35}
                    roughness={0.4}
                  />
                </Torus>
              </group>
            );
          }

          const h = isAi ? 0.13 : 0.1;
          const w = isAi ? 0.11 : 0.1;

          return (
            <group key={node?.id ?? i} position={pos}>
              <mesh>
                <boxGeometry args={[w, h, 0.08]} />
                <meshStandardMaterial
                  color={isAi ? i4203d.emerald : i4203d.teal}
                  emissive={i4203d.emerald}
                  emissiveIntensity={isAi ? emissiveIntensity : emissiveIntensity * 0.65}
                  metalness={0.35}
                  roughness={0.42}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </>
  );
}

export default memo(AutomationSkeletonScene);
