import * as THREE from "three";

/** Three.js colors aligned with Claude-inspired warm cream + terracotta palette */
export const i4203d = {
  terracotta: new THREE.Color("hsl(18, 52%, 52%)"),
  terracottaDark: new THREE.Color("hsl(18, 45%, 38%)"),
  stone: new THREE.Color("hsl(30, 15%, 55%)"),
  warmGray: new THREE.Color("hsl(40, 20%, 96%)"),
  grid: new THREE.Color("hsl(35, 15%, 88%)"),
  particle: new THREE.Color("hsl(18, 40%, 70%)"),
  background: new THREE.Color("hsl(40, 33%, 97%)"),
  glass: new THREE.Color("hsl(18, 52%, 52%)"),
  /** Agent nodes */
  indigo: new THREE.Color("hsl(18, 52%, 52%)"),
  indigoDark: new THREE.Color("hsl(18, 45%, 38%)"),
  violet: new THREE.Color("hsl(18, 45%, 42%)"),
  /** Automation nodes — warm stone instead of teal */
  teal: new THREE.Color("hsl(30, 15%, 55%)"),
  emerald: new THREE.Color("hsl(18, 52%, 46%)"),
} as const;

export type CanvasBackgroundVariant = "studio" | "list" | "welcome";

export const PARTICLE_COUNTS: Record<CanvasBackgroundVariant, number> = {
  studio: 32,
  list: 16,
  welcome: 48,
};
