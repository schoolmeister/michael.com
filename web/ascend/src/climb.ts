/**
 * climb.ts — the simulation tick + new-game construction.
 *
 * Phase machine (prototype #2 — HOLD-CLICK, no drag; ROPE & ANCHOR skill verb):
 *
 *   choosing ──(press+hold on a reachable hold)──▶ reaching
 *   choosing ──(press+hold on the current hold's free horn)──▶ anchoring
 *   reaching ──(held to 100%)──▶ choosing on the new hold (progress!)
 *   reaching ──(released early | stamina hit 0)──▶ FALLING (a slip)
 *   anchoring ──(release)──▶ choosing (protection placed, becomes the new rope point)
 *   falling ──(animation done)──▶ choosing (rope caught) | lost (ground death)
 *   light <= 0 ──▶ lost ;  current hold == summit ──▶ won
 *
 * `armed` is set true only when the pointer is up. Beginning a reach OR an anchor
 * placement clears it, so holding the mouse can't chain actions: every action is a
 * deliberate fresh press.
 *
 * Camera/cursor hit-testing goes through view.ts so clicks match rendered pixels.
 */

import {
  ABORT_FLASH_DURATION,
  ABORT_LIGHT_PENALTY,
  ABORT_STAMINA_PENALTY,
  ANCHOR_PLACE_LIGHT_COST,
  ANCHOR_PLACE_STAMINA_COST,
  CLIMB_EASE_POWER,
  CLIMB_RESOLVE_DURATION,
  FALL_GROUND_LIGHT_PENALTY,
  FALL_SPEED,
  FALL_STAMINA_PER_PX,
  HOLD_HIT_RADIUS,
  HORN_HIT_RADIUS,
  LIGHT_DRAIN_RATE,
  LIGHT_MAX,
  STAMINA_MAX,
  STAMINA_RECOVER_RATE,
  WALL_HEIGHT,
} from './config';
import { resolveFall, seatingQuality, type FallResult } from './anchor';
import { generateRoute, moveCost, reachableFrom } from './holds';
import type { Anchor, GameState, Hold, Pointer } from './state';
import { anchorById, holdById } from './state';
import { screenToWorld, worldToScreen } from './view';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function climbEase(t: number): number {
  return Math.pow(clamp(t, 0, 1), CLIMB_EASE_POWER);
}

/** The pending fall result for the active 'falling' phase (applied on landing). */
let pendingFall: FallResult | null = null;

/** Build a fresh run: a persistent wall + the climber on the floor hold. */
export function createGame(viewW: number, viewH: number): GameState {
  const { holds, summitHoldId, nextId } = generateRoute(viewW / 2, 1);
  const floor = holds[0];

  pendingFall = null;

  const s: GameState = {
    phase: 'choosing',
    light: LIGHT_MAX,
    stamina: STAMINA_MAX,
    holds,
    summitHoldId,
    currentHoldId: floor.id,
    climberX: floor.x,
    climberY: floor.y,
    facing: -1,
    reachable: [],
    hoverHoldId: null,
    hoverHorn: false,
    committedId: null,
    resolveProgress: 0,
    moveStartX: floor.x,
    moveStartY: floor.y,
    anchors: [],
    ropeAnchorId: null,
    placingHoldId: null,
    seatAngle: -Math.PI / 2,
    fallFromY: 0,
    fallToY: 0,
    fallProgress: 0,
    fallRipped: false,
    armed: false,
    abortFlash: 0,
    slipKick: 0,
    strain: 0,
    cameraY: floor.y,
    elapsed: 0,
    moves: 0,
    nextHoldId: nextId,
    nextAnchorId: 1,
    viewW,
    viewH,
  };

  // No starting anchor: the rope runs to the GROUND BELAY (ropeAnchorId = null).
  // That belay does NOT prevent decking — an unprotected fall from above
  // FALL_DEATH_HEIGHT kills you (see resolveFall). Placing your own pro is what
  // bounds a fall. The floor hold still has a horn if you want first pro early.
  recomputeReachable(s);
  return s;
}

export function recomputeReachable(s: GameState): void {
  const cur = holdById(s, s.currentHoldId);
  s.reachable = cur ? reachableFrom(s.holds, cur) : [];
}

/** Has this hold already got an anchor placed on it? */
function holdHasAnchor(s: GameState, holdId: number): boolean {
  return s.anchors.some((a) => a.holdId === holdId);
}

// ── HOVER / HIT-TESTING (all via view.ts so clicks match pixels) ───────────────

