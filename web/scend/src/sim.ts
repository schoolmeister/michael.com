/**
 * sim.ts — the whole game in one tick. You auto-run right at `speed` (always climbing);
 * the only input is a buffered jump. Land on platforms, leap the lethal void gaps, and
 * stack PERMANENT speed (wet-lava blasts, >> pickups) while a bullet hell rains in. Fall
 * into a gap → death. Vertical is screen-space px (+Y down); horizontal is world-space px.
 */

import * as C from './config';
import type { Column, GameState, Ghost, Player } from './state';
import { columnAt, columnAtX, createWorld, ensureTo, prune } from './world';

const groundY = (s: GameState): number => s.viewH * C.GROUND_FRAC;
const surfaceY = (s: GameState, h: number): number => groundY(s) - h * C.TILE;
const playerLeft = (p: Player): number => p.x - C.PLAYER_W / 2;
const playerRight = (p: Player): number => p.x + C.PLAYER_W / 2;
const playerFeet = (p: Player): number => p.y + C.PLAYER_H;
const isWet = (s: GameState): boolean => s.time < s.player.wetUntil;

export function createGame(seed: number, viewW: number, viewH: number): GameState {
  const world = createWorld(seed);
  const startX = 3 * C.TILE + C.TILE / 2;
  const s: GameState = {
    phase: 'running',
    time: 0,
    speed: C.BASE_SPEED,
    peakSpeed: C.BASE_SPEED,
    speedBoost: 0,
    slowTimer: 0,
    distance: 0,
    camX: startX - viewW * C.PLAYER_ANCHOR_X,
    player: {
      x: startX,
      y: 0,
      vy: 0,
      onGround: true,
      onUpper: false,
      coyote: 0,
      buffer: 0,
      wetUntil: -1,
      knife: false,
      horns: false
    },
    world,
    projectiles: [],
    particles: [],
    floats: [],
    trail: [],
    trailTimer: 0,
    shake: 0,
    boostFlash: 0,
    viewW,
    viewH
  };
  s.player.y = surfaceY(s, 1) - C.PLAYER_H; // seat on the lead-in platform (h = START_H)
  return s;
}

export function requestJump(s: GameState): void {
  s.player.buffer = C.JUMP_BUFFER;
}

// ── juice spawners ───────────────────────────────────────────────────────────
function burst(
  s: GameState,
  x: number,
  y: number,
  n: number,
  color: string,
  opts: { speed?: number; spread?: number; size?: number; life?: number; gravity?: boolean; vx0?: number } = {}
): void {
  const sp = opts.speed ?? 180;
  const spread = opts.spread ?? Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * spread + (spread < Math.PI * 2 ? Math.PI : 0);
    const v = sp * (0.4 + Math.random() * 0.8);
    s.particles.push({
      x,
      y,
      vx: (opts.vx0 ?? 0) + Math.cos(a) * v,
      vy: Math.sin(a) * v - (opts.gravity ? 60 : 0),
      life: opts.life ?? 0.5,
      maxLife: opts.life ?? 0.5,
      size: opts.size ?? 3,
      color,
      gravity: opts.gravity ?? false
    });
  }
}

function floatText(s: GameState, text: string, color: string): void {
  s.floats.push({ x: s.player.x, y: s.player.y - 10, vy: -70, life: 0.9, text, color });
}

function addBoost(s: GameState, amount: number, label: string): void {
  s.speedBoost += amount;
  s.boostFlash = 0.4;
  s.shake = Math.max(s.shake, C.SHAKE_BOOST);
  floatText(s, label, C.PALETTE.boost);
  burst(s, s.player.x, s.player.y + C.PLAYER_H / 2, 18, C.PALETTE.boost, {
    speed: 260,
    size: 4,
    life: 0.6,
    vx0: -120
  });
}

function die(s: GameState, color: string): void {
  if (s.phase !== 'running') return;
  s.phase = 'dead';
  s.shake = C.SHAKE_DEATH;
  burst(s, s.player.x, s.player.y + C.PLAYER_H / 2, 40, color, { speed: 360, size: 4, life: 0.9 });
  burst(s, s.player.x, s.player.y + C.PLAYER_H / 2, 20, C.PALETTE.player, { speed: 220, size: 3, life: 0.7 });
}

