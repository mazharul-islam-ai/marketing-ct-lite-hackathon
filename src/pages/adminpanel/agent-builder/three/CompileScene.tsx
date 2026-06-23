import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Mesh } from "three";
import * as THREE from "three";
import { i4203d } from "./i4203dTheme";
import { COMPILE_PHASE_ORDER } from "../integrationConfig";

const NODE_COUNT = 5;

interface CompileSceneContentProps {
  phase?: string;
  completedPhases?: string[];
}

function phaseToActiveIndex(phase?: string, completedPhases: string[] = []): number {
  if (!phase) return 0;
  const idx = COMPILE_PHASE_ORDER.indexOf(phase as (typeof COMPILE_PHASE_ORDER)[number]);
  if (idx < 0) return 0;
  // Map 8 phases → 5 visual nodes
  return Math.min(NODE_COUNT - 1, Math.floor((idx / COMPILE_PHASE_ORDER.length) * NODE_COUNT));
}

function CompileNode({
  index,
  activeIndex,
  done,
}: {
  index: number;
  activeIndex: number;
  done: boolean;
}) {
  const ref = useRef<Mesh>(null);
  const x = (index - (NODE_COUNT - 1) / 2) * 0.9;
  const isActive = index === activeIndex && !done;
  const isDone = index < activeIndex || done;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = isActive ? 1 + Math.sin(clock.getElapsedTime() * 4) * 0.15 : 1;
    ref.current.scale.setScalar(0.22 * pulse);
    if (isActive) {
      (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.5 + Math.sin(clock.getElapsedTime() * 3) * 0.3;
    }
  });

  return (
    <mesh ref={ref} position={[x, 0, 0]}>
      <sphereGeometry args={[1, 20, 20]} />
      <meshStandardMaterial
        color={isDone ? i4203d.emerald : isActive ? i4203d.indigo : i4203d.grid}
        emissive={isActive ? i4203d.violet : i4203d.indigoDark}
        emissiveIntensity={isActive ? 0.5 : isDone ? 0.2 : 0}
        metalness={0.4}
        roughness={0.35}
      />
    </mesh>
  );
}

function CompileSceneContent({ phase, completedPhases = [] }: CompileSceneContentProps) {
  const activeIndex = phaseToActiveIndex(phase, completedPhases);
  const allDone = completedPhases.includes("saving_version");

  const linePoints: [number, number, number][] = Array.from({ length: NODE_COUNT }, (_, i) => [
    (i - (NODE_COUNT - 1) / 2) * 0.9,
    0,
    0,
  ]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[2, 2, 3]} intensity={1} color={i4203d.indigo} />
      <Line
        points={linePoints}
        color={i4203d.indigoDark}
        lineWidth={1}
        transparent
        opacity={0.4}
      />
      {Array.from({ length: NODE_COUNT }, (_, i) => (
        <CompileNode
          key={i}
          index={i}
          activeIndex={activeIndex}
          done={allDone || i < activeIndex}
        />
      ))}
    </>
  );
}

export default CompileSceneContent;
