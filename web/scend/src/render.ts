/**
 * render.ts — neon Canvas2D for SCEND, tuned for SPEED. Three glowing floors over a black
 * abyss, each with its own neon edge colour so you can read which floor you're aiming for.
 * Parallax skyline, speed lines, afterimage trail, screen shake, fat >> readout.
 * World x → screen via `− camX`; vertical is already screen-space.
 */

import * as C from './config';
import * as A from './assets';
import { activeTheme, inspectorLayout, TILESET_W, TILESET_H, type Rect } from './themes';
import { TUNE_FIELDS, formatTune } from './tunables';
import type { GameState, Platform } from './state';
import { laneScreenY, screenY, isInvuln } from './sim';

const P = C.PALETTE;
const PLAT_THICK = C.TILE * 0.6;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
/** lane → its cycling neon edge colour (lanes are infinite, so cycle the 3-colour ramp). */
const laneEdgeColor = (lane: number): string => P.laneEdge[((lane % 3) + 3) % 3];

export function render(ctx: CanvasRenderingContext2D, s: GameState): void {
  const { viewW, viewH } = s;
  ctx.clearRect(0, 0, viewW, viewH);

  drawBackdrop(ctx, s);
  drawSpeedLines(ctx, s);

  ctx.save();
  if (s.shake > 0.2) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
  // camera zoom: scale the world around a fixed pivot (the player's screen anchor)
  if (s.zoom !== 1) {
    const pivotX = viewW * C.PLAYER_ANCHOR_X;
    const pivotY = viewH * C.ZOOM_PIVOT_FRAC;
    ctx.translate(pivotX, pivotY);
    ctx.scale(s.zoom, s.zoom);
    ctx.translate(-pivotX, -pivotY);
  }
  drawLaneGuides(ctx, s);
  drawPlatforms(ctx, s);
  drawGeysers(ctx, s);
  drawPickups(ctx, s);
  drawEnemies(ctx, s);
  drawProjectiles(ctx, s);
  drawParticles(ctx, s);
  drawTrail(ctx, s);
  drawPlayer(ctx, s);
  drawFloats(ctx, s);
  ctx.restore();

  if (s.boostFlash > 0) drawBoostFlash(ctx, s);
  if (s.phase === 'select') {
    if (s.inspectorOpen) drawInspector(ctx, s);
    else if (s.configOpen) drawConfigMenu(ctx, s);
    else drawSelectScreen(ctx, s);
    return;
  }
  drawHud(ctx, s);
  if (s.phase !== 'running') drawOverlay(ctx, s);
}

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
function noGlow(ctx: CanvasRenderingContext2D): void { ctx.shadowBlur = 0; }

/** Blend BG_DEEP→BG_HIGH at t (0..1) and return an rgb() string. */
function bgShade(t: number): string {
  const D = C.BG_DEEP, H = C.BG_HIGH;
  const m = (a: number, b: number) => Math.round(a + (b - a) * clamp01(t));
  return `rgb(${m(D[0], H[0])},${m(D[1], H[1])},${m(D[2], H[2])})`;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, s: GameState): void {
  const { viewW, viewH } = s;
  // depth shade by the floor the player is on: deeper down = darker, higher up = lighter.
  const tt = 0.45 + s.player.lane / C.BG_LANE_RANGE;
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, bgShade(tt + 0.18)); // top of view (looking up) — lighter
  grad.addColorStop(1, bgShade(tt - 0.3)); // bottom (the abyss) — darker
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  noGlow(ctx);

  drawSkyline(ctx, s, 0.12, viewH * 0.55, 0.10, P.bgFar, 120);
  drawSkyline(ctx, s, 0.28, viewH * 0.68, 0.16, P.bgNear, 90);
}