export function update(s: GameState, dt: number): void {
  if (s.phase !== 'running') {
    updateParticles(s, dt); // let the death burst finish animating
    s.shake = Math.max(0, s.shake - C.SHAKE_DECAY * dt);
    return;
  }
  const p = s.player;

  s.time += dt;
  if (s.time >= C.WIN_TIME) {
    s.phase = 'won';
    return;
  }

  // ── speed: PERMANENT boost, × time ramp, − brief water slow ──────────────────
  if (s.slowTimer > 0) s.slowTimer -= dt;
  const rampMult = 1 + C.RAMP_GAIN * Math.min(1, s.time / C.RAMP_FULL_AT);
  let speed = (C.BASE_SPEED + s.speedBoost) * rampMult;
  if (s.slowTimer > 0) speed *= C.WATER_SLOW_FACTOR;
  speed = Math.max(C.MIN_SPEED, speed);
  s.speed = speed;
  if (speed > s.peakSpeed) s.peakSpeed = speed;
  s.distance += speed * dt;

  // ── advance & stream the world ───────────────────────────────────────────────
  p.x += speed * dt;
  s.camX = p.x - s.viewW * C.PLAYER_ANCHOR_X;
  ensureTo(s.world, s.camX + s.viewW, s.time);
  prune(s.world, s.camX);

  // ── vertical physics ─────────────────────────────────────────────────────────
  p.coyote += dt;
  if (p.buffer > 0) p.buffer -= dt;

  const prevFeet = playerFeet(p);
  p.vy += C.GRAVITY * dt;
  p.y += p.vy * dt;

  // ── landing: check UPPER platforms first (higher surface = smaller Y), then ground ──
  // Upper platforms are one-way: only land when descending through the top surface.
  const col = columnAtX(s.world, p.x);
  let landed = false;
  p.onUpper = false;

  if (p.vy >= 0) {
    // upper platforms — descend from above only
    for (const up of s.world.upperPlatforms) {
      if (p.x < up.x0 || p.x > up.x1) continue;
      const upTop = surfaceY(s, up.h);
      if (prevFeet <= upTop + 2 && playerFeet(p) >= upTop) {
        const wasAir = !p.onGround;
        p.y = upTop - C.PLAYER_H;
        p.vy = 0;
        p.onGround = true;
        p.onUpper = true;
        p.coyote = 0;
        landed = true;
        if (wasAir) burst(s, p.x, p.y + C.PLAYER_H, 6, C.PALETTE.upperEdge, { speed: 120, size: 2, life: 0.3, gravity: true });
        break;
      }
    }

    // ground — only if not already on an upper platform
    if (!landed && col) {
      const surfTop = surfaceY(s, col.h);
      if (prevFeet <= surfTop + 2 && playerFeet(p) >= surfTop) {
        const wasAir = !p.onGround;
        p.y = surfTop - C.PLAYER_H;
        p.vy = 0;
        p.onGround = true;
        p.coyote = 0;
        landed = true;
        if (wasAir) burst(s, p.x, p.y + C.PLAYER_H, 6, C.PALETTE.groundEdge, { speed: 120, size: 2, life: 0.3, gravity: true });
      }
    }
  }

  if (!landed) p.onGround = false;

  // ── fall into the void → death ────────────────────────────────────────────────
  if (p.y > s.viewH + C.FALL_DEATH_MARGIN) {
    die(s, C.PALETTE.player);
    return;
  }

  // ── buffered jump ─────────────────────────────────────────────────────────────
  if (p.buffer > 0 && (p.onGround || p.coyote <= C.COYOTE)) {
    p.vy = -C.JUMP_V;
    p.onGround = false;
    p.onUpper = false;
    p.coyote = C.COYOTE + 1;
    p.buffer = 0;
    burst(s, p.x, p.y + C.PLAYER_H, 8, C.PALETTE.player, { speed: 150, size: 2, life: 0.3, gravity: true });
  }

  // ── ground tile hazards (skip if standing on an upper platform above the tile) ──
  if (p.onGround && !p.onUpper && col) {
    if (col.kind === 'spike') {
      if (p.horns) consumeHorns(s, col);
      else die(s, C.PALETTE.spike);
    } else if (col.kind === 'lava') {
      if (isWet(s)) {
        addBoost(s, C.LAVA_BOOST, 'STEAM >>');
        p.wetUntil = -1;
        col.kind = 'solid';
      } else if (p.horns) consumeHorns(s, col);
      else die(s, C.PALETTE.lava);
    } else if (col.kind === 'water') {
      s.slowTimer = C.WATER_SLOW_TIME;
      p.wetUntil = s.time + C.WET_DURATION;
      col.kind = 'solid';
      burst(s, p.x, p.y + C.PLAYER_H, 10, C.PALETTE.water, { speed: 140, size: 3, life: 0.4, gravity: true });
    }
  }

  updateGeysers(s, dt);
  updateGhosts(s, dt);
  updatePickups(s);
  updateProjectiles(s, dt);
  maybeThrowKnife(s);

  // ── juice bookkeeping ───────────────────────────────────────────────────────
  s.trailTimer += dt;
  if (s.trailTimer >= C.TRAIL_STEP) {
    s.trailTimer = 0;
    s.trail.push({ x: p.x, y: p.y, wet: isWet(s) });
    if (s.trail.length > C.TRAIL_LEN) s.trail.shift();
  }
  updateParticles(s, dt);
  updateFloats(s, dt);
  s.shake = Math.max(0, s.shake - C.SHAKE_DECAY * dt);
  if (s.boostFlash > 0) s.boostFlash -= dt;
}

