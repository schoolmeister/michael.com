/**
 * assets.ts — lazy image loading for the render module.
 *
 * Images are kicked off on first import (side-effect of `load()` below) and drawn only
 * once `.ready` is true. The render code uses a gray-box fallback while loading, so the
 * game looks fine whether or not the bitmaps have arrived yet (and main.ts stays untouched).
 *
 * Paths are RELATIVE (`assets/NAME.png`, no leading slash) so they resolve correctly in
 * BOTH the dev server (document at `/`) AND the production build (vite base `./`, served
 * under `/ascend-game/` and iframed by the /ascend route). An absolute `/assets/...` would
 * 404 in production and silently fall back to gray boxes on the live site.
 */

export interface Sprite {
  img: HTMLImageElement;
  ready: boolean;
  /** natural aspect ratio (w/h); 1 until loaded. */
  aspect: number;
}

function load(src: string): Sprite {
  const sprite: Sprite = { img: new Image(), ready: false, aspect: 1 };
  sprite.img.onload = () => {
    sprite.ready = true;
    sprite.aspect = sprite.img.naturalWidth / Math.max(1, sprite.img.naturalHeight);
  };
  sprite.img.src = src;
  return sprite;
}

/** The lantern-mountaineer, drawn as the torso at the CoG. */
export const climber = load('assets/climber.png');

/** Rock-hold variants. Index a hold into one of these deterministically by position. */
export const holdSprites: Sprite[] = [
  load('assets/hold-jug.png'),
  load('assets/hold-ledge.png'),
  load('assets/hold-flake.png'),
  load('assets/hold-pocket.png'),
];

/** Stable per-hold sprite pick (so a given hold always uses the same rock). */
export function holdSpriteFor(x: number, y: number): Sprite {
  const i = Math.abs(Math.round(x * 13.37 + y * 7.91)) % holdSprites.length;
  return holdSprites[i];
}
