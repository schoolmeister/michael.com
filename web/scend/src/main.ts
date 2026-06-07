/**
 * main.ts — bootstrap + loop. The whole game lives in sim.ts; this just sizes the canvas,
 * ticks the sim, renders, and wires the one button (jump while running, retry when not).
 */

import { MAX_DT } from './config';
import { attachInput } from './input';
import { render } from './render';
import {
  confirmChar, configAdjust, configMove, createGame, requestJump,
  returnToSelect, selectNext, selectPrev, toggleConfig, update,
  toggleInspector, inspSetMouse, inspPick, toggleGod, godSpeed
} from './sim';
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
  const prevChar = state.charId;
  state = createGame(newSeed(), state.viewW, state.viewH);
  state.charId = prevChar;
  state.selectIndex = prevChar;
  state.phase = 'running';
}

attachInput(canvas, {
  onPrimary: () => {
    if (state.inspectorOpen) return; // inspector swallows the click (it picks a tile)
    if (state.phase === 'select') {
      if (state.configOpen) toggleConfig(state); // Space closes the config menu
      else confirmChar(state);
    } else if (state.phase === 'running') requestJump(state);
    else restart();
  },
  onRestart: restart,
  onLeft:  () => { if (state.phase === 'select' && !state.inspectorOpen) { state.configOpen ? configAdjust(state, -1) : selectPrev(state); } },
  onRight: () => { if (state.phase === 'select' && !state.inspectorOpen) { state.configOpen ? configAdjust(state, 1) : selectNext(state); } },
  onUp:    () => { if (state.phase === 'select' && state.configOpen) configMove(state, -1); },
  onDown:  () => { if (state.phase === 'select' && state.configOpen) configMove(state, 1); },
  onConfig: () => { if (state.phase === 'select' && !state.inspectorOpen) toggleConfig(state); },
  onInspect: () => { if (state.phase === 'select') toggleInspector(state); },
  onGod: () => { if (state.phase === 'running') toggleGod(state); },
  onSpeedDown: () => { if (state.godMode) godSpeed(state, -1); },
  onSpeedUp: () => { if (state.godMode) godSpeed(state, 1); },
  onPointerMove: (x, y) => { if (state.inspectorOpen) inspSetMouse(state, x, y); },
  onPointerDown: (x, y) => { if (state.inspectorOpen) inspPick(state, x, y); },
  onEscape: () => {
    if (state.inspectorOpen) toggleInspector(state);
    else if (state.phase === 'select' && state.configOpen) toggleConfig(state);
    else if (state.phase === 'running') returnToSelect(state);
  },
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
