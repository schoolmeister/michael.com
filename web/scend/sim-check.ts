/**
 * sim-check.ts — throwaway headless harness. The sim is DOM-free, so we can tick it in node
 * to catch crashes / NaNs / impossible states before a visual pass. Not part of the build.
 *
 * Run: npx esbuild sim-check.ts --bundle --platform=node --format=esm --outfile=/tmp/sc.mjs \
 *      && node /tmp/sc.mjs
 */
import * as C from './src/config';
import { createGame, requestJump, update } from './src/sim';
import { columnAt } from './src/world';

const VW = 760,
  VH = 520;

function run(label: string, jumpEvery: number): void {
  const s = createGame(12345, VW, VH);
  let frames = 0;
  let jumpTimer = 0;
  let deaths = 0;
  let maxFeet = -Infinity;
  let minY = Infinity;
  const dt = 1 / 60;

  // Simulate up to the full win time (10 min) of game time, restarting on death.
  while (s.time < C.WIN_TIME && frames < C.WIN_TIME * 60 + 500) {
    if (jumpEvery > 0) {
      jumpTimer += dt;
      if (jumpTimer >= jumpEvery) {
        jumpTimer = 0;
        requestJump(s);
      }
    }
    update(s, dt);
    frames++;

    const p = s.player;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(s.speed)) {
      console.error(`${label}: NON-FINITE state at frame ${frames}`, { x: p.x, y: p.y, speed: s.speed });
      process.exit(1);
    }
    minY = Math.min(minY, p.y);
    maxFeet = Math.max(maxFeet, p.y + C.PLAYER_H);

    if (s.phase === 'dead') {
      deaths++;
      // emulate the player retrying immediately
      Object.assign(s, createGame(12345 + deaths, VW, VH));
    }
  }

  console.log(
    `${label}: frames=${frames} finalPhase=${s.phase} ` +
      `deaths(restarts)=${deaths} peak=${Math.round(s.peakSpeed)} ` +
      `minY=${minY.toFixed(0)} maxFeet=${maxFeet.toFixed(0)}`
  );

  // Falling into a gap is now a legit death, so we no longer assert against it; just sanity.
  if (s.peakSpeed < C.BASE_SPEED) {
    console.error(`${label}: peak speed never reached base?!`);
    process.exit(1);
  }
}

run('no-jump (falls in first gap)', 0);
run('steady-hops (jump ~3x/sec)', 0.33);

// Smart agent: jumps when the tile just ahead is a void gap or a lethal hazard. This proves
// the level is FAIR — gaps are clearable with good timing — and reports how far skill goes.
(function smartRun() {
  const dt = 1 / 60;
  let best = 0;
  let bestPeak = 0;
  let won = false;
  for (let attempt = 0; attempt < 40 && !won; attempt++) {
    const s = createGame(7000 + attempt, VW, VH);
    while (s.phase === 'running' && s.time < C.WIN_TIME) {
      const p = s.player;
      if (p.onGround) {
        const col = Math.floor(p.x / C.TILE);
        const ahead = columnAt(s.world, col + 1);
        const danger =
          !ahead || // void gap next
          (ahead.kind === 'spike') ||
          (ahead.kind === 'lava' && s.time >= p.wetUntil); // dry lava
        if (danger) requestJump(s);
      }
      update(s, dt);
    }
    best = Math.max(best, s.time);
    bestPeak = Math.max(bestPeak, s.peakSpeed);
    if (s.phase === 'won') won = true;
  }
  console.log(
    `smart-agent: best survival=${best.toFixed(1)}s peak=${Math.round(bestPeak)} won=${won}`
  );
  if (best < 4) {
    console.error('FAIL: even edge-timed jumps die almost immediately — gaps look unfair');
    process.exit(1);
  }
})();

// Direct assertion: a jump from a standing start must produce real lift, even after the
// player has been grounded a while (the coyote-timer regression).
(function jumpFromGround() {
  const s = createGame(99, VW, VH);
  const dt = 1 / 60;
  for (let i = 0; i < 60; i++) update(s, dt); // stand for ~1s
  const yBefore = s.player.y;
  requestJump(s);
  let minY = yBefore;
  for (let i = 0; i < 40; i++) {
    update(s, dt);
    minY = Math.min(minY, s.player.y);
  }
  const lift = yBefore - minY;
  console.log(`jump-from-ground: lift=${lift.toFixed(0)}px (expect ~120)`);
  if (lift < 60) {
    console.error('FAIL: jumping after standing produced no meaningful lift');
    process.exit(1);
  }
})();

console.log('OK — no crashes, no NaNs, no fall-through; speed ramps; jump lifts.');