/** Faint guide line under each floor (drawn INSIDE the zoom layer so it tracks platforms). */
function drawLaneGuides(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.strokeStyle = P.grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.22;
  const x1 = s.viewW / Math.max(0.3, s.zoom) + s.viewW; // overshoot to cover the zoomed-out view
  const c = s.player.lane;
  for (let l = c - 5; l <= c + 5; l++) {
    const y = laneScreenY(s, l);
    ctx.beginPath();
    ctx.moveTo(-s.viewW, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSkyline(
  ctx: CanvasRenderingContext2D, s: GameState, par: number, baseY: number,
  alpha: number, color: string, cell: number
): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const off = (s.camX * par) % cell;
  for (let x = -off - cell; x < s.viewW + cell; x += cell) {
    const idx = Math.round((x + s.camX * par) / cell);
    const hh = 40 + (Math.abs(Math.sin(idx * 12.9898) * 43758.5453) % 1) * 160;
    ctx.fillRect(x, baseY - hh, cell * 0.7, hh + 500);
  }
  ctx.globalAlpha = 1;
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, s: GameState): void {
  if (s.speed < C.SPEEDLINE_MIN_SPEED) return;
  const { viewW, viewH } = s;
  const t = Math.min(1, (s.speed - C.SPEEDLINE_MIN_SPEED) / 600);
  const n = Math.round(t * C.SPEEDLINE_MAX);
  ctx.strokeStyle = P.player;
  ctx.lineWidth = 1.5;
  glow(ctx, P.player, 6);
  for (let i = 0; i < n; i++) {
    const y = (Math.abs(Math.sin((i + 1) * 78.233 + Math.floor(s.distance / 40)) * 43758.5453) % 1) * viewH;
    const len = 50 + Math.random() * 130 * (0.5 + t);
    const x = Math.random() * viewW;
    ctx.globalAlpha = 0.12 + 0.24 * t;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  noGlow(ctx);
}

/** Blit one source rect from the active theme's tileset, scaled to (dw,dh) at (dx,dy). */
function blitTile(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement, rc: Rect,
  dx: number, dy: number, dw: number, dh: number
): void {
  // round dest to whole px and overdraw 1px to hide seams between adjacent tiles
  ctx.drawImage(img, rc.sx, rc.sy, rc.sw, rc.sh, Math.floor(dx), Math.floor(dy), Math.ceil(dw) + 1, Math.ceil(dh) + 1);
}

function drawPlatforms(ctx: CanvasRenderingContext2D, s: GameState): void {
  const theme = activeTheme();
  const tiled = theme.sprite.ready;
  noGlow(ctx);

  for (const plat of s.world.platforms) {
    const px0 = plat.col0 * C.TILE - s.camX;
    const px1 = (plat.col1 + 1) * C.TILE - s.camX;
    if (px1 < -C.TILE || px0 > s.viewW + C.TILE) continue;
    const top = laneScreenY(s, plat.lane);
    const nTiles = plat.col1 - plat.col0 + 1;

    if (tiled) {
      const img = theme.sprite.img;
      // Per-column: pick the surface slot by position in the run.
      // 1 wide → single; first col → left cap; last col → right cap; else repeating mid.
      // (Underside `under-*` slots are intentionally not drawn for now — kept in the tileset.)
      for (let i = 0; i < nTiles; i++) {
        const dx = (plat.col0 + i) * C.TILE - s.camX;
        let surf: Rect;
        if (nTiles === 1) {
          surf = theme.surfSingle;
        } else if (i === 0) {
          surf = theme.surfLeft;
        } else if (i === nTiles - 1) {
          surf = theme.surfRight;
        } else {
          surf = theme.surfMid;
        }
        blitTile(ctx, img, surf, dx, top, C.TILE, C.TILE);
      }
    } else {
      // fallback: the original neon slab so the game never renders blank
      ctx.fillStyle = P.ground;
      ctx.fillRect(px0, top, px1 - px0, PLAT_THICK);
    }

    // hazards per tile — always drawn ON TOP so spikes/lava stay readable
    for (let i = 0; i < plat.tiles.length; i++) {
      const kind = plat.tiles[i];
      if (kind === 'solid') continue;
      const sx = (plat.col0 + i) * C.TILE - s.camX;
      drawHazardTile(ctx, kind, sx, top);
    }

    // subtle neon top-edge accent so each floor stays readable at speed
    const edge = laneEdgeColor(plat.lane);
    glow(ctx, edge, tiled ? 6 : 12);
    ctx.fillStyle = edge;
    ctx.globalAlpha = tiled ? 0.55 : 1;
    ctx.fillRect(px0, top - 1, px1 - px0, tiled ? 2 : 3);
    ctx.globalAlpha = 1;
    noGlow(ctx);
  }
}

function drawHazardTile(ctx: CanvasRenderingContext2D, kind: Platform['tiles'][number], sx: number, top: number): void {
  if (kind === 'lava') {
    glow(ctx, P.lava, 20);
    ctx.fillStyle = P.lava;
    ctx.fillRect(sx, top, C.TILE + 1, C.TILE * 0.45);
    noGlow(ctx);
  } else if (kind === 'spike') {
    glow(ctx, P.spike, 16);
    ctx.fillStyle = P.spike;
    const n = 3;
    const w = C.TILE / n;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * w, top);
      ctx.lineTo(sx + i * w + w / 2, top - w * 0.95);
      ctx.lineTo(sx + i * w + w, top);
      ctx.closePath();
      ctx.fill();
    }
    noGlow(ctx);
  }
}

function drawGeysers(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const g of s.world.geysers) {
    if (g.dead) continue;
    const sx = g.x - s.camX;
    if (sx < -C.TILE || sx > s.viewW + C.TILE) continue;
    const base = laneScreenY(s, g.lane);
    if (g.phase < C.GEYSER_ERUPT) {
      const h = C.GEYSER_HEIGHT * C.TILE;
      glow(ctx, P.geyser, 24);
      ctx.fillStyle = P.geyser;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(sx - C.TILE * 0.22, base - h, C.TILE * 0.44, h);
      ctx.globalAlpha = 1;
      noGlow(ctx);
    } else {
      ctx.fillStyle = P.geyser;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(sx - C.TILE * 0.15, base - 14, C.TILE * 0.3, 9);
      ctx.globalAlpha = 1;
    }
  }
}

