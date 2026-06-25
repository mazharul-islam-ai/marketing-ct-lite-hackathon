import { Torus } from "@react-three/drei";
import type { Color } from "three";
import { getNodeDef, type FlowNode, type NodeCategory } from "../types";
import { i4203d } from "./i4203dTheme";

export type PipelineVariant = "agent" | "automation";

const VARIANT_PALETTE: Record<PipelineVariant, Record<NodeCategory, Color>> = {
  agent: {
    trigger: i4203d.terracotta,
    ai: i4203d.indigo,
    tool: i4203d.violet,
    logic: i4203d.warmGray,
    output: i4203d.indigoDark,
  },
  automation: {
    trigger: i4203d.teal,
    ai: i4203d.emerald,
    tool: i4203d.stone,
    logic: i4203d.warmGray,
    output: i4203d.teal,
  },
};

const VARIANT_EMISSIVE: Record<PipelineVariant, Color> = {
  agent: i4203d.violet,
  automation: i4203d.emerald,
};

interface NodeGlyph3dProps {
  node: FlowNode;
  variant: PipelineVariant;
  emissiveIntensity?: number;
}

export function NodeGlyph3d({
  node,
  variant,
  emissiveIntensity = 0.32,
}: NodeGlyph3dProps) {
  const def = getNodeDef(node.type);
  const category: NodeCategory = def?.category ?? "tool";
  const color = VARIANT_PALETTE[variant][category];
  const emissive = VARIANT_EMISSIVE[variant];
  const isAi = category === "ai";
  const isCron = node.type === "cron_trigger";
  const intensity = isAi ? emissiveIntensity : emissiveIntensity * 0.65;

  if (category === "trigger") {
    return (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.045, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={intensity}
            metalness={0.35}
            roughness={0.4}
          />
        </mesh>
        {isCron && (
          <Torus args={[0.095, 0.012, 8, 24]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={intensity * 1.1}
              metalness={0.4}
              roughness={0.35}
            />
          </Torus>
        )}
      </group>
    );
  }

  if (category === "logic") {
    return (
      <mesh scale={0.85}>
        <octahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={intensity * 0.8}
          metalness={0.3}
          roughness={0.45}
        />
      </mesh>
    );
  }

  if (category === "ai") {
    return (
      <mesh>
        <boxGeometry args={[0.11, 0.14, 0.08]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={intensity}
          metalness={0.35}
          roughness={0.38}
        />
      </mesh>
    );
  }

  if (category === "output") {
    return (
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.07, 0.12, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={intensity * 0.9}
          metalness={0.3}
          roughness={0.42}
        />
      </mesh>
    );
  }

  // tool (default)
  return (
    <mesh>
      <boxGeometry args={[0.1, 0.1, 0.08]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={intensity}
        metalness={0.35}
        roughness={0.4}
      />
    </mesh>
  );
}
