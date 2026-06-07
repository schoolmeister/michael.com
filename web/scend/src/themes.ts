/**
 * themes.ts — platform TILESET TEMPLATE + themes for SCEND.
 *
 * A platform is a 1-tile-tall walkable slab floating over a black abyss, drawn from a fixed
 * template grid so tile coordinates are STABLE forever. The artist paints art INTO this grid
 * (one PNG per theme, same layout), and the game blits named slots out of it.
 *
 * TEMPLATE GRID — 5 columns × 3 rows on a 64px cell (sheet 320×192). Cell (c,r) source rect
 * is ALWAYS (c*TEMPLATE_TILE, r*TEMPLATE_TILE, TEMPLATE_TILE, TEMPLATE_TILE). `blitTile` in
 * render.ts scales each 64px source cell down to the 44px gameplay TILE.
 *
 *   Row 0 — SURFACE (walkable top):  surfLeft  surfMid  surfRight  surfSingle  surfMidAlt
 *   Row 1 — UNDERSIDE (slab bottom): underLeft underMid underRight underSingle hangDetail
 *   Row 2 — HAZARDS / DECOR (future): spike    lavaTop  geyserVent corner      accent
 *
 * AUTHORING A NEW THEME: paint a copy of `assets-template/tileset-template.svg` at the SAME
 * layout, export a 320×192 PNG to `public/assets/<theme>.png`, then add a THEMES entry built
 * with `templateTheme(name, 'assets/<theme>.png')`. Switch with `setTheme('<theme>')`.
 *
 * The tileset INSPECTOR (TILESET_W/H + inspectorLayout) is a separate dev tool kept intact.
 */

import { load, type Sprite } from './assets';

/** Natural pixel size of the loaded tileset image (template sheet = 320×192). */
export const TILESET_W = 320;
export const TILESET_H = 192;

/** Fit-to-viewport layout for the tileset inspector (used by both render + pick math). */
export function inspectorLayout(viewW: number, viewH: number): { scale: number; ox: number; oy: number } {
  const padX = 16;
  const topPad = 50; // header room
  const botPad = 40; // picks/readout room
  const scale = Math.min((viewW - padX * 2) / TILESET_W, (viewH - topPad - botPad) / TILESET_H);
  const ox = (viewW - TILESET_W * scale) / 2;
  const oy = topPad;
  return { scale, ox, oy };
}

/** A source sub-rectangle in the tileset image (pixels). */
export interface Rect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Paintable cell size of the template grid. Cell (c,r) = (c*TEMPLATE_TILE, r*TEMPLATE_TILE). */
export const TEMPLATE_TILE = 64;

/** Build the source rect for grid cell (col,row) — the single source of truth for the layout. */
export function cell(col: number, row: number): Rect {
  return { sx: col * TEMPLATE_TILE, sy: row * TEMPLATE_TILE, sw: TEMPLATE_TILE, sh: TEMPLATE_TILE };
}

/** Named slot rects matching the template grid. */
export const SLOTS = {
  // Row 0 — SURFACE (walkable top)
  surfLeft: cell(0, 0),
  surfMid: cell(1, 0),
  surfRight: cell(2, 0),
  surfSingle: cell(3, 0),
  surfMidAlt: cell(4, 0),
  // Row 1 — UNDERSIDE (bottom edge of the floating slab)
  underLeft: cell(0, 1),
  underMid: cell(1, 1),
  underRight: cell(2, 1),
  underSingle: cell(3, 1),
  hangDetail: cell(4, 1),
  // Row 2 — HAZARDS / DECOR (optional, future theming)
  spike: cell(0, 2),
  lavaTop: cell(1, 2),
  geyserVent: cell(2, 2),
  corner: cell(3, 2),
  accent: cell(4, 2),
} as const;

export interface Theme {
  name: string;
  sprite: Sprite;
  // SURFACE row — the walkable top course of a platform.
  surfLeft: Rect;
  surfMid: Rect;
  surfRight: Rect;
  surfSingle: Rect;
  surfMidAlt: Rect;
  // UNDERSIDE row — drawn beneath the surface (the slab bottom is visible over the abyss).
  underLeft: Rect;
  underMid: Rect;
  underRight: Rect;
  underSingle: Rect;
  hangDetail: Rect;
  // HAZARDS / DECOR row — optional future theming (game still draws neon hazards in code).
  spike: Rect;
  lavaTop: Rect;
  geyserVent: Rect;
  corner: Rect;
  accent: Rect;
}

/**
 * Build a Theme from a template-layout PNG. Every theme reuses the identical named-slot rects
 * (the layout is fixed); only the image differs. Paint a copy of the template at the same grid.
 */
export function templateTheme(name: string, src: string): Theme {
  return { name, sprite: load(src), ...SLOTS };
}

/** The labeled TEMPLATE sheet — kept as a fallback / mapping reference. */
const TEMPLATE: Theme = templateTheme('template', 'assets/tileset-template.png');
/** Stone — the first painted theme (320×192, same grid as the template). */
const STONE: Theme = templateTheme('stone', 'assets/tileset-stone.png');

/** Registry, keyed by name. Painted themes first; `template` kept for reference. */
export const THEMES: Record<string, Theme> = {
  stone: STONE,
  template: TEMPLATE,
};

let active: Theme = THEMES.stone;

/** The platform theme `render.ts` currently draws with. */
export function activeTheme(): Theme {
  return active;
}

/** Swap the active theme by name (no-op if unknown). */
export function setTheme(name: string): void {
  const t = THEMES[name];
  if (t) active = t;
}