function drawPickups(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const pk of s.world.pickups) {
    if (pk.taken) continue;
    const sx = pk.x - s.camX;
    if (sx < -C.TILE || sx > s.viewW + C.TILE) continue;
    const bob = Math.sin(s.time * 6 + pk.x) * 3;
    const sy = laneScreenY(s, pk.lane) - C.PICKUP_VIS_FLOAT * C.TILE + bob;
    const r = C.TILE * 0.3;
    const color = pk.kind === 'boots' ? P.boost : pk.kind === 'knife' ? P.knife
      : pk.kind === 'magnet' ? P.magnet : pk.kind === 'boot' ? P.boot : P.stomp;
    glow(ctx, color, 18);
    ctx.fillStyle = color;
    if (pk.kind === 'boots') drawChevronIcon(ctx, sx, sy, r);
    else if (pk.kind === 'knife') drawKnifeIcon(ctx, sx, sy, r);
    else if (pk.kind === 'magnet') drawMagnetIcon(ctx, sx, sy, r);
    else drawGlyphIcon(ctx, sx, sy, r, pk.kind === 'boot' ? 'K' : 'S');
    noGlow(ctx);
  }
}

// ── small vector pickup icons (no more lame letters) ───────────────────────────
function drawChevronIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.lineWidth = Math.max(2, r * 0.28);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle;
  for (let k = 0; k < 2; k++) {
    const ox = x - r * 0.5 + k * r * 0.7;
    ctx.beginPath();
    ctx.moveTo(ox - r * 0.35, y - r * 0.6);
    ctx.lineTo(ox + r * 0.35, y);
    ctx.lineTo(ox - r * 0.35, y + r * 0.6);
    ctx.stroke();
  }
}
function drawKnifeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  // blade (diamond) pointing up
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.3, y + r * 0.2);
  ctx.lineTo(x, y + r * 0.45);
  ctx.lineTo(x - r * 0.3, y + r * 0.2);
  ctx.closePath();
  ctx.fill();
  // crossguard + handle
  ctx.fillRect(x - r * 0.55, y + r * 0.4, r * 1.1, r * 0.2);
  ctx.fillRect(x - r * 0.14, y + r * 0.55, r * 0.28, r * 0.55);
}
/** magnet boots — a downward arrow (dive). */
function drawMagnetIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.lineWidth = Math.max(2, r * 0.3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.7);
  ctx.lineTo(x, y + r * 0.5);
  ctx.moveTo(x - r * 0.45, y + r * 0.05);
  ctx.lineTo(x, y + r * 0.6);
  ctx.lineTo(x + r * 0.45, y + r * 0.05);
  ctx.stroke();
}
/** generic disc + letter (boot = K, stomp = S). */
function drawGlyphIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, letter: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = '#1a0a04';
  ctx.font = `bold ${Math.round(r * 1.1)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, y + 1);
}

function drawEnemies(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const e of s.world.enemies) {
    if (e.dead) continue;
    const sx = e.x - s.camX;
    if (sx < -C.TILE * 2 || sx > s.viewW + C.TILE * 2) continue;
    const sy = screenY(s, e.y);
    ctx.globalAlpha = e.kicked ? 0.7 : 1;
    if (e.kind === 'ghost') {
      const r = C.TILE * 0.36;
      glow(ctx, P.ghost, 18);
      ctx.fillStyle = P.ghost;
      ctx.beginPath();
      ctx.arc(sx, sy, r, Math.PI, 0);
      ctx.lineTo(sx + r, sy + r);
      ctx.lineTo(sx - r, sy + r);
      ctx.closePath();
      ctx.fill();
      noGlow(ctx);
      ctx.fillStyle = '#0b0617';
      ctx.fillRect(sx - r * 0.45, sy - r * 0.2, r * 0.3, r * 0.4);
      ctx.fillRect(sx + r * 0.15, sy - r * 0.2, r * 0.3, r * 0.4);
    } else if (e.kind === 'hobgoblin') {
      const hw = C.TILE * 0.9, hh = C.TILE;
      glow(ctx, P.hobgoblin, 16);
      ctx.fillStyle = P.hobgoblin;
      roundRect(ctx, sx - hw, sy - hh, hw * 2, hh * 2, 8);
      ctx.fill();
      noGlow(ctx);
      ctx.fillStyle = '#0b1a07'; // eyes
      ctx.fillRect(sx - hw * 0.5, sy - hh * 0.4, hw * 0.3, hh * 0.3);
      ctx.fillRect(sx + hw * 0.2, sy - hh * 0.4, hw * 0.3, hh * 0.3);
    } else {
      const r = C.TILE * 0.46;
      glow(ctx, P.boulder, 14);
      ctx.fillStyle = P.boulder;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      noGlow(ctx);
      ctx.strokeStyle = '#3a2a14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.6, 0.4, 2.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const pr of s.projectiles) {
    const sx = pr.x - s.camX;
    const sy = screenY(s, pr.y);
    if (pr.kind === 'boo') {
      glow(ctx, P.boo, 16);
      ctx.fillStyle = P.boo;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      noGlow(ctx);
    } else {
      glow(ctx, P.knife, 14);
      ctx.fillStyle = P.knife;
      ctx.fillRect(sx - 12, sy - 2, 24, 4);
      noGlow(ctx);
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const pt of s.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = a;
    glow(ctx, pt.color, 8);
    ctx.fillStyle = pt.color;
    const sz = pt.size * (0.4 + a);
    ctx.fillRect(pt.x - s.camX - sz / 2, screenY(s, pt.y) - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  noGlow(ctx);
}

// Display size for sprite characters (bottom-aligned to hitbox floor)
const SPRITE_W = 54;
const SPRITE_H = 54;

/** Blit one animation frame from a SpriteSheet to (destX, destY) at the given display size. */
function blitFrame(
  ctx: CanvasRenderingContext2D, sheet: A.SpriteSheet,
  frame: number, destX: number, destY: number, dw: number, dh: number
): void {
  const f = frame % sheet.frames;
  const col = f % sheet.cols;
  const row = Math.floor(f / sheet.cols);
  if (sheet.screen) ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(sheet.sprite.img, col * sheet.frameW, row * sheet.frameH, sheet.frameW, sheet.frameH, destX, destY, dw, dh);
  if (sheet.screen) ctx.globalCompositeOperation = 'source-over';
}

function drawTrail(ctx: CanvasRenderingContext2D, s: GameState): void {
  const n = s.trail.length;
  const sheet = A.CHARS[s.charId];
  const useSprite = sheet?.sprite.ready ?? false;
  for (let i = 0; i < n; i++) {
    const tr = s.trail[i];
    ctx.globalAlpha = (i / n) * (useSprite ? 0.3 : 0.45);
    const sx = tr.x - s.camX;
    const syT = screenY(s, tr.y);
    if (useSprite) {
      blitFrame(ctx, sheet, tr.frame, sx - SPRITE_W / 2, syT + C.PLAYER_H - SPRITE_H, SPRITE_W, SPRITE_H);
    } else {
      ctx.fillStyle = tr.wet ? P.horns : P.player;
      const shrink = (1 - i / n) * 6;
      roundRect(ctx, sx - C.PLAYER_W / 2 + shrink, syT + shrink, C.PLAYER_W - shrink * 2, C.PLAYER_H - shrink * 2, 5);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: GameState): void {
  const p = s.player;
  const sx = p.x - s.camX;
  const py = screenY(s, p.y);
  const invuln = isInvuln(s);
  const color = invuln ? P.horns : P.player;

  const chev = Math.floor(s.speedBoost / C.BOOST_PER_CHEVRON);
  if (chev > 0) {
    glow(ctx, P.boost, 10);
    ctx.fillStyle = P.boost;
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.8;
    ctx.fillText('»'.repeat(Math.min(chev, 6)), sx - C.PLAYER_W / 2 - 2, py + C.PLAYER_H / 2);
    ctx.globalAlpha = 1;
    noGlow(ctx);
  }

  const sheet = A.CHARS[s.charId];
  if (sheet?.sprite.ready) {
    if (invuln) {
      glow(ctx, P.horns, 22);
      ctx.strokeStyle = P.horns;
      ctx.lineWidth = 3;
      roundRect(ctx, sx - C.PLAYER_W / 2 - 2, py - 2, C.PLAYER_W + 4, C.PLAYER_H + 4, 6);
      ctx.stroke();
      noGlow(ctx);
    }
    blitFrame(ctx, sheet, s.animFrame, sx - SPRITE_W / 2, py + C.PLAYER_H - SPRITE_H, SPRITE_W, SPRITE_H);
  } else {
    glow(ctx, color, invuln ? 28 : 24);
    ctx.fillStyle = color;
    roundRect(ctx, sx - C.PLAYER_W / 2, py, C.PLAYER_W, C.PLAYER_H, 6);
    ctx.fill();
    noGlow(ctx);
  }

  if (p.knife) {
    ctx.fillStyle = P.knife;
    ctx.fillRect(sx + C.PLAYER_W / 2, py + C.PLAYER_H * 0.3, 9, 3);
  }
}

function drawFloats(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 18px ui-monospace, monospace';
  for (const f of s.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 1.5);
    glow(ctx, f.color, 10);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - s.camX, screenY(s, f.y));
  }
  ctx.globalAlpha = 1;
  noGlow(ctx);
}

function drawBoostFlash(ctx: CanvasRenderingContext2D, s: GameState): void {
  const a = Math.min(0.35, s.boostFlash * 0.8);
  const grad = ctx.createRadialGradient(s.viewW / 2, s.viewH / 2, s.viewH * 0.2, s.viewW / 2, s.viewH / 2, s.viewH * 0.75);
  grad.addColorStop(0, 'rgba(93,255,155,0)');
  grad.addColorStop(1, `rgba(93,255,155,${a})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s.viewW, s.viewH);
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState): void {
  noGlow(ctx);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  glow(ctx, P.player, 10);
  ctx.fillStyle = P.text;
  ctx.font = 'bold 34px ui-monospace, monospace';
  ctx.fillText(`${Math.round(s.speed)}`, 14, 10);
  noGlow(ctx);
  ctx.fillStyle = P.textDim;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.fillText('SPEED', 16, 46);

  const chev = Math.floor(s.speedBoost / C.BOOST_PER_CHEVRON);
  if (chev > 0) {
    glow(ctx, P.boost, 8);
    ctx.fillStyle = P.boost;
    ctx.font = 'bold 20px ui-monospace, monospace';
    ctx.fillText('»'.repeat(Math.min(chev, 10)), 92, 18);
    noGlow(ctx);
  }

  const remaining = Math.max(0, C.WIN_TIME - s.time);
  const mm = Math.floor(remaining / 60);
  const ss = Math.floor(remaining % 60);
  ctx.textAlign = 'right';
  ctx.fillStyle = P.text;
  ctx.font = 'bold 16px ui-monospace, monospace';
  ctx.fillText(`${mm}:${ss.toString().padStart(2, '0')}`, s.viewW - 14, 12);
  ctx.fillStyle = P.textDim;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.fillText(`${Math.round(s.distance / C.TILE)} m`, s.viewW - 14, 34);

  const tells: string[] = [];
  if (s.godMode) tells.push('GOD · O/P speed');
  if (isInvuln(s)) tells.push('CHARGED');
  if (s.player.knife) tells.push('KNIFE');
  if (s.player.boot) tells.push('KICK');
  if (s.player.stomp) tells.push('STOMP');
  if (tells.length) {
    ctx.fillStyle = P.text;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(tells.join('  '), s.viewW - 14, 54);
  }
  ctx.textAlign = 'left';
}

