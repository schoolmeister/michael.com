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

// ── World grid + INFINITE floors (lanes) ──────────────────────────────────────
export const TILE = 44;
export const FALL_DEATH_MARGIN = 120; // px below the view before a fall is fatal
/** Floors are now INFINITE: any integer lane. Lane n's surface world-y = -n * LANE_GAP
 *  (higher lane index = higher up). Spacing ≥ 2.5 tiles so a single jump climbs exactly one
 *  floor and floors read as clearly distinct. */
export const LANE_SPACING = 2.6; // tiles between adjacent floors
export const LANE_GAP = LANE_SPACING * TILE; // px between adjacent floors

/** Vertical camera — DEAD-ZONE + ASYMMETRIC DAMPING (anti-nausea). The camera holds still on
 *  Y while the player stays inside the central dead band; it only pans when the player pushes
 *  past the top/bottom thresholds, and even then it eases (slow up, snappier down).
 *  VERT_ANCHOR is just where the start floor sits initially. */
// The game climbs UP/sideways, so the player sits near the BOTTOM — most of the screen is
// above them, showing the higher floors they're heading for. The camera holds still while the
// player stays in the central dead band; outside it, it eases back to the bottom anchor.
export const VERT_ANCHOR = 0.72; // player's resting screen fraction (near the bottom)
export const CAM_DEAD_TOP = 0.4; // rise above this → camera pans up to re-anchor
export const CAM_DEAD_BOT = 0.88; // drop below this → camera pans down
export const CAM_UP_LERP = 5; // upward follow (climbing is the main direction now)
export const CAM_DOWN_LERP = 9; // snappy downward catch-up

export const PLAYER_ANCHOR_X = 0.3;
export const PLAYER_W = 28;
export const PLAYER_H = 36;

// ── Landing leeway (forgiveness so clipping an edge still catches you) ─────────
export const LAND_LEEWAY_X = 12; // px of horizontal overhang that still counts as "on it"
export const LAND_LEEWAY_Y = 8; // px the feet may be past the surface and still snap up

// ── Path generation (infinite-lane random walk; most knobs live in tunables.ts) ──
export const START_RUN = 12; // hazard-free lead-in (columns on the start floor)
export const GAP_LEN_MIN = 1; // floor on gap width (shallow drops need a narrow gap to be fair)
export const GAP_LEN_MAX = 13; // clamp so the next platform stays on-screen at high speed
export const MAX_DROP_LANES = 3; // path never drops more than this at once (fall-death bound)
export const SPIKE_CLUSTER_MAX = 6; // hard cap on adjacent-spike run length

/** DIFFICULTY rises with SPEED (not time). difficulty = clamp((speed-base)/RANGE, 0, 1).
 *  At 0 the world is timid (long platforms, mostly flat, few hazards, no parallel floors);
 *  at 1 it's the full chaos. Everything below interpolates START→END by this factor. */
export const DIFFICULTY_RANGE = 1100; // px/s above base speed to reach full difficulty
// difficulty 0 is a NORMAL challenging game (already engaging) — escalation piles on intensity.
export const TIMID_LEN_MULT = 1.25; // ×platform length at difficulty 0 (only slightly longer)
export const CLIMB_CHANCE_START = 0.4; // real vertical decisions from the very start
export const CLIMB_CHANCE_END = 0.6;
export const MULTI_FLOOR_START_FRAC = 0.5; // fraction of full multi-floor density at difficulty 0
/** Falling more than this far below the floor you last stood on (with nothing to land on) is
 *  fatal. Bigger than a legit MAX_DROP_LANES drop so only true voids kill. */
export const FALL_DEATH_DROP = (MAX_DROP_LANES + 1.3) * LANE_GAP;
export const GOD_SPEED_STEP = 60; // px/s per O/P press in god mode

/** Camera zooms OUT as you speed up, so you can read what's coming at high speed. */

/** Camera zooms OUT as you speed up, so you can read what's coming at high speed. */
export const ZOOM_MIN = 0.62; // most zoomed-out (fastest)
export const ZOOM_START_SPEED = 420; // zoom begins pulling back above this speed
export const ZOOM_FULL_SPEED = 1150; // fully zoomed out at/above this speed
export const ZOOM_PIVOT_FRAC = 0.7; // zoom pivots near the player (bottom) — reveals more above

// ── Hazards (tile-based, on platform interiors) ───────────────────────────────
export const HAZARD_CHANCE_START = 0.2; // hazards from the start; escalates with speed
export const HAZARD_CHANCE_END = 0.45;
export const HAZARD_WEIGHTS = { spike: 3, lava: 2, geyser: 1.5 } as const;
export const HAZARD_SPACER = 3; // min solid tiles between hazards on a lane

/** Monster tiers unlock by SPEED, not time — the faster you get, the deadlier the world.
 *  Tier 1 (start): only spikes + water (water is the harmless boost-setup). Tier 2: lava +
 *  geysers join. Tier 3: ghosts (the bullet hell) appear. */
export const GEYSER_UNLOCK_SPEED = 480; // lava + geysers turn on at/above this speed
export const GHOST_UNLOCK_SPEED = 660; // ghosts turn on at/above this speed

