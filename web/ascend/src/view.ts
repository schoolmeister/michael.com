/**
 * view.ts — the ONE camera mapping. Shared by render (drawing) and climb/input
 * (cursor hit-testing) so what you click is exactly what you see. Do not inline
 * this mapping anywhere else — both sides must agree, including the slip kick.
 *
 * World: +Y up. Screen: +Y down. No horizontal camera (climber's worldX == screenX).
 */

import { CLIMBER_SCREEN_ANCHOR } from './config';
import type { GameState } from './state';

/** Downward camera jolt (screen px) during a slip — eases out over ~0.7s. */
export function slipKickPx(s: GameState): number {
  return s.slipKick > 0 ? Math.sin((s.slipKick / 0.7) * Math.PI) * 14 : 0;
}

/** The climber's anchored screen-Y (the camera focus line), incl. the slip kick. */
export function focusScreenY(s: GameState): number {
  return s.viewH * CLIMBER_SCREEN_ANCHOR + slipKickPx(s);
}

export interface ScreenPt {
  x: number;
  y: number;
}

/** World → screen. */
export function worldToScreen(s: GameState, wx: number, wy: number): ScreenPt {
  return { x: wx, y: focusScreenY(s) - (wy - s.cameraY) };
}

/** Screen → world. */
export function screenToWorld(s: GameState, sxp: number, syp: number): ScreenPt {
  return { x: sxp, y: s.cameraY - (syp - focusScreenY(s)) };
}
