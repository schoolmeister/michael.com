/**
 * config.ts — ALL feel-critical tuning constants live here.
 *
 * Prototype #2 iteration. Changes from #1:
 *   - Input is now HOLD-CLICK directly on a hold (the drag is gone).
 *   - New skill verb: ROPE & ANCHOR. You sling protection around a rock horn; the
 *     seating angle must be right or it rips and you take a longer fall.
 *   - Reaches play as a visceral climbing animation; the old aim line is gone.
 *
 * TUNING ORDER: CLIMB_RESOLVE_DURATION first (the held breath), then the squeeze
 * (light vs stamina), then the anchor risk/reward (place cost vs fall danger).
 */

export type Mode = 'feel' | 'dread';
export const MODE = 'dread' as Mode;

// ───────────────────────────────────────────────────────────────────────────
//  THE SINGLE MOST IMPORTANT NUMBER — the held-breath length of a reach.
// ───────────────────────────────────────────────────────────────────────────
export const CLIMB_RESOLVE_DURATION = 1.7;
export const CLIMB_EASE_POWER = 2.1;

// ───────────────────────────────────────────────────────────────────────────
//  LIGHT — the global doom clock (the lantern). Always draining.
// ───────────────────────────────────────────────────────────────────────────
export const LIGHT_MAX = 100;
export const LIGHT_DRAIN_RATE = MODE === 'feel' ? 0.8 : 1.55;
export const LIGHT_MOVE_BASE = 0.6;
export const LIGHT_PER_REACH_PX = 0.004;

// ───────────────────────────────────────────────────────────────────────────
//  STAMINA — local pressure. Pushes you to rest; resting costs light.
// ───────────────────────────────────────────────────────────────────────────
export const STAMINA_MAX = 100;
export const STAMINA_RECOVER_RATE = MODE === 'feel' ? 26 : 20;
export const STAMINA_MOVE_BASE = 5;
export const STAMINA_PER_REACH_PX = 0.075;

// ───────────────────────────────────────────────────────────────────────────
//  HOLD TYPES — grip quality. The thing darkness HIDES from you.
// ───────────────────────────────────────────────────────────────────────────
export type HoldType = 'jug' | 'ledge' | 'flake' | 'pocket';

export interface GripSpec {
  mult: number; // stamina cost multiplier
  width: number; // on-wall draw width (world px)
  sprite: HoldType;
  weight: number; // spawn weight
  /** Can a horn/corner be slung here for protection? Flakes/ledges yes, pockets no. */
  anchorable: boolean;
}

export const GRIPS: Record<HoldType, GripSpec> = {
  jug: { mult: 0.6, width: 82, sprite: 'jug', weight: 2, anchorable: true },
  ledge: { mult: 0.95, width: 74, sprite: 'ledge', weight: 3, anchorable: true },
  flake: { mult: 1.25, width: 66, sprite: 'flake', weight: 3, anchorable: true },
  pocket: { mult: 1.8, width: 46, sprite: 'pocket', weight: 2, anchorable: false }, // crimp: nothing to sling
};

/** Higher up the wall, grips turn nastier (more flake/pocket). */
export const HARD_GRIP_BIAS_AT_SUMMIT = 2.2;

// ───────────────────────────────────────────────────────────────────────────
//  INPUT — hold-click directly on a hold (NO drag).
// ───────────────────────────────────────────────────────────────────────────
/** Screen-px radius around a hold's centre that counts as "pressing that hold".
 *  Generous — commitment, not precision. */
export const HOLD_HIT_RADIUS = 46;
/** Screen-px radius around the current hold's HORN that starts anchor placement. */
export const HORN_HIT_RADIUS = 40;

// ───────────────────────────────────────────────────────────────────────────
//  ABORT / SLIP — releasing a reach early, or strength giving out mid-reach.
//  A slip is now a FALL (see below) — the rope may or may not catch it.
// ───────────────────────────────────────────────────────────────────────────
export const ABORT_STAMINA_PENALTY = MODE === 'feel' ? 6 : 10;
export const ABORT_LIGHT_PENALTY = MODE === 'feel' ? 2 : 3.5;
export const ABORT_FLASH_DURATION = 0.7;

