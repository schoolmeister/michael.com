// Throwaway: drive Prototype #2 ("maintain the hold") and screenshot the UI states.
// Run the dev server first: (cd ..; npm run game:dev)  then: node shoot.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173/';
const W = 1100, H = 760;
const browser = await chromium.launch({
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__state, null, { timeout: 8000 });
await page.waitForTimeout(300);

const shot = (n) => page.screenshot({ path: `/tmp/ascend-${n}.png` }).then(() => console.log('shot', n));
const getS = () => page.evaluate(() => {
  const s = window.__state();
  return {
    phase: s.phase, light: s.light, stamina: s.stamina, safety: s.safety, markerY: s.markerY,
    inZone: s.inZone, moves: s.moves, climberY: s.climberY, cameraY: s.cameraY, viewH: s.viewH,
    candidates: s.candidates.map((c) => ({ x: c.x, y: c.y, hardness: c.hardness })),
  };
});
const screenY = (st, worldY) => st.viewH * 0.66 - (worldY - st.cameraY);
const waitFor = (src, t = 12000) =>
  page.waitForFunction((s) => new Function('s', 'return ' + s)(window.__state()), src, { timeout: t }).catch(() => {});
const m = page.mouse;

await shot('01-choosing'); // three candidates with visible hardness

// select the MEDIUM candidate and start steadying it
async function reach(idx) {
  const st = await getS();
  const sorted = st.candidates.map((c, i) => ({ ...c, i })).sort((a, b) => a.hardness - b.hardness);
  const c = sorted[idx] ?? sorted[0];
  await m.move(c.x, screenY(st, c.y));
  await m.down(); // selects + begins pushing
}

await reach(1);
await page.waitForTimeout(450); // pushing the marker up into the zone
await shot('02-maintaining'); // marker + zone + safety bar, mid-feather

// feather toward the zone centre until safety is high, then screenshot + commit
for (let k = 0; k < 240; k++) {
  const st = await getS();
  if (st.phase !== 'maintaining') break;
  if (st.safety > 0.55 && k === 80) await shot('03-securing');
  if (st.safety >= 0.92) { await shot('04-secured'); break; }
  // bang-bang: push when below zone centre, release when above
  await page.evaluate(() => {}); // keep page active
  const below = st.markerY < 0.56;
  if (below) await m.down(); else await m.up();
  await page.waitForTimeout(40);
}
await m.down();
await page.keyboard.press('Space'); // commit
await page.waitForTimeout(200);
await m.up();
await shot('05-after-commit');

// climb a couple more holds to show the loop + progress
for (let hold = 0; hold < 3; hold++) {
  await waitFor(`s.phase === 'choosing' || s.phase === 'won' || s.phase === 'lost'`);
  let st = await getS();
  if (st.phase !== 'choosing') break;
  await reach(0); // easy holds
  for (let k = 0; k < 240; k++) {
    st = await getS();
    if (st.phase !== 'maintaining') break;
    if (st.safety >= 0.92) break;
    if (st.markerY < 0.56) await m.down(); else await m.up();
    await page.waitForTimeout(40);
  }
  await m.down();
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await m.up();
}
await shot('06-progress');

const fin = await getS();
console.log('final:', fin.phase, `${((fin.climberY / 2000) * 100).toFixed(0)}%`, 'holds', fin.moves, 'light', fin.light.toFixed(0), 'stam', fin.stamina.toFixed(0));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
