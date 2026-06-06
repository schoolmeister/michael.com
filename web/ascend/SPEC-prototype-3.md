# Prototype #3 — team build spec (the four-limb / CoG verb)

Read `game-protoype-3.md` for the full design (the source of truth for *feel* is the HTML
at `climb-4limb-test_5.html`, now ported to TS). The lead has built and verified the
**foundation**: the faithful sim + a scrolling-wall **objective** (reach the finish line at
the top) + level loading + a baseline gray-box render + a solvability harness.

This pass does three things in parallel, each owning disjoint files:
- **Render** → real visuals (sprites, beyond gray boxes). Owns `render.ts` + new `assets.ts`.
- **Levels** → 3 solvable levels easy→hard. Owns `levels.ts`.
- **Playtest** → critique (after the above).

## Do NOT edit (the contract)
`config.ts`, `state.ts`, `sim.ts`, `input.ts`, `main.ts`. If you think you need a change
there, add a `// CONTRACT-GAP: …` comment and tell the lead.

## How to run / verify
From `web/`: `npm run game:dev` (HMR dev server) and `npm run game:build` (emits to
`static/ascend-game/`). Typecheck: `cd ascend && npx tsc --noEmit -p tsconfig.json`.
Solvability harness: `cd ascend && npx esbuild sim-check.ts --bundle --platform=node --format=esm --outfile=/tmp/s.mjs && node /tmp/s.mjs`.
A parallel teammate may be editing a different file, so tsc may show errors that aren't
yours — only fix errors in YOUR file.

## The contract you build against

**Coords:** world space, **+Y is DOWN**. The climbable column is `WORLD_WIDTH = 460` wide,
centred in the viewport; the wall scrolls vertically; the **finish is near the TOP (small y)**.

**`sim.ts` exports** (use these; don't reimplement or inline the camera):
- Camera: `worldToScreen(s, wx, wy) → {x,y}`, `screenToWorld(s, sx, sy)`, `offsetX(s)`.
- Body math: `cog(s)`, `cogOf(pts, lean, fallback)`, `anchored(s)`, `anchoredWith(s, override?)`,
  `limbPositionsWith(s, override?)`, `supportCentroid(s)`, `insideOf(pts, p)`, `insideSupport(s, p)`,
  `goodness(s, limb) → 0..1`, `computeLoads(s)`.
- Actions (for the harness): `commitLimb(s, limb, hold|null, x, y)`, `setLean(s, lx, ly)`,
  `limbByName(s, name)`, `loadLevel(s, level)`, `createGame(levelIndex, viewW, viewH) → GameState`,
  `update(s, dt)`.

**`state.ts` types:** `GameState { phase:'climbing'|'fallen'|'won', holds:Hold[], climber{ body, lean, limbs:Limb[] }, drag, cameraY, levelIndex, finishY, worldHeight, elapsed, moves, winTime, winMoves, viewW, viewH }`;
`Hold { x, y, ang }` (ang = good-side direction, points toward the side you pull from);
`Limb { name:'LH'|'RH'|'LF'|'RF', type:'hand'|'foot', x, y, hold:Hold|null, stam, load }`;
`Level { name, holds:{x,y,ang}[], start:Record<LimbName,number>, finishY, height }`.

**`config.ts`** holds all tunables (`WORLD_WIDTH`, `LIMB_REACH=150`, `GRAB_DIST=30`, `HOLD_R=13`,
`HAND_STAM_MAX`, `GOOD_MARGIN`, `DRAIN_BAD`, load-model biases, `CAM_ANCHOR`, …).

---

## RENDER pass (owns `render.ts`, new `assets.ts`)
Replace the gray boxes with real art while keeping the exact sim/feel and all the readability
the HTML had. Requirements:
- Use `worldToScreen` for ALL drawing (the wall scrolls; render must follow the camera).
- **Climber:** draw a proper body using the climber sprite (`public/assets/climber.png`; more
  in `web/ascend/assets/` — copy any you want into `public/assets/`). Hands vs feet visually
  distinct. The **load-thickness limb lines**, **CoG dot**, **support polygon**, and **hand
  stamina rings (green good → red bad)** MUST remain — they're how the player reads the body.
- **Holds:** rock sprites (`public/assets/hold-*.png` / the rock-N images) with the **good-side
  arrow/triangle still clearly shown** (the pull direction is core information).
- **Aim preview** (during a drag): keep the ghost limb + previewed support polygon + previewed
  CoG, **green = stable / red = would fall**. This is the no-blind-falls promise — keep it crisp.
- Keep the **finish line / TOP** marker, the **fall** overlay, and a rewarding **win** overlay
  (`TOPPED OUT`, moves + time, "click/N: next, R: retry").
- **Load assets lazily inside the render module** (kick off image loads on first import; draw
  sprites once loaded, gray-box fallback meanwhile). Do **not** modify `main.ts`.
- Mood: dark, climbing-horror-adjacent, but readability first. It's still a prototype.

## LEVELS pass (owns `levels.ts`)
Author **3 levels, easy → hard**, replacing the placeholder. Each MUST be **verified solvable**.
- A `Level` is `{ name, holds:[{x,y,ang}], start:{LH,RH,LF,RF: holdIndex}, finishY, height }`.
  Hold x ∈ [0,460]; y grows downward; finish near the top (small y); start indices give a
  restful 4-point base (hands above feet). NOTE: `loadLevel` re-angles the START holds toward
  the opening CoG (restful), so only NON-start holds' `ang` matter for difficulty — design those
  angles to force awkward, draining pulls on the hard level.
- **Difficulty knobs (design, don't change config):** hold spacing/gaps near `LIMB_REACH`, how
  many holds (sparse = committing moves), good-side angles that fight you, long reaches that
  shift CoG toward the support edge, scarcity of restful (well-angled, well-below) holds.
- **Verify with the harness:** the greedy auto-climber in `sim-check.ts` must top out each level
  (it only makes 3+-contact stable moves, so a pass means a straightforward solution exists).
  If a level needs cleverer play than greedy can do, add a scripted manual solution to the
  harness proving it. Document each level's intended solution in a comment.
- Keep the levels genuinely distinct (a slab, a steep/sparse face, an overhang-ish reachy one).

## PLAYTEST pass (after render + levels)
Drive the built game (screenshots + scripted moves via the harness), confirm all 3 levels are
completable, and critique honestly: is operating the body fun/tense/masterable; is easy→hard a
satisfying, *rewarding* curve; are the tuning constants & level designs good; the single
highest-leverage next change. Be clear about what only a human hand can judge.
