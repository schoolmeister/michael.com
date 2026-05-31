/**
 * render.ts — the look + the FEEL of moving. Iteration #2.
 *
 * Keeps the dark amber-lantern mood from #1:
 *   - procedural, scrolling ROCK FACE, a night SKY with stars above the summit,
 *     a black ABYSS below the floor, the lantern darkness vignette, HUD meters,
 *     end screens.
 * Adds the new model:
 *   - the old aim/drag line is GONE,
 *   - a visceral REACH animation (coil → extend/lean along an eased arc → grab
 *     pop → settle, with strain wobble, falling grit, a subtle camera ease),
 *   - a real hanging VERLET ROPE from the harness down to the last anchor / ground,
 *   - placed ANCHORS (slings/carabiners) + horn nubs, the ANCHORING safe-cone gauge
 *     (only legible inside the lantern's clarity radius), and FALL rendering.
 *
 * ALL world→screen goes through view.ts so drawing matches gameplay hit-testing.
 */

import {
  HORN_CONE_HALF_WIDTH,
  ROPE_GRAVITY,
  ROPE_ITERATIONS,
  ROPE_SEGMENTS,
  ROPE_SLACK,
  STAMINA_MAX,
  WALL_HEIGHT,
} from './config';
import { climbEase } from './climb';
import { seatingQuality, qualityTier, type QualityTier } from './anchor';
import { moveCost, spriteKeyFor } from './holds';
import { clarityRadius, sightRadius } from './sightline';
// worldToScreen is the single camera mapping; it already folds in focusScreenY
// and slipKickPx, so all drawing (and the rope sim) goes through it.
import { worldToScreen } from './view';
import type { Assets } from './assets';
import type { GameState, Hold } from './state';
import {
  anchorById,
  holdById,
  lightFraction,
  ropeBaseX,
  ropeBaseY,
  staminaFraction,
} from './state';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

const TIER_COLOR: Record<QualityTier, string> = {
  solid: '#7ad17a',
  marginal: '#e8b85f',
  bad: '#d85b54',
};

// ── Procedural rock texture (generated once, tiled & scrolled). ─────────────
let wallTile: HTMLCanvasElement | null = null;
const TILE = 256;

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

