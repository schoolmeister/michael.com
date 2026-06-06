/**
 * render.ts — real-visuals render for Prototype #3 (the four-limb / CoG verb).
 *
 * Reskins the gray-box baseline with rock-sprite holds + a lantern-mountaineer torso at
 * the CoG, WITHOUT dropping any readability the sim depends on:
 *   • load-thickness limb lines      • CoG marker
 *   • support polygon                • hand stamina rings (green good → red bad)
 *   • good-side arrow on every hold   • aim preview (ghost + previewed support + CoG, green/red)
 *   • finish/TOP marker, fall overlay, rewarding win overlay
 *
 * All drawing goes through worldToScreen(s, ...) so it follows the scrolling camera.
 * Sprites load lazily (see assets.ts); gray-box fallbacks draw until they're ready.
 */

import { HAND_STAM_MAX, HOLD_R, WORLD_WIDTH } from './config';
import { holdSpriteFor } from './assets';
import {
  anchored,
  anchoredWith,
  cog,
  cogOf,
  goodness,
  insideOf,
  limbPositionsWith,
  supportCentroid,
  worldToScreen,
} from './sim';
import type { GameState, Hold, Limb } from './state';

const HAND_COL = '#e7a94a';
const FOOT_COL = '#5b8fc9';

export function render(ctx: CanvasRenderingContext2D, s: GameState): void {
  const sx = (wx: number, wy: number) => worldToScreen(s, wx, wy);

  drawBackdrop(ctx, s);

  // finish line (the top) — a glowing band + marker
  drawFinish(ctx, s);

  // holds: rock sprites with the good-side arrow on top
  for (const h of s.holds) drawHold(ctx, s, h);

  // support polygon (the area the CoG must stay inside)
  drawSupportPolygon(ctx, s, sx);

  const g = cog(s);
  const gs = sx(g.x, g.y);

  // limb lines (thickness = load) — drawn under the limb caps
  for (const L of s.climber.limbs) drawLimbLine(ctx, gs, sx(L.x, L.y), L);

  // (No climber sprite for now — the CoG dot + limb caps + load lines ARE the body.
  //  The sprite read as way too small next to the limb span; deferred until reworked.)

  // limb caps (hands amber / feet blue) + hand stamina rings
  for (const L of s.climber.limbs) drawLimbCap(ctx, s, sx(L.x, L.y), L);

  // CoG marker on top of the torso
  drawCoG(ctx, gs);

  // aim preview
  if (s.drag && s.drag.kind === 'limb' && s.drag.limb) drawAimPreview(ctx, s, sx);

  drawHUD(ctx, s);

  if (s.phase === 'fallen') overlay(ctx, s, '#c8636b', 'you fell', 'weight left your support / too few holds');
  if (s.phase === 'won')
    winOverlay(ctx, s);
}

