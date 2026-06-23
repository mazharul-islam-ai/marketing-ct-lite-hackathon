import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Torus } from "@react-three/drei";
import type { Group } from "three";
import type { FlowJSON } from "../types";
import { i4203d } from "./i4203dTheme";

const MAX_NODES = 8;
const SPACING = 0.55;

interface FlowPreviewSceneContentProps {
  flowJson: FlowJSON | null;
  variant?: "agent" | "automation";
  isRunActive?: boolean;
}

function FlowPreviewSceneContent({
  flowJson,
  variant = "agent",
  isRunActive = false,
}: FlowPreviewSceneContentProps) {
  const groupRef = useRef<Group>(null);
  const isAutomation = variant === "automation";

  const nodes = useMemo(() => {
    if (!flowJson) return [];
    const all = [...(flowJson.trigger ? [flowJson.trigger] : []), ...flowJson.steps];
    return all.slice(0, MAX_NODES);
  }, [flowJson]);

  const positions = useMemo(() => {
    const n = Math.max(nodes.length, 1);
    const start = -((n - 1) * SPACING) / 2;
    return nodes.map((_, i) => [start + i * SPACING, 0, 0] as [number, number, number]);
  }, [nodes.length]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (isRunActive) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.8) * 0.08;
    }
  });

  const nodeColor = isAutomation ? i4203d.teal : i4203d.indigo;
  const emissiveColor = isAutomation ? i4203d.emerald : i4203d.violet;

  if (nodes.length === 0) {
    return (
      <>
        <ambientLight intensity={0.5} />
        <mesh>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color={i4203d.grid} opacity={0.5} transparent />
        </mesh>
      </>
    );
  }

  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[2, 2, 3]} intensity={0.9} color={nodeColor} />
      <group ref={groupRef}>
        {positions.length > 1 && (
          <Line points={positions} color={nodeColor} lineWidth={1.5} transparent opacity={0.5} />
        )}
        {positions.map((pos, i) => (
          <group key={nodes[i]?.id ?? i} position={pos}>
            {isAutomation && i === 0 && flowJson?.trigger?.type === "cron_trigger" && (
              <Torus args={[0.22, 0.025, 8, 24]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color={i4203d.emerald} emissive={i4203d.teal} emissiveIntensity={0.4} />
              </Torus>
            )}
            <mesh>
              <sphereGeometry args={[0.14, 20, 20]} />
              <meshStandardMaterial
                color={nodeColor}
                emissive={emissiveColor}
                emissiveIntensity={isRunActive ? 0.5 : 0.25}
                metalness={0.35}
                roughness={0.4}
              />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

export default FlowPreviewSceneContent;
