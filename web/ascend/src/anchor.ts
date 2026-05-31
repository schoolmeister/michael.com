/**
 * anchor.ts — pure rope/anchor math. The HEART of the new skill verb, kept in one
 * place so the gameplay logic (placing, falling) and the render gauge compute
 * identical numbers. No state mutation, no drawing.
 *
 * The skill: when you sling a horn, you aim the sling's SEATING ANGLE. Each horn
 * has a safe cone (a wedge pointing into its load-bearing notch). Seat within the
 * cone → bomber; off to the side → it'll rip when you weight it. Darkness hides
 * the cone, so placing good pro late in the run is a gamble (render shows the cone
 * only within the lantern's clear radius).
 */

import {
  ANCHOR_MARGINAL_QUALITY,
  ANCHOR_RIP_FALL_DISTANCE,
  ANCHOR_SOLID_QUALITY,
  FALL_DEATH_HEIGHT,
  FALL_SLACK,
  HORN_CONE_HALF_WIDTH,
} from './config';
import type { Anchor, Hold } from './state';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Smallest absolute difference between two angles (radians), in [0, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/**
 * Seating quality 0..1 for slinging `hold`'s horn at `seatAngle` (radians, world).
 * 1 = dead-centre in the safe cone (bomber); 0 = pointing the wrong way entirely.
 * The cone centre points into the corner's load-bearing notch (generated per horn).
 */
export function seatingQuality(hold: Hold, seatAngle: number): number {
  const off = angleDiff(seatAngle, hold.hornConeCenter);
  // linear falloff: 1 at centre → 0 at (a little past) the cone edge
  return clamp(1 - off / (HORN_CONE_HALF_WIDTH * 1.15), 0, 1);
}

export type QualityTier = 'solid' | 'marginal' | 'bad';
export function qualityTier(q: number): QualityTier {
  if (q >= ANCHOR_SOLID_QUALITY) return 'solid';
  if (q >= ANCHOR_MARGINAL_QUALITY) return 'marginal';
  return 'bad';
}

/** Will an anchor of this quality rip, given how far above it the fall began? */
export function wouldRip(quality: number, fallAbovePx: number): boolean {
  if (quality < ANCHOR_MARGINAL_QUALITY) return true; // bad seats always rip
  if (quality < ANCHOR_SOLID_QUALITY) return fallAbovePx > ANCHOR_RIP_FALL_DISTANCE; // marginal: hard catch rips
  return false; // solid: bomber
}

export interface FallResult {
  /** World Y the fall bottoms out at (the scary low point of the animation). */
  toY: number;
  /** The anchor that caught the fall (null = hit the ground). */
  caughtById: number | null;
  /** Anchors that ripped during the fall and must be removed (high→low order). */
  rippedIds: number[];
  /** True if the climber fell to the ground from a fatal height. */
  death: boolean;
}

/**
 * Resolve a fall from `climberY`, with the rope running over `ropeAnchorId`,
 * cascading through anchors that rip. Pure — caller applies the result.
 *
 * Lead-fall geometry: you fall to roughly twice the distance you were above the
 * catching anchor (plus slack). A ripping anchor drops you to the next one down.
 */
export function resolveFall(
  climberY: number,
  anchors: Anchor[],
  ropeAnchorId: number | null,
): FallResult {
  const rippedIds: number[] = [];
  let caughtId = ropeAnchorId;

  while (caughtId != null) {
    const a = anchors.find((x) => x.id === caughtId);
    if (!a) break;
    const fallAbove = Math.max(0, climberY - a.y);
    if (wouldRip(a.quality, fallAbove)) {
      rippedIds.push(a.id);
      const lower = anchors
        .filter((x) => x.y < a.y && !rippedIds.includes(x.id))
        .sort((p, q) => q.y - p.y)[0];
      caughtId = lower ? lower.id : null;
      continue;
    }
    const toY = Math.max(0, 2 * a.y - climberY - FALL_SLACK);
    return { toY, caughtById: a.id, rippedIds, death: false };
  }

  // No anchor caught it — ground fall.
  return { toY: 0, caughtById: null, rippedIds, death: climberY > FALL_DEATH_HEIGHT };
}