// ── Backdrop ────────────────────────────────────────────────────────────────────
function drawBackdrop(ctx: CanvasRenderingContext2D, s: GameState): void {
  const W = s.viewW, H = s.viewH;
  const sx = (wx: number, wy: number) => worldToScreen(s, wx, wy);

  // dark vertical gradient — colder/darker toward the top (where you're climbing into)
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#070a10');
  grad.addColorStop(0.55, '#0e1118');
  grad.addColorStop(1, '#14171e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const left = sx(0, 0).x, right = sx(WORLD_WIDTH, 0).x;

  // the climbable rock column — a slightly lighter, textured band
  const rock = ctx.createLinearGradient(left, 0, right, 0);
  rock.addColorStop(0, 'rgba(40,38,34,0.55)');
  rock.addColorStop(0.5, 'rgba(56,52,46,0.55)');
  rock.addColorStop(1, 'rgba(38,36,32,0.55)');
  ctx.fillStyle = rock;
  ctx.fillRect(left, 0, right - left, H);

  // faint scrolling strata (horizontal rock layering) — moves with the camera
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const step = 46;
  const first = Math.floor(s.cameraY / step) * step;
  for (let wy = first; wy < s.cameraY + H + step; wy += step) {
    const p = sx(0, wy);
    ctx.beginPath();
    ctx.moveTo(left, p.y);
    ctx.lineTo(right, p.y);
    ctx.stroke();
  }

  // a couple of vertical crack lines for texture; they jitter with world-y so they
  // scroll with the camera rather than sitting static on screen
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (const frac of [0.28, 0.66]) {
    const baseX = left + (right - left) * frac;
    ctx.beginPath();
    ctx.moveTo(baseX + Math.sin(s.cameraY * 0.05 + frac * 9) * 10, 0);
    for (let wy = first; wy < s.cameraY + H + step; wy += step) {
      const p = sx(0, wy);
      const jx = baseX + Math.sin(wy * 0.05 + frac * 9) * 10;
      ctx.lineTo(jx, p.y);
    }
    ctx.stroke();
  }

  // column edges (the climbable band borders)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, 0); ctx.lineTo(left, H);
  ctx.moveTo(right, 0); ctx.lineTo(right, H);
  ctx.stroke();

  // vignette — focus the eye, climbing-horror mood
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawFinish(ctx: CanvasRenderingContext2D, s: GameState): void {
  const sx = (wx: number, wy: number) => worldToScreen(s, wx, wy);
  const left = sx(0, 0).x, right = sx(WORLD_WIDTH, 0).x;
  const fy = sx(0, s.finishY).y;
  if (fy <= -40 || fy >= s.viewH + 40) return;

  // soft glow above the line (the daylight at the top)
  const glow = ctx.createLinearGradient(0, fy - 60, 0, fy + 6);
  glow.addColorStop(0, 'rgba(150,220,160,0)');
  glow.addColorStop(1, 'rgba(150,220,160,0.18)');
  ctx.fillStyle = glow;
  ctx.fillRect(left, fy - 60, right - left, 66);

  ctx.fillStyle = 'rgba(160,225,170,0.7)';
  ctx.fillRect(left, fy - 2, right - left, 4);
  ctx.fillStyle = 'rgba(190,240,200,0.95)';
  ctx.font = 'bold 13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('▲ TOP ▲', (left + right) / 2, fy - 12);
}

// ── Holds ─────────────────────────────────────────────────────────────────────
function drawHold(ctx: CanvasRenderingContext2D, s: GameState, h: Hold): void {
  const c = worldToScreen(s, h.x, h.y);
  if (c.y < -40 || c.y > s.viewH + 40) return;

  const sprite = holdSpriteFor(h.x, h.y);
  const w = HOLD_R * 3.4;
  const hgt = w / (sprite.ready ? sprite.aspect : 2.0);

  // Rotate the rock to its pull direction. The sprite art, UNROTATED, depicts a hold whose
  // best pull is straight DOWN (good-side = down, which is ang = +PI/2 in our +y-down world).
  // So rotate by (ang - PI/2): a "pull-down" hold draws upright; angled holds tilt to match.
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(h.ang - Math.PI / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  if (sprite.ready) {
    ctx.drawImage(sprite.img, -w / 2, -hgt * 0.42, w, hgt);
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.42, hgt * 0.42, 0, 0, 7);
    ctx.fillStyle = '#2b2f38';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#454c57';
    ctx.stroke();
  }
  ctx.restore();

  // the grab spot — a faint ring so the exact hold point is readable under the rock art
  ctx.beginPath();
  ctx.arc(c.x, c.y, HOLD_R, 0, 7);
  ctx.strokeStyle = 'rgba(220,225,235,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // good-side arrow: a small chevron whose point aims toward h.ang (the pull direction).
  // This is CORE info — keep it crisp and on top of the rock.
  drawGoodSideArrow(ctx, c.x, c.y, h.ang);
}

function drawGoodSideArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, ang: number): void {
  const r0 = HOLD_R + 3;        // arrow starts just outside the grab ring
  const len = HOLD_R * 1.1;     // shaft length
  const tipX = cx + Math.cos(ang) * (r0 + len);
  const tipY = cy + Math.sin(ang) * (r0 + len);
  const baseX = cx + Math.cos(ang) * r0;
  const baseY = cy + Math.sin(ang) * r0;

  // shaft
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(tipX, tipY);
  ctx.strokeStyle = 'rgba(120,200,150,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // arrowhead
  const back = 6, spread = 0.5;
  const h1x = tipX - Math.cos(ang - spread) * back;
  const h1y = tipY - Math.sin(ang - spread) * back;
  const h2x = tipX - Math.cos(ang + spread) * back;
  const h2y = tipY - Math.sin(ang + spread) * back;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(h1x, h1y);
  ctx.lineTo(h2x, h2y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(150,225,175,0.95)';
  ctx.fill();
}

// ── Support polygon ──────────────────────────────────────────────────────────
function drawSupportPolygon(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  sx: (x: number, y: number) => { x: number; y: number },
): void {
  const a = anchored(s);
  if (a.length < 2) return;
  const c = supportCentroid(s);
  const pts = a
    .map((L) => ({ x: L.x, y: L.y, t: Math.atan2(L.y - c.y, L.x - c.x) }))
    .sort((u, v) => u.t - v.t);
  ctx.beginPath();
  pts.forEach((p, i) => { const sp = sx(p.x, p.y); i ? ctx.lineTo(sp.x, sp.y) : ctx.moveTo(sp.x, sp.y); });
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,200,150,0.07)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,200,150,0.28)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── Climber body ────────────────────────────────────────────────────────────────
function drawLimbLine(
  ctx: CanvasRenderingContext2D,
  gs: { x: number; y: number },
  ls: { x: number; y: number },
  L: Limb,
): void {
  ctx.beginPath();
  ctx.moveTo(gs.x, gs.y);
  ctx.lineTo(ls.x, ls.y);
  if (!L.hold) {
    // dangling limb (counterweight): thin, dim reddish
    ctx.strokeStyle = 'rgba(200,120,120,0.45)';
    ctx.lineWidth = 2;
  } else {
    const load = L.load || 0;
    // thickness = load; colour-coded by hand/foot. This is how the player reads "why is this
    // limb working hard?" — keep it bright when loaded.
    ctx.strokeStyle = L.type === 'hand'
      ? `rgba(231,169,74,${0.3 + load * 0.6})`
      : `rgba(91,143,201,${0.3 + load * 0.6})`;
    ctx.lineWidth = 2 + load * 14;
    ctx.lineCap = 'round';
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawLimbCap(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  ls: { x: number; y: number },
  L: Limb,
): void {
  const grabbing = !!L.hold;
  const col = L.type === 'hand' ? HAND_COL : FOOT_COL;

  // shape distinguishes hands (round) from feet (square boot) — readable at a glance.
  if (L.type === 'hand') {
    ctx.beginPath();
    ctx.arc(ls.x, ls.y, 10, 0, 7);
  } else {
    ctx.beginPath();
    ctx.rect(ls.x - 9, ls.y - 9, 18, 18);
  }
  ctx.fillStyle = grabbing ? col : '#2a2e36';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = grabbing ? '#fff' : '#555';
  ctx.globalAlpha = grabbing ? 0.7 : 0.4;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // hand stamina ring (green good → red bad), arc length = stamina fraction
  if (L.type === 'hand' && grabbing) {
    const frac = L.stam / HAND_STAM_MAX;
    const q = goodness(s, L);
    ctx.beginPath();
    ctx.arc(ls.x, ls.y, 15, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    const r = Math.round(90 + (1 - q) * 150);
    const gg = Math.round(200 - (1 - q) * 150);
    const b = Math.round(120 - (1 - q) * 60);
    ctx.strokeStyle = `rgb(${r},${gg},${b})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(20,22,26,0.85)';
  ctx.font = 'bold 8px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(L.name, ls.x, ls.y + 3);
}

function drawCoG(ctx: CanvasRenderingContext2D, gs: { x: number; y: number }): void {
  ctx.beginPath();
  ctx.arc(gs.x, gs.y, 8, 0, 7);
  ctx.fillStyle = '#d9d2c0';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0d0f13';
  ctx.font = 'bold 7px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CoG', gs.x, gs.y + 2.5);
}

// ── Aim preview ──────────────────────────────────────────────────────────────────
function drawAimPreview(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  sx: (x: number, y: number) => { x: number; y: number },
): void {
  const drag = s.drag!;
  const limb = drag.limb!;
  const massPts = limbPositionsWith(s, { limb, x: drag.aimX, y: drag.aimY });
  const supPts = anchoredWith(s, { limb, hold: drag.aimHold });
  const pcog = cogOf(massPts, s.climber.lean, { x: s.climber.body.x, y: s.climber.body.y });
  const willFall = !insideOf(supPts, pcog) || supPts.length < 2;
  const col = willFall ? 'rgba(220,90,100,0.9)' : 'rgba(120,200,150,0.9)';
  const aim = sx(drag.aimX, drag.aimY);
  const pc = sx(pcog.x, pcog.y);

  // previewed support polygon
  if (supPts.length >= 2) {
    const c = {
      x: supPts.reduce((a2, p) => a2 + p.x, 0) / supPts.length,
      y: supPts.reduce((a2, p) => a2 + p.y, 0) / supPts.length,
    };
    const sp = supPts.map((p) => ({ ...p, t: Math.atan2(p.y - c.y, p.x - c.x) })).sort((u, v) => u.t - v.t);
    ctx.beginPath();
    sp.forEach((p, i) => { const q = sx(p.x, p.y); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath();
    ctx.fillStyle = willFall ? 'rgba(220,90,100,0.08)' : 'rgba(120,200,150,0.12)';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ghost limb line: previewed CoG → aimed point
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(pc.x, pc.y);
  ctx.lineTo(aim.x, aim.y);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  // ghost limb cap (square for foot, circle for hand — match the real caps)
  ctx.beginPath();
  if (limb.type === 'hand') ctx.arc(aim.x, aim.y, 10, 0, 7);
  else ctx.rect(aim.x - 9, aim.y - 9, 18, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();

  // highlight the hold being aimed at
  if (drag.aimHold) {
    const ah = sx(drag.aimHold.x, drag.aimHold.y);
    ctx.beginPath();
    ctx.arc(ah.x, ah.y, HOLD_R + 4, 0, 7);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // previewed CoG
  ctx.beginPath();
  ctx.arc(pc.x, pc.y, 8, 0, 7);
  ctx.fillStyle = willFall ? 'rgba(220,90,100,0.35)' : 'rgba(120,200,150,0.35)';
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.font = 'bold 9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(willFall ? 'would fall' : 'new CoG', pc.x, pc.y - 14);
}

// ── HUD + overlays ──────────────────────────────────────────────────────────────
function drawHUD(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(205,210,220,0.85)';
  ctx.font = '12px ui-monospace, monospace';
  const climbed = Math.max(0, Math.round(((s.worldHeight - cog(s).y) / (s.worldHeight - s.finishY)) * 100));
  const label = s.level.name;
  ctx.fillText(`${label}  ·  ${Math.min(100, climbed)}%  ·  ${s.moves} moves  ·  ${s.elapsed.toFixed(0)}s`, 12, 18);
  ctx.fillStyle = 'rgba(150,155,165,0.75)';
  ctx.fillText('drag a limb to aim, release to grip · drag CoG to lean · [1-4] level · [G] new spray wall · [R] retry', 12, 34);
}

function overlay(ctx: CanvasRenderingContext2D, s: GameState, color: string, title: string, sub: string): void {
  ctx.fillStyle = 'rgba(8,9,12,0.8)';
  ctx.fillRect(0, 0, s.viewW, s.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 30px ui-monospace, monospace';
  ctx.fillText(title, s.viewW / 2, s.viewH / 2 - 6);
  ctx.fillStyle = '#9aa0aa';
  ctx.font = '12px ui-monospace, monospace';
  ctx.fillText(sub, s.viewW / 2, s.viewH / 2 + 18);
}

function winOverlay(ctx: CanvasRenderingContext2D, s: GameState): void {
  const W = s.viewW, H = s.viewH;
  // a warmer, rewarding wash (summit daylight) rather than the grim fall screen
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(20,40,28,0.86)');
  grad.addColorStop(1, 'rgba(8,12,10,0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  ctx.fillStyle = '#9fe6a6';
  ctx.font = 'bold 38px ui-monospace, monospace';
  ctx.fillText('TOPPED OUT', W / 2, H / 2 - 30);

  ctx.fillStyle = '#d8e8da';
  ctx.font = 'bold 18px ui-monospace, monospace';
  ctx.fillText(`${s.winMoves} moves  ·  ${s.winTime.toFixed(1)}s`, W / 2, H / 2 + 6);

  ctx.fillStyle = 'rgba(170,190,175,0.85)';
  ctx.font = '13px ui-monospace, monospace';
  ctx.fillText('click / N: next route   ·   R: retry', W / 2, H / 2 + 36);
}
