# Ascend — Prototype #1 (core-feel test)

A **disposable** prototype. It exists to answer one question:

> Does dragging-and-holding through a slow climb, while the light drains and your
> sightline shrinks into darkness, feel like **dread** — or like a **chore**?

Gray boxes only. Throwaway by design. See `game-protoype-1.md` for the full brief.

## Run it

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173/` and **play it with your hands** (mouse now,
finger later). Edit any number in `src/config.ts`, save, and the page hot-reloads —
that's the edit → refresh → feel loop the whole prototype is built around.

```bash
npm run build   # typecheck (tsc --noEmit) + production build, to confirm it's clean
```

## How to play  (iteration #2 — hold-click + rope & anchor)

- You climb a **persistent wall** of holds. The reachable ones above you **glow**;
  the rest of the wall is visible only as shapes fading into the dark.
- **Climb:** press and **HOLD directly on a glowing hold**. A climb animation plays
  over ~1.7s — keep holding. **Release early = you slip and FALL.** Each move is a
  fresh press (holding the cursor down does *not* auto-climb).
- A hold's glow is **RED** when you can't afford the reach (its `⚡` stamina cost
  exceeds your stamina): committing to it *will* slip you mid-move. Rest, or place
  pro first. So a slip is an informed gamble, never a surprise.
- **Place protection:** instead of reaching, press-and-hold on your current hold's
  **horn** (a nub — only some holds have one), **aim the sling** into its green
  **safe cone**, and release. A seat in the cone is solid (green); off to the side
  is bad (red) and rips when loaded. **Darkness hides the cone**, so placing good
  pro late is a gamble. Placing pro costs real lantern — that's the trade.
- The rope trails to your **last anchor** (or the ground belay). The **RUN-OUT** HUD
  shows how far you are above it = how big a fall you're risking. Falls are caught by
  good pro, *rip* through bad pro (you fall further), or — high and unprotected — you
  **deck** (death). Lower unprotected falls are survivable but batter the lantern.
- **The squeeze:** the lantern always drains (even while you think). Stamina recovers
  only while planted — but resting spends light. Push too hard and you slip in the
  dark; rest too long and the lantern dies.
- Reach the **▲ SUMMIT ▲** to win. Light hits zero → the dark takes you. `R`/click to retry.

## Tuning (read `src/config.ts` — everything feel-critical is there)

`MODE` in `config.ts` switches the whole tuning between:

- `'feel'` — generous meters to isolate the climb verb (use this to tune
  **`CLIMB_RESOLVE_DURATION`**, the single most important number, until a held
  move is a held breath not a loading bar).
- `'dread'` (the default) — tight lantern, fast-closing dark. The scary version.

Key dread knobs, with the curve that matters most:

- `CLARITY_RADIUS_AT_FULL_LIGHT` / `clarityRadius()` in `sightline.ts` — how soon
  you stop being able to *read* grips. This degrades ~linearly with the lantern,
  so the read-the-wall gamble lives across the whole climb (not just the last
  seconds). This is the highest-leverage feel knob after `CLIMB_RESOLVE_DURATION`.
- `LIGHT_DRAIN_RATE` vs `STAMINA_RECOVER_RATE` — the squeeze. Tuned so a sensible
  climber *just barely* wins (verify with the sim harness below).
- `GRIPS` + `HARD_GRIP_BIAS_AT_SUMMIT` — grip costs and how nasty the wall gets up high.
- `ANCHOR_PLACE_LIGHT_COST` — how much lantern placing pro costs (the safety-vs-light
  trade). `HORN_CONE_HALF_WIDTH` / `ANCHOR_SOLID_QUALITY` — how forgiving seating is.
- `FALL_DEATH_HEIGHT` / `FALL_GROUND_LIGHT_PENALTY` — the run-out danger curve: how far
  an unprotected fall can be before it kills vs merely batters you.

See `SPEC-iteration-2.md` for the full design of the hold-click + rope/anchor model.

## Dev tools (throwaway, but handy for "tune the feel")

- `sim-check.ts` — a headless logic harness. Drives the sim with smart / idle /
  exploit players and asserts winnability + that the auto-chain exploit is dead.
  Run: `npx esbuild sim-check.ts --bundle --platform=node --format=esm --outfile=/tmp/s.mjs && node /tmp/s.mjs`
- `shoot.mjs` — drives the running game in headless Chromium (Playwright) and
  writes screenshots to `/tmp/ascend-*.png` at given light levels. Run: `node shoot.mjs`
  (dev server must be up). The game exposes `window.__state()` for the harness.

## Files (one responsibility each)

| file            | does |
|-----------------|------|
| `config.ts`     | **all** feel-critical tuning constants |
| `state.ts`      | game state model + phases (persistent wall) |
| `input.ts`      | mouse press/drag/hold/release → a raw pointer |
| `climb.ts`      | new-game build + the sim tick: phase machine, drag→commit, resolve, slip |
| `holds.ts`      | generating the persistent route, reachability, grip/cost model |
| `sightline.ts`  | light level → sight radius (silhouettes) & clarity radius (readable) |
| `assets.ts`     | preloads sprites; keys the white background out of the climber |
| `render.ts`     | rock face, sky/abyss, sprite holds, climber + lantern, darkness, HUD |
| `main.ts`       | asset load, game loop, camera, resize, restart wiring |
