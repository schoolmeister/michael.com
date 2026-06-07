/**
 * assets.ts — lazy image loading for SCEND's sprite characters.
 *
 * Paths are RELATIVE (`assets/NAME.png`, no leading slash) so they resolve correctly in
 * both the dev server (document at `/`) and the production build (vite base `./`, served
 * under `/scend-game/`). An absolute `/assets/...` would 404 in production.
 */

export interface Sprite {
  img: HTMLImageElement;
  ready: boolean;
  aspect: number;
}

export function load(src: string): Sprite {
  const sprite: Sprite = { img: new Image(), ready: false, aspect: 1 };
  sprite.img.onload = () => {
    sprite.ready = true;
    sprite.aspect = sprite.img.naturalWidth / Math.max(1, sprite.img.naturalHeight);
  };
  sprite.img.src = src;
  return sprite;
}

export interface SpriteSheet {
  sprite: Sprite;
  cols: number;
  frames: number;
  frameW: number;
  frameH: number;
  /** true = use 'screen' composite op to drop a solid black background */
  screen: boolean;
}

/**
 * One entry per sprite character (index === charId).
 * charId 2 = Cube (no sprite, handled as a fallback in render.ts).
 */
export const CHARS: SpriteSheet[] = [
  // charId 0 — Fleshman1: 5×5 sheet, transparent background
  {
    sprite: load('assets/Fleshman-run.png'),
    cols: 5, frames: 25, frameW: 256, frameH: 256, screen: false,
  },
  // charId 1 — Fleshman2: 6×3 sheet, black background → screen blend
  {
    sprite: load('assets/fleshman-2-run.png'),
    cols: 6, frames: 16, frameW: 256, frameH: 341, screen: true,
  },
];

export const ANIM_FPS = 18;
/** Shared animation cycle length — LCM(25, 16) = 400, so both frame counts divide evenly. */
export const ANIM_CYCLE = 400;