function consumeHorns(s: GameState, col: Column): void {
  s.player.horns = false;
  col.kind = 'solid';
  s.shake = Math.max(s.shake, C.SHAKE_BOOST * 0.7);
  burst(s, s.player.x, s.player.y + C.PLAYER_H / 2, 14, C.PALETTE.horns, { speed: 220, size: 3, life: 0.5 });
}

// ── geysers ─────────────────────────────────────────────────────────────────
function updateGeysers(s: GameState, dt: number): void {
  const p = s.player;
  const fromCol = Math.floor(s.camX / C.TILE) - 1;
  const toCol = Math.ceil((s.camX + s.viewW) / C.TILE) + 1;
  for (let c = fromCol; c <= toCol; c++) {
    const col = columnAt(s.world, c);
    if (!col?.geyser || col.geyser.dead) continue;
    const g = col.geyser;
    g.phase = (g.phase + dt) % C.GEYSER_PERIOD;
    if (g.phase >= C.GEYSER_ERUPT) continue;
    const sx0 = c * C.TILE;
    const base = surfaceY(s, col.h);
    const top = base - C.GEYSER_HEIGHT * C.TILE;
    if (playerRight(p) > sx0 && playerLeft(p) < sx0 + C.TILE && playerFeet(p) > top && p.y < base) {
      if (p.horns) {
        p.horns = false;
        g.dead = true;
      } else die(s, C.PALETTE.geyser);
    }
  }
}

// ── ghosts = bullet hell ───────────────────────────────────────────────────────
function ghostHits(s: GameState, g: Ghost): boolean {
  const gy = surfaceY(s, g.floatTiles);
  const p = s.player;
  const r = C.TILE * 0.33;
  return playerRight(p) > g.x - r && playerLeft(p) < g.x + r && playerFeet(p) > gy - r && p.y < gy + r;
}

function updateGhosts(s: GameState, dt: number): void {
  const t = Math.min(1, s.time / C.WIN_TIME);
  const n = 1 + Math.round(t * (C.BOO_COUNT_MAX - 1));
  for (const g of s.world.ghosts) {
    if (g.dead) continue;
    g.x += g.dir * C.GHOST_SPEED * dt;
    if (g.x > g.anchorX + C.GHOST_PATROL * C.TILE) g.dir = -1;
    else if (g.x < g.anchorX - C.GHOST_PATROL * C.TILE) g.dir = 1;

    g.fire -= dt;
    if (g.fire <= 0) {
      g.fire = (C.GHOST_FIRE_START + (C.GHOST_FIRE_END - C.GHOST_FIRE_START) * t);
      const gy = surfaceY(s, g.floatTiles);
      const vx = -(C.BOO_SPEED + C.BOO_SPEED_RAMP * t);
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * C.BOO_SPREAD;
        s.projectiles.push({ x: g.x, y: gy + off, vx, vy: off * 0.7, kind: 'boo', dead: false });
      }
    }

    if (ghostHits(s, g)) {
      if (s.player.horns) {
        s.player.horns = false;
        g.dead = true;
        burst(s, g.x, surfaceY(s, g.floatTiles), 14, C.PALETTE.horns, { speed: 220, size: 3, life: 0.5 });
      } else die(s, C.PALETTE.ghost);
    }
  }
}

