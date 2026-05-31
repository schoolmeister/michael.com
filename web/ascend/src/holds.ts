/**
 * holds.ts — generate the PERSISTENT wall once, plus reach/cost helpers.
 *
 * The wall is a field of holds in rows from floor to summit. Rows are spaced
 * closer than your reach, so the next row is always grabbable — but a longer leap
 * (skipping a row, or a far lateral hold) covers ground faster at a steep stamina
 * cost. That's the greed: push hard and risk a rest in the dark, or creep safely
 * while the lantern bleeds.
 *
 * Holds vary in grip quality (jug → pocket). In the light you read it; in the dark
 * you gamble. Reading the wall is the decision the brief is really about.
 */

import {
  GRIPS,
  HARD_GRIP_BIAS_AT_SUMMIT,
  HOLDS_PER_ROW_MAX,
  HOLDS_PER_ROW_MIN,
  HORN_SPAWN_PROBABILITY,
  LIGHT_MOVE_BASE,
  LIGHT_PER_REACH_PX,
  REACH_MAX,
  REACH_MIN_DY,
  ROUTE_WIDTH,
  ROW_JITTER_Y,
  ROW_SPACING,
  STAMINA_MOVE_BASE,
  STAMINA_PER_REACH_PX,
  WALL_HEIGHT,
  type HoldType,
} from './config';
import type { Hold } from './state';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const TYPES = Object.keys(GRIPS) as HoldType[];
const HARD = new Set<HoldType>(['flake', 'pocket']);

/** Weighted pick, biased toward HARD grips (flake/pocket) as you climb higher.
 *  heightFrac: 0 at the floor, 1 at the summit. */
function weightedType(heightFrac: number): HoldType {
  const bias = 1 + HARD_GRIP_BIAS_AT_SUMMIT * Math.max(0, heightFrac);
  const w = (t: HoldType) => GRIPS[t].weight * (HARD.has(t) ? bias : 1);
  const total = TYPES.reduce((s, t) => s + w(t), 0);
  let r = Math.random() * total;
  for (const t of TYPES) {
    r -= w(t);
    if (r <= 0) return t;
  }
  return 'ledge';
}

/**
 * Build the whole route. centerX is the world X the climbable band centres on.
 * Returns the holds and the id of the summit hold.
 */
export function generateRoute(
  centerX: number,
  startId: number,
): { holds: Hold[]; summitHoldId: number; nextId: number } {
  const holds: Hold[] = [];
  let id = startId;
  const halfBand = ROUTE_WIDTH / 2;

  // Floor hold: a guaranteed big jug, dead centre, with a solid start-pro horn.
  holds.push(makeHold(id++, centerX, 0, 'jug', 0, true));

  let y = 0;
  let row = 1;
  while (y < WALL_HEIGHT) {
    y += ROW_SPACING + rand(-ROW_JITTER_Y, ROW_JITTER_Y);
    const n = Math.round(rand(HOLDS_PER_ROW_MIN, HOLDS_PER_ROW_MAX));
    // Spread n holds across the band so there's a real left/right choice.
    for (let i = 0; i < n; i++) {
      const slot = (i + 0.5) / n; // 0..1 across band
      const x = centerX - halfBand + slot * ROUTE_WIDTH + rand(-halfBand / n, halfBand / n) * 0.6;
      holds.push(makeHold(id++, x, y, weightedType(y / WALL_HEIGHT), row));
    }
    row++;
  }

  // Summit: a single obvious jug above the last row, the unambiguous goal.
  const summitY = y + ROW_SPACING * 0.9;
  const summit = makeHold(id++, centerX, summitY, 'jug', row, true);
  holds.push(summit);

  // Guarantee every hold has at least one reachable hold above it, so the route
  // can't dead-end. If one can't reach anything above, nudge in a helper hold.
  ensureReachability(holds, id);
  // recompute next id (helpers may have been added with ids beyond `id`)
  const maxId = holds.reduce((m, h) => Math.max(m, h.id), 0);

  return { holds, summitHoldId: summit.id, nextId: maxId + 1 };
}

function makeHold(
  id: number,
  x: number,
  y: number,
  type: HoldType,
  row: number,
  forceHorn = false,
): Hold {
  const g = GRIPS[type];
  const width = g.width * rand(0.92, 1.12);
  const hasHorn = forceHorn || (g.anchorable && Math.random() < HORN_SPAWN_PROBABILITY);

  let hornX = x;
  let hornY = y;
  let hornConeCenter = 0;
  if (hasHorn) {
    // Horn sits at a corner of the hold; the safe cone points DOWN into the rock
    // (world +y is up, so -PI/2 points down) so a hung load seats into the notch.
    const side = Math.random() < 0.5 ? -1 : 1;
    hornX = x + side * width * 0.42;
    hornY = y + rand(2, 10);
    hornConeCenter = -Math.PI / 2 + rand(-0.7, 0.7);
  }

  return {
    id,
    x,
    y,
    type,
    row,
    gripMult: g.mult,
    width,
    hasHorn,
    hornX,
    hornY,
    hornConeCenter,
  };
}

function ensureReachability(holds: Hold[], nextId: number): void {
  let id = nextId;
  for (const h of holds) {
    const above = holds.filter(
      (o) => o.y - h.y >= REACH_MIN_DY && dist(h, o) <= REACH_MAX,
    );
    if (above.length === 0 && h.y < WALL_HEIGHT) {
      // drop a friendly ledge straight above, just inside reach
      holds.push(makeHold(id++, h.x + rand(-30, 30), h.y + REACH_MAX * 0.7, 'ledge', h.row + 1));
    }
  }
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Holds reachable from a given hold: above it, within physical reach. */
export function reachableFrom(holds: Hold[], from: Hold): Hold[] {
  return holds
    .filter((h) => h.id !== from.id && h.y - from.y >= REACH_MIN_DY && dist(from, h) <= REACH_MAX)
    .sort((a, b) => dist(from, a) - dist(from, b));
}

/** Cost to reach `to` from `from`. Stamina scales with distance AND grip; light
 *  scales with distance (effort/time). These are shown honestly when lit. */
export function moveCost(
  from: { x: number; y: number },
  to: Hold,
): { lightCost: number; staminaCost: number; reach: number } {
  const reach = dist(from, to);
  const staminaCost = (STAMINA_MOVE_BASE + reach * STAMINA_PER_REACH_PX) * to.gripMult;
  const lightCost = LIGHT_MOVE_BASE + reach * LIGHT_PER_REACH_PX;
  return { lightCost, staminaCost, reach };
}

/** A stable sprite key for a hold (chosen from its type). */
export function spriteKeyFor(h: Hold): HoldType {
  return GRIPS[h.type].sprite;
}
