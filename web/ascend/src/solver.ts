/**
 * solver.ts — a competent auto-climber used to VERIFY a level is solvable. Unlike a naive
 * greedy, it models what a real player does so it can fairly judge walls with nasty,
 * awkwardly-angled holds:
 *   • ROUTE: among stable upward moves, it prefers putting hands on well-angled holds.
 *   • LEAN: after each move it shifts its weight to relieve the worst-angled hand.
 * If it tops out, a fair solution exists (route + balance) and the hands survive — so a
 * generated spray wall with weird holds is only accepted when it's genuinely beatable.
 *
 * Imports only from sim.ts → no import cycle with levels.ts.
 */

import { ANGLE_TOLERANCE, GOOD_MARGIN, HAND_STAM_MAX, LEAN_RANGE, LIMB_REACH } from './config';
import {
  anchoredWith,
  cog,
  cogOf,
  commitLimb,
  createGame,
  goodness,
  insideOf,
  insideSupport,
  limbPositionsWith,
  update,
} from './sim';
import type { GameState, Hold, Level, Limb } from './state';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Goodness of gripping `hold` if the CoG were at `p` (the live `goodness` uses the current
 *  CoG; this lets us score a previewed move). 1 = perfectly on the good side, 0 = terrible. */
function goodnessAt(hold: Hold, p: { x: number; y: number }): number {
  const dx = p.x - hold.x, dy = p.y - hold.y;
  const len = Math.hypot(dx, dy) || 1;
  const dot = (dx / len) * Math.cos(hold.ang) + (dy / len) * Math.sin(hold.ang);
  return Math.max(0, Math.min(1, (dot + ANGLE_TOLERANCE) / (1 + ANGLE_TOLERANCE)));
}

/** Balance to relieve the most-strained hand — but only when one actually needs it.
 *  Default to CENTRED (lean 0) for maximum mobility/reach; only lean if a gripping hand is
 *  below the comfort margin, and then pick the SMALLEST lean that best relieves it (a real
 *  climber doesn't contort their weight unless a hold demands it). */
function worstHandGoodness(s: GameState): number {
  let worst = 2;
  for (const L of s.climber.limbs) if (L.type === 'hand' && L.hold) worst = Math.min(worst, goodness(s, L));
  return worst;
}
function leanRelieve(s: GameState): void {
  s.climber.lean.x = 0;
  s.climber.lean.y = 0;
  if (worstHandGoodness(s) >= GOOD_MARGIN) return; // already comfortable → stay centred
  let bestX = 0, bestY = 0;
  let bestScore = worstHandGoodness(s); // centred baseline
  for (let lx = -LEAN_RANGE; lx <= LEAN_RANGE; lx += 14) {
    for (let ly = -LEAN_RANGE; ly <= LEAN_RANGE; ly += 14) {
      if (Math.hypot(lx, ly) > LEAN_RANGE) continue;
      s.climber.lean.x = lx;
      s.climber.lean.y = ly;
      if (!insideSupport(s, cog(s))) continue;
      // relieve the worst hand, but prefer the smallest lean (keep mobility)
      const score = worstHandGoodness(s) - 0.00004 * (lx * lx + ly * ly);
      if (score > bestScore) { bestScore = score; bestX = lx; bestY = ly; }
    }
  }
  s.climber.lean.x = bestX;
  s.climber.lean.y = bestY;
}

/** Best stable upward move for the lowest limb that has one (hands prefer good angles). */
function tryClimb(s: GameState): boolean {
  const limbs = [...s.climber.limbs].sort((a, b) => b.y - a.y); // lowest (largest y) first
  let best: { limb: Limb; hold: Hold; score: number } | null = null;
  const g = cog(s);
  for (const limb of limbs) {
    for (const h of s.holds) {
      if (dist(g, h) > LIMB_REACH) continue;
      if (h.y >= limb.y - 6) continue;
      if (s.climber.limbs.some((o) => o !== limb && o.hold === h)) continue;
      if (s.climber.limbs.some((o) => o !== limb && dist(o, h) < 22)) continue;
      const sup = anchoredWith(s, { limb, hold: h });
      const mass = limbPositionsWith(s, { limb, x: h.x, y: h.y });
      const pc = cogOf(mass, s.climber.lean, { x: s.climber.body.x, y: s.climber.body.y });
      if (sup.length < 3 || !insideOf(sup, pc)) continue;
      let score = limb.y - h.y; // height gained (dominant)
      // a hand prefers a hold it can pull on well from here (a tiebreaker, not overriding
      // progress) — combined with leanRelieve this avoids bleeding out on bad holds
      if (limb.type === 'hand') score += (goodnessAt(h, pc) - 0.5) * 70;
      if (!best || score > best.score) best = { limb, hold: h, score };
    }
    if (best) break;
  }
  if (!best) return false;
  commitLimb(s, best.limb, best.hold, best.hold.x, best.hold.y);
  leanRelieve(s); // balance to ease the worst hand before time passes
  for (let i = 0; i < 8; i++) update(s, 1 / 60); // let loads/fall settle
  return s.phase !== 'fallen';
}

export interface SolveResult {
  won: boolean;
  moves: number;
  minHandStam: number;
}

export function greedySolve(level: Level): SolveResult {
  const s = createGame(level, 0, 460, 680);
  let minHandStam = HAND_STAM_MAX;
  for (let step = 0; step < 300; step++) {
    if (s.phase === 'won' || s.phase === 'fallen') break;
    if (!tryClimb(s)) break;
    for (const L of s.climber.limbs)
      if (L.type === 'hand' && L.hold) minHandStam = Math.min(minHandStam, L.stam);
  }
  return { won: s.phase === 'won', moves: s.moves, minHandStam };
}

export function greedySolvable(level: Level): boolean {
  return greedySolve(level).won;
}
