# SCEND — Prototype #1 ("one button, ten minutes, maximum speed")

A **disposable** core-verb prototype, in the spirit of `ascend/`. The pitch: a mix of
Vampire Survivors (auto-battle, escalating density) and a platformer (auto-move), stripped to
a **single control — jump (Space)**. Gray/neon boxes only, on purpose: prove the verb before
any art.

> **The one question:** with your only choice being *when* to tap jump, does leaping the
> lethal gaps while you get faster and stronger feel like an exhilarating, escalating **flow
> state**, or like **coin-flip guessing**?

## SCEND — the idea

A **bullet-hell platformer** built on one button. You auto-run right across floating neon
platforms suspended over a black abyss. Your **only** control is **Space = jump** — a single
fixed leap. The fantasy is *acceleration*: you are getting faster and stronger the whole time.

Every moment your real choice is just *when to tap*:

- **UP** — tap to clear a gap and land on a higher platform.
- **STAY** — ride the platform you're on.
- **DOWN** — don't jump; drop to a lower platform across the gap.

**Fall into a gap and you die.** Gaps scale with your jump distance, so the faster you go the
bigger — and more spectacular — your leaps. Survive **10:00** to win. **One life.**

### Speed is permanent and it stacks

This is the core fantasy. Speed only ever goes **up**: a relentless time ramp, plus
**permanent** boosts you collect (`»`). Every boost makes you faster *forever*. Your `»` count
and a fat live SPEED readout show your power growing; speed lines, an afterimage trail, screen
shake and a green flash punch in on every gain.

### Platforms, hazards & the bullet hell (a hit = death unless noted)

- **GAP (the void)** — miss the jump, fall off the bottom = death.
- **SPIKES** — on a platform tile. Touch = death. Hop over.
- **LAVA** — a tile. Dry = death. **Wet = a permanent `»` speed blast** (hit water first).
- **WATER** — a tile. Touch = brief slow + become **wet** (sets up the lava blast).
- **GEYSER** — erupts a steam column upward on a cycle. Touch live steam = death.
- **GHOST** — patrols and fires **volleys of "boo" bullets** that fan toward you. Volleys grow
  from 1 to 3 bullets and fire faster as the clock runs — the hell thickens.

### Upgrades (float above platforms, or riskily over the gaps)

- **`»` (BOOTS)** — instant **permanent** speed boost. The thing you're chasing.
- **KNIFE** — auto-throws forward at the next ghost / spike, destroying it. One use.
- **HORNS** — barrel through one ghost / spike / geyser and destroy it. One use.

### Feel & look (Blade — rave scene)

Near-black, neon cyan/magenta/violet, heavy glow, parallax skyline, speed lines, particles.
Boxes only — but it should feel FAST and electric from frame one.

## Run it (vendored inside the SvelteKit site)

From the `web/` directory:

```bash
npm run scend:dev     # vite dev server for the game (HMR) — open the printed localhost URL
npm run scend:build   # bundles to ../static/scend-game/ (served by the /scend route's iframe)
```

Typecheck the game (strict):

```bash
cd scend && npx tsc --noEmit -p tsconfig.json
```

Edit any number in `src/config.ts`, save, refresh — that's the edit → feel loop.

## How to play

- **Run** — you move right automatically, always accelerating.
- **Jump (Space / click / tap)** — a single fixed leap. Time it to clear the **gaps** between
  platforms and to hop deadly tiles. Coyote-time + a jump buffer keep it fair. Miss a gap and
  you fall to your death.
- **Stack `»`** — grab boots-pickups for permanent speed, and run the **water → lava** line
  (get wet, then hit lava) for a permanent speed blast. You only get faster.
- **Win** at 10:00. **Die** once and restart from 0:00 (`R`, Space, or click).

## Tuning (`src/config.ts` — everything feel-critical is there)

Suggested order:

1. **The leap**: `JUMP_V`, `GRAVITY`, `BASE_SPEED`, `TILE`, `COYOTE` / `JUMP_BUFFER`. Then the
   gap shape — `GAP_FACTOR_FLAT`, `GAP_FACTOR_PER_UP`, `GAP_MAX_TILES`, `PLAT_LEN_*`,
   `TIER_UP_MAX` / `TIER_DOWN_MAX`. Are gaps thrilling but clearable?
2. **The acceleration fantasy**: `RAMP_GAIN` / `RAMP_FULL_AT`, `LAVA_BOOST`, `BOOTS_BOOST`,
   `BOOST_PER_CHEVRON`. Does getting faster feel powerful and permanent?
3. **The bullet hell**: `GHOST_CHANCE_*`, `GHOST_FIRE_*`, `BOO_*` (count/spread/speed ramp).
4. **Hazards / pickups**: `HAZARD_*`, `GEYSER_*`, `PICKUP_*`, `GAP_PICKUP_CHANCE`, `KNIFE_*`.
5. **Juice**: `TRAIL_*`, `SHAKE_*`, `SPEEDLINE_*`, and the `PALETTE`.

## Files

| file         | does |
|--------------|------|
| `config.ts`  | **all** feel-critical tuning constants + the neon palette + juice knobs |
| `state.ts`   | types only: tiles/voids, geyser/ghost/projectile/pickup, player, world, particles |
| `world.ts`   | seeded PRNG streaming platforms + gaps (scaled to jump) + hazards/ghosts/pickups |
| `sim.ts`     | the whole tick: run, jump, one-way landing, fall-death, permanent boost, bullets, juice |
| `render.ts`  | neon Canvas2D: parallax, speed lines, platforms, entities, trail, particles, HUD |
| `input.ts`   | one button: Space/click = jump or retry; `R` = restart |
| `main.ts`    | bootstrap, resize/DPR, the rAF loop |

## Dev tool

`sim-check.ts` — throwaway headless harness. Bundles & ticks the DOM-free sim to catch
crashes/NaNs, verifies the jump lifts, and runs a **smart edge-jumping agent** to confirm gaps
are clearable (fair). Run:
`npx esbuild sim-check.ts --bundle --platform=node --format=esm --outfile=/tmp/sc.mjs && node /tmp/sc.mjs`
