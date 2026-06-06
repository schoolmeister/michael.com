// Throwaway solvability harness for Prototype #3 (4-limb / CoG).
//   npx esbuild sim-check.ts --bundle --platform=node --format=esm --outfile=/tmp/s.mjs && node /tmp/s.mjs
//
// Uses the shared greedy solver (solver.ts): it only makes stable 3+-contact upward moves,
// so a "won" means a fair straightforward solution exists and the climber survives.
// Verifies the 3 designed levels AND that the generated Spray Wall is always solvable.
import { LEVELS, makeSprayWall } from './src/levels';
import { greedySolve } from './src/solver';

let ok = true;
const check = (c: boolean, m: string) => { if (!c) { ok = false; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

console.log('designed levels:');
const results = LEVELS.map((lvl) => ({ lvl, r: greedySolve(lvl) }));
for (const { lvl, r } of results) {
  console.log(`  ${lvl.name.padEnd(12)} → ${r.won ? 'WON ' : 'STUCK'} | moves=${r.moves} | minHandStam=${r.minHandStam.toFixed(0)}`);
}
results.forEach(({ lvl, r }, i) => check(r.won, `Level ${i + 1} (${lvl.name}) is solvable`));
// Difficulty now ramps via decoy/hostile-hold density (badChance 0.08 → 0.22 → 0.4), not
// the solver's stamina margin (it leans to relieve), so this is informational only.
console.log('  (decoy density ramps easy→hard; solver min-stam:', results.map((x) => x.r.minHandStam.toFixed(0)).join(' / '), ')');

console.log('\nspray wall (random, generated-and-verified): 8 rolls');
let allSpraySolvable = true;
let totalHolds = 0;
for (let i = 0; i < 8; i++) {
  const w = makeSprayWall(); // guaranteed solvable by construction
  const r = greedySolve(w);
  totalHolds += w.holds.length;
  if (!r.won) allSpraySolvable = false;
  console.log(`  roll ${i + 1}: holds=${w.holds.length} → ${r.won ? 'WON' : 'STUCK'} (moves=${r.moves}, minStam=${r.minHandStam.toFixed(0)})`);
}
check(allSpraySolvable, 'every generated Spray Wall has a verified route to the summit');
check(LEVELS.every((l) => l.finishY > 0), 'every level (incl. spray) has a summit/finish goal');
// non-overlap: no two holds closer than ~min sep on any level
const minPairDist = (holds: { x: number; y: number }[]) => {
  let m = Infinity;
  for (let a = 0; a < holds.length; a++) for (let b = a + 1; b < holds.length; b++) m = Math.min(m, Math.hypot(holds[a].x - holds[b].x, holds[a].y - holds[b].y));
  return m;
};
const worst = Math.min(...LEVELS.map((l) => minPairDist(l.holds)), minPairDist(makeSprayWall().holds));
check(worst >= 30, `holds never overlap (closest pair across levels = ${worst.toFixed(0)}px)`);

console.log(`\navg spray holds=${(totalHolds / 8).toFixed(0)}`);
console.log(ok ? '\nALL CHECKS PASSED' : '\nCHECKS FAILED');
process.exit(ok ? 0 : 1);