// ───────────────────────────────────────────────────────────────────────────
//  REACH & ROUTE — the persistent wall (generated once).
// ───────────────────────────────────────────────────────────────────────────
export const REACH_MAX = 240; // physical reach radius (world px)
export const REACH_MIN_DY = 26; // a hold must be this far above to be a valid move
export const ROUTE_WIDTH = 480;
export const ROW_SPACING = 96;
export const ROW_JITTER_Y = 22;
export const HOLDS_PER_ROW_MIN = 2;
export const HOLDS_PER_ROW_MAX = 3;
export const WALL_HEIGHT = 2000;

// ───────────────────────────────────────────────────────────────────────────
//  ROPE & ANCHOR — the new skill verb. Sling protection on a horn; seat the
//  angle right or it rips. Anchors bound how far you fall.
// ───────────────────────────────────────────────────────────────────────────

/** Placing an anchor takes effort + time (light keeps draining while you seat it). */
export const ANCHOR_PLACE_STAMINA_COST = 8;
/** Placing pro burns real lantern — that's the squeeze the verb exists to create:
 *  do you spend precious light buying safety, or run it out and pray? */
export const ANCHOR_PLACE_LIGHT_COST = 6;

/** A horn's safe cone: the angular wedge (radians, half-width) within which the
 *  sling seats securely. Wider = more forgiving. The cone CENTRE is per-horn
 *  (generated), pointing into the load-bearing notch of the corner. */
export const HORN_CONE_HALF_WIDTH = 0.55; // ~31°

/** Seating quality (0..1, from anchor.ts) thresholds:
 *  >= SOLID  → bomber (green), holds any fall.
 *  >= MARGINAL → yellow, holds but may rip on a hard (long) fall.
 *  <  MARGINAL → red, rips on the first load. */
export const ANCHOR_SOLID_QUALITY = 0.62;
export const ANCHOR_MARGINAL_QUALITY = 0.3;

/** Probability a given anchorable hold actually sports a slingable horn. Keep
 *  below 1 so "is there pro here?" is a real routing question. */
export const HORN_SPAWN_PROBABILITY = 0.55;

/** Verlet rope (visual). Owned/used by render; here so feel lives in one place. */
export const ROPE_SEGMENTS = 14;
export const ROPE_GRAVITY = 900; // px/s^2 sag
export const ROPE_SLACK = 1.18; // rope length = straight-line dist * this
export const ROPE_ITERATIONS = 12;

// ───────────────────────────────────────────────────────────────────────────
//  FALLS — a slip drops you until the rope (last anchor) arrests you, or it rips.
// ───────────────────────────────────────────────────────────────────────────

/** Downward fall speed (world px/s) of the fall animation. */
export const FALL_SPEED = 1100;
/** Extra distance you fall BELOW the catching anchor (rope stretch/slack feel). */
export const FALL_SLACK = 46;
/** Stamina burned per world-px fallen when the rope catches you (a hard catch hurts). */
export const FALL_STAMINA_PER_PX = 0.06;
/** A marginal anchor rips if the fall above it exceeds this (world px). */
export const ANCHOR_RIP_FALL_DISTANCE = 150;
/** An UNPROTECTED fall (no anchor / ripped through all) of more than this many world
 *  px down to the ground = death. Below it you SURVIVE but take a brutal, graded
 *  battering (see FALL_GROUND_LIGHT_PENALTY) — so run-out is a rising dread, not a
 *  binary "safe → instant death" cliff. */
export const FALL_DEATH_HEIGHT = 560;
/** Light torn away by a survivable unprotected ground fall, scaled by fall height
 *  (per world px). A near-deck fall should cost a frightening chunk of lantern. */
export const FALL_GROUND_LIGHT_PENALTY = 0.07;

// ───────────────────────────────────────────────────────────────────────────
//  SIGHTLINE — darkness steals INFORMATION (now incl. horn safe-cones).
// ───────────────────────────────────────────────────────────────────────────
export const SIGHT_RADIUS_AT_FULL_LIGHT = 900;
export const SIGHT_RADIUS_AT_DARK = 165;
export const CLARITY_RADIUS_AT_FULL_LIGHT = 300;
export const CLARITY_RADIUS_AT_DARK = 88;
export const SIGHT_CALM_THRESHOLD = 0.62;

// ───────────────────────────────────────────────────────────────────────────
//  CAMERA / MISC
// ───────────────────────────────────────────────────────────────────────────
export const CLIMBER_SCREEN_ANCHOR = 0.62;
export const CAMERA_LERP = 5.5;
export const MAX_DT = 1 / 20;