function drawSelectScreen(ctx: CanvasRenderingContext2D, s: GameState): void {
  const { viewW, viewH } = s;

  // dark backdrop
  ctx.fillStyle = 'rgba(5,4,16,0.82)';
  ctx.fillRect(0, 0, viewW, viewH);

  // title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  glow(ctx, P.player, 18);
  ctx.fillStyle = P.player;
  ctx.font = 'bold 28px ui-monospace, monospace';
  ctx.fillText('SELECT CHARACTER', viewW / 2, viewH * 0.22);
  noGlow(ctx);

  // three slots
  const slotW = 110;
  const slotH = 140;
  const gap = 40;
  const totalW = slotW * 3 + gap * 2;
  const slotY = viewH * 0.42;
  const centerX = viewW / 2;

  const chars = [
    { name: 'FLESHMAN', id: 0 },
    { name: 'FLESHMAN II', id: 1 },
    { name: 'CUBE', id: 2 },
  ];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const slotX = centerX - totalW / 2 + i * (slotW + gap);
    const selected = s.selectIndex === i;

    // slot border
    ctx.strokeStyle = selected ? P.player : P.textDim;
    ctx.lineWidth = selected ? 2.5 : 1;
    if (selected) glow(ctx, P.player, 20);
    ctx.strokeRect(slotX, slotY - slotH / 2, slotW, slotH);
    noGlow(ctx);

    // character preview
    const previewCx = slotX + slotW / 2;
    const previewCy = slotY + slotH * 0.08;

    const sheet = A.CHARS[ch.id];
    if (sheet?.sprite.ready) {
      blitFrame(ctx, sheet, s.animFrame, previewCx - 42, previewCy - 42, 84, 84);
    } else if (sheet && !sheet.sprite.ready) {
      // loading placeholder
      ctx.fillStyle = P.player;
      ctx.globalAlpha = 0.4;
      roundRect(ctx, previewCx - 18, previewCy - 22, 36, 44, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // Cube — neon rectangle (no sheet entry)
      glow(ctx, P.player, 20);
      ctx.fillStyle = P.player;
      roundRect(ctx, previewCx - 18, previewCy - 22, 36, 44, 6);
      ctx.fill();
      noGlow(ctx);
    }

    // character name
    ctx.fillStyle = selected ? P.text : P.textDim;
    ctx.font = `bold 12px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(ch.name, slotX + slotW / 2, slotY + slotH / 2 - 18);
  }

  // footer
  ctx.fillStyle = P.textDim;
  ctx.font = '13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('← → to choose   SPACE to run   C config   T tiles', viewW / 2, viewH * 0.74);
  ctx.font = '11px ui-monospace, monospace';
  ctx.globalAlpha = 0.45;
  ctx.fillText('ESC during game to return here', viewW / 2, viewH * 0.80);
  ctx.globalAlpha = 1;
}

// ── tileset coordinate inspector (dev tool: hover to read px, click to log a cell) ──
function drawInspector(ctx: CanvasRenderingContext2D, s: GameState): void {
  const { viewW, viewH } = s;
  ctx.fillStyle = '#05040a';
  ctx.fillRect(0, 0, viewW, viewH);

  const theme = activeTheme();
  const img = theme.sprite.img;
  const L = inspectorLayout(viewW, viewH);
  const dw = TILESET_W * L.scale;
  const dh = TILESET_H * L.scale;

  ctx.imageSmoothingEnabled = false;
  if (theme.sprite.ready) ctx.drawImage(img, 0, 0, TILESET_W, TILESET_H, L.ox, L.oy, dw, dh);

  // 64px cell grid (matches the template's TEMPLATE_TILE)
  ctx.strokeStyle = 'rgba(0,240,255,0.16)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= TILESET_W; gx += 64) {
    const X = L.ox + gx * L.scale;
    ctx.beginPath(); ctx.moveTo(X, L.oy); ctx.lineTo(X, L.oy + dh); ctx.stroke();
  }
  for (let gy = 0; gy <= TILESET_H; gy += 64) {
    const Y = L.oy + gy * L.scale;
    ctx.beginPath(); ctx.moveTo(L.ox, Y); ctx.lineTo(L.ox + dw, Y); ctx.stroke();
  }

  // header
  ctx.fillStyle = P.text;
  ctx.font = 'bold 13px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('TILESET INSPECTOR  ·  hover = px/cell  ·  click = log r(...) to console  ·  T/ESC close', 14, 14);

  // cursor → image px
  const ix = Math.floor((s.inspMouseX - L.ox) / L.scale);
  const iy = Math.floor((s.inspMouseY - L.oy) / L.scale);
  if (ix >= 0 && iy >= 0 && ix < TILESET_W && iy < TILESET_H) {
    const cx = Math.floor(ix / 64) * 64;
    const cy = Math.floor(iy / 64) * 64;
    // highlight hovered cell
    ctx.strokeStyle = P.spike;
    ctx.lineWidth = 2;
    ctx.strokeRect(L.ox + cx * L.scale, L.oy + cy * L.scale, 64 * L.scale, 64 * L.scale);
    ctx.fillStyle = P.boost;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText(`px ${ix},${iy}     cell  r(${cx}, ${cy})`, 14, 32);
    drawLoupe(ctx, img, ix, iy, viewW, theme.sprite.ready);
  }

  // recent picks
  ctx.fillStyle = P.textDim;
  ctx.font = '12px ui-monospace, monospace';
  for (let i = 0; i < s.inspPicks.length; i++) {
    ctx.fillText(s.inspPicks[i], 14, viewH - 18 - i * 15);
  }
  ctx.imageSmoothingEnabled = true;
}

/** Magnified loupe around the cursor so cells can be read at the pixel level. */
function drawLoupe(ctx: CanvasRenderingContext2D, img: HTMLImageElement, ix: number, iy: number, viewW: number, ready: boolean): void {
  const size = 196;
  const zoom = 7;
  const src = size / zoom; // image px shown
  const lx = viewW - size - 16;
  const ly = 50;
  const sx = ix - src / 2;
  const sy = iy - src / 2;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(lx, ly, size, size);
  if (ready) ctx.drawImage(img, sx, sy, src, src, lx, ly, size, size);

  // 64-cell grid aligned to image coords
  ctx.strokeStyle = 'rgba(0,240,255,0.4)';
  ctx.lineWidth = 1;
  for (let gx = Math.ceil(sx / 64) * 64; gx <= sx + src; gx += 64) {
    const X = lx + (gx - sx) * zoom;
    ctx.beginPath(); ctx.moveTo(X, ly); ctx.lineTo(X, ly + size); ctx.stroke();
  }
  for (let gy = Math.ceil(sy / 64) * 64; gy <= sy + src; gy += 64) {
    const Y = ly + (gy - sy) * zoom;
    ctx.beginPath(); ctx.moveTo(lx, Y); ctx.lineTo(lx + size, Y); ctx.stroke();
  }
  // center crosshair + frame
  ctx.strokeStyle = P.spike;
  ctx.beginPath();
  ctx.moveTo(lx + size / 2, ly); ctx.lineTo(lx + size / 2, ly + size);
  ctx.moveTo(lx, ly + size / 2); ctx.lineTo(lx + size, ly + size / 2);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(lx, ly, size, size);
}

function drawConfigMenu(ctx: CanvasRenderingContext2D, s: GameState): void {
  const { viewW, viewH } = s;
  ctx.fillStyle = 'rgba(5,4,16,0.9)';
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  glow(ctx, P.boost, 16);
  ctx.fillStyle = P.boost;
  ctx.font = 'bold 24px ui-monospace, monospace';
  ctx.fillText('CONFIG', viewW / 2, viewH * 0.1);
  noGlow(ctx);

  // two-column list of tunables
  const n = TUNE_FIELDS.length;
  const cols = 2;
  const rows = Math.ceil(n / cols);
  const colW = Math.min(360, viewW / cols - 30);
  const top = viewH * 0.2;
  const rowH = Math.min(30, (viewH * 0.62) / rows);
  ctx.font = 'bold 14px ui-monospace, monospace';

  for (let i = 0; i < n; i++) {
    const f = TUNE_FIELDS[i];
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = viewW / 2 + (col === 0 ? -colW - 14 : 14);
    const y = top + row * rowH;
    const sel = i === s.configIndex;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (sel) {
      ctx.fillStyle = 'rgba(93,255,155,0.14)';
      ctx.fillRect(x - 8, y - rowH / 2 + 2, colW + 16, rowH - 4);
    }
    ctx.fillStyle = sel ? P.boost : P.textDim;
    ctx.fillText(f.label, x, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = sel ? P.text : P.textDim;
    ctx.fillText(sel ? `‹ ${formatTune(f)} ›` : formatTune(f), x + colW, y);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = P.textDim;
  ctx.font = '12px ui-monospace, monospace';
  ctx.fillText('↑ ↓ pick field    ← → adjust    C / ESC back', viewW / 2, viewH * 0.9);
}

function drawOverlay(ctx: CanvasRenderingContext2D, s: GameState): void {
  const { viewW, viewH } = s;
  ctx.fillStyle = 'rgba(5,4,16,0.76)';
  ctx.fillRect(0, 0, viewW, viewH);

  const won = s.phase === 'won';
  const color = won ? P.win : P.dead;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  glow(ctx, color, 28);
  ctx.fillStyle = color;
  ctx.font = 'bold 50px ui-monospace, monospace';
  ctx.fillText(won ? 'ASCENDED' : 'WASTED', viewW / 2, viewH / 2 - 46);
  noGlow(ctx);

  ctx.fillStyle = P.boost;
  ctx.font = 'bold 24px ui-monospace, monospace';
  glow(ctx, P.boost, 10);
  ctx.fillText(`TOP SPEED  ${Math.round(s.peakSpeed)}`, viewW / 2, viewH / 2 + 6);
  noGlow(ctx);

  ctx.fillStyle = P.text;
  ctx.font = '15px ui-monospace, monospace';
  const mm = Math.floor(s.time / 60);
  const ss = Math.floor(s.time % 60);
  ctx.fillText(`${Math.round(s.distance / C.TILE)} m   ·   survived ${mm}:${ss.toString().padStart(2, '0')}`, viewW / 2, viewH / 2 + 38);
  ctx.fillStyle = P.textDim;
  ctx.fillText('press SPACE or click to retry', viewW / 2, viewH / 2 + 66);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
