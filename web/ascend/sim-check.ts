// Throwaway logic harness for iteration #2. Bundle w/ esbuild, run in node.
//   npx esbuild sim-check.ts --bundle --platform=node --format=esm --outfile=/tmp/s.mjs && node /tmp/s.mjs
import { createGame, update } from './src/climb';
import { reachableFrom, moveCost } from './src/holds';
import { seatingQuality, qualityTier, resolveFall } from './src/anchor';
import { WALL_HEIGHT, FALL_DEATH_HEIGHT, ANCHOR_RIP_FALL_DISTANCE, HOLD_HIT_RADIUS } from './src/config';
import { holdById, ropeBaseY, type Anchor, type GameState, type Hold, type Pointer } from './src/state';
import { worldToScreen } from './src/view';

let ok = true;
const check = (c: boolean, m: string) => { if (!c) { ok = false; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ── 1. Pure anchor/fall math ────────────────────────────────────────────────
console.log('anchor math:');
const horn: Hold = {
  id: 1, x: 0, y: 100, type: 'flake', row: 1, gripMult: 1, width: 60,
  hasHorn: true, hornX: 0, hornY: 100, hornConeCenter: -Math.PI / 2,
};
check(seatingQuality(horn, -Math.PI / 2) > 0.95, 'seating dead-centre in the cone is ~bomber');
check(seatingQuality(horn, -Math.PI / 2 + 1.2) < 0.05, 'seating way off the cone is worthless');
check(qualityTier(seatingQuality(horn, -Math.PI / 2)) === 'solid', 'centred seat → solid tier');

const solid: Anchor = { id: 1, x: 0, y: 200, holdId: 1, quality: 1 };
const marginal: Anchor = { id: 2, x: 0, y: 200, holdId: 2, quality: 0.45 };
check(!resolveFall(800, [solid], 1).death, 'a solid anchor below catches a long fall (no death)');
check(resolveFall(800, [solid], 1).caughtById === 1, '…and the catch is credited to that anchor');
check(resolveFall(800, [], null).death, 'an unprotected fall from high (no pro) = death');
check(!resolveFall(FALL_DEATH_HEIGHT - 50, [], null).death, 'an unprotected fall from low survives');
const rip = resolveFall(200 + ANCHOR_RIP_FALL_DISTANCE + 50, [marginal], 2);
check(rip.rippedIds.includes(2), 'a marginal anchor RIPS on a hard (long) fall');
check(!resolveFall(200 + 40, [marginal], 2).rippedIds.includes(2), '…but holds a short fall');

// ── 2. Sim integration ──────────────────────────────────────────────────────
const dt = 1 / 60;
const aim = (s: GameState, p: Pointer, wx: number, wy: number) => {
  const sp = worldToScreen(s, wx, wy); p.startX = sp.x; p.startY = sp.y; p.x = sp.x; p.y = sp.y;
};
const runout = (s: GameState) => s.climberY - ropeBaseY(s);
const hasAnchorOn = (s: GameState, id: number) => s.anchors.some((a) => a.holdId === id);

function pickReach(s: GameState) {
  const cur = holdById(s, s.currentHoldId)!;
  return reachableFrom(s.holds, cur)
    .map((h) => ({ h, c: moveCost(cur, h) }))
    .sort((a, b) => (b.h.y - cur.y) / b.c.staminaCost - (a.h.y - cur.y) / a.c.staminaCost);
}

function run(label: string, strat: 'smart' | 'idle' | 'exploit') {
  const s = createGame(1280, 800);
  const p: Pointer = { down: false, x: 0, y: 0, startX: 0, startY: 0 };
  let frames = 0, actions = 0, anchorsPlaced = 0, fellAndLived = 0, released = false, prevPhase = s.phase;
  const max = 60 * 600;

  while (s.phase !== 'won' && s.phase !== 'lost' && frames < max) {
    frames++;
    if (strat === 'idle') p.down = false;
    else if (strat === 'exploit') {
      // release once, then HOLD forever aiming at a hold — must not chain.
      if (!released) { p.down = false; released = true; }
      else { const r = pickReach(s)[0]; if (r) aim(s, p, r.h.x, r.h.y); p.down = true; }
    } else {
      // smart: place pro when run-out grows; rest if needed; else reach.
      if (s.phase === 'choosing') {
        const cur = holdById(s, s.currentHoldId)!;
        const wantAnchor = cur.hasHorn && !hasAnchorOn(s, cur.id) && runout(s) > 260;
        if (!s.armed) p.down = false; // release to arm
        else if (wantAnchor) { aim(s, p, cur.hornX, cur.hornY); p.down = true; }
        else {
          const r = pickReach(s)[0];
          if (!r) p.down = false;
          else if (s.stamina < r.c.staminaCost + 12) p.down = false; // rest
          else { aim(s, p, r.h.x, r.h.y); p.down = true; }
        }
      } else if (s.phase === 'reaching') p.down = true;
      else if (s.phase === 'anchoring') p.down = false; // release → place at centred seat
      else if (s.phase === 'falling') p.down = false;
    }

    update(s, dt, p);

    if (s.phase !== prevPhase) {
      if (s.phase === 'reaching' || s.phase === 'anchoring') actions++;
      if (prevPhase === 'anchoring' && s.phase === 'choosing') anchorsPlaced++;
      if (prevPhase === 'falling' && s.phase === 'choosing') fellAndLived++;
      prevPhase = s.phase;
    }
  }
  console.log(
    `${label.padEnd(8)} → ${s.phase.padEnd(5)} | ${((s.climberY / WALL_HEIGHT) * 100).toFixed(0)}% | ` +
      `${s.moves} moves | ${anchorsPlaced} pro placed | ${fellAndLived} caught falls | ` +
      `${(frames * dt).toFixed(0)}s | light=${s.light.toFixed(0)}`,
  );
  return { s, actions, anchorsPlaced };
}

console.log('\nsim:');
const smart = run('smart', 'smart');
const idle = run('idle', 'idle');
const exploit = run('exploit', 'exploit');

console.log('\nchecks:');
check(smart.s.phase === 'won', 'a sensible climber (placing pro) can win in DREAD mode');
check(smart.anchorsPlaced > 0, 'the smart climber actually placed protection');
check(idle.s.phase === 'lost', 'idling → the dark takes you');
check(exploit.actions <= 1, 'holding the cursor (no re-press) cannot chain actions');
// HOLD_HIT_RADIUS sanity (selection is forgiving)
check(HOLD_HIT_RADIUS >= 30, 'hold hit radius is forgiving (commitment, not precision)');

console.log(ok ? '\nALL CHECKS PASSED' : '\nCHECKS FAILED');
process.exit(ok ? 0 : 1);