function makeWallTile(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TILE;
  c.height = TILE;
  const g = c.getContext('2d')!;
  const rng = lcg(1337);

  g.fillStyle = '#241f1b';
  g.fillRect(0, 0, TILE, TILE);

  for (let i = 0; i < 900; i++) {
    const x = rng() * TILE;
    const y = rng() * TILE;
    const r = 2 + rng() * 14;
    const shade = rng();
    const v = Math.floor(28 + shade * 40);
    g.fillStyle = `rgba(${v + 14},${v + 6},${v - 2},${0.35 + rng() * 0.4})`;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.6 + rng() * 0.7), rng() * 6.28, 0, 6.28);
    g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 7; i++) {
    g.lineWidth = 1 + rng() * 2;
    g.beginPath();
    let x = rng() * TILE;
    let y = rng() * TILE;
    g.moveTo(x, y);
    const segs = 3 + Math.floor(rng() * 4);
    for (let j = 0; j < segs; j++) {
      x += (rng() - 0.5) * 90;
      y += (rng() - 0.5) * 90;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

// stars above the summit (world coords, generated once)
let stars: { x: number; y: number; b: number }[] | null = null;
function makeStars(viewW: number): { x: number; y: number; b: number }[] {
  const rng = lcg(424242);
  const out: { x: number; y: number; b: number }[] = [];
  for (let i = 0; i < 70; i++) {
    out.push({
      x: rng() * (viewW + 400) - 200,
      y: WALL_HEIGHT + 80 + rng() * 1600,
      b: 0.3 + rng() * 0.7,
    });
  }
  return out;
}

// ── Reach animation: the climber's animated WORLD position + body transform. ─
interface ClimberPose {
  x: number; // world px (the body's grounding point)
  y: number;
  squash: number; // 1 = neutral; <1 = squashed wider/shorter; >1 = stretched
  lean: number; // body rotation (radians)
  punch: number; // extra scale on the grab pop (0..~0.18)
  effort: number; // 0..1 darkening/strain intensity
}

/** Animated body pose during reach/fall; static otherwise. */
function climberPose(s: GameState): ClimberPose {
  if (s.phase === 'reaching' && s.committedId != null) {
    const h = holdById(s, s.committedId);
    if (h) {
      const p = clamp(s.resolveProgress, 0, 1);
      const t = climbEase(p); // eased travel 0..1
      // outward arc reads as "reaching with the body" — bulge sideways mid-move
      const dx = h.x - s.moveStartX;
      const dy = h.y - s.moveStartY;
      const arc = Math.sin(p * Math.PI) * 18 * s.facing; // outward then back
      const x = s.moveStartX + dx * t + arc;
      const y = s.moveStartY + dy * t;

      // beats: coil (squash) early, extend mid, grab-pop near end, settle.
      // squash: dip below 1 in the first ~25% (coil), rise above 1 while extending.
      let squash = 1;
      if (p < 0.22) squash = 1 - 0.18 * Math.sin((p / 0.22) * Math.PI); // crouch
      else squash = 1 + 0.12 * Math.sin(((p - 0.22) / 0.78) * Math.PI); // reach up

      // grab pop: a quick scale punch in the last ~15%
      const punch = p > 0.85 ? Math.sin(((p - 0.85) / 0.15) * Math.PI) * 0.16 : 0;

      // lean toward the target; strain adds a wobble
      const baseLean = -0.16 * s.facing * Math.sin(p * Math.PI);
      const wob = Math.sin(s.elapsed * 24) * s.strain * 0.05;
      const lean = baseLean + wob;

      const effort = Math.sin(p * Math.PI) * (0.45 + 0.55 * s.strain);
      return { x, y, squash, lean, punch, effort };
    }
  }

  if (s.phase === 'falling') {
    const p = clamp(s.fallProgress, 0, 1);
    // accelerate downward (gravity feel), then a small settle bounce at the catch
    const fallT = p * p;
    const y = s.fallFromY + (s.fallToY - s.fallFromY) * fallT;
    const settle = p > 0.92 ? Math.sin(((p - 0.92) / 0.08) * Math.PI) * 0.1 : 0;
    // tumble/sway as you drop
    const lean = Math.sin(p * 9) * 0.18 * (1 - p) + (s.fallRipped ? Math.sin(p * 16) * 0.1 : 0);
    return { x: s.climberX, y, squash: 1 - settle, lean, punch: 0, effort: 0.3 };
  }

  return { x: s.climberX, y: s.climberY, squash: 1, lean: 0, punch: 0, effort: 0 };
}

// ── Falling grit/dust particles (knocked off the wall during effort). ───────
interface Grit {
  x: number; // world px
  y: number;
  vx: number;
  vy: number;
  life: number; // remaining seconds
  max: number;
}
let grit: Grit[] = [];
let lastGritT = 0;

function spawnGrit(s: GameState, pose: ClimberPose): void {
  // emit only during effortful moments, rate-limited by elapsed time
  const reaching = s.phase === 'reaching' && pose.effort > 0.12;
  const falling = s.phase === 'falling';
  if (!reaching && !falling) return;
  if (s.elapsed - lastGritT < 0.04) return;
  lastGritT = s.elapsed;
  const n = falling ? 3 : 1 + Math.floor(pose.effort * 2);
  for (let i = 0; i < n; i++) {
    grit.push({
      x: pose.x + (Math.random() - 0.5) * 40,
      y: pose.y + 40 + Math.random() * 70, // off hands/feet contact zone
      vx: (Math.random() - 0.5) * 30,
      vy: -10 - Math.random() * 30, // world +y up; grit falls → negative
      life: 0.5 + Math.random() * 0.5,
      max: 1,
    });
    if (grit.length > 220) grit.shift();
  }
}

function updateAndDrawGrit(ctx: CanvasRenderingContext2D, s: GameState, dt: number): void {
  for (const p of grit) {
    p.life -= dt;
    p.vy -= 240 * dt; // world gravity (pulls -y, i.e. down)
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  grit = grit.filter((p) => p.life > 0);
  for (const p of grit) {
    const scr = worldToScreen(s, p.x, p.y);
    const a = clamp(p.life / p.max, 0, 1) * 0.6;
    ctx.fillStyle = `rgba(190,170,140,${a})`;
    ctx.fillRect(scr.x, scr.y, 2, 2);
  }
}

// ── Verlet rope (module-level node state; re-pinned each frame). ────────────
interface Node {
  x: number; // screen px (we simulate in screen space so sag reads on-screen)
  y: number;
  px: number;
  py: number;
}
let ropeNodes: Node[] | null = null;
let ropeLastMs = 0;

function ensureRope(topX: number, topY: number, botX: number, botY: number): Node[] {
  const n = ROPE_SEGMENTS + 1;
  if (!ropeNodes || ropeNodes.length !== n) {
    ropeNodes = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = topX + (botX - topX) * t;
      const y = topY + (botY - topY) * t;
      ropeNodes.push({ x, y, px: x, py: y });
    }
  }
  return ropeNodes;
}

function simulateRope(
  topX: number,
  topY: number,
  botX: number,
  botY: number,
  dt: number,
): Node[] {
  const nodes = ensureRope(topX, topY, botX, botY);
  const n = nodes.length;

  // total rope length with slack → segment rest length (in screen px)
  const straight = Math.hypot(botX - topX, botY - topY);
  const segLen = (Math.max(straight, 1) * ROPE_SLACK) / (n - 1);

  // verlet integrate (gravity in +screenY = down). cap dt for stability.
  const h = Math.min(dt, 0.033);
  const g = ROPE_GRAVITY * h * h;
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    const vx = (node.x - node.px) * 0.94;
    const vy = (node.y - node.py) * 0.94;
    node.px = node.x;
    node.py = node.y;
    node.x += vx;
    node.y += vy + g;
  }

  // constrain: pin endpoints + distance constraints between neighbours.
  for (let it = 0; it < ROPE_ITERATIONS; it++) {
    nodes[0].x = topX;
    nodes[0].y = topY;
    nodes[n - 1].x = botX;
    nodes[n - 1].y = botY;
    for (let i = 0; i < n - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      const diff = (d - segLen) / d;
      const offx = dx * 0.5 * diff;
      const offy = dy * 0.5 * diff;
      const lockA = i === 0;
      const lockB = i + 1 === n - 1;
      if (!lockA) {
        a.x += offx;
        a.y += offy;
      }
      if (!lockB) {
        b.x -= offx;
        b.y -= offy;
      }
    }
  }
  return nodes;
}

function drawRope(ctx: CanvasRenderingContext2D, nodes: Node[]): void {
  if (nodes.length < 2) return;
  // dark core
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(40,32,24,0.95)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(nodes[0].x, nodes[0].y);
  for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
  ctx.stroke();
  // warm-lit highlight strand
  ctx.strokeStyle = 'rgba(190,150,90,0.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(nodes[0].x - 0.8, nodes[0].y);
  for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x - 0.8, nodes[i].y);
  ctx.stroke();
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, assets: Assets): void {
  const { viewW: W, viewH: H } = s;
  if (!wallTile) wallTile = makeWallTile();
  if (!stars) stars = makeStars(W);

  // frame dt (for grit + rope sim) — derived locally; render owns no sim state
  const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let dt = ropeLastMs ? (nowMs - ropeLastMs) / 1000 : 1 / 60;
  ropeLastMs = nowMs;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;

  const pose = climberPose(s);
  const headScreen = worldToScreen(s, pose.x, pose.y);
  const climberSX = headScreen.x;
  const climberSY = headScreen.y;
  const lf = lightFraction(s);
  const radius = sightRadius(lf);
  const clarity = clarityRadius(lf);

  // chest/harness anchor for the rope (a bit above the grounding point)
  const chestSX = climberSX;
  const chestSY = climberSY - 56;

  // ── Base: black ───────────────────────────────────────────────────────────
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const wallTop = worldToScreen(s, 0, WALL_HEIGHT).y; // summit on screen
  const wallBot = worldToScreen(s, 0, 0).y; // floor on screen

  // ── Sky above the summit ────────────────────────────────────────────────────
  if (wallTop > 0) {
    const sky = ctx.createLinearGradient(0, 0, 0, Math.min(wallTop, H));
    sky.addColorStop(0, '#05070d');
    sky.addColorStop(1, '#0d1018');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, Math.min(wallTop, H));
    for (const st of stars!) {
      const py = worldToScreen(s, st.x, st.y).y;
      if (py < -2 || py > wallTop) continue;
      ctx.fillStyle = `rgba(200,210,235,${st.b * 0.8})`;
      ctx.fillRect(st.x, py, 1.5, 1.5);
    }
  }

  // ── The rock face (tiled, scrolls 1:1 with the climb) ──────────────────────
  const top = Math.max(0, wallTop);
  const bot = Math.min(H, wallBot);
  if (bot > top) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, W, bot - top);
    ctx.clip();
    const offY = ((wallBot % TILE) + TILE) % TILE;
    for (let ty = top - TILE + offY - TILE; ty < bot + TILE; ty += TILE) {
      for (let tx = 0; tx < W + TILE; tx += TILE) {
        ctx.drawImage(wallTile, tx, ty);
      }
    }
    const wash = ctx.createLinearGradient(0, top, 0, bot);
    wash.addColorStop(0, 'rgba(20,28,45,0.35)');
    wash.addColorStop(1, 'rgba(10,6,4,0.5)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, top, W, bot - top);
    ctx.restore();

    if (wallTop > -20 && wallTop < H + 20) {
      ctx.fillStyle = 'rgba(120,150,120,0.18)';
      ctx.fillRect(0, wallTop - 4, W, 8);
    }
  }

  // ── Holds within sight (+ horns, + anchors) ─────────────────────────────────
  const reachableIds = new Set(s.reachable.map((h) => h.id));
  const labels: { x: number; y: number; hold: Hold }[] = [];
  const choosing = s.phase === 'choosing';

  for (const h of s.holds) {
    const scr = worldToScreen(s, h.x, h.y);
    const hx = scr.x;
    const hy = scr.y;
    if (hy < -60 || hy > H + 60) continue;
    const d = Math.hypot(hx - climberSX, hy - climberSY);
    if (d > radius && h.id !== s.currentHoldId) continue;

    const reachable = reachableIds.has(h.id);
    const isCurrent = h.id === s.currentHoldId;
    const isHover = h.id === s.hoverHoldId;
    const clear = d <= clarity;

    // reachable highlight (rim) — drawn beneath the sprite, only when choosing.
    // RED when you can't afford the reach: committing to it WILL slip you mid-move,
    // so this is your warning to rest (or place pro) first — an informed gamble,
    // never a surprise death.
    if (reachable && choosing) {
      const pulse = 0.5 + 0.5 * Math.sin(s.elapsed * 4 + h.id);
      const cost = moveCost({ x: s.climberX, y: s.climberY }, h);
      const affordable = s.stamina >= cost.staminaCost;
      ctx.save();
      if (!affordable) {
        ctx.shadowColor = 'rgba(232,80,72,0.95)';
        ctx.shadowBlur = isHover ? 28 : 16 + pulse * 8;
        ctx.fillStyle = isHover ? 'rgba(220,70,62,0.34)' : 'rgba(200,64,58,0.2)';
      } else {
        ctx.shadowColor = isHover ? 'rgba(255,210,90,0.95)' : 'rgba(255,180,80,0.6)';
        ctx.shadowBlur = isHover ? 26 : 12 + pulse * 8;
        ctx.fillStyle = isHover ? 'rgba(255,205,90,0.30)' : 'rgba(255,170,70,0.16)';
      }
      ctx.beginPath();
      ctx.ellipse(hx, hy, h.width * 0.62, h.width * 0.42, 0, 0, 6.28);
      ctx.fill();
      ctx.restore();
    }

    drawHoldSprite(ctx, assets, h, hx, hy, clear);

    // horn nub on holds that have one
    if (h.hasHorn) {
      const hornScr = worldToScreen(s, h.hornX, h.hornY);
      const hornBright = (isCurrent && s.hoverHorn) || (isCurrent && s.phase === 'anchoring');
      drawHornNub(ctx, hornScr.x, hornScr.y, hornBright);
    }

    if (isCurrent) {
      ctx.strokeStyle = 'rgba(230,235,240,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hx, hy + 4, h.width * 0.5, h.width * 0.28, 0, 0, 6.28);
      ctx.stroke();
    }

    if (reachable && clear && choosing) {
      labels.push({ x: hx, y: hy, hold: h });
    }
  }

  // ── Placed anchors (slings/carabiners) within sight ─────────────────────────
  for (const a of s.anchors) {
    const scr = worldToScreen(s, a.x, a.y);
    if (scr.y < -40 || scr.y > H + 40) continue;
    const d = Math.hypot(scr.x - climberSX, scr.y - climberSY);
    if (d > radius) continue;
    const live = a.id === s.ropeAnchorId;
    drawAnchor(ctx, scr.x, scr.y, qualityTier(a.quality), live);
  }

  // (Anchoring gauge is drawn AFTER the climber, below, so the sprite can't occlude it.)

  // ── ROPE: harness/chest → last anchor (or ground). Simulated in screen px. ──
  {
    const baseScr = worldToScreen(s, ropeBaseX(s), ropeBaseY(s));
    const nodes = simulateRope(chestSX, chestSY, baseScr.x, baseScr.y, dt);
    drawRope(ctx, nodes);
  }

  // ── Grit/dust (spawn during effort, fall off the wall) ──────────────────────
  spawnGrit(s, pose);
  updateAndDrawGrit(ctx, s, dt);

  // ── Darkness vignette ───────────────────────────────────────────────────────
  drawDarkness(ctx, W, H, climberSX, climberSY, radius);

  // ── Lantern LIGHT (warm wash behind the climber) ───────────────────────────
  const flicker = 0.85 + 0.15 * Math.sin(s.elapsed * 9);
  const warm = ctx.createRadialGradient(climberSX, climberSY - 30, 6, climberSX, climberSY - 30, radius * 0.7);
  warm.addColorStop(0, `rgba(255,178,70,${0.22 * flicker})`);
  warm.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);

  // ── Climber sprite, animated by pose ────────────────────────────────────────
  drawClimber(ctx, assets, s, pose, climberSX, climberSY);

  // bright lantern core
  const core = ctx.createRadialGradient(climberSX, climberSY - 78, 1, climberSX, climberSY - 78, 34 * (0.6 + lf * 0.4));
  core.addColorStop(0, `rgba(255,232,170,${0.85 * flicker})`);
  core.addColorStop(1, 'rgba(255,210,130,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  // ── Anchoring gauge — drawn ON TOP of the climber so it's never occluded ────
  if (s.phase === 'anchoring' && s.placingHoldId != null) {
    const hold = holdById(s, s.placingHoldId);
    if (hold) {
      const hornScr = worldToScreen(s, hold.hornX, hold.hornY);
      const hornD = Math.hypot(hornScr.x - climberSX, hornScr.y - climberSY);
      const q = seatingQuality(hold, s.seatAngle);
      drawAnchorGauge(ctx, hornScr.x, hornScr.y, hold.hornConeCenter, s.seatAngle, qualityTier(q), hornD <= clarity);
    }
  }

  // effort darkening during a hard reach (sells strain)
  if (pose.effort > 0.02 && s.phase === 'reaching') {
    const e = ctx.createRadialGradient(climberSX, climberSY, radius * 0.25, climberSX, climberSY, radius);
    e.addColorStop(0, 'rgba(0,0,0,0)');
    e.addColorStop(1, `rgba(0,0,0,${0.3 * pose.effort})`);
    ctx.fillStyle = e;
    ctx.fillRect(0, 0, W, H);
  }

  // fall: harder vignette + a rip snap flash
  if (s.phase === 'falling') {
    const fp = clamp(s.fallProgress, 0, 1);
    const intensity = 0.35 + 0.35 * Math.sin(fp * Math.PI);
    const e = ctx.createRadialGradient(climberSX, climberSY, radius * 0.15, climberSX, climberSY, radius * 1.1);
    e.addColorStop(0, 'rgba(0,0,0,0)');
    e.addColorStop(1, `rgba(20,4,4,${0.6 * intensity})`);
    ctx.fillStyle = e;
    ctx.fillRect(0, 0, W, H);
    if (s.fallRipped && fp < 0.4) {
      // snap flash near where the rope was anchored (the rip)
      const baseScr = worldToScreen(s, ropeBaseX(s), ropeBaseY(s));
      const a = (1 - fp / 0.4) * 0.8;
      ctx.fillStyle = `rgba(255,120,90,${a})`;
      ctx.beginPath();
      ctx.arc(baseScr.x, baseScr.y, 10 + (1 - a) * 18, 0, 6.28);
      ctx.fill();
    }
  }

  // abort flash (slip lurch)
  if (s.abortFlash > 0) {
    const a = clamp(s.abortFlash / 0.7, 0, 1);
    const edge = ctx.createRadialGradient(climberSX, climberSY, radius * 0.2, climberSX, climberSY, radius);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, `rgba(40,8,6,${0.55 * a})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(90,20,18,${0.18 * a})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Cost labels (after darkness so readable holds stay legible) ────────────
  for (const l of labels) drawCostLabel(ctx, s, l.hold, l.x, l.y);

  // ── HUD ─────────────────────────────────────────────────────────────────────
  drawHUD(ctx, s);

  if (s.phase === 'won') drawEnd(ctx, s, 'YOU MADE IT', '#bfe8b0');
  if (s.phase === 'lost') drawEnd(ctx, s, 'THE DARK TOOK YOU', '#d05b54');
}

function drawHoldSprite(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  h: Hold,
  x: number,
  y: number,
  clear: boolean,
): void {
  const img = assets.holds[spriteKeyFor(h)];
  const w = h.width;
  const hgt = (w * img.height) / img.width;
  ctx.save();
  if (!clear) {
    ctx.globalAlpha = 0.9;
    ctx.filter = 'brightness(0.45)';
  }
  ctx.drawImage(img, x - w / 2, y - hgt / 2, w, hgt);
  ctx.restore();
}

/** A subtle rock nub for a slingable horn; brightens when hovered/active. */
function drawHornNub(ctx: CanvasRenderingContext2D, x: number, y: number, bright: boolean): void {
  ctx.save();
  ctx.fillStyle = bright ? 'rgba(255,210,120,0.9)' : 'rgba(150,140,120,0.55)';
  if (bright) {
    ctx.shadowColor = 'rgba(255,200,90,0.8)';
    ctx.shadowBlur = 14;
  }
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 4);
  ctx.lineTo(x, y - 7);
  ctx.lineTo(x + 5, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A placed anchor: sling loop + carabiner, colored by tier; live rope anchor glows. */
function drawAnchor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tier: QualityTier,
  live: boolean,
): void {
  ctx.save();
  const col = TIER_COLOR[tier];
  if (live) {
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
  }
  // sling loop around the horn
  ctx.strokeStyle = 'rgba(210,200,180,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 7, 5, 0, 0, 6.28);
  ctx.stroke();
  // carabiner (a small colored oval below)
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(x, y + 9, 3.4, 5.2, 0, 0, 6.28);
  ctx.stroke();
  ctx.restore();
}

/** The anchoring skill read: the safe cone (only if in clarity) + the seat sling. */
function drawAnchorGauge(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  coneCenter: number,
  seatAngle: number,
  tier: QualityTier,
  inClarity: boolean,
): void {
  const R = 104; // big enough to read clearly past the climber's body
  ctx.save();
  // world angles: +y up, but screen +y down → negate the angle's y for drawing.
  const toScreen = (ang: number) => -ang;

  // safe-cone wedge — ONLY when within the lantern's clarity radius
  if (inClarity) {
    const c = toScreen(coneCenter);
    const a0 = c - HORN_CONE_HALF_WIDTH;
    const a1 = c + HORN_CONE_HALF_WIDTH;
    const grad = ctx.createRadialGradient(hx, hy, 6, hx, hy, R);
    grad.addColorStop(0, 'rgba(130,230,140,0.55)');
    grad.addColorStop(1, 'rgba(130,230,140,0.08)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.arc(hx, hy, R, a0, a1);
    ctx.closePath();
    ctx.fill();
    // cone edges + a centre line marking the sweet spot
    ctx.strokeStyle = 'rgba(170,245,180,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(a0) * R, hy + Math.sin(a0) * R);
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(a1) * R, hy + Math.sin(a1) * R);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,255,200,0.45)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(c) * R, hy + Math.sin(c) * R);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    // guessing in the dark — a faint "?" ring, no cone
    ctx.fillStyle = 'rgba(210,210,220,0.5)';
    ctx.font = '20px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', hx, hy - R * 0.55);
    ctx.strokeStyle = 'rgba(180,180,190,0.22)';
    ctx.setLineDash([3, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hx, hy, R * 0.72, 0, 6.28);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // current seat direction — the sling line, colored by quality tier
  const sa = toScreen(seatAngle);
  const ex = hx + Math.cos(sa) * R;
  const ey = hy + Math.sin(sa) * R;
  ctx.strokeStyle = TIER_COLOR[tier];
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.shadowColor = TIER_COLOR[tier];
  ctx.shadowBlur = tier === 'solid' ? 18 : 10;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  // sling head (a satisfying fat dot; pulses when the seat is solid)
  const head = tier === 'solid' ? 7 + 1.5 * Math.sin(Date.now() / 90) : 5.5;
  ctx.fillStyle = TIER_COLOR[tier];
  ctx.beginPath();
  ctx.arc(ex, ey, head, 0, 6.28);
  ctx.fill();
  ctx.restore();
}

function drawClimber(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  s: GameState,
  pose: ClimberPose,
  x: number,
  y: number,
): void {
  const img = assets.climber;
  const baseH = 150;
  const baseW = (baseH * img.width) / img.height;

  // squash-stretch: conserve area-ish (wider when squashed, taller when stretched)
  const sy = pose.squash * (1 + pose.punch);
  const sx = (1 / pose.squash) * (1 + pose.punch * 0.5);
  const h = baseH * sy;
  const w = baseW * sx;

  // drop shadow grounds the figure
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 18, w * 0.34, 8, 0, 0, 6.28);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pose.lean);
  if (s.facing === 1) ctx.scale(-1, 1); // sprite faces left by default
  // feet sit just below the grounding point; pivot near the feet for the lean
  ctx.drawImage(img, -w / 2, -h + 26 * sy, w, h);
  ctx.restore();
}

function drawDarkness(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cx: number,
  cy: number,
  radius: number,
): void {
  const g = ctx.createRadialGradient(cx, cy, radius * 0.32, cx, cy, radius);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0.99)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawCostLabel(ctx: CanvasRenderingContext2D, s: GameState, h: Hold, x: number, y: number): void {
  const cost = moveCost({ x: s.climberX, y: s.climberY }, h);
  const affordable = s.stamina >= cost.staminaCost;
  const yy = y - h.width * 0.5 - 12;
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = affordable ? 'rgba(230,232,238,0.9)' : 'rgba(235,120,110,0.95)';
  ctx.fillText(`${h.type}  ${cost.staminaCost.toFixed(0)}`, x, yy);
}

function drawHUD(ctx: CanvasRenderingContext2D, s: GameState): void {
  const pad = 18;
  const barW = 250;
  const barH = 16;

  // projected stamina cost of the reach we're committing to (ghost on the bar)
  let ghost = 0;
  if (s.phase === 'reaching' && s.committedId != null) {
    const h = holdById(s, s.committedId);
    if (h) ghost = moveCost({ x: s.moveStartX, y: s.moveStartY }, h).staminaCost;
  }

  drawBar(ctx, pad, pad, barW, barH, lightFraction(s), '#f0c64a', 'LANTERN', `${s.light.toFixed(0)}`, 0);
  drawBar(
    ctx,
    pad,
    pad + barH + 10,
    barW,
    barH,
    staminaFraction(s),
    '#5fa6e8',
    'STAMINA',
    `${s.stamina.toFixed(0)}`,
    ghost / STAMINA_MAX,
  );

  // protection / exposure readout — the "run-out" above your last anchor.
  drawExposure(ctx, s, pad, pad + (barH + 10) * 2 + 6);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(205,210,220,0.85)';
  ctx.font = '13px ui-monospace, monospace';
  const pct = Math.floor((s.climberY / WALL_HEIGHT) * 100);
  ctx.fillText(`${pct}%  ·  ${s.moves} moves  ·  ${s.elapsed.toFixed(0)}s`, s.viewW - pad, pad + 12);
  ctx.fillStyle = 'rgba(150,155,165,0.75)';
  ctx.fillText(phaseHint(s), s.viewW - pad, pad + 30);
}

/** Run-out gauge: how far the climber is above the last anchor (or ground). */
function drawExposure(ctx: CanvasRenderingContext2D, s: GameState, x: number, y: number): void {
  const anchor = anchorById(s, s.ropeAnchorId);
  const baseY = anchor ? anchor.y : 0;
  const runOut = Math.max(0, s.climberY - baseY);
  const protectedNow = anchor != null;

  // color ramps from calm → alarming as run-out grows toward a fatal fall.
  const danger = clamp(runOut / 320, 0, 1);
  const r = Math.floor(120 + danger * 130);
  const g = Math.floor(170 - danger * 120);
  const col = `rgb(${r},${g},80)`;

  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(180,185,195,0.8)';
  ctx.fillText('RUN-OUT', x, y + 11);

  // a thin vertical gauge to the right of the label
  const gx = x + 78;
  const gh = 26;
  const gy = y - 6;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(gx, gy, 8, gh);
  const fillH = gh * danger;
  ctx.fillStyle = col;
  ctx.fillRect(gx, gy + gh - fillH, 8, fillH);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(gx + 0.5, gy + 0.5, 8, gh);

  ctx.fillStyle = col;
  ctx.fillText(
    protectedNow ? `${runOut.toFixed(0)} px` : 'UNPROTECTED',
    gx + 16,
    y + 11,
  );
}

function phaseHint(s: GameState): string {
  switch (s.phase) {
    case 'choosing':
      return s.hoverHorn
        ? 'hold the horn, aim the sling, release to set'
        : 'hold a glowing hold to climb · or sling the horn';
    case 'reaching':
      return 'HOLD — release = fall';
    case 'anchoring':
      return 'aim the sling into the safe cone · release to set';
    case 'falling':
      return s.fallRipped ? 'the anchor RIPS…' : 'falling…';
    default:
      return '';
  }
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string,
  label: string,
  value: string,
  ghostFrac: number,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(x, y, w, h);
  const fillW = w * clamp(frac, 0, 1);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, fillW, h);

  if (ghostFrac > 0) {
    const gW = w * clamp(ghostFrac, 0, 1);
    const gx = Math.max(x, x + fillW - gW);
    const enough = frac >= ghostFrac;
    ctx.fillStyle = enough ? 'rgba(255,255,255,0.35)' : 'rgba(230,80,70,0.7)';
    ctx.fillRect(gx, y, Math.min(gW, fillW), h);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.fillStyle = '#0a0c10';
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 6, y + h - 4);
  ctx.fillStyle = 'rgba(235,237,242,0.9)';
  ctx.textAlign = 'right';
  ctx.fillText(value, x + w - 6, y + h - 4);
}

function drawEnd(ctx: CanvasRenderingContext2D, s: GameState, title: string, color: string): void {
  const W = s.viewW;
  const H = s.viewH;
  ctx.fillStyle = 'rgba(0,0,0,0.84)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 42px ui-monospace, monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.fillStyle = 'rgba(220,222,228,0.85)';
  ctx.font = '16px ui-monospace, monospace';
  const pct = Math.floor((s.climberY / WALL_HEIGHT) * 100);
  ctx.fillText(`${pct}% climbed · ${s.moves} moves · ${s.elapsed.toFixed(1)}s`, W / 2, H / 2 + 16);
  ctx.fillStyle = 'rgba(170,175,185,0.8)';
  ctx.font = '14px ui-monospace, monospace';
  ctx.fillText('click or press R to climb again', W / 2, H / 2 + 48);
}
