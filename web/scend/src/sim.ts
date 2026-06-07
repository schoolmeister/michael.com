/**
 * sim.ts — the whole game in one tick. You auto-run right across an INFINITE stack of floors,
 * getting faster forever. One button: on the ground Space jumps (climb a floor / clear a gap);
 * running off a hole drops you down; with MAGNET BOOTS a mid-air Space dives straight down.
 * A vertical camera tracks the floor you're on — fall off it into the void and you die.
 *
 * Coordinates: horizontal = world px (camera scrolls right). Vertical = world px (+Y down);
 * lane n's surface world-y = -n * LANE_GAP. Screen-y = worldY - camY.
 */

import * as C from './config';
import * as A from './assets';
import { TUNE, TUNE_FIELDS, adjustTune } from './tunables';
import { inspectorLayout, TILESET_W, TILESET_H } from './themes';
import type { Enemy, EnemyKind, GameState, Player } from './state';
import { createWorld, ensureTo, platformAt, prune } from './world';

const laneWorldY = (lane: number): number => -lane * C.LANE_GAP;
const screenY = (s: GameState, worldY: number): number => worldY - s.camY;
const laneScreenY = (s: GameState, lane: number): number => laneWorldY(lane) - s.camY;
const playerLeft = (p: Player): number => p.x - C.PLAYER_W / 2;
const playerRight = (p: Player): number => p.x + C.PLAYER_W / 2;
const playerFeet = (p: Player): number => p.y + C.PLAYER_H;
/** World-y of an enemy's CENTRE when sitting on its lane (before any kick flings it). */
export function enemyLaneY(kind: EnemyKind, lane: number): number {
  const off = kind === 'ghost' ? C.GHOST_FLOAT * C.TILE : kind === 'hobgoblin' ? C.TILE : C.TILE * 0.5;
  return laneWorldY(lane) - off;
}
/** Half-extent (px) of an enemy's box, by kind. */
function enemyHalf(kind: EnemyKind): { hw: number; hh: number } {
  if (kind === 'hobgoblin') return { hw: C.TILE * 0.9, hh: C.TILE };
  if (kind === 'boulder') return { hw: C.TILE * 0.46, hh: C.TILE * 0.46 };
  return { hw: C.TILE * 0.34, hh: C.TILE * 0.34 };
}
/** During invuln (granted by a speed boost) you ram THROUGH hazards, destroying them. */
const isInvuln = (s: GameState): boolean => s.time < s.player.invulnUntil;

export function createGame(seed: number, viewW: number, viewH: number): GameState {
  const world = createWorld(seed);
  const startX = 3 * C.TILE + C.TILE / 2;
  const groundWorldY = laneWorldY(0);
  const s: GameState = {
    phase: 'select',
    time: 0,
    speed: TUNE.baseSpeed,
    peakSpeed: TUNE.baseSpeed,
    speedBoost: 0,
    distance: 0,
    camX: startX - viewW * C.PLAYER_ANCHOR_X,
    camY: groundWorldY - viewH * C.VERT_ANCHOR,
    player: {
      x: startX, y: groundWorldY - C.PLAYER_H, vy: 0, onGround: true, lane: 0,
      coyote: 0, buffer: 0, invulnUntil: -1, lastGroundY: groundWorldY,
      knife: false, knifeTimer: 0, magnet: true, diving: false, slideUntil: 0, boot: false, stomp: false
    },
    world,
    projectiles: [], particles: [], floats: [], trail: [], trailTimer: 0,
    shake: 0, boostFlash: 0, viewW, viewH,
    charId: 0, selectIndex: 0, animFrame: 0, animTimer: 0, zoom: 1,
    configOpen: false, configIndex: 0,
    inspectorOpen: false, inspMouseX: 0, inspMouseY: 0, inspPicks: [],
    godMode: false, godSpeed: TUNE.baseSpeed, boulderTimer: C.BOULDER_PERIOD,
  };
  return s;
}

