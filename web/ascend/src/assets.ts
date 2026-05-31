/**
 * assets.ts — preload sprites, and key the white background out of the climber.
 *
 * The climber art ships on a solid white-ish background (not real transparency),
 * which renders as an ugly card. We strip near-white pixels to alpha 0 at load
 * (with a soft edge) so the figure sits on the wall cleanly. Rough but it's a
 * prototype. The rock holds are already transparent, so they're used as-is.
 */

import type { HoldType } from './config';

export type Sprite = HTMLImageElement | HTMLCanvasElement;

export interface Assets {
  climber: Sprite;
  holds: Record<HoldType, HTMLImageElement>;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

/** Turn near-white pixels transparent (soft threshold) and trim to content. */
function keyOutWhite(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], gr = px[i + 1], b = px[i + 2];
    const min = Math.min(r, gr, b);
    // very light + low saturation → background
    if (min > 232 && Math.max(r, gr, b) - min < 22) {
      px[i + 3] = 0;
    } else if (min > 210 && Math.max(r, gr, b) - min < 30) {
      px[i + 3] = Math.round(px[i + 3] * (1 - (min - 210) / 22)); // soft edge
    }
  }
  g.putImageData(data, 0, 0);
  return c;
}

export async function loadAssets(): Promise<Assets> {
  // Resolve relative to Vite's base URL so the game works both standalone
  // (served at /) and embedded under a subpath (e.g. /ascend-game/).
  const base = import.meta.env.BASE_URL;
  const [climber, jug, ledge, flake, pocket] = await Promise.all([
    load(`${base}assets/climber.png`),
    load(`${base}assets/hold-jug.png`),
    load(`${base}assets/hold-ledge.png`),
    load(`${base}assets/hold-flake.png`),
    load(`${base}assets/hold-pocket.png`),
  ]);
  return { climber: keyOutWhite(climber), holds: { jug, ledge, flake, pocket } };
}