// ── Pickups — speed (>>) buffs drop ~1.5× more often (but each is weaker, see bootsBoost) ──
export const PICKUP_BASE = 0.12; // base per-tile pickup chance on a lane (↑ ~1.5×)
export const PLAYER_LANE_GOOD_MULT = 0.25; // ×chance on the floor the player is currently on
export const OBSTACLE_REWARD_CHANCE = 0.3; // chance a hazard is "guarding" a nearby pickup
export const PICKUP_AFTER_OBSTACLE = 2; // tiles after an obstacle the guarded pickup sits
export const PICKUP_SPACER = 4; // ↓ pickups come ~1.5× more often
export const PICKUP_VIS_FLOAT = 0.5; // tiles above the floor a pickup hovers (grabbed at run height)
/** Early pool is just boots (>> speed). knife joins once geysers unlock; the "new" boosts
 *  (kick/stomp) only join later, once ghosts unlock. (Magnet is now a permanent default.) */
export const PICKUP_WEIGHTS_BASE = { boots: 1.3 } as const;
export const PICKUP_KNIFE_WEIGHT = 0.8; // added once speed ≥ GEYSER_UNLOCK_SPEED
export const PICKUP_LATE_WEIGHTS = { boot: 0.7, stomp: 0.7 } as const; // added once ghosts unlock

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
export const GHOST_BOUNCE_V = 720; // upward bounce off a ghost — LESS than a full jump (JUMP_V)
export const BOO_SPEED = 230;
export const BOO_SPEED_RAMP = 160;
export const BOO_SPREAD = 28;
export const BOO_COUNT_MAX = 3;

// ── Knife (held weapon: auto-throws on a timer, kills the obstacle in front) ───
export const KNIFE_SPEED = 820;
export const KNIFE_RANGE = 680;
export const KNIFE_PERIOD = 3; // seconds between auto-throws

// ── New enemies ────────────────────────────────────────────────────────────────
export const HOBGOBLIN_UNLOCK_SPEED = 520; // big 2×2 walker — evade by switching floors
export const HOBGOBLIN_SPEED = 55; // px/s patrol
export const HOBGOBLIN_CHANCE = 0.16; // per eligible wide platform
export const BOULDER_UNLOCK_SPEED = 600; // rolls right→left at you
export const BOULDER_SPEED = 320; // px/s leftward roll (relative to world)
export const BOULDER_PERIOD = 3.2; // s between boulder spawns (once unlocked)

// ── Kick (BOOT pickup) + STOMP ─────────────────────────────────────────────────
export const KICK_VX = 520; // forward velocity given to a kicked enemy
export const KICK_VY = -260; // slight upward pop on a kick
export const KICK_CHAIN_R = 0.7; // tiles: a flying kicked enemy knocks others within this
export const STOMP_RADIUS = 2; // tiles: on landing, obstacles within this get launched
export const STOMP_LAUNCH_V = -640; // upward velocity given to stomped enemies

// ── Magnet dive (mid-air Space) + the DIVE-SLIDE on landing ───────────────────
export const MAGNET_DIVE_V = 1500;
/** Landing FROM A DIVE triggers a slide: a brief invincible ground-dash that smashes every
 *  enemy/obstacle in its path (each kill = a speed boost). */
export const SLIDE_TIME = 0.45; // seconds the dive-slide lasts

// ── Kill = FUEL: destroying an enemy/obstacle boosts speed, but the boost TAPERS as you
//    get faster (early kills launch you; late kills barely nudge — you're already flying). ──
export const KILL_BOOST_MAX = 55; // boost from a kill at base speed
export const KILL_TAPER_RANGE = 1300; // px/s above base over which the boost fades to its min
export const KILL_BOOST_MIN_FRAC = 0.12; // floor (kills always give a little)

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

// ── Palette — dark, bloody RED. The background DEPTH-shades: deeper down = darker,
//    higher up = lighter (see BG_DEEP → BG_HIGH, blended by the player's floor). ──────
export const BG_DEEP = [10, 2, 4] as const; // RGB at deep depth (near-black blood)
export const BG_HIGH = [92, 16, 24] as const; // RGB high up (lighter blood red)
export const BG_LANE_RANGE = 14; // lanes from deepest→lightest across the gradient

export const PALETTE = {
  grid: '#3a0c14', // dark-red floor guide lines
  ground: '#1c0a10', // fallback slab fill (when a tile image isn't loaded)
  bgFar: '#2a060c', // far parallax silhouettes
  bgNear: '#48101c', // near parallax silhouettes
  laneEdge: ['#ff5a4a', '#ff8a5a', '#ffb27a'], // floor top-edge accents (cycled by lane)
  player: '#00f6ff', // cyan — pops against the red
  playerWet: '#56b3ff',
  spike: '#ff2d4a',
  lava: '#ff6a1a',
  water: '#19d2ff',
  geyser: '#ffe4d0',
  ghost: '#c190ff',
  boo: '#ff3df0',
  knife: '#fff95e',
  boost: '#5dff9b',
  horns: '#ff9b3d',
  magnet: '#8ad8ff',
  hobgoblin: '#7bd24a', // sickly green ogre
  boulder: '#b08050', // rolling stone
  boot: '#ff7b3d', // kick charge
  stomp: '#ffd23d', // stomp charge
  text: '#ffe9ec',
  textDim: '#b0707a',
  win: '#5dff9b',
  dead: '#ff2d4a'
} as const;
