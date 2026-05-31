/**
 * input.ts — mouse press / drag / hold / release, captured into a Pointer.
 *
 * Deliberately dumb: it records WHERE the pointer is and WHETHER it's down.
 * All meaning (which hold, commit vs abort) is derived by the sim in climb.ts,
 * so the rules live in one place. Mouse now; finger later — Pointer Events
 * cover both, so the same handlers will work on touch.
 *
 * Crucially: the drag is NOT a skill check. We capture raw position only; we
 * never measure steadiness or accuracy. Forgiving by construction.
 */

import type { Pointer } from './state';

export function createPointer(): Pointer {
  return { down: false, x: 0, y: 0, startX: 0, startY: 0 };
}

/**
 * Attach pointer handlers to the canvas.
 * @param onRestart called on a fresh press while the game is over (restart).
 */
export function attachInput(
  canvas: HTMLCanvasElement,
  pointer: Pointer,
  isEnded: () => boolean,
  onRestart: () => void,
): void {
  const pos = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  };

  canvas.addEventListener('pointerdown', (e) => {
    pos(e);
    if (isEnded()) {
      onRestart();
      return;
    }
    pointer.down = true;
    pointer.startX = pointer.x;
    pointer.startY = pointer.y;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    pos(e);
  });

  const release = (e: PointerEvent) => {
    pos(e);
    pointer.down = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  // If the pointer leaves the window mid-drag, treat as release (abort).
  window.addEventListener('blur', () => {
    pointer.down = false;
  });
}
