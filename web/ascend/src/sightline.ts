/**
 * sightline.ts — light level → how much you can SEE and READ.
 *
 * Two radii, both shrinking as the lantern dies:
 *   sightRadius   — beyond it, pure black. Holds outside are invisible.
 *   clarityRadius — within it you can READ a hold (its grip type + costs). Between
 *                   clarity and sight, a hold is a silhouette: you can reach it, but
 *                   you can't tell if it's a friendly jug or a vicious pocket.
 *
 * That gap is the whole "darkness steals information" mechanic: late in the run
 * you commit to reaches without knowing what you're grabbing. Dread.
 */

import {
  CLARITY_RADIUS_AT_DARK,
  CLARITY_RADIUS_AT_FULL_LIGHT,
  SIGHT_CALM_THRESHOLD,
  SIGHT_RADIUS_AT_DARK,
  SIGHT_RADIUS_AT_FULL_LIGHT,
} from './config';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Above the calm threshold you feel near-full sight; below it sight collapses
 *  fast (ease-out), so the late drain is where the dread lives. */
function vision(lightFrac: number): number {
  const t = clamp01(lightFrac / SIGHT_CALM_THRESHOLD);
  return clamp01(1 - (1 - t) * (1 - t));
}

/** Lantern reach (screen px) — how far you can see SILHOUETTES. Eases down,
 *  staying generous most of the run then collapsing into the end-game pool. */
export function sightRadius(lightFrac: number): number {
  return lerp(SIGHT_RADIUS_AT_DARK, SIGHT_RADIUS_AT_FULL_LIGHT, vision(lightFrac));
}

/** Within this radius (screen px) a hold can be READ (grip type + cost). Unlike
 *  sight, this degrades ~LINEARLY with the lantern — so you lose the ability to
 *  read grips early and gamble through most of the climb, not just the final
 *  seconds. That linear bleed is where the dread curve actually lives. */
export function clarityRadius(lightFrac: number): number {
  return lerp(CLARITY_RADIUS_AT_DARK, CLARITY_RADIUS_AT_FULL_LIGHT, clamp01(lightFrac));
}
