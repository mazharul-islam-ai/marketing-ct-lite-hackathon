import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Group } from "three";
import type { FlowJSON } from "../types";
import { isLlmNodeType } from "../extractFlowModels";
import {
  AGENT_IDLE_ROTATION,
  AGENT_ORBIT_RADIUS,
  flowNodesForSkeleton,
  orbitPositions,
} from "./skeletonShared";
import { i4203d } from "./i4203dTheme";
import { GroundShadow, SceneLighting } from "./SceneLighting";

const TORSO_Y = 0.08;
const _start = new Vector3(0, TORSO_Y, 0);
const _end = new Vector3();
const _dir = new Vector3();
const _mid = new Vector3();

interface AgentSkeletonSceneProps {
  flowJson: FlowJSON | null;
  isRunActive?: boolean;
  reducedMotion?: boolean;
}

function ArmCylinder({ target }: { target: [number, number, number] }) {
  _end.set(target[0], target[1], target[2]);
  _dir.subVectors(_end, _start);
  const len = _dir.length() || 0.001;
  _mid.copy(_start).add(_end).multiplyScalar(0.5);

  const horizontal = Math.sqrt(_dir.x * _dir.x + _dir.z * _dir.z);
  const rotX = Math.atan2(horizontal, _dir.y) - Math.PI / 2;
  const rotY = Math.atan2(_dir.x, _dir.z);

  return (
    <mesh position={[_mid.x, _mid.y, _mid.z]} rotation={[rotX, rotY, 0]}>
      <cylinderGeometry args={[0.008, 0.008, len, 6]} />
      <meshStandardMaterial color={i4203d.indigo} opacity={0.35} transparent />
    </mesh>
  );
}

function AgentSkeletonScene({
  flowJson,
  isRunActive = false,
  reducedMotion = false,
}: AgentSkeletonSceneProps) {
  const groupRef = useRef<Group>(null);

  const nodes = useMemo(() => flowNodesForSkeleton(flowJson), [flowJson]);
  const satellites = useMemo(
    () => orbitPositions(nodes.length, AGENT_ORBIT_RADIUS),
    [nodes.length],
  );

  const animate = isRunActive && !reducedMotion;
  const emissiveIntensity = isRunActive ? 0.55 : 0.32;

  useFrame(() => {
    if (!groupRef.current || !animate) return;
    groupRef.current.rotation.y += 0.003;
  });

  if (nodes.length === 0) {
    return (
      <>
        <SceneLighting />
        <GroundShadow />
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.14, 0.2, 0.08]} />
          <meshStandardMaterial color={i4203d.grid} opacity={0.45} transparent />
        </mesh>
      </>
    );
  }

  return (
    <>
      <SceneLighting />
      <GroundShadow />

      <group ref={groupRef} rotation={AGENT_IDLE_ROTATION}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.16, 0.22, 0.1]} />
          <meshStandardMaterial
            color={i4203d.indigo}
            emissive={i4203d.violet}
            emissiveIntensity={emissiveIntensity * 0.6}
            metalness={0.3}
            roughness={0.45}
          />
        </mesh>

        <mesh position={[0, 0.24, 0]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial
            color={i4203d.terracotta}
            emissive={i4203d.indigo}
            emissiveIntensity={emissiveIntensity}
            metalness={0.35}
            roughness={0.35}
          />
        </mesh>

        {satellites.map((pos, i) => {
          const node = nodes[i];
          const isAi = node && isLlmNodeType(node.type);
          const boxH = isAi ? 0.15 : 0.11;
          const boxW = isAi ? 0.12 : 0.1;
          const boxD = 0.08;

          return (
            <group key={node?.id ?? i}>
              <ArmCylinder target={pos} />
              <mesh position={pos}>
                <boxGeometry args={[boxW, boxH, boxD]} />
                <meshStandardMaterial
                  color={isAi ? i4203d.terracotta : i4203d.indigo}
                  emissive={i4203d.violet}
                  emissiveIntensity={isAi ? emissiveIntensity : emissiveIntensity * 0.7}
                  metalness={0.35}
                  roughness={0.4}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </>
  );
}

export default memo(AgentSkeletonScene);
