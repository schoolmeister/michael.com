# Prototype #2 iteration — build spec (for the implementation agents)

This is a **disposable climbing-horror prototype**. Read `game-protoype-1.md` for the
original brief and `README.md` for how to run it. This iteration responds to the
developer's gripes:

1. **Drag is cumbersome → replace with HOLD-CLICK directly on a hold.** No drag.
2. **Hold choices are uninteresting → add the ROPE & ANCHOR skill verb** (the big one).
3. **Reach animation is unfulfilling + the aim line is "stupid" → a visceral climb
   animation and a real hanging rope; delete the line.**

## The new core loop
- The climber is secured on a hold (`choosing`). Reachable holds above glow.
- **Reach:** press-and-HOLD directly on a reachable hold. A visceral climb animation
  plays over `CLIMB_RESOLVE_DURATION`; you must keep holding. Release early (or run
  out of stamina) → you **slip and FALL**.
- **Protect:** instead of reaching, press-and-HOLD on the current hold's **horn** (if it
  has one) to place an anchor. While holding, you **aim the seating angle**; release to
  set it. A good seat (within the horn's safe cone) is bomber; a bad one rips when
  loaded. **Darkness hides the safe cone** — placing good pro late is a gamble.
- **Falls** drop you until the rope (your last anchor) arrests you — or the anchor
  **rips** and you fall further, cascading down anchors, maybe to the ground (death if
  the unprotected fall is high enough).
- The **lantern (light)** always drains = doom clock. **Stamina** recovers only while
  resting. The new choice each stance: *push on unprotected (fast, saves light, but a
  slip = a long/fatal fall) vs spend light+stamina+time placing pro you can trust.*

## The CONTRACT (already written — do NOT edit these files)
`config.ts`, `state.ts`, `anchor.ts`, `view.ts`, `main.ts`, `assets.ts` are the
contract. **Do not modify them.** If you think you need a new constant or state field,
STOP and leave a `// CONTRACT-GAP: ...` comment using a sane local fallback; the lead
will reconcile. Build strictly against:

- **Phases** (`state.ts`): `choosing | reaching | anchoring | falling | won | lost`.
- **`view.ts`**: `worldToScreen(s,x,y)`, `screenToWorld(s,x,y)`, `focusScreenY(s)`,
  `slipKickPx(s)`. BOTH hit-testing and rendering MUST use these (so clicks match
  pixels). Never inline the camera mapping.
- **`anchor.ts`**: `seatingQuality(hold, seatAngle)→0..1`, `qualityTier(q)`,
  `wouldRip(q, fallAbovePx)`, `resolveFall(climberY, anchors, ropeAnchorId)→FallResult`,
  `angleDiff(a,b)`.
- **`state.ts` helpers**: `holdById`, `anchorById`, `ropeBaseX/Y`, `lightFraction`,
  `staminaFraction`.
- Tuning in `config.ts` (HOLD_HIT_RADIUS, HORN_HIT_RADIUS, ANCHOR_* , HORN_* , ROPE_*,
  FALL_*, etc.). Use these names; don't hard-code feel numbers.

Entry points main.ts already calls (keep these signatures):
- `climb.ts`: `createGame(viewW,viewH): GameState`, `update(s, dt, pointer): void`,
  and (re-export ok) `climbEase(t)`.
- `input.ts`: `createPointer(): Pointer`, `attachInput(canvas, pointer, isEnded, onRestart)`.
- `render.ts`: `render(ctx, s, assets): void`.

Run `npx tsc --noEmit` to check your work. Keep modules small and readable; this is a
throwaway feel prototype, not production.

---

## AGENT A — gameplay logic. You OWN: `climb.ts`, `input.ts`, `holds.ts`.

### `input.ts`
Likely unchanged from current: record raw pointer (down, x, y, startX, startY) in
canvas px; on a press while the game is ended, call the restart callback. All meaning
is derived in `climb.ts`. Keep `createPointer`/`attachInput`.

### `holds.ts` — persistent route + HORNS + reach/cost
Keep the existing persistent-route generation (rows, grip types, `HARD_GRIP_BIAS`,
`reachableFrom`, `moveCost`, `spriteKeyFor`). ADD horn generation per hold:
- If `GRIPS[type].anchorable` and `Math.random() < HORN_SPAWN_PROBABILITY`: `hasHorn = true`,
  else false.
- `hornX = x + (±)width*0.42`, `hornY = y + rand(2..10)` (a corner of the hold).
- `hornConeCenter`: bias DOWNWARD-into-rock so a hung load seats into the notch — e.g.
  `-Math.PI/2 + rand(-0.7, 0.7)` (radians, world; recall +y is up, so this points down).
- If no horn: `hasHorn=false`, `hornX=x, hornY=y, hornConeCenter=0`.
- The floor hold and summit hold should both have a solid horn (guaranteed start pro / top).

### `climb.ts` — phase machine, hit-testing, anchoring, falls
Rewrite `createGame` + `update` for the new phases. Use `view.worldToScreen` /
`screenToWorld` for ALL cursor↔world tests. `armed` gating stays (must release before a
new press; set `armed=true` whenever pointer is up; clear it when an action begins).

`createGame`: build route (holds.ts), put climber on floor hold, `ropeAnchorId=null`
(ground belay), place an initial guaranteed anchor on the floor horn (optional but nice),
`anchors=[]` or `[floorAnchor]`, recompute reachable, `phase='choosing'`.

`update(s, dt, pointer)` per phase:
- **always**: `elapsed+=dt`; decay `abortFlash`, `slipKick`; drain light
  (`LIGHT_DRAIN_RATE`); if `!pointer.down` set `armed=true`; death check `light<=0 → lost`.
- **choosing**:
  - recover stamina (`STAMINA_RECOVER_RATE`).
  - Hover: set `hoverHoldId` = the reachable hold whose screen pos is within
    `HOLD_HIT_RADIUS` of the pointer (nearest if several); set `hoverHorn` = pointer within
    `HORN_HIT_RADIUS` of the current hold's horn (only if `currentHold.hasHorn` and no
    anchor already on this hold).
  - On `pointer.down && armed`:
    - if `hoverHorn` → begin `anchoring` (`placingHoldId=currentHoldId`, init `seatAngle`),
      clear armed.
    - else if `hoverHoldId` → begin `reaching` (`committedId=hoverHoldId`,
      `moveStart=climber pos`, `resolveProgress=0`, set `facing`), clear armed.
