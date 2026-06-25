import type { ColorRepresentation } from "three";
import { i4203d } from "./i4203dTheme";

interface SceneLightingProps {
  keyColor?: ColorRepresentation;
  keyIntensity?: number;
}

export function SceneLighting({ keyColor = i4203d.indigo, keyIntensity = 0.9 }: SceneLightingProps) {
  return (
    <>
      <ambientLight intensity={0.58} />
      <pointLight position={[1.6, 2, 2.2]} intensity={keyIntensity} color={keyColor} />
      <pointLight position={[-1.2, 0.4, 1.2]} intensity={0.28} color={i4203d.violet} />
    </>
  );
}

export function GroundShadow() {
  return (
    <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2.4, 1.2]} />
      <meshBasicMaterial color={i4203d.indigoDark} transparent opacity={0.1} />
    </mesh>
  );
}
