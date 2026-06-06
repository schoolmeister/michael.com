/**
 * render.ts — neon Canvas2D for SCEND, tuned for SPEED. Blade / rave palette: near-black,
 * glowing neon, parallax silhouettes, speed lines, an afterimage trail, screen shake, and a
 * fat >> boost readout. Floating platforms hang over a black abyss; everything pushes the
 * feeling of getting faster and stronger. World x → screen via `− camX`; vertical is
 * already screen-space.
 */

import * as C from './config';
import type { GameState } from './state';
import { surfaceY, isWet } from './sim';

const P = C.PALETTE;
const PLAT_THICK = C.TILE * 1.4; // how thick the floating slabs look

export function render(ctx: CanvasRenderingContext2D, s: GameState): void {
  const { viewW, viewH } = s;
  ctx.clearRect(0, 0, viewW, viewH);

  drawBackdrop(ctx, s);
  drawSpeedLines(ctx, s);

  // world layers get the screen shake; HUD stays put
  ctx.save();
  if (s.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
  }
  drawPlatforms(ctx, s);
  drawUpperPlatforms(ctx, s);
  drawGeysers(ctx, s);
  drawPickups(ctx, s);
  drawGhosts(ctx, s);
  drawProjectiles(ctx, s);
  drawParticles(ctx, s);
  drawTrail(ctx, s);
  drawPlayer(ctx, s);
  drawFloats(ctx, s);
  ctx.restore();

  if (s.boostFlash > 0) drawBoostFlash(ctx, s);
  drawHud(ctx, s);
  if (s.phase !== 'running') drawOverlay(ctx, s);
}

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
function noGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, s: GameState): void {
  const { viewW, viewH } = s;
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, P.bg0);
  grad.addColorStop(0.6, P.bg1);
  grad.addColorStop(1, P.bg0);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  noGlow(ctx);

  // two parallax bands of neon "skyline" silhouettes
  drawSkyline(ctx, s, 0.12, viewH * 0.62, 0.10, P.bgFar, 120);
  drawSkyline(ctx, s, 0.28, viewH * 0.74, 0.16, P.bgNear, 90);

  // faint grid under the action
  const gy = viewH * C.GROUND_FRAC + C.TILE;
  ctx.strokeStyle = P.grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  const step = C.TILE;
  const startX = -((s.camX % step) + step) % step;
  for (let x = startX; x < viewW; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, viewH);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSkyline(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  par: number,
  baseY: number,
  alpha: number,
  color: string,
  cell: number
): void {
  const { viewW } = s;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const off = (s.camX * par) % cell;
  for (let x = -off - cell; x < viewW + cell; x += cell) {
    // deterministic pseudo-random height from the cell index (stable as it scrolls)
    const idx = Math.round((x + s.camX * par) / cell);
    const hh = 40 + (Math.abs(Math.sin(idx * 12.9898) * 43758.5453) % 1) * 160;
    const w = cell * 0.7;
    ctx.fillRect(x, baseY - hh, w, hh + 400);
  }
  ctx.globalAlpha = 1;
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, s: GameState): void {
  if (s.speed < C.SPEEDLINE_MIN_SPEED) return;
  const { viewW, viewH } = s;
  const t = Math.min(1, (s.speed - C.SPEEDLINE_MIN_SPEED) / 500);
  const n = Math.round(t * C.SPEEDLINE_MAX);
  ctx.strokeStyle = P.player;
  ctx.lineWidth = 1.5;
  glow(ctx, P.player, 6);
  for (let i = 0; i < n; i++) {
    const y = (Math.abs(Math.sin((i + 1) * 78.233 + Math.floor(s.distance / 40)) * 43758.5453) % 1) * viewH;
    const len = 50 + Math.random() * 120 * (0.5 + t);
    const x = Math.random() * viewW;
    ctx.globalAlpha = 0.12 + 0.22 * t;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  noGlow(ctx);
}

function drawPlatforms(ctx: CanvasRenderingContext2D, s: GameState): void {
  const fromCol = Math.floor(s.camX / C.TILE) - 1;
  const toCol = Math.ceil((s.camX + s.viewW) / C.TILE) + 1;

  for (let c = fromCol; c <= toCol; c++) {
    const col = colAt(s, c);
    if (!col) continue; // void gap — leave the abyss black
    const sx = c * C.TILE - s.camX;
    const top = surfaceY(s, col.h);

    // slab body
    noGlow(ctx);
    ctx.fillStyle = P.ground;
    ctx.fillRect(sx, top, C.TILE + 1, PLAT_THICK);

    // surface tile by kind
    if (col.kind === 'lava') {
      glow(ctx, P.lava, 20);
      ctx.fillStyle = P.lava;
      ctx.fillRect(sx, top, C.TILE + 1, C.TILE * 0.5);
      noGlow(ctx);
    } else if (col.kind === 'water') {
      glow(ctx, P.water, 16);
      ctx.fillStyle = P.water;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(sx, top, C.TILE + 1, C.TILE * 0.5);
      ctx.globalAlpha = 1;
      noGlow(ctx);
    } else if (col.kind === 'spike') {
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

    // neon top edge (brighter on takeoff/landing tiles)
    glow(ctx, P.groundEdge, col.edge ? 16 : 8);
    ctx.fillStyle = P.groundEdge;
    ctx.fillRect(sx, top - 2, C.TILE + 1, col.edge ? 4 : 3);
    noGlow(ctx);
  }
}

function drawUpperPlatforms(ctx: CanvasRenderingContext2D, s: GameState): void {
  const THICK = C.TILE * 0.55;
  for (const up of s.world.upperPlatforms) {
    const sx0 = up.x0 - s.camX;
    const sx1 = up.x1 - s.camX;
    if (sx1 < -C.TILE || sx0 > s.viewW + C.TILE) continue;
    const top = surfaceY(s, up.h);

    // slab body — slightly transparent, distinct colour from ground
    noGlow(ctx);
    ctx.fillStyle = P.upperPlat;
    ctx.fillRect(sx0, top, sx1 - sx0, THICK);

    // violet neon top edge — the "can land here" signal
    glow(ctx, P.upperEdge, 14);
    ctx.fillStyle = P.upperEdge;
    ctx.fillRect(sx0, top - 2, sx1 - sx0, 3);
    noGlow(ctx);

    // subtle underside glow
    const ug = ctx.createLinearGradient(0, top + THICK, 0, top + THICK + 20);
    ug.addColorStop(0, 'rgba(192,144,255,0.18)');
    ug.addColorStop(1, 'rgba(192,144,255,0)');
    ctx.fillStyle = ug;
    ctx.fillRect(sx0, top + THICK, sx1 - sx0, 20);
  }
}

function drawGeysers(ctx: CanvasRenderingContext2D, s: GameState): void {
  const fromCol = Math.floor(s.camX / C.TILE) - 1;
  const toCol = Math.ceil((s.camX + s.viewW) / C.TILE) + 1;
  for (let c = fromCol; c <= toCol; c++) {
    const col = colAt(s, c);
    if (!col?.geyser || col.geyser.dead) continue;
    const sx = c * C.TILE - s.camX;
    const base = surfaceY(s, col.h);
    if (col.geyser.phase < C.GEYSER_ERUPT) {
      const h = C.GEYSER_HEIGHT * C.TILE;
      glow(ctx, P.geyser, 24);
      ctx.fillStyle = P.geyser;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(sx + C.TILE * 0.28, base - h, C.TILE * 0.44, h);
      ctx.globalAlpha = 1;
      noGlow(ctx);
    } else {
      ctx.fillStyle = P.geyser;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(sx + C.TILE * 0.35, base - 16, C.TILE * 0.3, 10);
      ctx.globalAlpha = 1;
    }
  }
}

function drawPickups(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const pk of s.world.pickups) {
    if (pk.taken) continue;
    const sx = pk.x - s.camX;
    if (sx < -C.TILE || sx > s.viewW + C.TILE) continue;
    const bob = Math.sin(s.time * 6 + pk.x) * 4;
    const sy = surfaceY(s, pk.floatTiles) + bob;
    const r = C.TILE * 0.34;
    const color = pk.kind === 'boots' ? P.boost : pk.kind === 'knife' ? P.knife : P.horns;
    glow(ctx, color, 18);
    ctx.fillStyle = color;
    if (pk.kind === 'boots') {
      // a glowing ">>"
      ctx.font = `bold ${Math.round(r * 1.8)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('»', sx, sy + 1);
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      noGlow(ctx);
      ctx.fillStyle = '#0b0617';
      ctx.font = `bold ${Math.round(r * 1.1)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pk.kind === 'knife' ? 'K' : 'H', sx, sy + 1);
    }
    noGlow(ctx);
  }
}

function drawGhosts(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const g of s.world.ghosts) {
    if (g.dead) continue;
    const sx = g.x - s.camX;
    if (sx < -C.TILE || sx > s.viewW + C.TILE) continue;
    const sy = surfaceY(s, g.floatTiles);
    const r = C.TILE * 0.36;
    glow(ctx, P.ghost, 18);
    ctx.fillStyle = P.ghost;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(sx, sy, r, Math.PI, 0);
    ctx.lineTo(sx + r, sy + r);
    ctx.lineTo(sx - r, sy + r);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    noGlow(ctx);
    ctx.fillStyle = '#0b0617';
    ctx.fillRect(sx - r * 0.45, sy - r * 0.2, r * 0.3, r * 0.4);
    ctx.fillRect(sx + r * 0.15, sy - r * 0.2, r * 0.3, r * 0.4);
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const pr of s.projectiles) {
    const sx = pr.x - s.camX;
    if (pr.kind === 'boo') {
      glow(ctx, P.boo, 16);
      ctx.fillStyle = P.boo;
      ctx.beginPath();
      ctx.arc(sx, pr.y, 6, 0, Math.PI * 2);
      ctx.fill();
      noGlow(ctx);
    } else {
      glow(ctx, P.knife, 14);
      ctx.fillStyle = P.knife;
      ctx.fillRect(sx - 12, pr.y - 2, 24, 4);
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
    ctx.fillRect(pt.x - s.camX - sz / 2, pt.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  noGlow(ctx);
}

function drawTrail(ctx: CanvasRenderingContext2D, s: GameState): void {
  const n = s.trail.length;
  for (let i = 0; i < n; i++) {
    const tr = s.trail[i];
    const a = (i / n) * 0.45;
    ctx.globalAlpha = a;
    ctx.fillStyle = tr.wet ? P.playerWet : P.player;
    const sx = tr.x - s.camX;
    const shrink = (1 - i / n) * 6;
    roundRect(ctx, sx - C.PLAYER_W / 2 + shrink, tr.y + shrink, C.PLAYER_W - shrink * 2, C.PLAYER_H - shrink * 2, 5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: GameState): void {
  const p = s.player;
  const sx = p.x - s.camX;
  const wet = isWet(s);
  const color = wet ? P.playerWet : P.player;

  // boost chevrons streaming off the back
  const chev = Math.floor(s.speedBoost / C.BOOST_PER_CHEVRON);
  if (chev > 0) {
    glow(ctx, P.boost, 10);
    ctx.fillStyle = P.boost;
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.8;
    ctx.fillText('»'.repeat(Math.min(chev, 6)), sx - C.PLAYER_W / 2 - 2, p.y + C.PLAYER_H / 2);
    ctx.globalAlpha = 1;
    noGlow(ctx);
  }

  glow(ctx, color, 24);
  ctx.fillStyle = color;
  roundRect(ctx, sx - C.PLAYER_W / 2, p.y, C.PLAYER_W, C.PLAYER_H, 6);
  ctx.fill();
  noGlow(ctx);

  if (p.horns) {
    ctx.fillStyle = P.horns;
    ctx.beginPath();
    ctx.moveTo(sx - 7, p.y);
    ctx.lineTo(sx - 11, p.y - 9);
    ctx.lineTo(sx - 3, p.y);
    ctx.moveTo(sx + 7, p.y);
    ctx.lineTo(sx + 11, p.y - 9);
    ctx.lineTo(sx + 3, p.y);
    ctx.fill();
  }
  if (p.knife) {
    ctx.fillStyle = P.knife;
    ctx.fillRect(sx + C.PLAYER_W / 2, p.y + C.PLAYER_H * 0.3, 9, 3);
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
    ctx.fillText(f.text, f.x - s.camX, f.y);
  }
  ctx.globalAlpha = 1;
  noGlow(ctx);
}

function drawBoostFlash(ctx: CanvasRenderingContext2D, s: GameState): void {
  const a = Math.min(0.35, s.boostFlash * 0.8);
  const grad = ctx.createRadialGradient(
    s.viewW / 2,
    s.viewH / 2,
    s.viewH * 0.2,
    s.viewW / 2,
    s.viewH / 2,
    s.viewH * 0.75
  );
  grad.addColorStop(0, 'rgba(93,255,155,0)');
  grad.addColorStop(1, `rgba(93,255,155,${a})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s.viewW, s.viewH);
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState): void {
  noGlow(ctx);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // big speed readout
  glow(ctx, P.player, 10);
  ctx.fillStyle = P.text;
  ctx.font = 'bold 34px ui-monospace, monospace';
  ctx.fillText(`${Math.round(s.speed)}`, 14, 10);
  noGlow(ctx);
  ctx.fillStyle = P.textDim;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.fillText('SPEED', 16, 46);

  // >> boost chevrons
  const chev = Math.floor(s.speedBoost / C.BOOST_PER_CHEVRON);
  if (chev > 0) {
    glow(ctx, P.boost, 8);
    ctx.fillStyle = P.boost;
    ctx.font = 'bold 20px ui-monospace, monospace';
    ctx.fillText('»'.repeat(Math.min(chev, 10)), 90, 18);
    noGlow(ctx);
  }

  // clock + distance (right)
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

  // held items
  const tells: string[] = [];
  if (s.player.horns) tells.push('HORNS');
  if (s.player.knife) tells.push('KNIFE');
  if (tells.length) {
    ctx.fillStyle = P.text;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(tells.join('  '), s.viewW - 14, 54);
  }
  ctx.textAlign = 'left';
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

// ── helpers ────────────────────────────────────────────────────────────────────
function colAt(s: GameState, c: number) {
  const i = c - s.world.baseCol;
  const cols = s.world.cols;
  return i >= 0 && i < cols.length ? cols[i] : null;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