- **reaching**: if `!pointer.down` → **slip** (start a fall, see below). Else advance
  `resolveProgress += dt/CLIMB_RESOLVE_DURATION`; spend `moveCost` light+stamina across the
  reach; set `strain` from cost; if `stamina<=0` → slip; if `progress>=1` → land:
  climber→hold, `currentHoldId`, `moves++`, recompute reachable, win if summit, else
  `choosing`.
- **anchoring**: while `pointer.down`, `seatAngle = atan2(worldPointer.y - hornY,
  worldPointer.x - hornX)` (use `screenToWorld`). On release: `q = seatingQuality(hold,
  seatAngle)`; push `Anchor{id, x:hornX, y:hornY, holdId, quality:q}`; `ropeAnchorId = id`;
  pay `ANCHOR_PLACE_STAMINA_COST` + `ANCHOR_PLACE_LIGHT_COST`; `phase='choosing'`. (Mark the
  hold so you can't double-anchor it.)
- **falling**: animate `fallProgress += dt*FALL_SPEED / max(1, fallFromY-fallToY)`.
  When `>=1`: apply the precomputed `FallResult`: remove `rippedIds` from `anchors`; set
  `ropeAnchorId = caughtById`; if `death` → `lost`; else set climber to the catching
  anchor's hold (or floor if none), pay fall stamina (`(fallFromY-fallToY)*FALL_STAMINA_PER_PX`)
  + `ABORT_*` penalties, `slipKick`/`abortFlash`, recompute reachable, `phase='choosing'`.

Starting a slip (helper): compute `FallResult = resolveFall(climberY, anchors, ropeAnchorId)`,
set `fallFromY=climberY`, `fallToY=result.toY`, `fallProgress=0`, `fallRipped =
result.rippedIds.length>0`, stash the result (e.g. on a local field or recompute on land),
`phase='falling'`. Clear `committedId`.

Keep `climbEase`. Recompute reachable via `reachableFrom`.

---

## AGENT B — render + animation. You OWN: `render.ts`.

Rewrite `render(ctx, s, assets)`. Keep the good stuff from the current render (procedural
rock-face texture that scrolls, sky+stars above summit, abyss below floor, lantern
darkness vignette, HUD meters, end screens). USE `view.worldToScreen`/`focusScreenY` for
all world→screen (delete any inline mapping). Sprites: `assets.climber` (a single
lantern-mountaineer image; animate it with transforms/effects — you can't articulate
limbs, so fake it), `assets.holds[type]`.

Deliver these upgrades:

1. **Delete the old aim line entirely.** It's gone with the drag.

2. **Visceral reach animation** (during `reaching`, progress = `climbEase(resolveProgress)`):
   make the hold-through feel like climbing, not sliding. Suggested beats over the reach:
   coil/compress (squash) early → extend/lean toward the target hold (translate + slight
   rotate, reach with the body) → a "grab/catch" pop near the end (quick scale punch) →
   settle weight. Add: strain wobble (use `s.strain`), falling **dust/grit** particles off
   the wall, a subtle camera ease, and a darkening of effort. The climber should visibly
   travel from `moveStart` to the target hold along an eased arc (a slight outward arc reads
   better than a straight lerp). Sell weight and commitment. No numbers/line.

3. **Hanging rope (replaces the line):** a verlet rope from the climber's harness down to
   `ropeBaseX/Y(s)` (last anchor, or ground). Use `ROPE_SEGMENTS`, `ROPE_GRAVITY`,
   `ROPE_SLACK`, `ROPE_ITERATIONS`. Keep node state module-level; re-anchor endpoints each
   frame (top = climber, bottom = rope base); integrate + constrain; draw as a rope
   (slightly thick, a couple of strands or a highlight). It should sag and sway, swing
   during falls. Pin the top to the climber's chest/harness, not the lantern.

4. **Anchors & horns:**
   - Draw placed `anchors` as small slings/carabiners on their holds (visible within sight).
   - Holds with `hasHorn` show a subtle horn nub; brighten it when `hoverHorn`/current.
   - **Anchoring gauge** (phase `anchoring`, hold = `holdById(s, placingHoldId)`): at the
     horn draw the **safe cone wedge** (centered on `hold.hornConeCenter`, half-width
     `HORN_CONE_HALF_WIDTH`) — BUT only render the cone if the horn is within the lantern's
     `clarityRadius` (import from sightline.ts); otherwise show nothing (you're guessing in
     the dark). Draw the current **seat direction** (a sling line from horn along
     `s.seatAngle`). Color it by `qualityTier(seatingQuality(hold, s.seatAngle))`:
     solid=green, marginal=amber, bad=red. This is the skill read.

5. **Fall rendering** (phase `falling`): climber drops from `fallFromY`→`fallToY`
   (interpolate with `fallProgress`), rope whips, a harder vignette/again `abortFlash`.
   If `fallRipped`, sell the rip (a flash/snap near the ripped anchor). Then the settle.

6. **HUD additions:** keep LANTERN + STAMINA bars. Add a small **protection/exposure**
   readout: how far you are above your last anchor ("run-out") — e.g. a thin vertical gauge
   or text — so the risk you're carrying is legible. Phase hint text per phase
   ("hold a glowing hold to climb" / "hold the horn, aim the sling, release" / "HOLD —
   release = fall" etc.).

Keep it readable and gray-box-pragmatic where art is missing. Match the existing dark,
amber-lantern mood. Run `npx tsc --noEmit`.
