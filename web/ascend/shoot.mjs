// Throwaway: drive iteration #2 (hold-click + anchors) and screenshot. node shoot.mjs
import { chromium } from 'playwright';

const W = 1280, H = 800;
const browser = await chromium.launch({
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__state, null, { timeout: 8000 });
await page.waitForTimeout(400);

const shot = (n) => page.screenshot({ path: `/tmp/ascend-${n}.png` }).then(() => console.log('shot', n));
const getS = () => page.evaluate(() => {
  const s = window.__state();
  const c = s.holds.find((h) => h.id === s.currentHoldId);
  return {
    phase: s.phase, light: s.light, stamina: s.stamina, moves: s.moves,
    climberX: s.climberX, climberY: s.climberY, cameraY: s.cameraY,
    viewH: s.viewH, slipKick: s.slipKick, ropeAnchorId: s.ropeAnchorId, anchors: s.anchors.length,
    reachable: s.reachable.map((h) => ({ id: h.id, x: h.x, y: h.y })),
    cur: c ? { id: c.id, x: c.x, y: c.y, hasHorn: c.hasHorn, hornX: c.hornX, hornY: c.hornY, cone: c.hornConeCenter } : null,
  };
});
const screen = (st, wx, wy) => {
  const kick = st.slipKick > 0 ? Math.sin((st.slipKick / 0.7) * Math.PI) * 14 : 0;
  const focusY = st.viewH * 0.62 + kick;
  return { x: wx, y: focusY - (wy - st.cameraY) };
};
const waitFor = (pred, t = 15000) => page.waitForFunction(
  (src) => { const s = window.__state(); return new Function('s', 'return ' + src)(s); },
  pred, { timeout: t },
).catch(() => {});

const m = page.mouse;

await shot('01-start'); // choosing, full light, rope to ground, holds glowing

// ── Anchoring gauge: the floor hold has a guaranteed horn. ──────────────────
let st = await getS();
if (st.cur && st.cur.hasHorn) {
  const horn = screen(st, st.cur.hornX, st.cur.hornY);
  await m.move(horn.x, horn.y); await m.down(); // → anchoring
  await page.waitForTimeout(120);
  // GOOD seat: aim along the cone centre
  const g = screen(st, st.cur.hornX + Math.cos(st.cur.cone) * 70, st.cur.hornY + Math.sin(st.cur.cone) * 70);
  await m.move(g.x, g.y); await page.waitForTimeout(120); await shot('02-anchor-good');
  // BAD seat: aim well off the cone
  const b = screen(st, st.cur.hornX + Math.cos(st.cur.cone + 1.4) * 70, st.cur.hornY + Math.sin(st.cur.cone + 1.4) * 70);
  await m.move(b.x, b.y); await page.waitForTimeout(120); await shot('03-anchor-bad');
  // settle on a good seat and place it
  await m.move(g.x, g.y); await page.waitForTimeout(60); await m.up(); await page.waitForTimeout(150);
}

// ── Climb: capture a reach mid-animation, then keep going. ───────────────────
async function climb(captureMid = false) {
  st = await getS();
  const target = st.reachable.slice().sort((a, b) => b.y - a.y)[0];
  if (!target) return false;
  const sp = screen(st, target.x, target.y);
  const before = st.moves;
  await m.move(sp.x, sp.y); await m.down();
  if (captureMid) { await page.waitForTimeout(550); await shot('04-reaching'); } // mid-resolve
  await waitFor(`s.moves > ${before} || s.phase === 'lost' || s.phase === 'won'`);
  await m.up(); await page.waitForTimeout(120);
  return true;
}

await climb(true);
for (let i = 0; i < 4; i++) await climb();
await shot('05-midclimb'); // rope sag, placed anchor below, run-out HUD

// ── Force a fall: press a reach and release early. ───────────────────────────
st = await getS();
const t2 = st.reachable.slice().sort((a, b) => b.y - a.y)[0];
if (t2) {
  const sp = screen(st, t2.x, t2.y);
  await m.move(sp.x, sp.y); await m.down(); await page.waitForTimeout(450); await m.up();
  await page.waitForTimeout(60); await shot('06-falling');
  await waitFor(`s.phase === 'choosing' || s.phase === 'lost'`);
}

// ── Climb on to drain the lantern → the dread zone. ──────────────────────────
for (let i = 0; i < 14; i++) {
  const s = await getS();
  if (s.phase === 'won' || s.phase === 'lost') break;
  if (s.light < 24 && s.light > 8) { await shot('07-dread'); }
  await climb();
}
const fin = await getS();
await shot('08-end');
console.log('final:', fin.phase, `${((fin.climberY / 2000) * 100).toFixed(0)}%`, 'light', fin.light.toFixed(0), 'anchors', fin.anchors);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
