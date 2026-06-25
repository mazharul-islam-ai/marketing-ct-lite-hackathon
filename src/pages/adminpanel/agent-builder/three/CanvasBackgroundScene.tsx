import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import type { Points } from "three";
import { i4203d, PARTICLE_COUNTS, type CanvasBackgroundVariant } from "./i4203dTheme";

interface ParticlesProps {
  count: number;
  running?: boolean;
}

function Particles({ count, running = false }: ParticlesProps) {
  const ref = useRef<Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const speed = running ? 0.4 : 0.12;
    // Whole cloud rotates slowly as one unit — no per-particle jitter
    ref.current.rotation.y = clock.getElapsedTime() * speed * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={running ? 0.055 : 0.04}
        color={running ? i4203d.teal : i4203d.particle}
        transparent
        opacity={0.55}
        sizeAttenuation
      />
    </points>
  );
}

interface CanvasBackgroundSceneProps {
  variant?: CanvasBackgroundVariant;
  running?: boolean;
}

function CanvasBackgroundScene({ variant = "studio", running = false }: CanvasBackgroundSceneProps) {
  const count = PARTICLE_COUNTS[variant];
  const isCompile = variant === "compile";
  const particlesRunning = running || isCompile;

  return (
    <>
      <ambientLight intensity={isCompile ? 0.65 : 0.5} />
      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor={i4203d.grid}
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor={i4203d.indigoDark}
        fadeDistance={18}
        fadeStrength={1.2}
        followCamera={false}
        infiniteGrid
        position={[0, -1.5, -2]}
        rotation={[0, 0, 0]}
      />
      <Particles count={count} running={particlesRunning} />
    </>
  );
}

export default CanvasBackgroundScene;
