/**
 * state.ts — the type hub for SCEND. Plain data only; behaviour lives in sim.ts / world.ts.
 * Vertical is screen-space px (+Y down); horizontal is world-space px (camera scrolls right).
 *
 * The world is THREE stacked floors (lanes). Each lane is a stream of platform runs broken by
 * short holes. A platform is a run of tiles at a fixed lane height; tiles carry hazards.
 * Ghosts, geysers and pickups are positioned by (x, lane).
 */

export type TileKind = 'solid' | 'spike' | 'lava' | 'water';

/** A run of tiles on one lane. col0..col1 inclusive; height = LANE_H[lane]. */
export interface Platform {
  lane: number;
  col0: number;
  col1: number;
  tiles: TileKind[]; // length === col1 - col0 + 1
}

export interface Geyser {
  x: number; // world x (centre of its tile)
  lane: number;
  phase: number;
  dead: boolean;
}

export interface Ghost {
  x: number;
  lane: number;
  floatTiles: number; // absolute tile height (LANE_H[lane] + GHOST_FLOAT)
  anchorX: number;
  dir: 1 | -1;
  fire: number;
  dead: boolean;
}

export type PickupKind = 'knife' | 'boots' | 'horns';

export interface Pickup {
  x: number;
  lane: number;
  floatTiles: number; // sits on the lane surface (= LANE_H[lane]) so it's always reachable
  kind: PickupKind;
  taken: boolean;
}

export type ProjectileKind = 'boo' | 'knife';

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: ProjectileKind;
  dead: boolean;
}

export interface Player {
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
  lane: number; // floor the player is currently on / nearest to (for adaptive generation)
  coyote: number;
  buffer: number;
  wetUntil: number;
  knife: boolean;
  horns: boolean;
}

/** Per-lane generation cursor (kept on the World so streaming is resumable). */
export interface World {
  seed: number;
  platforms: Platform[]; // currently-open platforms are mutated in place as they extend
  geysers: Geyser[];
  ghosts: Ghost[];
  pickups: Pickup[];
  nextCol: number;
  minCol: number; // oldest column still kept (for pruning bookkeeping)
  present: boolean[]; // per lane: currently a platform (vs a hole)
  runLeft: number[]; // per lane: columns until the run toggles
  open: (Platform | null)[]; // per lane: the platform being extended (ref into `platforms`)
  hazSpacer: number[];
  pickSpacer: number[];
  pickPending: number[]; // per lane: tiles until a "guarded" pickup drops (0 = none)
  ghostSpacer: number[];
  playerLane: number; // mirrored from the player for adaptive spawning
}

// ── juice ──────────────────────────────────────────────────────────────────────
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: boolean;
}

export interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
}

export interface TrailSample {
  x: number;
  y: number;
  wet: boolean;
}

export type Phase = 'running' | 'dead' | 'won';

export interface GameState {
  phase: Phase;
  time: number;
  speed: number;
  peakSpeed: number;
  speedBoost: number;
  slowTimer: number;
  distance: number;
  camX: number;
  player: Player;
  world: World;
  projectiles: Projectile[];
  particles: Particle[];
  floats: FloatText[];
  trail: TrailSample[];
  trailTimer: number;
  shake: number;
  boostFlash: number;
  viewW: number;
  viewH: number;
}
