/**
 * state.ts — the type hub for SCEND. Plain data only; behaviour lives in sim.ts / world.ts.
 * Horizontal is world-space px (camera scrolls right). Vertical is also WORLD space now
 * (+Y down): lane n's surface world-y = -n * LANE_GAP. A vertical follow-camera (camY) maps
 * world-y → screen. Floors are INFINITE — `lane` is any integer.
 *
 * The world is a guaranteed-reachable PATH that random-walks up/down across lanes, with sparse
 * branch platforms. Ghosts, geysers and pickups are positioned by (x, lane).
 */

export type TileKind = 'solid' | 'spike' | 'lava';

/** A run of tiles on one lane. col0..col1 inclusive; surface world-y = -lane * LANE_GAP. */
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

export type EnemyKind = 'ghost' | 'hobgoblin' | 'boulder';

/** Unified enemy. All kinds are kickable (Boot) / stompable (Stomp): a `kicked` enemy flies
 *  with (vx,vy) under gravity, is harmless to the player, and knocks other enemies (bowling). */
export interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number; // world-y of its centre (free-flies when kicked; else its lane centre)
  lane: number;
  anchorX: number;
  dir: 1 | -1; // patrol direction (ghost/hobgoblin)
  fire: number; // ghost bullet timer
  vx: number; // when kicked (and the boulder's leftward roll)
  vy: number; // when kicked/stomped (flung up, then gravity)
  kicked: boolean; // flying away after a kick/stomp — no longer a threat
  dead: boolean;
}

export type PickupKind = 'knife' | 'boots' | 'magnet' | 'boot' | 'stomp';

export interface Pickup {
  x: number;
  lane: number;
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
  y: number; // WORLD y (+down). screen-y = y - camY.
  vy: number;
  onGround: boolean;
  lane: number; // floor the player is currently ON (any integer; drives the camera + gen)
  coyote: number;
  buffer: number;
  invulnUntil: number; // game-time until which a speed boost makes you ram through hazards
  lastGroundY: number; // world-y of the surface last stood on (for the fall-death check)
  knife: boolean; // held knife weapon (auto-throws every KNIFE_PERIOD)
  knifeTimer: number; // seconds until the next auto-throw
  magnet: boolean; // magnet boots: mid-air Space dives straight down
  diving: boolean; // currently mid-dive (set by a mid-air Space) → triggers a slide on landing
  slideUntil: number; // game-time the dive-slide (invincible smashing dash) ends
  boot: boolean; // kick charge: next enemy hit is kicked away (bowling chain)
  stomp: boolean; // stomp charge: next landing launches nearby obstacles up
}

/** Generation cursor for the infinite-lane PATH walk (kept on the World so it's resumable). */
export interface World {
  seed: number;
  platforms: Platform[]; // includes the currently-open path platform (mutated as it extends)
  geysers: Geyser[];
  enemies: Enemy[];
  pickups: Pickup[];
  nextCol: number; // next column to generate from
  minCol: number; // oldest column still kept (for pruning bookkeeping)
  pathLane: number; // current lane of the guaranteed path
  patternLeft: number; // segments remaining in the current special pattern (0 = normal)
  pattern: 'none' | 'stair'; // active pattern mode (stair = a run of climbs)
  incomingLand: number; // tiles INTO the next platform the player will land (sizes its length)
  hazSpacer: number; // columns until a hazard may be placed again
  ghostSpacer: number; // columns until a ghost may spawn again
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
  frame: number;
}

export type Phase = 'select' | 'running' | 'dead' | 'won';

export interface GameState {
  phase: Phase;
  time: number;
  speed: number;
  peakSpeed: number;
  speedBoost: number;
  distance: number;
  camX: number;
  camY: number; // vertical follow-camera (world-y at the top of the view)
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
  charId: number;      // 0 = Fleshman, 1 = Cube
  selectIndex: number; // cursor on character select screen
  animFrame: number;   // current sprite frame (0–24)
  animTimer: number;   // accumulates dt; ticks animFrame at ANIM_FPS
  zoom: number;        // camera zoom (1 = normal, <1 = pulled back at high speed)
  configOpen: boolean; // config menu open on the select screen
  configIndex: number; // selected config field
  inspectorOpen: boolean; // tileset coordinate inspector (dev tool) open
  inspMouseX: number; // cursor x in the inspector (screen px)
  inspMouseY: number;
  inspPicks: string[]; // recently click-logged tile rects
  godMode: boolean; // invincible + manual speed via O/P (debug)
  godSpeed: number; // the speed god mode holds you at
  boulderTimer: number; // seconds until the next boulder rolls in
}
