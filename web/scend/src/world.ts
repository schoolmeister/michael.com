/**
 * world.ts — INFINITE-lane PATH generator. The world is a single guaranteed-reachable path
 * that random-walks up/down across an unbounded set of integer lanes, with occasional sparse
 * BRANCH platforms (the optional risk/reward detours that carry most pickups). Gaps and spike
 * clusters scale with the player's CURRENT speed so they stay fair-but-tense at any speed (you
 * can't out-run a pattern by jumping the whole thing, and adjacent spikes are hard when slow).
 *
 * A platform is `{lane, col0, col1, tiles}`. Lane n's surface world-y = -n * LANE_GAP (sim.ts).
 * The path only ever climbs +1 lane (a jump) or drops down to MAX_DROP_LANES (a fall), and
 * gaps are capped to the reachable distance for that move — so there's always a way through.
 */

import * as C from './config';
import { TUNE } from './tunables';
import type { PickupKind, Platform, TileKind, World } from './state';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rngs = new WeakMap<World, () => number>();
function rng(w: World): () => number {
  let r = rngs.get(w);
  if (!r) { r = mulberry32(w.seed); rngs.set(w, r); }
  return r;
}

function pickWeighted<K extends string>(r: number, weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][];
  let total = 0;
  for (const [, v] of entries) total += v;
  let x = r * total;
  for (const [k, v] of entries) { x -= v; if (x <= 0) return k; }
  return entries[entries.length - 1][0];
}
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function createWorld(seed: number): World {
  return {
    seed,
    platforms: [],
    geysers: [],
    enemies: [],
    pickups: [],
    nextCol: 0,
    minCol: 0,
    pathLane: 0,
    patternLeft: 0,
    pattern: 'none',
    incomingLand: 0,
    hazSpacer: 0,
    ghostSpacer: 0,
    playerLane: 0
  };
}

/** Horizontal reach of one jump, in tiles, at this speed. */
function jumpReach(speed: number): number {
  const air = (2 * TUNE.jumpV) / TUNE.gravity;
  return (speed * air) / C.TILE;
}

/** Horizontal distance (tiles) at which the player LANDS for a lane move `delta`.
 *  delta>=0 → a jump that returns to height `delta` floors up (flat = same height);
 *  delta<0 → no jump, just running off and falling k floors. This is fixed by physics,
 *  so we size the gap to it (platform sits right where you'll touch down). */
function landTiles(speed: number, delta: number): number {
  const g = TUNE.gravity, v = TUNE.jumpV;
  if (delta < 0) {
    const tt = Math.sqrt((2 * -delta * C.LANE_GAP) / g);
    return (speed * tt) / C.TILE;
  }
  const rise = delta * C.LANE_GAP; // height the platform sits ABOVE the takeoff
  const disc = v * v - 2 * g * rise;
  const tt = disc <= 0 ? (2 * v) / g : (v + Math.sqrt(disc)) / g; // descending root
  return (speed * tt) / C.TILE;
}

function hazardWeightsFor(speed: number): Record<string, number> {
  const wts: Record<string, number> = { spike: C.HAZARD_WEIGHTS.spike }; // tier 1: spikes only
  if (speed >= TUNE.geyserUnlock) { wts.lava = C.HAZARD_WEIGHTS.lava; wts.geyser = C.HAZARD_WEIGHTS.geyser; }
  return wts;
}

/** Pickup weights at the given speed — knife joins once geysers unlock; the new kick/stomp
 *  boosts only join later (once ghosts unlock). Magnet is a permanent default, not a drop. */
function pickupWeightsFor(speed: number): Record<string, number> {
  const wts: Record<string, number> = { ...C.PICKUP_WEIGHTS_BASE };
  if (speed >= TUNE.geyserUnlock) wts.knife = C.PICKUP_KNIFE_WEIGHT;
  if (speed >= TUNE.ghostUnlock) Object.assign(wts, C.PICKUP_LATE_WEIGHTS);
  return wts;
}

function addPickup(w: World, col: number, lane: number, r: () => number, speed: number, kind?: PickupKind): void {
  w.pickups.push({
    x: col * C.TILE + C.TILE / 2,
    lane,
    kind: kind ?? (pickWeighted(r(), pickupWeightsFor(speed)) as PickupKind),
    taken: false
  });
}