/** Nearest reachable hold whose screen position is within HOLD_HIT_RADIUS, or null. */
function pickHoverHold(s: GameState, pointer: Pointer): number | null {
  let best: number | null = null;
  let bestD = HOLD_HIT_RADIUS;
  for (const h of s.reachable) {
    const sp = worldToScreen(s, h.x, h.y);
    const d = Math.hypot(sp.x - pointer.x, sp.y - pointer.y);
    if (d <= bestD) {
      bestD = d;
      best = h.id;
    }
  }
  return best;
}

/** Is the pointer over the current hold's placeable horn? */
function pickHoverHorn(s: GameState, pointer: Pointer): boolean {
  const cur = holdById(s, s.currentHoldId);
  if (!cur || !cur.hasHorn) return false;
  if (holdHasAnchor(s, cur.id)) return false; // already protected — no double-anchor
  const sp = worldToScreen(s, cur.hornX, cur.hornY);
  return Math.hypot(sp.x - pointer.x, sp.y - pointer.y) <= HORN_HIT_RADIUS;
}

// ── ACTION TRANSITIONS ─────────────────────────────────────────────────────────

function beginReach(s: GameState, target: Hold): void {
  s.phase = 'reaching';
  s.committedId = target.id;
  s.resolveProgress = 0;
  s.moveStartX = s.climberX;
  s.moveStartY = s.climberY;
  const dx = target.x - s.climberX;
  s.facing = dx > 8 ? 1 : dx < -8 ? -1 : s.facing;
  s.strain = 0;
  s.armed = false; // must release before the next action
}

function beginAnchoring(s: GameState): void {
  const cur = holdById(s, s.currentHoldId)!;
  s.phase = 'anchoring';
  s.placingHoldId = cur.id;
  // start the aim pointing into the horn's load notch (a sane default)
  s.seatAngle = cur.hornConeCenter;
  s.armed = false;
}

function completeReach(s: GameState): void {
  const h = holdById(s, s.committedId!)!;
  s.climberX = h.x;
  s.climberY = h.y;
  s.currentHoldId = h.id;
  s.committedId = null;
  s.resolveProgress = 0;
  s.strain = 0;
  s.moves++;

  if (h.id === s.summitHoldId || h.y >= WALL_HEIGHT) {
    s.phase = 'won';
    return;
  }
  s.phase = 'choosing';
  recomputeReachable(s);
}

/** Release on a horn → place protection, make it the new rope point. */
function placeAnchor(s: GameState): void {
  const hold = holdById(s, s.placingHoldId);
  if (hold) {
    const q = seatingQuality(hold, s.seatAngle);
    const a: Anchor = {
      id: s.nextAnchorId++,
      x: hold.hornX,
      y: hold.hornY,
      holdId: hold.id,
      quality: q,
    };
    s.anchors.push(a);
    s.anchors.sort((p, qq) => p.y - qq.y); // keep low→high
    s.ropeAnchorId = a.id;
    s.stamina = clamp(s.stamina - ANCHOR_PLACE_STAMINA_COST, 0, STAMINA_MAX);
    s.light = clamp(s.light - ANCHOR_PLACE_LIGHT_COST, 0, LIGHT_MAX);
  }
  s.placingHoldId = null;
  s.phase = 'choosing';
}

/** Begin a slip → resolve where the rope catches (or doesn't) and animate the fall. */
function startSlip(s: GameState): void {
  const result = resolveFall(s.climberY, s.anchors, s.ropeAnchorId);
  pendingFall = result;
  s.fallFromY = s.climberY;
  s.fallToY = result.toY;
  s.fallProgress = 0;
  s.fallRipped = result.rippedIds.length > 0;
  s.committedId = null;
  s.resolveProgress = 0;
  s.strain = 0;
  s.phase = 'falling';
}

/** Apply the resolved fall once the drop animation finishes. */
function landFall(s: GameState): void {
  const result = pendingFall ?? resolveFall(s.fallFromY, s.anchors, s.ropeAnchorId);
  pendingFall = null;

  // Remove ripped anchors.
  if (result.rippedIds.length) {
    s.anchors = s.anchors.filter((a) => !result.rippedIds.includes(a.id));
  }

  if (result.death) {
    s.climberY = result.toY;
    s.climberX = s.climberX;
    s.phase = 'lost';
    return;
  }

  s.ropeAnchorId = result.caughtById;

  // Settle the climber onto the catching anchor's hold (or the floor if none).
  const caught = anchorById(s, result.caughtById);
  const landHold = caught
    ? holdById(s, caught.holdId)
    : s.holds.find((h) => h.row === 0) ?? s.holds[0];
  if (landHold) {
    s.currentHoldId = landHold.id;
    s.climberX = landHold.x;
    s.climberY = landHold.y;
  } else {
    s.climberY = result.toY;
  }

  // The catch hurts: stamina scaled by drop distance, plus the slip penalties.
  const dropPx = Math.max(0, s.fallFromY - s.fallToY);
  s.stamina = clamp(
    s.stamina - dropPx * FALL_STAMINA_PER_PX - ABORT_STAMINA_PENALTY,
    0,
    STAMINA_MAX,
  );
  // A survivable UNPROTECTED ground fall batters the lantern, scaled by how far
  // you fell — run-out becomes a rising dread, not a binary death cliff.
  const groundPenalty = result.caughtById == null ? s.fallFromY * FALL_GROUND_LIGHT_PENALTY : 0;
  s.light = clamp(s.light - ABORT_LIGHT_PENALTY - groundPenalty, 0, LIGHT_MAX);
  s.abortFlash = ABORT_FLASH_DURATION;
  s.slipKick = ABORT_FLASH_DURATION;
  s.fallProgress = 0;
  s.phase = 'choosing';
  recomputeReachable(s);
}

