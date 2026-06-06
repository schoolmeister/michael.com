/**
 * sim.ts — the four-limb / center-of-gravity body mechanic, ported faithfully from
 * climb-4limb-test_5.html (the source of truth for feel), plus camera + finish-line
 * objective + level loading + programmatic helpers (so levels can be verified headless).
 *
 * The math is intentionally a 1:1 port — do not "improve" it without re-feeling the HTML.
 *
 * KEY DISTINCTION (the source of the depth):
 *   • CoG  = centroid of ALL four limb POSITIONS (gripping or not) + a small lean. An
 *            ungrabbed limb still has mass, so flagging it out shifts your weight.
 *   • Support polygon = ONLY the limbs currently gripping holds. CoG leaving it → fall.
 */

import {
  ANGLE_TOLERANCE,
  CAMERA_LERP,
  CAM_ANCHOR,
  DRAIN_BAD,
  FALL_RESET_DELAY,
  FOOT_ABSORB_MAX,
  GOOD_MARGIN,
  HAND_MIN_LOAD,
  HAND_STAM_MAX,
  LEAN_RANGE,
  LOAD_DRAIN_GAIN,
  LOAD_BELOW_BIAS,
  LOAD_NEAR_BIAS,
  REGRAB_STAM_FRAC,
  WORLD_WIDTH,
} from './config';
import type { Climber, GameState, Hold, Level, Limb, LimbName } from './state';

type P = { x: number; y: number };

