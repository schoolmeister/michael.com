/**
 * world.ts — THREE-lane streaming generator. Each of the three floors is an independent
 * stream of platform runs broken by short holes — EXCEPT the invariant: at most one lane may
 * be a hole at any column. With three lanes that guarantees ≥2 solid floors everywhere, so
 * from whatever floor you're on there's always an adjacent solid floor to jump up to or drop
 * down to. Falling past the bottom of the screen is still death (sim.ts).
 *
 * Adaptive placement: the floor the PLAYER is currently on gets far less good stuff; the
 * other floors get more, and pickups cluster around obstacles. So rewards always cost a
 * deliberate lane change.
 */

import * as C from './config';
import type { Pickup, PickupKind, Platform, TileKind, World } from './state';

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
const NLANES = C.LANE_H.length;

export function createWorld(seed: number): World {
  return {
    seed,
    platforms: [],
    geysers: [],
    ghosts: [],
    pickups: [],
    nextCol: 0,
    minCol: 0,
    present: Array(NLANES).fill(true),
    runLeft: Array(NLANES).fill(C.START_RUN),
    open: Array(NLANES).fill(null),
    hazSpacer: Array(NLANES).fill(0),
    pickSpacer: Array(NLANES).fill(0),
    pickPending: Array(NLANES).fill(0),
    ghostSpacer: Array(NLANES).fill(0),
    playerLane: 0
  };
}

function addPickup(w: World, c: number, lane: number, r: () => number): void {
  const p: Pickup = {
    x: c * C.TILE + C.TILE / 2,
    lane,
    floatTiles: C.LANE_H[lane] + C.PICKUP_VIS_FLOAT, // hovers just above the floor → grabbed at run height
    kind: pickWeighted(r(), C.PICKUP_WEIGHTS) as PickupKind,
    taken: false
  };
  w.pickups.push(p);
}

/** Build one tile on lane `l` at column `c` (already known present + past lead-in). */
function buildTile(
  w: World, l: number, c: number, r: () => number, hazChance: number, ghostChance: number
): void {
  const P = w.open[l]!;
  const tileIdx = P.tiles.length;
  let kind: TileKind = 'solid';

  if (w.hazSpacer[l] > 0) w.hazSpacer[l]--;
  if (w.pickSpacer[l] > 0) w.pickSpacer[l]--;
  if (w.ghostSpacer[l] > 0) w.ghostSpacer[l]--;

  let placedPickup = false;

  // a "guarded" pickup landing a couple tiles after an obstacle
  if (w.pickPending[l] > 0) {
    w.pickPending[l]--;
    if (w.pickPending[l] === 0) {
      addPickup(w, c, l, r);
      placedPickup = true;
      w.pickSpacer[l] = C.PICKUP_SPACER;
    }
  }

  // hazard (never on the platform's first tile — keeps the takeoff/landing edge clean)
  if (!placedPickup && tileIdx >= 1 && w.hazSpacer[l] <= 0 && r() < hazChance) {
    const haz = pickWeighted(r(), C.HAZARD_WEIGHTS);
    w.hazSpacer[l] = C.HAZARD_SPACER;
    if (haz === 'geyser') {
      w.geysers.push({ x: c * C.TILE + C.TILE / 2, lane: l, phase: r() * C.GEYSER_PERIOD, dead: false });
    } else {
      kind = haz as TileKind;
    }
    if (w.pickPending[l] === 0 && r() < C.OBSTACLE_REWARD_CHANCE) {
      w.pickPending[l] = C.PICKUP_AFTER_OBSTACLE;
    }
  } else if (!placedPickup && kind === 'solid' && w.pickSpacer[l] <= 0) {
    // standalone adaptive pickup — rare on the floor the player is on
    const good = C.PICKUP_BASE * (l === w.playerLane ? C.PLAYER_LANE_GOOD_MULT : 1);
    if (r() < good) {
      addPickup(w, c, l, r);
      w.pickSpacer[l] = C.PICKUP_SPACER;
    }
  }

  // ghost over a solid tile (also biased off the player's current floor)
  if (kind === 'solid' && tileIdx >= 1 && w.ghostSpacer[l] <= 0 && r() < ghostChance) {
    const gmult = l === w.playerLane ? 0.4 : 1;
    if (r() < gmult) {
      const x = c * C.TILE + C.TILE / 2;
      w.ghosts.push({
        x,
        lane: l,
        floatTiles: C.LANE_H[l] + C.GHOST_FLOAT,
        anchorX: x,
        dir: r() < 0.5 ? 1 : -1,
        fire: lerp(C.GHOST_FIRE_START, C.GHOST_FIRE_END, Math.min(1, w.nextCol / 9999)) * (0.5 + 0.5 * r()),
        dead: false
      });
      w.ghostSpacer[l] = C.GHOST_SPACER;
    }
  }

  P.tiles.push(kind);
  P.col1 = c;
}

function genColumn(w: World, time: number): void {
  const r = rng(w);
  const c = w.nextCol;
  const leadIn = c < C.START_RUN;
  const t = Math.min(1, time / C.WIN_TIME);
  const hazChance = lerp(C.HAZARD_CHANCE_START, C.HAZARD_CHANCE_END, t);
  const ghostChance = lerp(C.GHOST_CHANCE_START, C.GHOST_CHANCE_END, t);

  // toggle runs that have expired
  if (!leadIn) {
    for (let l = 0; l < NLANES; l++) {
      if (w.runLeft[l] > 0) continue;
      if (w.present[l]) {
        const othersHole = w.present.some((pr, k) => k !== l && !pr);
        if (!othersHole && r() < C.GAP_PROB) {
          w.present[l] = false;
          w.runLeft[l] = C.GAP_LEN_MIN + Math.floor(r() * (C.GAP_LEN_MAX - C.GAP_LEN_MIN + 1));
          w.open[l] = null;
        } else {
          w.runLeft[l] = C.PLAT_LEN_MIN + Math.floor(r() * (C.PLAT_LEN_MAX - C.PLAT_LEN_MIN + 1));
        }
      } else {
        w.present[l] = true;
        w.runLeft[l] = C.PLAT_LEN_MIN + Math.floor(r() * (C.PLAT_LEN_MAX - C.PLAT_LEN_MIN + 1));
      }
    }
  }

  for (let l = 0; l < NLANES; l++) {
    if (w.present[l]) {
      if (!w.open[l]) {
        const p: Platform = { lane: l, col0: c, col1: c, tiles: [] };
        w.platforms.push(p);
        w.open[l] = p;
      }
      if (leadIn) {
        w.open[l]!.tiles.push('solid');
        w.open[l]!.col1 = c;
      } else {
        buildTile(w, l, c, r, hazChance, ghostChance);
      }
    } else {
      w.open[l] = null;
    }
    w.runLeft[l]--;
  }
  w.nextCol++;
}

export function ensureTo(w: World, maxX: number, time: number): void {
  const need = Math.ceil(maxX / C.TILE) + 2;
  while (w.nextCol < need) genColumn(w, time);
}

export function prune(w: World, minX: number): void {
  const minCol = Math.floor(minX / C.TILE) - 2;
  w.minCol = minCol;
  w.platforms = w.platforms.filter((p) => p.col1 >= minCol);
  w.geysers = w.geysers.filter((g) => g.x > minX - C.TILE * 2 && !g.dead);
  w.ghosts = w.ghosts.filter((g) => g.x > minX - C.TILE * 2 && !g.dead);
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