// ── pickups ─────────────────────────────────────────────────────────────────
function updatePickups(s: GameState): void {
  const p = s.player;
  for (const pk of s.world.pickups) {
    if (pk.taken) continue;
    const py = surfaceY(s, pk.floatTiles);
    if (
      Math.abs(pk.x - p.x) < C.TILE * 0.5 + C.PLAYER_W / 2 &&
      py > p.y - C.TILE * 0.5 &&
      py < playerFeet(p) + C.TILE * 0.5
    ) {
      pk.taken = true;
      burst(s, pk.x, py, 12, C.PALETTE.boost, { speed: 180, size: 3, life: 0.5 });
      if (pk.kind === 'boots') addBoost(s, C.BOOTS_BOOST, '>>');
      else if (pk.kind === 'knife') {
        p.knife = true;
        floatText(s, 'KNIFE', C.PALETTE.knife);
      } else {
        p.horns = true;
        floatText(s, 'HORNS', C.PALETTE.horns);
      }
    }
  }
}

// ── projectiles ─────────────────────────────────────────────────────────────
function updateProjectiles(s: GameState, dt: number): void {
  const p = s.player;
  for (const pr of s.projectiles) {
    if (pr.dead) continue;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    if (pr.kind === 'boo') {
      if (
        pr.x > playerLeft(p) &&
        pr.x < playerRight(p) &&
        pr.y > p.y &&
        pr.y < playerFeet(p)
      ) {
        if (p.horns) {
          p.horns = false;
          pr.dead = true;
        } else die(s, C.PALETTE.boo);
      }
    } else {
      for (const g of s.world.ghosts) {
        if (!g.dead && Math.abs(g.x - pr.x) < C.TILE * 0.5) {
          g.dead = true;
          pr.dead = true;
          burst(s, g.x, surfaceY(s, g.floatTiles), 12, C.PALETTE.knife, { speed: 200, size: 3, life: 0.4 });
        }
      }
      const col = columnAtX(s.world, pr.x);
      if (col && col.kind === 'spike') {
        col.kind = 'solid';
        pr.dead = true;
      }
    }
    if (pr.x < s.camX - C.TILE || pr.x > s.camX + s.viewW + C.TILE || pr.y < -C.TILE || pr.y > s.viewH + C.TILE) {
      pr.dead = true;
    }
  }
  s.projectiles = s.projectiles.filter((pr) => !pr.dead);
}

// ── knife auto-throw ──────────────────────────────────────────────────────────
function maybeThrowKnife(s: GameState): void {
  const p = s.player;
  if (!p.knife || s.projectiles.some((pr) => pr.kind === 'knife')) return;
  let target = s.world.ghosts.some((g) => !g.dead && g.x > p.x && g.x - p.x < C.KNIFE_RANGE);
  if (!target) {
    const fromCol = Math.floor(p.x / C.TILE);
    const toCol = Math.floor((p.x + C.KNIFE_RANGE) / C.TILE);
    for (let c = fromCol; c <= toCol && !target; c++) {
      if (columnAt(s.world, c)?.kind === 'spike') target = true;
    }
  }
  if (target) {
    p.knife = false;
    s.projectiles.push({ x: p.x, y: p.y + C.PLAYER_H * 0.4, vx: C.KNIFE_SPEED, vy: 0, kind: 'knife', dead: false });
  }
}

// ── particle / float updates ──────────────────────────────────────────────────
function updateParticles(s: GameState, dt: number): void {
  for (const pt of s.particles) {
    if (pt.gravity) pt.vy += C.GRAVITY * 0.35 * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  s.particles = s.particles.filter((pt) => pt.life > 0);
}

function updateFloats(s: GameState, dt: number): void {
  for (const f of s.floats) {
    f.y += f.vy * dt;
    f.life -= dt;
  }
  s.floats = s.floats.filter((f) => f.life > 0);
}

export { groundY, surfaceY, isWet };