// ── Camera mapping (render + input share this so clicks match pixels) ────────
export function offsetX(s: GameState): number {
  return (s.viewW - WORLD_WIDTH) / 2;
}
export function worldToScreen(s: GameState, wx: number, wy: number): P {
  return { x: wx + offsetX(s), y: wy - s.cameraY };
}
export function screenToWorld(s: GameState, sx: number, sy: number): P {
  return { x: sx - offsetX(s), y: sy + s.cameraY };
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
function centroidOf(pts: P[], fallback: P): P {
  if (pts.length === 0) return fallback;
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  return { x: sx / pts.length, y: sy / pts.length };
}

export function cogOf(pts: P[], lean: P, fallback: P): P {
  const c = centroidOf(pts, fallback);
  return { x: c.x + lean.x, y: c.y + lean.y };
}

/** Point-in-support test. <3 contacts → a small disc around their centroid (unstable). */
export function insideOf(pts: P[], p: P): boolean {
  if (pts.length < 2) return false;
  const c = centroidOf(pts, p);
  if (pts.length < 3) {
    const maxr = pts.length === 2 ? 40 : 18;
    return Math.hypot(p.x - c.x, p.y - c.y) <= maxr;
  }
  const ps = pts
    .map((L) => ({ x: L.x, y: L.y, t: Math.atan2(L.y - c.y, L.x - c.x) }))
    .sort((u, v) => u.t - v.t);
  let inside = false;
  for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) {
    const xi = ps[i].x, yi = ps[i].y, xj = ps[j].x, yj = ps[j].y;
    const hit = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function anchored(s: GameState): Limb[] {
  return s.climber.limbs.filter((L) => L.hold);
}
function bodyFallback(s: GameState): P {
  return { x: s.climber.body.x, y: s.climber.body.y };
}

/** Mass positions of all four limbs (override one to preview an aimed move). */
export function limbPositionsWith(s: GameState, override?: { limb: Limb; x: number; y: number }): P[] {
  return s.climber.limbs.map((L) =>
    override && L === override.limb ? { x: override.x, y: override.y } : { x: L.x, y: L.y },
  );
}
/** Support points (override one to preview); a lifted (hold:null) override drops a contact. */
export function anchoredWith(s: GameState, override?: { limb: Limb; hold: Hold | null }): P[] {
  return s.climber.limbs
    .map((L) => {
      if (override && L === override.limb) return override.hold ? { x: override.hold.x, y: override.hold.y } : null;
      return L.hold ? { x: L.x, y: L.y } : null;
    })
    .filter((p): p is P => p !== null);
}

export function cog(s: GameState): P {
  return cogOf(limbPositionsWith(s), s.climber.lean, bodyFallback(s));
}
export function supportCentroid(s: GameState): P {
  const a = anchored(s);
  return centroidOf(a.map((L) => ({ x: L.x, y: L.y })), bodyFallback(s));
}
export function insideSupport(s: GameState, p: P): boolean {
  return insideOf(anchored(s).map((L) => ({ x: L.x, y: L.y })), p);
}

/** Goodness 1 (CoG perfectly on the hold's good side) .. 0 (terrible). Live with CoG. */
export function goodness(s: GameState, L: Limb): number {
  if (!L.hold) return 1;
  const g = cog(s);
  const dx = g.x - L.hold.x, dy = g.y - L.hold.y;
  const len = Math.hypot(dx, dy) || 1;
  const gx = Math.cos(L.hold.ang), gy = Math.sin(L.hold.ang);
  const dot = (dx / len) * gx + (dy / len) * gy; // -1..1
  return Math.max(0, Math.min(1, (dot + ANGLE_TOLERANCE) / (1 + ANGLE_TOLERANCE)));
}

/** Distribute bodyweight (=1) across gripping limbs by geometry. Writes L.load. */
export function computeLoads(s: GameState): void {
  const a = anchored(s);
  s.climber.limbs.forEach((L) => (L.load = 0));
  if (a.length === 0) return;
  const g = cog(s);
  const raw = a.map((L) => {
    const dy = L.y - g.y;
    const dist = Math.hypot(L.x - g.x, dy) || 1;
    const near = 1 / Math.pow(dist / 60 + 1, LOAD_NEAR_BIAS);
    const below = dy > 0 ? 1 + (dy / 120) * (LOAD_BELOW_BIAS - 1) : 1;
    return { L, w: near * below, share: 0, final: 0 };
  });
  const tot = raw.reduce((acc, r) => acc + r.w, 0) || 1;
  raw.forEach((r) => (r.share = r.w / tot));

  const footShare = raw.filter((r) => r.L.type === 'foot').reduce((acc, r) => acc + r.share, 0);
  const footCap = Math.min(footShare, FOOT_ABSORB_MAX);
  const scaleFeet = footShare > 0 ? footCap / footShare : 0;

  let used = 0;
  raw.forEach((r) => { if (r.L.type === 'foot') { r.final = r.share * scaleFeet; used += r.final; } });
  const handRemainder = Math.max(0, 1 - used);
  const handShareSum = raw.filter((r) => r.L.type === 'hand').reduce((acc, r) => acc + r.share, 0) || 1;
  raw.forEach((r) => { if (r.L.type === 'hand') r.final = handRemainder * (r.share / handShareSum); });

  const hands = raw.filter((r) => r.L.type === 'hand');
  hands.forEach((r) => (r.final = Math.max(r.final, HAND_MIN_LOAD)));
  const hsum = hands.reduce((acc, r) => acc + r.final, 0);
  if (hsum > handRemainder && hsum > 0) { const k = handRemainder / hsum; hands.forEach((r) => (r.final *= k)); }

  raw.forEach((r) => (r.L.load = r.final));
}

// ── The tick ──────────────────────────────────────────────────────────────────
export function update(s: GameState, dt: number): void {
  if (s.phase === 'won') return;

  if (s.phase === 'fallen') {
    s.fallTimer += dt;
    if (s.fallTimer > FALL_RESET_DELAY) loadLevel(s, s.level); // retry THIS level
    followCamera(s, dt);
    return;
  }

  s.elapsed += dt;
  computeLoads(s);

  for (const L of s.climber.limbs) {
    if (L.type === 'hand' && L.hold) {
      const q = goodness(s, L);
      const badness = q < GOOD_MARGIN ? (GOOD_MARGIN - q) / GOOD_MARGIN : 0;
      const drain = DRAIN_BAD * badness * (L.load * LOAD_DRAIN_GAIN);
      L.stam -= drain * dt;
      if (L.stam <= 0) { L.stam = 0; L.hold = null; } // slips off
    }
  }

  // clamp lean magnitude
  const lm = Math.hypot(s.climber.lean.x, s.climber.lean.y);
  if (lm > LEAN_RANGE) { s.climber.lean.x *= LEAN_RANGE / lm; s.climber.lean.y *= LEAN_RANGE / lm; }

  const g = cog(s);
  // win: CoG crossed the finish line near the top
  if (g.y <= s.finishY) {
    s.phase = 'won';
    s.winTime = s.elapsed;
    s.winMoves = s.moves;
    return;
  }
  // fall: CoG left the support polygon, or too few contacts
  if (!insideSupport(s, g) || anchored(s).length < 2) {
    s.phase = 'fallen';
    s.fallTimer = 0;
  }

  followCamera(s, dt);
}

function followCamera(s: GameState, dt: number): void {
  const target = cog(s).y - s.viewH * CAM_ANCHOR;
  s.cameraY += (target - s.cameraY) * Math.min(1, CAMERA_LERP * dt);
}

// ── Committing a move (input + harness use this) ────────────────────────────
/** Commit a limb to a hold (grip) or to open air (x,y, hold=null). Counts as a move. */
export function commitLimb(s: GameState, limb: Limb, hold: Hold | null, x: number, y: number): void {
  if (hold) {
    limb.hold = hold;
    limb.x = hold.x;
    limb.y = hold.y;
    if (limb.stam <= 0) limb.stam = HAND_STAM_MAX * REGRAB_STAM_FRAC;
  } else {
    limb.hold = null;
    limb.x = x;
    limb.y = y;
  }
  s.moves++;
}

export function setLean(s: GameState, lx: number, ly: number): void {
  const lm = Math.hypot(lx, ly);
  if (lm > LEAN_RANGE) { lx *= LEAN_RANGE / lm; ly *= LEAN_RANGE / lm; }
  s.climber.lean.x = lx;
  s.climber.lean.y = ly;
}

export function limbByName(s: GameState, name: LimbName): Limb {
  return s.climber.limbs.find((L) => L.name === name)!;
}

// ── Level loading / new game ────────────────────────────────────────────────
export function loadLevel(s: GameState, level: Level): void {
  s.level = level;
  const holds: Hold[] = level.holds.map((h) => ({ x: h.x, y: h.y, ang: h.ang }));
  const names: LimbName[] = ['LH', 'RH', 'LF', 'RF'];
  const types = { LH: 'hand', RH: 'hand', LF: 'foot', RF: 'foot' } as const;

  const limbs: Limb[] = names.map((name) => {
    const h = holds[level.start[name]];
    return { name, type: types[name], x: h.x, y: h.y, hold: h, stam: HAND_STAM_MAX, load: 0 };
  });

  // Re-angle each start hold's good-side toward the opening CoG so the start is RESTFUL.
  const sc = centroidOf(limbs.map((L) => ({ x: L.x, y: L.y })), { x: WORLD_WIDTH / 2, y: 0 });
  for (const L of limbs) {
    const h = L.hold!;
    h.ang = Math.atan2(sc.y - h.y, sc.x - h.x);
  }

  const climber: Climber = { body: { x: sc.x, y: sc.y }, lean: { x: 0, y: 0 }, limbs };
  s.holds = holds;
  s.climber = climber;
  s.drag = null;
  s.phase = 'climbing';
  s.fallTimer = 0;
  s.finishY = level.finishY;
  s.worldHeight = level.height;
  s.elapsed = 0;
  s.moves = 0;
  s.winTime = 0;
  s.winMoves = 0;
  s.cameraY = cog(s).y - s.viewH * CAM_ANCHOR;
  computeLoads(s);
}

export function createGame(level: Level, levelIndex: number, viewW: number, viewH: number): GameState {
  const s: GameState = {
    phase: 'climbing',
    holds: [],
    climber: { body: { x: 0, y: 0 }, lean: { x: 0, y: 0 }, limbs: [] },
    drag: null,
    fallTimer: 0,
    cameraY: 0,
    levelIndex,
    level,
    finishY: 0,
    worldHeight: 0,
    elapsed: 0,
    moves: 0,
    winTime: 0,
    winMoves: 0,
    viewW,
    viewH,
  };
  loadLevel(s, level);
  return s;
}
