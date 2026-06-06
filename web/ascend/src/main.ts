/**
 * main.ts — bootstrap + loop + level switching. The body sim is in sim.ts; this just
 * ticks it, renders, and handles level selection / reset / next-on-win.
 */

import { MAX_DT } from './config';
import { attachInput } from './input';
import { LEVELS, makeSprayWall } from './levels';
import { render } from './render';
import { createGame, loadLevel, update } from './sim';
import type { GameState } from './state';

/** Selectable slots: the designed levels + one generated "Spray Wall" at the end. */
const SPRAY_INDEX = LEVELS.length;
const SLOTS = LEVELS.length + 1;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);

let state: GameState = createGame(LEVELS[0], 0, window.innerWidth, window.innerHeight);

function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
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

function selectLevel(i: number): void {
  if (i < 0 || i >= SLOTS) return;
  // the last slot is the generated Spray Wall (re-rolled fresh each time it's selected)
  const level = i === SPRAY_INDEX ? makeSprayWall() : LEVELS[i];
  state = createGame(level, i, state.viewW, state.viewH);
}
function nextLevel(): void {
  selectLevel((state.levelIndex + 1) % SLOTS);
}

attachInput(canvas, () => state);

window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') loadLevel(state, state.level); // retry the current level/wall
  else if (e.key === 'g' || e.key === 'G') selectLevel(SPRAY_INDEX); // roll a new spray wall
  else if (e.key === 'n' || e.key === 'N') { if (state.phase === 'won') nextLevel(); }
  else if (e.key >= '1' && e.key <= '9') selectLevel(parseInt(e.key, 10) - 1);
});
// click advances on the win screen
canvas.addEventListener('pointerdown', () => { if (state.phase === 'won') nextLevel(); });

// debug hook for the headless harness / playtester
(window as unknown as { __state?: () => GameState }).__state = () => state;

let last = performance.now();
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > MAX_DT) dt = MAX_DT;
  if (dt < 0) dt = 0;
  update(state, dt);
  render(ctx, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
