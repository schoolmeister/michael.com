/**
 * main.ts — bootstrap, asset load, game loop, wiring.
 * Loop: clamp dt → update sim → lerp camera → render. Restart on click / R.
 */

import { CAMERA_LERP, MAX_DT } from './config';
import { createGame, update } from './climb';
import { loadAssets, type Assets } from './assets';
import { attachInput, createPointer } from './input';
import { render } from './render';
import type { GameState } from './state';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);

const pointer = createPointer();
let state: GameState = createGame(window.innerWidth, window.innerHeight);
let assets: Assets | null = null;

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
  state = createGame(state.viewW, state.viewH);
}

// Debug hook for the headless screenshot harness (harmless in a prototype).
(window as unknown as { __state?: () => GameState }).__state = () => state;

attachInput(canvas, pointer, () => state.phase === 'won' || state.phase === 'lost', restart);
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') restart();
});

function loadingScreen(msg: string): void {
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, state.viewW, state.viewH);
  ctx.fillStyle = 'rgba(220,200,150,0.85)';
  ctx.font = '16px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(msg, state.viewW / 2, state.viewH / 2);
}

let last = performance.now();
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > MAX_DT) dt = MAX_DT;
  if (dt < 0) dt = 0;

  if (assets) {
    update(state, dt, pointer);
    state.cameraY += (state.climberY - state.cameraY) * Math.min(1, CAMERA_LERP * dt);
    render(ctx, state, assets);
  } else {
    loadingScreen('lighting the lantern…');
  }
  requestAnimationFrame(frame);
}

loadAssets()
  .then((a) => {
    assets = a;
  })
  .catch((err) => {
    console.error(err);
    loadingScreen('failed to load assets — see console');
  });

requestAnimationFrame(frame);
