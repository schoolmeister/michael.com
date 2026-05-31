/**
 * state.ts — the game state model. Plain data, no behaviour.
 *
 * World coords: +Y is UP (height climbed), +X is right. Floor y=0, summit y=WALL_HEIGHT.
 * The wall is a PERSISTENT field of holds. The climber occupies one hold, reaches to
 * nearby ones (HOLD-CLICK, no drag), and trails a rope down to its last placed anchor.
 */

import { LIGHT_MAX, STAMINA_MAX, type HoldType } from './config';

export type Phase =
  | 'choosing' // secured on a hold, resting; may reach to a hold OR place an anchor
  | 'reaching' // holding through a reach — the climb animation plays
  | 'anchoring' // holding on a horn, aiming the sling's seating angle
  | 'falling' // a slip is animating: dropping until the rope catches (or rips)
  | 'won'
  | 'lost';

export interface Hold {
  id: number;
  x: number;
  y: number;
  type: HoldType;
  row: number;
  gripMult: number;
  width: number;
  /** Does this hold have a slingable horn for protection? (set in holds.ts) */
  hasHorn: boolean;
  /** Horn anchor point (world px) — offset slightly from the hold centre. */
  hornX: number;
  hornY: number;
  /** Safe-cone CENTRE direction at this horn (radians, world: 0=+x, PI/2=+y up).
   *  The sling seats securely when aimed within HORN_CONE_HALF_WIDTH of this. */
  hornConeCenter: number;
}

/** Placed protection. Anchors are ordered low→high in GameState.anchors. */
export interface Anchor {
  id: number;
  x: number;
  y: number;
  holdId: number;
  quality: number; // 0..1 seating security at placement time (from anchor.ts)
}

/** Raw pointer state. input.ts writes it; the sim reads it. */
export interface Pointer {
  down: boolean;
  x: number; // canvas/screen px
  y: number;
  startX: number; // where the current press began (screen px)
  startY: number;
}

export interface GameState {
  phase: Phase;

  light: number;
  stamina: number;

  // The persistent wall.
  holds: Hold[];
  summitHoldId: number;

  // Climber.
  currentHoldId: number;
  climberX: number; // world pos (animates during reach/fall)
  climberY: number;
  facing: 1 | -1; // -1 faces left (sprite default), 1 faces right

  // Reach options (recomputed each 'choosing').
  reachable: Hold[];
  /** Reachable hold the cursor is hovering (highlight), or null. */
  hoverHoldId: number | null;
  /** True when the cursor is over the current hold's placeable horn (highlight). */
  hoverHorn: boolean;

  // Active reach (phase === 'reaching').
  committedId: number | null;
  resolveProgress: number; // 0..1
  moveStartX: number;
  moveStartY: number;

  // Rope & anchors.
  anchors: Anchor[]; // placed protection, ordered low→high
  ropeAnchorId: number | null; // anchor the rope runs to; null = ground belay (y=0)

  // Anchor placement (phase === 'anchoring').
  placingHoldId: number | null; // the horn being seated
  seatAngle: number; // current aim (radians, world) set by the pointer

  // Fall (phase === 'falling').
  fallFromY: number; // height the slip began
  fallToY: number; // height the rope/ground will arrest at
  fallProgress: number; // 0..1 down the fall
  fallRipped: boolean; // did an anchor rip during this fall (for feedback)

  // Gate: must RELEASE before a new move/placement (no auto-repeat).
  armed: boolean;

  // Feedback
  abortFlash: number; // seconds left on the slip flash
  slipKick: number; // seconds left on the downward camera jolt
  strain: number; // 0..1 visual strain during a hard reach

  // Camera.
  cameraY: number;

  // Bookkeeping
  elapsed: number;
  moves: number;
  nextHoldId: number;
  nextAnchorId: number;

  viewW: number;
  viewH: number;
}

export const lightFraction = (s: GameState) => s.light / LIGHT_MAX;
export const staminaFraction = (s: GameState) => s.stamina / STAMINA_MAX;
export const holdById = (s: GameState, id: number | null): Hold | undefined =>
  id == null ? undefined : s.holds.find((h) => h.id === id);
export const anchorById = (s: GameState, id: number | null): Anchor | undefined =>
  id == null ? undefined : s.anchors.find((a) => a.id === id);

/** World Y the rope currently runs down to (last anchor, or ground). */
export function ropeBaseY(s: GameState): number {
  const a = anchorById(s, s.ropeAnchorId);
  return a ? a.y : 0;
}
export function ropeBaseX(s: GameState): number {
  const a = anchorById(s, s.ropeAnchorId);
  return a ? a.x : s.climberX;
}