// ── god mode (debug): invincible, manual speed via O / P ──────────────────────
export function toggleGod(s: GameState): void {
  s.godMode = !s.godMode;
  if (s.godMode) s.godSpeed = s.speed;
}
export function godSpeed(s: GameState, dir: 1 | -1): void {
  s.godSpeed = Math.max(60, s.godSpeed + dir * C.GOD_SPEED_STEP);
}

export function requestJump(s: GameState): void {
  s.player.buffer = C.JUMP_BUFFER;
}

const NUM_CHARS = 3;
export function selectPrev(s: GameState): void { s.selectIndex = ((s.selectIndex - 1) + NUM_CHARS) % NUM_CHARS; }
export function selectNext(s: GameState): void { s.selectIndex = (s.selectIndex + 1) % NUM_CHARS; }
export function confirmChar(s: GameState): void { s.charId = s.selectIndex; s.animFrame = 0; s.animTimer = 0; s.phase = 'running'; }
export function returnToSelect(s: GameState): void { s.selectIndex = s.charId; s.phase = 'select'; }

// ── config menu ───────────────────────────────────────────────────────────────
export function toggleConfig(s: GameState): void { s.configOpen = !s.configOpen; }
export function configMove(s: GameState, dir: 1 | -1): void { s.configIndex = (s.configIndex + dir + TUNE_FIELDS.length) % TUNE_FIELDS.length; }
export function configAdjust(s: GameState, dir: 1 | -1): void { adjustTune(TUNE_FIELDS[s.configIndex], dir); }

// ── tileset inspector ──────────────────────────────────────────────────────────
export function toggleInspector(s: GameState): void { s.inspectorOpen = !s.inspectorOpen; }
export function inspSetMouse(s: GameState, x: number, y: number): void { s.inspMouseX = x; s.inspMouseY = y; }
export function inspPick(s: GameState, x: number, y: number): void {
  const L = inspectorLayout(s.viewW, s.viewH);
  const ix = Math.floor((x - L.ox) / L.scale);
  const iy = Math.floor((y - L.oy) / L.scale);
  if (ix < 0 || iy < 0 || ix >= TILESET_W || iy >= TILESET_H) return;
  const cx = Math.floor(ix / 32) * 32;
  const cy = Math.floor(iy / 32) * 32;
  const str = `r(${cx}, ${cy})`;
  s.inspPicks.unshift(`${str}  (px ${ix},${iy})`);
  if (s.inspPicks.length > 8) s.inspPicks.pop();
  // eslint-disable-next-line no-console
  console.log('[tileset]', str, `// exact px ${ix},${iy}`);
}

