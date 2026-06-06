/**
 * config.ts — ALL feel-critical tuning constants for SCEND.
 *
 * THE GAME: you auto-run right across THREE stacked floors (lanes), getting faster and
 * stronger forever. One button. Jump = climb to the floor above; run off a hole = drop to
 * the floor below; do neither = run straight (safe, but no reward). The good stuff —
 * pickups, killable monsters — lives on the floors you're NOT on, and clusters near
 * obstacles. So every reward is a deliberate risk: leave your safe lane to grab it.
 *
 * Edit a number, save, refresh — that's the whole feel loop.
 */

// ── World grid + the three floors ─────────────────────────────────────────────
export const TILE = 44;
export const GROUND_FRAC = 0.86; // the LOWEST lane sits this far down the viewport
export const FALL_DEATH_MARGIN = 110; // px below the viewport before a fall is fatal
/** The three floor heights, in tiles above the baseline. Spacing ≥ 2.5 so floors read as
 *  clearly distinct (no "is that 1 tile or 2?" ambiguity) and a single jump climbs exactly
 *  one floor. */
export const LANE_H = [0, 2.6, 5.2];

export const PLAYER_ANCHOR_X = 0.3;
export const PLAYER_W = 28;
export const PLAYER_H = 36;

// ── Landing leeway (forgiveness so clipping an edge still catches you) ─────────
export const LAND_LEEWAY_X = 12; // px of horizontal overhang that still counts as "on it"
export const LAND_LEEWAY_Y = 8; // px the feet may be past the surface and still snap up

// ── Floor / gap generation ─────────────────────────────────────────────────────
export const START_RUN = 14; // hazard-free lead-in (columns, all lanes solid)
export const PLAT_LEN_MIN = 5; // platform run length (columns) per lane
export const PLAT_LEN_MAX = 12;
export const GAP_LEN_MIN = 1; // holes are short — they're "drop here", not big leaps
export const GAP_LEN_MAX = 2;
export const GAP_PROB = 0.45; // chance a lane opens a hole when its platform run ends
// Invariant enforced in world.ts: at most ONE lane may be a hole at any column, so from any
// floor there is always an adjacent solid floor to jump up to or drop down to.

// ── Hazards (tile-based, on platform interiors) ───────────────────────────────
export const HAZARD_CHANCE_START = 0.08;
export const HAZARD_CHANCE_END = 0.26;
export const HAZARD_WEIGHTS = { spike: 3, lava: 2, water: 3, geyser: 1.5 } as const;
export const HAZARD_SPACER = 3; // min solid tiles between hazards on a lane

// ── Pickups — adaptive: rare on YOUR floor, common on the others & near obstacles ──
export const PICKUP_BASE = 0.1; // base per-tile pickup chance on a lane
export const PLAYER_LANE_GOOD_MULT = 0.2; // ×chance on the floor the player is currently on
export const OBSTACLE_REWARD_CHANCE = 0.7; // chance a hazard is "guarding" a nearby pickup
export const PICKUP_AFTER_OBSTACLE = 2; // tiles after an obstacle the guarded pickup sits
export const PICKUP_SPACER = 3;
export const PICKUP_WEIGHTS = { boots: 2, knife: 1, horns: 1 } as const;

// ── Geyser (now JUMPABLE — clear the steam with a normal hop) ──────────────────
export const GEYSER_PERIOD = 2.0;
export const GEYSER_ERUPT = 0.85;
export const GEYSER_HEIGHT = 1.9; // tiles of steam — low enough to jump over

// ── Ghosts — bullet hell, but STOMPABLE (body contact kills + boosts) ─────────
export const GHOST_CHANCE_START = 0.18; // per-eligible-tile chance to anchor a ghost
export const GHOST_CHANCE_END = 0.42;
export const GHOST_SPACER = 5;
export const GHOST_FLOAT = 1.3; // tiles above its lane surface
export const GHOST_PATROL = 1.8;
export const GHOST_SPEED = 80;
export const GHOST_FIRE_START = 1.9;
export const GHOST_FIRE_END = 0.75;
export const GHOST_KILL_BOOST = 60; // permanent +px/s for stomping a ghost
export const BOO_SPEED = 230;
export const BOO_SPEED_RAMP = 160;
export const BOO_SPREAD = 28;
export const BOO_COUNT_MAX = 3;

// ── Knife ─────────────────────────────────────────────────────────────────────
export const KNIFE_SPEED = 760;
export const KNIFE_RANGE = 540;

// ── Speed: PERMANENT stacking boost × a steeper time ramp (FASTER overall) ─────
export const BASE_SPEED = 360; // ↑ was 280 — quicker out of the gate
export const RAMP_FULL_AT = 540;
export const RAMP_GAIN = 2.2; // ↑ was 1.4 — you accelerate harder over the run
export const MIN_SPEED = 220;

export const LAVA_BOOST = 90;
export const BOOTS_BOOST = 70;
export const BOOST_PER_CHEVRON = 80;

export const WATER_SLOW_FACTOR = 0.6;
export const WATER_SLOW_TIME = 0.45;
export const WET_DURATION = 3.5;

// ── Jump (single fixed impulse; rises ~1 floor + clears a geyser) ─────────────
export const GRAVITY = 3000;
export const JUMP_V = 1010; // rise ≈ 170px ≈ 3.8 tiles — clears one floor (2.6) comfortably
export const COYOTE = 0.11;
export const JUMP_BUFFER = 0.12;

export const WIN_TIME = 600;
export const MAX_DT = 1 / 20;

// ── Juice ─────────────────────────────────────────────────────────────────────
export const TRAIL_LEN = 14;
export const TRAIL_STEP = 1 / 90;
export const SHAKE_BOOST = 9;
export const SHAKE_DEATH = 18;
export const SHAKE_DECAY = 38;
export const SPEEDLINE_MIN_SPEED = 420;
export const SPEEDLINE_MAX = 28;

// ── Palette ──────────────────────────────────────────────────────────────────
export const PALETTE = {
  bg0: '#050410',
  bg1: '#0a0622',
  bgFar: '#150a3a',
  bgNear: '#241057',
  grid: '#2a1566',
  ground: '#160f33',
  laneEdge: ['#00f0ff', '#39d0ff', '#7da8ff'], // per-floor neon top edge (low→high)
  player: '#00f6ff',
  playerWet: '#56b3ff',
  spike: '#ff1f6b',
  lava: '#ff6a1a',
  water: '#19d2ff',
  geyser: '#ddf7ff',
  ghost: '#c190ff',
  boo: '#ff3df0',
  knife: '#fff95e',
  boost: '#5dff9b',
  horns: '#ff9b3d',
  text: '#eef0ff',
  textDim: '#7d77b8',
  win: '#5dff9b',
  dead: '#ff1f6b'
} as const;
