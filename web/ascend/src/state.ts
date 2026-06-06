/**
 * state.ts — the type hub + game-state shape. Plain data, no behaviour.
 * (Behaviour lives in sim.ts; levels in levels.ts.)
 *
 * Coords: world space, +Y DOWN (canvas style). The wall is a tall column WORLD_WIDTH
 * wide; the finish is near the top (small y). The camera scrolls vertically.
 */

export type LimbName = 'LH' | 'RH' | 'LF' | 'RF';
export type LimbType = 'hand' | 'foot';

export interface Hold {
  x: number;
  y: number;
  ang: number; // good-side direction (points toward the side you should pull from)
}

export interface Limb {
  name: LimbName;
  type: LimbType;
  x: number;
  y: number;
  hold: Hold | null; // the hold this limb is gripping (null = dangling)
  stam: number; // hand stamina (feet never tire); 0..HAND_STAM_MAX
  load: number; // share of bodyweight currently borne (0..1), set each tick
}

export interface Climber {
  body: { x: number; y: number };
  lean: { x: number; y: number };
  limbs: Limb[]; // [LH, RH, LF, RF]
}

/** An in-progress aim (drag). The real limb does NOT move until release commits it. */
export interface Drag {
  kind: 'limb' | 'body';
  limb?: Limb;
  aimX: number;
  aimY: number;
  aimHold: Hold | null;
}

export type Phase = 'climbing' | 'fallen' | 'won';

/** A designed level. Hold x in [0, WORLD_WIDTH]; y grows downward; finishY is near the
 *  top (small y). `start` indexes into `holds` for each limb's opening grip. */
export interface Level {
  name: string;
  holds: { x: number; y: number; ang: number }[];
  start: Record<LimbName, number>;
  finishY: number;
  /** World height (for camera clamp / backdrop). Bottom of the wall is y = height. */
  height: number;
}

export interface GameState {
  phase: Phase;
  holds: Hold[];
  climber: Climber;
  drag: Drag | null;

  fallTimer: number; // seconds since a fall (drives auto-reset)
  cameraY: number;

  levelIndex: number;
  /** The active level object — held so a fall resets THIS level (incl. a generated
   *  spray wall, which isn't in the static LEVELS array). */
  level: Level;
  finishY: number;
  worldHeight: number;

  // bookkeeping / "rewarding" stats
  elapsed: number;
  moves: number; // committed limb placements
  winTime: number; // elapsed at the moment of topping out
  winMoves: number;

  viewW: number;
  viewH: number;
}