// ── juice spawners ───────────────────────────────────────────────────────────
function burst(
  s: GameState, x: number, y: number, n: number, color: string,
  opts: { speed?: number; spread?: number; size?: number; life?: number; gravity?: boolean; vx0?: number } = {}
): void {
  const sp = opts.speed ?? 180;
  const spread = opts.spread ?? Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * spread + (spread < Math.PI * 2 ? Math.PI : 0);
    const v = sp * (0.4 + Math.random() * 0.8);
    s.particles.push({
      x, y, vx: (opts.vx0 ?? 0) + Math.cos(a) * v, vy: Math.sin(a) * v - (opts.gravity ? 60 : 0),
      life: opts.life ?? 0.5, maxLife: opts.life ?? 0.5, size: opts.size ?? 3, color, gravity: opts.gravity ?? false
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
  s.player.invulnUntil = Math.max(s.player.invulnUntil, s.time + TUNE.invulnDur);
  floatText(s, label, C.PALETTE.boost);
  burst(s, s.player.x, s.player.y + C.PLAYER_H / 2, 18, C.PALETTE.boost, { speed: 260, size: 4, life: 0.6, vx0: -120 });
}
function die(s: GameState, color: string): boolean {
  if (s.phase !== 'running' || s.godMode) return false; // god mode = invincible
  s.phase = 'dead';
  s.shake = C.SHAKE_DEATH;
  burst(s, s.player.x, s.player.y + C.PLAYER_H / 2, 40, color, { speed: 360, size: 4, life: 0.9 });
  burst(s, s.player.x, s.player.y + C.PLAYER_H / 2, 20, C.PALETTE.player, { speed: 220, size: 3, life: 0.7 });
  return true;
}
/** A kill/smash is FUEL: boost speed, but the gain tapers off as you get faster. */
function gainKill(s: GameState, x: number, y: number, color: string): void {
  const taper = Math.max(C.KILL_BOOST_MIN_FRAC, 1 - (s.speed - TUNE.baseSpeed) / C.KILL_TAPER_RANGE);
  s.speedBoost += C.KILL_BOOST_MAX * taper;
  s.boostFlash = Math.max(s.boostFlash, 0.2);
  s.shake = Math.max(s.shake, C.SHAKE_BOOST * 0.6);
  burst(s, x, y, 10, color, { speed: 220, size: 3, life: 0.4 });
}

export function update(s: GameState, dt: number): void {
  s.animTimer += dt;
  const frameDur = 1 / A.ANIM_FPS;
  while (s.animTimer >= frameDur) { s.animTimer -= frameDur; s.animFrame = (s.animFrame + 1) % A.ANIM_CYCLE; }

  if (s.phase !== 'running') {
    updateParticles(s, dt);
    s.shake = Math.max(0, s.shake - C.SHAKE_DECAY * dt);
    return;
  }
  const p = s.player;

  s.time += dt;
  if (s.time >= C.WIN_TIME) { s.phase = 'won'; return; }

  // ── speed: PERMANENT boost × time ramp (or manual in god mode) ───────────────
  const rampMult = 1 + TUNE.rampGain * Math.min(1, s.time / C.RAMP_FULL_AT);
  let speed = s.godMode ? s.godSpeed : (TUNE.baseSpeed + s.speedBoost) * rampMult;
  speed = Math.max(C.MIN_SPEED, speed);
  s.speed = speed;
  if (speed > s.peakSpeed) s.peakSpeed = speed;
  s.distance += speed * dt;

  // zoom out with speed
  const zt = Math.min(1, Math.max(0, (speed - C.ZOOM_START_SPEED) / (C.ZOOM_FULL_SPEED - C.ZOOM_START_SPEED)));
  s.zoom = 1 - (1 - TUNE.zoomMin) * zt;

  // ── advance & stream the world ───────────────────────────────────────────────
  p.x += speed * dt;
  s.camX = p.x - s.viewW * C.PLAYER_ANCHOR_X;
  const pivotX = s.viewW * C.PLAYER_ANCHOR_X;
  ensureTo(s.world, s.camX + s.viewW / s.zoom + C.TILE * 2, s.time, speed);
  prune(s.world, s.camX - pivotX * (1 / s.zoom - 1) - C.TILE * 2);

  // ── vertical camera: DEAD-ZONE + ASYMMETRIC DAMPING (anti-nausea) ────────────
  // The camera holds still while the player's centre stays inside the central band; only when
  // they push past the top/bottom thresholds does it pan — slowly UP, snappier DOWN.
  const pc = p.y + C.PLAYER_H / 2; // player centre (world y)
  const screenPC = pc - s.camY; // its current screen y
  let camTargetY = s.camY;
  // when the player leaves the dead band, ease the camera so they return to the BOTTOM anchor
  if (screenPC < s.viewH * C.CAM_DEAD_TOP || screenPC > s.viewH * C.CAM_DEAD_BOT) {
    camTargetY = pc - s.viewH * C.VERT_ANCHOR;
  }
  const movingUp = camTargetY < s.camY;
  const lerp = movingUp ? C.CAM_UP_LERP : C.CAM_DOWN_LERP;
  s.camY += (camTargetY - s.camY) * Math.min(1, lerp * dt);

  // ── vertical physics ─────────────────────────────────────────────────────────
  p.coyote += dt;
  if (p.buffer > 0) p.buffer -= dt;

  if (s.godMode) {
    // GOD MODE: fly — no gravity, never fall. Space rises one floor (to inspect higher floors).
    p.vy = 0;
    p.onGround = true;
    if (p.buffer > 0) {
      p.buffer = 0;
      p.lane += 1;
      p.y = laneWorldY(p.lane) - C.PLAYER_H;
      p.lastGroundY = laneWorldY(p.lane);
    }
    s.world.playerLane = p.lane;
  } else {
  const prevFeet = playerFeet(p);
  p.vy += TUNE.gravity * dt;
  p.y += p.vy * dt;

  // ── one-way landing across the infinite floors (highest crossed surface wins) ─
  let landed = false;
  if (p.vy >= 0) {
    let bestTop = Infinity;
    let bestLane = 0;
    for (const plat of s.world.platforms) {
      const x0 = plat.col0 * C.TILE - C.LAND_LEEWAY_X;
      const x1 = (plat.col1 + 1) * C.TILE + C.LAND_LEEWAY_X;
      if (p.x < x0 || p.x > x1) continue;
      const top = laneWorldY(plat.lane);
      if (prevFeet <= top + C.LAND_LEEWAY_Y && playerFeet(p) >= top && top < bestTop) {
        bestTop = top;
        bestLane = plat.lane;
      }
    }
    if (bestTop !== Infinity) {
      const wasAir = !p.onGround;
      p.y = bestTop - C.PLAYER_H;
      p.vy = 0;
      p.onGround = true;
      p.lane = bestLane;
      p.lastGroundY = bestTop;
      p.coyote = 0;
      landed = true;
      if (wasAir) {
        burst(s, p.x, p.y + C.PLAYER_H, 6, C.PALETTE.laneEdge[((bestLane % 3) + 3) % 3], { speed: 120, size: 2, life: 0.3, gravity: true });
        if (p.stomp) applyStomp(s); // STOMP: launch nearby obstacles up on this landing
        if (p.diving) {
          // DIVE-SLIDE: a brief invincible ground-dash that smashes everything in its path
          p.diving = false;
          p.slideUntil = s.time + C.SLIDE_TIME;
          p.invulnUntil = Math.max(p.invulnUntil, p.slideUntil);
          s.shake = Math.max(s.shake, C.SHAKE_BOOST);
          burst(s, p.x, p.y + C.PLAYER_H, 16, C.PALETTE.boost, { speed: 300, size: 3, life: 0.4, vx0: 160 });
        }
      }
    }
  }
  if (!landed) p.onGround = false;
  s.world.playerLane = p.lane;

  // ── fall into a void (dropped too far below the last floor with nothing to catch) → death ─
  if (!p.onGround && p.y > p.lastGroundY + C.FALL_DEATH_DROP && die(s, C.PALETTE.player)) return;

  // ── buffered jump / magnet dive ───────────────────────────────────────────────
  if (p.buffer > 0) {
    if (p.onGround || p.coyote <= C.COYOTE) {
      p.vy = -TUNE.jumpV;
      p.onGround = false;
      p.coyote = C.COYOTE + 1;
      p.buffer = 0;
      burst(s, p.x, p.y + C.PLAYER_H, 8, C.PALETTE.player, { speed: 150, size: 2, life: 0.3, gravity: true });
    } else if (p.magnet && p.vy > -C.MAGNET_DIVE_V * 0.5) {
      // magnet boots: slam straight down mid-air (a dive → triggers a slide on landing)
      p.vy = C.MAGNET_DIVE_V;
      p.diving = true;
      p.buffer = 0;
      burst(s, p.x, p.y + C.PLAYER_H, 6, C.PALETTE.magnet, { speed: 140, size: 2, life: 0.25 });
    }
  }
  } // end !godMode

  // ── ground-tile hazards (the tile under the player on its floor) ──────────────
  if (p.onGround) {
    const pa = platformAt(s.world, p.x, p.lane);
    if (pa) {
      const k = pa.p.tiles[pa.idx];
      if (k === 'spike' || k === 'lava') {
        const col = k === 'lava' ? C.PALETTE.lava : C.PALETTE.spike;
        if (isInvuln(s)) { pa.p.tiles[pa.idx] = 'solid'; gainKill(s, p.x, p.y + C.PLAYER_H / 2, col); }
        else die(s, col);
      }
    }
  }

  updateGeysers(s, dt);
  maybeSpawnBoulder(s, dt);
  updateEnemies(s, dt);
  updatePickups(s);
  updateProjectiles(s, dt);
  updateKnife(s, dt);

  // ── juice bookkeeping ───────────────────────────────────────────────────────
  s.trailTimer += dt;
  if (s.trailTimer >= C.TRAIL_STEP) {
    s.trailTimer = 0;
    s.trail.push({ x: p.x, y: p.y, wet: isInvuln(s), frame: s.animFrame });
    if (s.trail.length > C.TRAIL_LEN) s.trail.shift();
  }
  updateParticles(s, dt);
  updateFloats(s, dt);
  s.shake = Math.max(0, s.shake - C.SHAKE_DECAY * dt);
  if (s.boostFlash > 0) s.boostFlash -= dt;
}

// ── geysers (jumpable: low steam) ──────────────────────────────────────────────
function updateGeysers(s: GameState, dt: number): void {
  const p = s.player;
  for (const g of s.world.geysers) {
    if (g.dead) continue;
    g.phase = (g.phase + dt) % C.GEYSER_PERIOD;
    if (g.phase >= C.GEYSER_ERUPT) continue;
    if (p.vy < 0) continue; // rising (jumping over it) is safe — clear the steam on your way up
    const base = laneWorldY(g.lane);
    const top = base - C.GEYSER_HEIGHT * C.TILE;
    if (playerRight(p) > g.x - C.TILE / 2 && playerLeft(p) < g.x + C.TILE / 2 && playerFeet(p) > top && p.y < base) {
      if (isInvuln(s)) { g.dead = true; gainKill(s, g.x, top, C.PALETTE.geyser); }
      else die(s, C.PALETTE.geyser);
    }
  }
}

// ── enemies: ghost (bounce + bullets), hobgoblin (2×2 walker), boulder (roller) ───
//    All are KICKABLE (Boot) and STOMPABLE — a kicked enemy flies off and bowls others.
function playerHitsEnemy(p: Player, e: Enemy): boolean {
  const { hw, hh } = enemyHalf(e.kind);
  return playerRight(p) > e.x - hw && playerLeft(p) < e.x + hw && playerFeet(p) > e.y - hh && p.y < e.y + hh;
}
function kickEnemy(s: GameState, e: Enemy, dir: 1 | -1): void {
  e.kicked = true;
  e.vx = dir * C.KICK_VX;
  e.vy = C.KICK_VY;
  burst(s, e.x, e.y, 12, C.PALETTE.boot, { speed: 220, size: 3, life: 0.5 });
}
/** STOMP: on landing, fling every enemy within STOMP_RADIUS up, and clear nearby spike tiles. */
function applyStomp(s: GameState): void {
  s.player.stomp = false;
  const px = s.player.x;
  const R = C.STOMP_RADIUS * C.TILE;
  for (const e of s.world.enemies) {
    if (e.dead || e.kicked) continue;
    if (Math.abs(e.x - px) < R && Math.abs(e.y - (s.player.y + C.PLAYER_H / 2)) < R) {
      e.kicked = true; e.vy = C.STOMP_LAUNCH_V; e.vx = (Math.random() - 0.5) * 160;
    }
  }
  const pa = platformAt(s.world, px, s.player.lane);
  if (pa) for (let i = -C.STOMP_RADIUS; i <= C.STOMP_RADIUS; i++) {
    const idx = pa.idx + i;
    if (idx >= 0 && idx < pa.p.tiles.length && pa.p.tiles[idx] !== 'solid') pa.p.tiles[idx] = 'solid';
  }
  s.shake = Math.max(s.shake, C.SHAKE_BOOST);
  burst(s, px, s.player.y + C.PLAYER_H, 16, C.PALETTE.stomp, { speed: 200, size: 3, life: 0.5, gravity: true });
}

function maybeSpawnBoulder(s: GameState, dt: number): void {
  if (s.speed < C.BOULDER_UNLOCK_SPEED) return;
  s.boulderTimer -= dt;
  if (s.boulderTimer > 0) return;
  s.boulderTimer = C.BOULDER_PERIOD;
  const lane = s.player.lane + [0, 1, -1][Math.floor(Math.random() * 3)];
  const x = s.camX + s.viewW / s.zoom + C.TILE;
  s.world.enemies.push({
    kind: 'boulder', x, y: enemyLaneY('boulder', lane), lane, anchorX: x,
    dir: -1, fire: 0, vx: 0, vy: 0, kicked: false, dead: false
  });
}

function updateEnemies(s: GameState, dt: number): void {
  const p = s.player;
  const t = Math.min(1, s.time / C.WIN_TIME);
  const n = 1 + Math.round(t * (C.BOO_COUNT_MAX - 1));
  for (const e of s.world.enemies) {
    if (e.dead) continue;

    // kicked → flying away under gravity; bowls other enemies it touches; harmless to player
    if (e.kicked) {
      e.vy += C.GRAVITY * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      for (const o of s.world.enemies) {
        if (o === e || o.dead || o.kicked) continue;
        if (Math.abs(o.x - e.x) < C.KICK_CHAIN_R * C.TILE && Math.abs(o.y - e.y) < C.KICK_CHAIN_R * C.TILE) {
          kickEnemy(s, o, e.vx >= 0 ? 1 : -1); // chain reaction (bowling)
        }
      }
      if (e.x < s.camX - C.TILE * 4 || e.y > p.lastGroundY + 3000) e.dead = true;
      continue;
    }

    // alive on its lane
    if (e.kind === 'ghost') {
      e.x += e.dir * C.GHOST_SPEED * dt;
      if (e.x > e.anchorX + C.GHOST_PATROL * C.TILE) e.dir = -1;
      else if (e.x < e.anchorX - C.GHOST_PATROL * C.TILE) e.dir = 1;
      e.fire -= dt;
      if (e.fire <= 0) {
        e.fire = C.GHOST_FIRE_START + (C.GHOST_FIRE_END - C.GHOST_FIRE_START) * t;
        const vx = -(C.BOO_SPEED + C.BOO_SPEED_RAMP * t);
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * C.BOO_SPREAD;
          s.projectiles.push({ x: e.x, y: e.y + off, vx, vy: off * 0.7, kind: 'boo', dead: false });
        }
      }
    } else if (e.kind === 'hobgoblin') {
      e.x += e.dir * C.HOBGOBLIN_SPEED * dt;
      if (e.x > e.anchorX + C.GHOST_PATROL * C.TILE) e.dir = -1;
      else if (e.x < e.anchorX - C.GHOST_PATROL * C.TILE) e.dir = 1;
    } else {
      e.x -= C.BOULDER_SPEED * dt; // boulder rolls left, toward the player
    }

    // player contact
    if (playerHitsEnemy(p, e)) {
      if (p.boot) { p.boot = false; kickEnemy(s, e, 1); floatText(s, 'KICK!', C.PALETTE.boot); }
      else if (isInvuln(s)) { e.dead = true; gainKill(s, e.x, e.y, C.PALETTE[e.kind]); }
      else if (e.kind === 'ghost' && p.vy > -C.GHOST_BOUNCE_V * 0.5) {
        p.y = e.y - C.TILE * 0.34 - C.PLAYER_H; // bounce up off the ghost (lower than a jump)
        p.vy = -C.GHOST_BOUNCE_V;
        p.onGround = false;
        burst(s, e.x, e.y, 8, C.PALETTE.ghost, { speed: 160, size: 2, life: 0.3 });
      } else if (e.kind !== 'ghost') {
        die(s, C.PALETTE[e.kind]);
      }
    }
  }
}

// ── pickups (on the lane surface — grab by being on that floor) ───────────────
function updatePickups(s: GameState): void {
  const p = s.player;
  for (const pk of s.world.pickups) {
    if (pk.taken) continue;
    const py = laneWorldY(pk.lane) - C.PICKUP_VIS_FLOAT * C.TILE;
    if (Math.abs(pk.x - p.x) < C.TILE * 0.5 + C.PLAYER_W / 2 && py > p.y - 14 && py < playerFeet(p) + 14) {
      pk.taken = true;
      burst(s, pk.x, py, 12, C.PALETTE.boost, { speed: 180, size: 3, life: 0.5 });
      if (pk.kind === 'boots') addBoost(s, TUNE.bootsBoost, '»');
      else if (pk.kind === 'knife') { p.knife = true; p.knifeTimer = C.KNIFE_PERIOD; floatText(s, 'KNIFE', C.PALETTE.knife); }
      else if (pk.kind === 'magnet') { p.magnet = true; floatText(s, 'MAGNET', C.PALETTE.magnet); }
      else if (pk.kind === 'boot') { p.boot = true; floatText(s, 'KICK', C.PALETTE.boot); }
      else { p.stomp = true; floatText(s, 'STOMP', C.PALETTE.stomp); }
    }
  }
}

// ── projectiles (ghost "boo" bullets + thrown knives) ─────────────────────────
function updateProjectiles(s: GameState, dt: number): void {
  const p = s.player;
  for (const pr of s.projectiles) {
    if (pr.dead) continue;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    if (pr.kind === 'boo') {
      if (pr.x > playerLeft(p) && pr.x < playerRight(p) && pr.y > p.y && pr.y < playerFeet(p)) {
        if (isInvuln(s)) pr.dead = true;
        else die(s, C.PALETTE.boo);
      }
    } else {
      // knife: kill the first enemy / destroy the first spike tile it passes
      for (const e of s.world.enemies) {
        if (!e.dead && !e.kicked && Math.abs(e.x - pr.x) < C.TILE * 0.7 && Math.abs(e.y - pr.y) < C.TILE) {
          e.dead = true; pr.dead = true;
          gainKill(s, e.x, e.y, C.PALETTE.knife);
        }
      }
      const lane = Math.round(-pr.y / C.LANE_GAP);
      const pa = platformAt(s.world, pr.x, lane);
      if (pa && pa.p.tiles[pa.idx] === 'spike') { pa.p.tiles[pa.idx] = 'solid'; pr.dead = true; }
    }
    const sx = pr.x - s.camX;
    const sy = screenY(s, pr.y);
    if (sx < -C.TILE || sx > s.viewW + C.TILE || sy < -C.TILE || sy > s.viewH + C.TILE) pr.dead = true;
  }
  s.projectiles = s.projectiles.filter((pr) => !pr.dead);
}

// ── knife auto-throw (held weapon: fires every KNIFE_PERIOD seconds) ──────────
function updateKnife(s: GameState, dt: number): void {
  const p = s.player;
  if (!p.knife) return;
  p.knifeTimer -= dt;
  if (p.knifeTimer <= 0) {
    p.knifeTimer = C.KNIFE_PERIOD;
    s.projectiles.push({ x: playerRight(p), y: p.y + C.PLAYER_H * 0.4, vx: C.KNIFE_SPEED, vy: 0, kind: 'knife', dead: false });
  }
}

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
  for (const f of s.floats) { f.y += f.vy * dt; f.life -= dt; }
  s.floats = s.floats.filter((f) => f.life > 0);
}

export { laneWorldY, laneScreenY, screenY, isInvuln };