// ── TICK ─────────────────────────────────────────────────────────────────────

export function update(s: GameState, dt: number, pointer: Pointer): void {
  if (s.phase === 'won' || s.phase === 'lost') return;

  s.elapsed += dt;
  if (s.abortFlash > 0) s.abortFlash = Math.max(0, s.abortFlash - dt);
  if (s.slipKick > 0) s.slipKick = Math.max(0, s.slipKick - dt);
  if (s.strain > 0 && s.phase !== 'reaching') s.strain = Math.max(0, s.strain - dt * 3);

  // The lantern always bleeds.
  s.light -= LIGHT_DRAIN_RATE * dt;

  // Re-press gate: only a lifted pointer can arm the next action.
  if (!pointer.down) s.armed = true;

  switch (s.phase) {
    case 'choosing': {
      s.stamina = clamp(s.stamina + STAMINA_RECOVER_RATE * dt, 0, STAMINA_MAX);

      s.hoverHorn = pickHoverHorn(s, pointer);
      // Don't also highlight a hold under the horn — horn takes priority.
      s.hoverHoldId = s.hoverHorn ? null : pickHoverHold(s, pointer);

      if (pointer.down && s.armed) {
        if (s.hoverHorn) {
          beginAnchoring(s);
        } else if (s.hoverHoldId != null) {
          const target = holdById(s, s.hoverHoldId);
          if (target) beginReach(s, target);
        }
      }
      break;
    }

    case 'reaching': {
      const target = holdById(s, s.committedId!)!;
      if (!pointer.down) {
        startSlip(s); // released early → slip and fall
        break;
      }
      const cost = moveCost({ x: s.moveStartX, y: s.moveStartY }, target);
      const prev = s.resolveProgress;
      s.resolveProgress = clamp(prev + (1 / CLIMB_RESOLVE_DURATION) * dt, 0, 1);
      const frac = s.resolveProgress - prev;
      s.light -= cost.lightCost * frac;
      s.stamina -= cost.staminaCost * frac;

      // strain: how close this reach is to emptying you (visual wobble cue)
      s.strain = clamp(cost.staminaCost / Math.max(8, s.stamina + cost.staminaCost), 0, 1);

      // Animate the climber from launch hold toward the target along the reach.
      const e = climbEase(s.resolveProgress);
      s.climberX = s.moveStartX + (target.x - s.moveStartX) * e;
      s.climberY = s.moveStartY + (target.y - s.moveStartY) * e;

      if (s.stamina <= 0) {
        s.stamina = 0;
        startSlip(s); // ran out of strength mid-reach → slip
        break;
      }
      if (s.resolveProgress >= 1) completeReach(s);
      break;
    }

    case 'anchoring': {
      const hold = holdById(s, s.placingHoldId);
      if (!hold) {
        s.phase = 'choosing';
        break;
      }
      if (!pointer.down) {
        placeAnchor(s);
        break;
      }
      // Aim the seating angle from the horn toward the cursor (world space).
      const w = screenToWorld(s, pointer.x, pointer.y);
      s.seatAngle = Math.atan2(w.y - hold.hornY, w.x - hold.hornX);
      break;
    }

    case 'falling': {
      const drop = Math.max(1, s.fallFromY - s.fallToY);
      s.fallProgress = clamp(s.fallProgress + (dt * FALL_SPEED) / drop, 0, 1);
      // Animate the climber dropping for the render side.
      s.climberY = s.fallFromY + (s.fallToY - s.fallFromY) * s.fallProgress;
      if (s.fallProgress >= 1) landFall(s);
      break;
    }
  }

  if (s.light <= 0) {
    s.light = 0;
    s.phase = 'lost';
  }
}
