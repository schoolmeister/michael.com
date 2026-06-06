/**
 * main.ts — bootstrap + loop. The whole game lives in sim.ts; this just sizes the canvas,
 * ticks the sim, renders, and wires the one button (jump while running, retry when not).
 */

import { MAX_DT } from './config';
import { attachInput } from './input';
import { render } from './render';
import { createGame, requestJump, update } from './sim';
import type { GameState } from './state';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);

function newSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

let state: GameState = createGame(newSeed(), window.innerWidth, window.innerHeight);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.viewW = w;
  state.viewH = h;
}
window.addEventListener('resize', resize);
resize();

function restart(): void {
  state = createGame(newSeed(), state.viewW, state.viewH);
}

attachInput(canvas, {
  onPrimary: () => {
    if (state.phase === 'running') requestJump(state);
    else restart();
  },
  onRestart: restart
});

// When embedded in the SvelteKit window's iframe, take focus so Space reaches the game
// without needing a click first.
window.focus();

let last = performance.now();
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > MAX_DT) dt = MAX_DT;
  update(state, dt);
  render(ctx, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
