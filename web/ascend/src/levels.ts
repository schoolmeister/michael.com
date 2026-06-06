/**
 * levels.ts — three SCATTERED spray-wall levels for Prototype #3, easy → hard.
 *
 * The old paired-ladder levels were repetitive/boring. These scatter many holds at
 * (seeded) random positions and angles, so the wall is dense and the *good* path — the
 * sequence that keeps your CoG stable and your hands on well-angled holds — is non-obvious.
 * Reading the wall and committing to a line IS the challenge.
 *
 * Determinism: a seeded PRNG generates each level the SAME way every load, so the layout
 * is reproducible AND verifiable. The greedy solver in sim-check.ts confirms each is
 * topple-out-able (a fair, straightforward solution exists and the climber survives).
 *
 * Coords: world space, +Y DOWN. x ∈ [0, WORLD_WIDTH(460)]; finish near the top (small y).
 * `ang` (good-side, radians, +y down) only matters for NON-start holds (loadLevel re-angles
 * the start quad). DOWN (≈+PI/2) = pull straight down (restful from below); lateral = fights you.
 */

import { HOLD_R, WORLD_WIDTH } from './config';
import { greedySolvable } from './solver';
import type { Level } from './state';

const DOWN = Math.PI / 2;
/** Minimum centre-to-centre distance between holds so grab points never overlap/ambiguate. */
const MIN_HOLD_SEP = HOLD_R * 2.6; // ~34px

type H = { x: number; y: number; ang: number };

// deterministic PRNG so a given seed always yields the same (verified) layout
function rng(seed: number): (a: number, b: number) => number {
  let s = seed >>> 0;
  return (a, b) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return a + (s / 0xffffffff) * (b - a);
  };
}

export interface Cfg {
  seed: number;
  bottom: number;
  topY: number;
  rowStep: number;
  jitterY: number;
  perRow: [number, number];
  margin: number;
  badChance: number; // fraction of holds that are "fight-you" angled
  maxBad: number; // max lateral angle offset (radians) for a bad hold
  /** Truly uniform-random good-sides (0..2π) — some holds will be awkward/hostile, not all
   *  nice. Used by the Spray Wall. (Designed levels use the badChance scheme for a curve.) */
  randomAngle?: boolean;
}

export function scatter(name: string, cfg: Cfg): Level {
  const r = rng(cfg.seed);
  const holds: H[] = [];
  // A deterministic, stable START QUAD at the bottom (hands above feet, narrow base).
  const lx = 200, rx = 260;
  holds.push({ x: lx, y: cfg.bottom, ang: DOWN }); // 0 LF
  holds.push({ x: rx, y: cfg.bottom, ang: DOWN }); // 1 RF
  holds.push({ x: lx, y: cfg.bottom - 70, ang: DOWN }); // 2 LH
  holds.push({ x: rx, y: cfg.bottom - 70, ang: DOWN }); // 3 RH

  // Scattered field above: rows of randomly-placed holds with random good-sides. Density
  // keeps it reachable (≥3 holds spread per row, rows < reach apart); the randomness +
  // bad angles make the safe, low-drain line hard to spot among the decoys.
  let y = cfg.bottom - 70 - cfg.rowStep;
  while (y >= cfg.topY) {
    const n = Math.round(r(cfg.perRow[0], cfg.perRow[1]));
    for (let i = 0; i < n; i++) {
      // pick an x that doesn't overlap an existing hold (rejection sampling); skip if we
      // can't find room after a few tries — holds must never sit on top of each other.
      let x = 0;
      let placed = false;
      for (let tries = 0; tries < 14 && !placed; tries++) {
        x = r(cfg.margin, WORLD_WIDTH - cfg.margin);
        placed = holds.every((h) => Math.hypot(h.x - x, h.y - y) >= MIN_HOLD_SEP);
      }
      if (!placed) continue;
      let ang: number;
      if (cfg.randomAngle) {
        ang = r(0, Math.PI * 2); // truly random — some holds will be hostile, by design
      } else if (r(0, 1) < cfg.badChance) {
        const sgn = r(0, 1) < 0.5 ? -1 : 1;
        ang = DOWN + sgn * r(0.55, cfg.maxBad); // a hold that fights a centred CoG
      } else {
        ang = DOWN + r(-0.25, 0.25); // roughly restful
      }
      holds.push({ x, y, ang });
    }
    y -= cfg.rowStep + r(-cfg.jitterY, cfg.jitterY);
  }

  return {
    name,
    holds,
    start: { LF: 0, RF: 1, LH: 2, RH: 3 },
    finishY: cfg.topY + 55,
    height: cfg.bottom + 80,
  };
}

// ── The three levels ─────────────────────────────────────────────────────────
// EASY "Scramble"   — dense, mostly-good holds: plenty of safe options, gentle reads.
// MEDIUM "Tangle"   — fewer per row, more lateral bad-angled holds: the line weaves.
// HARD "The Maze"   — sparse + wide + lots of fight-you angles: the safe path hides.
// Seeds chosen (via a seed search) so the greedy solver tops each out AND the difficulty
// is monotonic by stamina margin: Scramble (easy, lots of slack) → Tangle → The Maze
// (hard, tight). The greedy doesn't lean or avoid bad holds, so a human who reads angles
// and shifts weight will have more margin than these numbers — the RELATIVE curve holds.
export const LEVELS: Level[] = [
  scatter('Scramble', { seed: 1, bottom: 1180, topY: 150, rowStep: 56, jitterY: 8, perRow: [4, 6], margin: 70, badChance: 0.08, maxBad: 0.7 }),
  scatter('Tangle', { seed: 9, bottom: 1180, topY: 150, rowStep: 58, jitterY: 10, perRow: [4, 6], margin: 56, badChance: 0.22, maxBad: 0.95 }),
  scatter('The Maze', { seed: 55, bottom: 1180, topY: 150, rowStep: 60, jitterY: 12, perRow: [4, 6], margin: 44, badChance: 0.4, maxBad: 1.1 }),
];

/**
 * LEVEL 4 — "Spray Wall": a FRESHLY-random wall every time you pick it (the replayable
 * mode the designer liked). Same scatter generator with a random seed, then VERIFIED
 * solvable before it's handed over (regenerate until the greedy climber tops it out), so
 * it always has a real route to the summit. Non-overlapping holds (rejection sampling above).
 */
export function makeSprayWall(): Level {
  for (let tries = 0; tries < 300; tries++) {
    const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    const lvl = scatter('Spray Wall', {
      seed,
      bottom: 1180, topY: 150, rowStep: 60, jitterY: 14, perRow: [4, 6], margin: 50,
      badChance: 0, maxBad: 0, randomAngle: true, // truly random good-sides
    });
    if (greedySolvable(lvl)) return lvl;
  }
  return LEVELS[1]; // fallback (should never hit at this density)
}