function addEnemy(w: World, kind: 'ghost' | 'hobgoblin', col: number, lane: number, r: () => number): void {
  const x = col * C.TILE + C.TILE / 2;
  const off = kind === 'ghost' ? C.GHOST_FLOAT * C.TILE : C.TILE; // centre offset above the lane
  w.enemies.push({ kind, x, y: -lane * C.LANE_GAP - off, lane, anchorX: x, dir: r() < 0.5 ? 1 : -1, fire: 0.4 + r() * 1.2, vx: 0, vy: 0, kicked: false, dead: false });
}

/** Difficulty 0..1, driven by SPEED — the world starts timid and escalates as you accelerate. */
function difficulty(speed: number): number {
  return clamp((speed - TUNE.baseSpeed) / C.DIFFICULTY_RANGE, 0, 1);
}

/** Climb (+1) vs flat (0); more climbs as difficulty rises. Up/sideways only (never down). */
function chooseDelta(r: () => number, d: number): number {
  return r() < lerp(C.CLIMB_CHANCE_START, C.CLIMB_CHANCE_END, d) ? 1 : 0;
}

/** Generate one path segment: a platform on the path lane + its trailing gap + maybe a branch. */
function genSegment(w: World, speed: number): void {
  const r = rng(w);
  const c0 = w.nextCol;
  const leadIn = c0 < C.START_RUN;
  const d = difficulty(speed); // 0 = timid → 1 = full chaos (drives everything below)

  if (!leadIn && w.patternLeft <= 0) {
    w.pattern = 'none';
    if (r() < TUNE.patternChance) { w.pattern = 'stair'; w.patternLeft = 3 + Math.floor(r() * 4); }
  }

  const lane = w.pathLane;
  const hazChance = lerp(C.HAZARD_CHANCE_START, TUNE.hazardEnd, d);
  const hazWeights = hazardWeightsFor(speed);
  const clusterMax = clamp(Math.round(jumpReach(speed) * TUNE.spikeClusterF), 1, C.SPIKE_CLUSTER_MAX);

  // pick the next move FIRST (the gap is sized to where this move lands)
  let delta = 0;
  if (!leadIn) {
    delta = w.pattern === 'stair' ? 1 : chooseDelta(r, d); // up or sideways only
  }

  // platform length — long & predictable when timid (×TIMID_LEN_MULT at d=0), tightening as
  // difficulty rises; always long enough to CATCH the previous segment's landing.
  const catchLen = Math.ceil(w.incomingLand) + 1;
  const lenMult = lerp(C.TIMID_LEN_MULT, 1, d);
  const baseLen = leadIn
    ? C.START_RUN
    : Math.round((TUNE.platMin + Math.floor(r() * (Math.max(TUNE.platMin, TUNE.platMax) - TUNE.platMin + 1))) * lenMult);
  const L = Math.max(baseLen, catchLen);

  // build solid tiles
  const tiles: TileKind[] = Array(L).fill('solid');

  // Hazards sit at the platform's TRAILING edge (the takeoff side) — never on a DROP segment
  // (you'd run into them) — so the same jump that clears the gap clears the spikes. The gap is
  // then shrunk by the cluster width below, keeping the landing fair. Adjacent-spike width
  // scales with jump reach (→ speed): wide is fine when fast, tight when slow.
  let cw = 0;
  if (w.hazSpacer > 0) w.hazSpacer--;
  if (!leadIn && delta >= 0 && L >= 3 && w.hazSpacer <= 0 && r() < hazChance) {
    const haz = pickWeighted(r(), hazWeights);
    if (haz === 'geyser') {
      // a geyser erupts at the takeoff edge — you jump the gap over its steam (safe while rising)
      w.geysers.push({ x: (c0 + L - 1) * C.TILE + C.TILE / 2, lane, phase: r() * C.GEYSER_PERIOD, dead: false });
      w.hazSpacer = C.HAZARD_SPACER;
    } else {
      cw = clamp(1 + Math.floor(r() * clusterMax), 1, L - 2); // leave ≥2 solid tiles to run up
      for (let k = 0; k < cw; k++) tiles[L - 1 - k] = haz as TileKind;
      w.hazSpacer = C.HAZARD_SPACER + cw;
    }
  }
  w.platforms.push({ lane, col0: c0, col1: c0 + L - 1, tiles });

  // an enemy on the path platform (speed-gated, spaced, kept off the player's current floor).
  // ghosts at ghost-unlock; the big 2×2 hobgoblin once it unlocks (it needs a wide platform).
  if (w.ghostSpacer > 0) w.ghostSpacer--;
  if (!leadIn && w.ghostSpacer <= 0 && lane !== w.playerLane && L >= 3) {
    const ghostChance = lerp(C.GHOST_CHANCE_START, TUNE.ghostEnd, d);
    if (speed >= C.HOBGOBLIN_UNLOCK_SPEED && L >= 4 && r() < C.HOBGOBLIN_CHANCE) {
      addEnemy(w, 'hobgoblin', c0 + Math.floor(L / 2), lane, r); w.ghostSpacer = C.GHOST_SPACER + 2;
    } else if (speed >= TUNE.ghostUnlock && r() < ghostChance) {
      addEnemy(w, 'ghost', c0 + Math.floor(L / 2), lane, r); w.ghostSpacer = C.GHOST_SPACER;
    }
  }

  // a sparse path pickup just before a spike cluster (reward for committing to the hop)
  if (cw > 0 && r() < C.OBSTACLE_REWARD_CHANCE) {
    const good = lane === w.playerLane ? C.PLAYER_LANE_GOOD_MULT : 1;
    if (r() < good) addPickup(w, c0 + Math.max(0, L - 1 - cw), lane, r, speed);
  }

  // gap: landing-aligned (× gapScale, which tightens platforms when <1), minus the spike
  // cluster (you take off before the spikes). Record how far INTO the next platform the
  // player will land, so the next platform can be made long enough to catch it.
  let gap = C.GAP_LEN_MIN + Math.floor(r() * 2);
  if (!leadIn) {
    const land = landTiles(speed, delta);
    gap = clamp(Math.round((land - 1 - cw) * TUNE.gapScale + (r() * 0.8 - 0.2)), C.GAP_LEN_MIN, C.GAP_LEN_MAX);
    w.incomingLand = Math.max(0, land - (gap + cw + 1));
  } else {
    w.incomingLand = 0;
  }

  // MULTI-FLOOR: parallel platforms on floors ABOVE this stretch (game only goes up/sideways,
  // so no platforms spawn below). The "how often platforms span multiple levels" knob.
  if (!leadIn && w.pattern === 'none') {
    for (const up of [1, 2] as const) {
      // some layering from the start (MULTI_FLOOR_START_FRAC), growing to full with speed
      if (r() >= TUNE.multiFloor * lerp(C.MULTI_FLOOR_START_FRAC, 1, d)) continue;
      const bLane = lane + up;
      const bLen = 3 + Math.floor(r() * 4);
      const bCol = c0 + 1 + Math.floor(r() * Math.max(1, L - 2));
      const btiles: TileKind[] = Array(bLen).fill('solid');
      w.platforms.push({ lane: bLane, col0: bCol, col1: bCol + bLen - 1, tiles: btiles });
      if (r() < 0.7) addPickup(w, bCol + Math.floor(bLen / 2), bLane, r, speed);
      if (speed >= TUNE.ghostUnlock && r() < 0.35) addEnemy(w, 'ghost', bCol, bLane, r);
    }
  }

  w.nextCol = c0 + L + gap;
  w.pathLane = lane + delta;
  if (!leadIn) w.patternLeft--;
}

export function ensureTo(w: World, maxX: number, _time: number, speed: number): void {
  const need = maxX + C.TILE * 2;
  while (w.nextCol * C.TILE < need) genSegment(w, speed);
}

export function prune(w: World, minX: number): void {
  const minCol = Math.floor(minX / C.TILE) - 2;
  w.minCol = minCol;
  w.platforms = w.platforms.filter((p) => p.col1 >= minCol);
  w.geysers = w.geysers.filter((g) => g.x > minX - C.TILE * 2 && !g.dead);
  // keep kicked enemies a bit longer (they fly leftward); cull dead/off-screen
  w.enemies = w.enemies.filter((g) => !g.dead && g.x > minX - C.TILE * 4);
  w.pickups = w.pickups.filter((p) => p.x > minX - C.TILE * 2 && !p.taken);
}

/** The platform on `lane` whose column-span contains world-x `x`, with its tile index. */
export function platformAt(w: World, x: number, lane: number): { p: Platform; idx: number } | null {
  const col = Math.floor(x / C.TILE);
  for (const p of w.platforms) {
    if (p.lane === lane && col >= p.col0 && col <= p.col1) return { p, idx: col - p.col0 };
  }
  return null;
}
