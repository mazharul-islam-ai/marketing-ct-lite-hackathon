import * as THREE from "three";

/** Three.js colors aligned with agentBuilderTheme indigo/teal palette */
export const i4203d = {
  indigo: new THREE.Color("hsl(248, 50%, 62%)"),
  indigoDark: new THREE.Color("hsl(248, 45%, 42%)"),
  violet: new THREE.Color("hsl(270, 50%, 48%)"),
  teal: new THREE.Color("hsl(172, 60%, 42%)"),
  emerald: new THREE.Color("hsl(160, 55%, 40%)"),
  grid: new THREE.Color("hsl(250, 18%, 88%)"),
  particle: new THREE.Color("hsl(248, 55%, 70%)"),
  background: new THREE.Color("hsl(250, 33%, 98%)"),
  glass: new THREE.Color("hsl(248, 50%, 62%)"),
} as const;

export type CanvasBackgroundVariant = "studio" | "list" | "welcome";

export const PARTICLE_COUNTS: Record<CanvasBackgroundVariant, number> = {
  studio: 32,
  list: 16,
  welcome: 48,
};
