/**
 * input.ts — the entire control surface: one button. Space (or a click/tap) is the
 * "primary" action — jump while running, retry on the end screen. `R` always restarts.
 * Key-repeat is ignored so a held Space doesn't machine-gun jumps: every hop is a tap.
 */

export interface InputHandlers {
  onPrimary: () => void; // Space / click / tap
  onRestart: () => void; // R
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
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    window.focus(); // when embedded in an iframe, grab keyboard focus so Space works
    h.onPrimary();
  });
}
