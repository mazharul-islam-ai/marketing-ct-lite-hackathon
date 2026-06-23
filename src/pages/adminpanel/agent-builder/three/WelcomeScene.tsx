import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { i4203d } from "./i4203dTheme";

const ORBIT_COUNT = 7;

function OrbitingSphere({ index }: { index: number }) {
  const ref = useRef<Mesh>(null);
  const radius = 1.4 + (index % 3) * 0.15;
  const speed = 0.4 + index * 0.08;
  const phase = (index / ORBIT_COUNT) * Math.PI * 2;
  const tilt = 0.3 + index * 0.12;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed + phase;
    ref.current.position.x = Math.cos(t) * radius;
    ref.current.position.z = Math.sin(t) * radius;
    ref.current.position.y = Math.sin(t * 1.3 + phase) * tilt;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial
        color={i4203d.violet}
        emissive={i4203d.indigo}
        emissiveIntensity={0.6}
        metalness={0.3}
        roughness={0.4}
      />
    </mesh>
  );
}

function CentralOrb() {
  const ref = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.25;
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.15) * 0.1;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.55, 1]} />
        <MeshTransmissionMaterial
          backside
          samples={4}
          thickness={0.4}
          chromaticAberration={0.05}
          anisotropy={0.1}
          distortion={0.15}
          distortionScale={0.2}
          temporalDistortion={0.05}
          iridescence={0.3}
          iridescenceIOR={1}
          color={i4203d.glass}
        />
      </mesh>
    </Float>
  );
}

function WelcomeSceneContent() {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock, pointer }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = pointer.x * 0.15;
    groupRef.current.rotation.x = -pointer.y * 0.08 + Math.sin(clock.getElapsedTime() * 0.2) * 0.05;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 4, 4]} intensity={1.2} color={i4203d.indigo} />
      <pointLight position={[-3, 2, 2]} intensity={0.8} color={i4203d.violet} />
      <group ref={groupRef}>
        <CentralOrb />
        {Array.from({ length: ORBIT_COUNT }, (_, i) => (
          <OrbitingSphere key={i} index={i} />
        ))}
      </group>
    </>
  );
}

export default function WelcomeScene() {
  return <WelcomeSceneContent />;
}
