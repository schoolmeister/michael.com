/**
 * input.ts — pointer → aim-then-commit (limbs) + lean (body), ported from the HTML.
 *
 * Dragging a limb does NOT move it; it AIMS (a ghost preview in render). Release commits.
 * Dragging the body/CoG dot leans (fine weight control). All picking/aiming is in WORLD
 * space via sim's camera mapping, so it lines up with what render draws.
 */

import { GRAB_DIST, LIMB_REACH } from './config';
import { cog, commitLimb, screenToWorld, supportCentroid } from './sim';
import type { GameState, Limb } from './state';

export function attachInput(canvas: HTMLCanvasElement, get: () => GameState): void {
  const toWorld = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    // render works in CSS px (the ctx is dpr-scaled), so pointer CSS px maps directly
    return screenToWorld(get(), e.clientX - r.left, e.clientY - r.top);
  };

  canvas.addEventListener('pointerdown', (e) => {
    const s = get();
    if (s.phase !== 'climbing') return;
    const p = toWorld(e);
    canvas.setPointerCapture(e.pointerId);

    // pick a limb (within 22) first, else the CoG dot (within 18)
    let best: Limb | null = null;
    let bd = 22;
    for (const L of s.climber.limbs) {
      const d = Math.hypot(p.x - L.x, p.y - L.y);
      if (d < bd) { bd = d; best = L; }
    }
    const g = cog(s);
    const db = Math.hypot(p.x - g.x, p.y - g.y);
    if (db < 18 && db < bd) {
      s.drag = { kind: 'body', aimX: g.x, aimY: g.y, aimHold: null };
    } else if (best) {
      s.drag = { kind: 'limb', limb: best, aimX: best.x, aimY: best.y, aimHold: best.hold };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const s = get();
    if (!s.drag || s.phase !== 'climbing') return;
    const p = toWorld(e);
    if (s.drag.kind === 'limb') {
      const g = cog(s);
      let dx = p.x - g.x, dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d > LIMB_REACH) { dx *= LIMB_REACH / d; dy *= LIMB_REACH / d; }
      s.drag.aimX = g.x + dx;
      s.drag.aimY = g.y + dy;
      // snap to nearest hold within GRAB_DIST, else open air
      let near = null as null | (typeof s.holds)[number];
      let nd = GRAB_DIST;
      for (const h of s.holds) {
        const dd = Math.hypot(h.x - s.drag.aimX, h.y - s.drag.aimY);
        if (dd < nd) { nd = dd; near = h; }
      }
      if (near) { s.drag.aimHold = near; s.drag.aimX = near.x; s.drag.aimY = near.y; }
      else s.drag.aimHold = null;
    } else {
      // lean: pointer relative to the support centroid (clamped in the tick)
      const c = supportCentroid(s);
      s.climber.lean.x = p.x - c.x;
      s.climber.lean.y = p.y - c.y;
    }
  });

  const release = (e: PointerEvent) => {
    const s = get();
    if (s.drag && s.drag.kind === 'limb' && s.drag.limb) {
      commitLimb(s, s.drag.limb, s.drag.aimHold, s.drag.aimX, s.drag.aimY);
    }
    s.drag = null;
    void e;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
}
