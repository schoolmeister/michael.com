/**
 * input.ts — the entire control surface: one button. Space (or a click/tap) is the
 * "primary" action — jump while running, retry on the end screen. `R` always restarts.
 * Key-repeat is ignored so a held Space doesn't machine-gun jumps: every hop is a tap.
 */

export interface InputHandlers {
  onPrimary: () => void; // Space / click / tap
  onRestart: () => void; // R
  onLeft?: () => void;   // ← / A  (select / config adjust)
  onRight?: () => void;  // → / D  (select / config adjust)
  onUp?: () => void;     // ↑ / W  (config field up)
  onDown?: () => void;   // ↓ / S  (config field down)
  onConfig?: () => void; // C      (toggle config menu)
  onInspect?: () => void; // T     (toggle tileset inspector)
  onGod?: () => void;     // G      (toggle god mode)
  onSpeedDown?: () => void; // O    (god mode: slower)
  onSpeedUp?: () => void;   // P    (god mode: faster)
  onEscape?: () => void; // Esc    (return to character select / close config)
  onPointerMove?: (x: number, y: number) => void; // canvas-local px
  onPointerDown?: (x: number, y: number) => void; // canvas-local px
}

export function attachInput(canvas: HTMLCanvasElement, h: InputHandlers): void {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      h.onPrimary();
    } else if (e.code === 'KeyR') {
      h.onRestart();
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      h.onLeft?.();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      h.onRight?.();
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      h.onUp?.();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      h.onDown?.();
    } else if (e.code === 'KeyC') {
      h.onConfig?.();
    } else if (e.code === 'KeyT') {
      h.onInspect?.();
    } else if (e.code === 'KeyG') {
      h.onGod?.();
    } else if (e.code === 'KeyO') {
      h.onSpeedDown?.();
    } else if (e.code === 'KeyP') {
      h.onSpeedUp?.();
    } else if (e.code === 'Escape') {
      h.onEscape?.();
    }
  });

  const localXY = (e: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = localXY(e);
    h.onPointerMove?.(x, y);
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    window.focus(); // when embedded in an iframe, grab keyboard focus so Space works
    const [x, y] = localXY(e);
    h.onPointerDown?.(x, y);
    h.onPrimary();
  });
}
