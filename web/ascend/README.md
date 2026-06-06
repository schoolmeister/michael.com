# Ascend — Prototype #2 ("maintain the hold")

A **disposable** core-verb prototype. Prototype #1 (hold-click / rope-and-anchor) was
built, played, and found **boring** — the verb was at the wrong altitude. Prototype #2
tests a new verb. See `game-protoype-2.md` for the full brief (and `game-protoype-1.md` /
`SPEC-iteration-2.md` for the superseded history).

> **The one question:** does feathering a sketchy hold into its secure zone while the
> light drains — and choosing the moment to trust your weight — feel like **calculated
> risk you handled** (tense, satisfying), or like **babysitting a meter** (a chore)?

Gray boxes only, on purpose: prove the verb before any art.

## Run it (this game is vendored inside the SvelteKit site)

From the `web/` directory:

```bash
npm run game:dev     # vite dev server for the game (HMR) — open the printed localhost URL
npm run game:build   # bundles to ../static/ascend-game/ (served by the /ascend route's iframe)
```

Typecheck the game (strict):

```bash
cd ascend && npx tsc --noEmit -p tsconfig.json
```

Edit any number in `src/config.ts`, save, refresh — that's the edit → feel loop.

## How to play

- **Planted (choosing):** three candidate holds glow above you, labelled by hardness
  (`JUG` → `OK` → `RISKY` → `SKETCH`). Harder = **more height gained** but harder to
  hold. Stamina recovers while you rest here — but the lantern keeps draining. **Click a
  hold** to reach it.
- **Maintaining:** the hold starts unstable — a marker drifts down. **HOLD the mouse** to
  push it up; release to let it fall. **Feather it into the green secure zone.** While
  in-zone a **SAFETY** bar builds; out-of-zone it stalls and stamina bleeds faster. Low
  stamina weakens your push, so tiredness compounds.
- **Commit (Space):** once safety is past the red danger-line, press **Space** to trust
  your weight and ascend. Commit **early** = fast, less light/stamina, but you carry an
  off-balance start into the next hold. Commit **late** (full safety) = safe but costly.
  Commit **below the danger-line** and the hold blows — you slip back, big stamina hit.
- **Lose** if stamina gives out while hanging, or the lantern hits zero. **Win** at the
  summit. `R` or click to retry.

## Tuning (`src/config.ts` — everything feel-critical is there)

`MODE` flips between `'feel'` (generous, isolate the verb — the default) and `'squeeze'`
(tight light/stamina). Per the brief:

1. Get the **maintain feel** right first: `MARKER_FALL_RATE`, `PUSH_STRENGTH`,
   `MARKER_DAMP` (and `ZONE_HEIGHT_*`). Does feathering feel like a physical negotiation?
2. **Only then** tighten `LIGHT_DRAIN_RATE` vs the stamina drains for the squeeze.
3. `MIN_COMMIT_SAFETY` + the `COMMIT_*` penalties shape the early-vs-late commit gamble.
4. `HARD_FALL_MULT` / `ZONE_HEIGHT_HARD` / `ZONE_WANDER_MAX` / `REACH_DY_*` are the
   hardness model (hard holds: faster drift, narrower/wandering zone, bigger height).

## Files

| file          | does |
|---------------|------|
| `config.ts`   | **all** feel-critical tuning constants |
| `state.ts`    | state model, phases, candidate generation |
| `input.ts`    | mouse-hold (push) + Space (commit) + restart |
| `maintain.ts` | the maintain mechanic (marker physics, zone, safety) + the tick + camera map |
| `render.ts`   | gray-box rendering: wall, climber, candidates, the maintain UI, meters |
| `main.ts`     | game loop, resize, restart wiring |

## Dev tools (throwaway)

- `sim-check.ts` — headless controllability harness (feathering wins; passive / instant-commit
  lose). Run: `npx esbuild sim-check.ts --bundle --platform=node --format=esm --outfile=/tmp/s.mjs && node /tmp/s.mjs`
- `shoot.mjs` — Playwright screenshotter of the UI states (needs `playwright` installed;
  point it at the dev server with `URL=http://localhost:PORT/ node shoot.mjs`). It only
  talks to the dev server over HTTP, so run it from anywhere Playwright resolves.
