# Climbing Horror Game — Prototype Brief

A design + build handoff for Claude Code. This document captures the result of an
ideation session. The goal right now is **not** to build the game. It is to build
the smallest possible disposable prototype that answers **one question**.

---

## The one question this prototype must answer

> Does dragging-and-holding through a slow climb, while the light drains and your
> sightline shrinks into darkness, feel like **dread** — or like a **chore**?

Dread = success, keep going. Chore = the core is wrong, tune before building anything else.
The two are a hair apart and only a thumb (or, for now, a mouse) can tell them apart.

Everything below serves that question. Anything that doesn't tighten or release
tension is out of scope for this build.

---

## Game concept (the "why", kept short)

- **Spine of the game: tension.** Not loot dopamine, not combat, not story. Tension is
  the emotional engine and everything is subordinate to it.
- **The "aha" / fresh take:** it is not really a climbing game. It's a *greed-vs-survival
  game wrapped in climbing*. Like The Last of Us "happens to" be a zombie game, this
  "happens to" be a climbing game. The real subject is commitment under an encroaching clock.
- **The antagonist is the dark, not monsters.** No monsters in the prototype (or possibly
  ever). Light is the doom timer.
- **Pace is slow and deliberate — deliberately NOT Temple Run.** The challenge is
  *choosing and committing*, not reflexes or gesture speed. Climbing/mountaineering is slow,
  steady, with overarching dread. In full light it should feel like you have infinite time;
  as dark falls, tension sharpens.
- Tone reference for art (LATER, not now): old Diablo. Pixelated, niche, focused. 2D.
- Single player. No story yet (background lore optional, much later).

### The central squeeze (this IS the game)
- **Light** = global doom meter. Always draining, including while you deliberate and while a
  move resolves. Hitting zero = the dark takes you.
- **Stamina** = local pressure meter. Drains on moves, recovers when planted/resting.
- The squeeze: **stamina pushes you to rest; light punishes you for resting.** That tension
  is sufficient on its own to make the prototype tense. Nothing else needed.

### Tension comes from decisions, not execution
- A pure climbing game tests whether you can *execute* a hard move. That's stress, not tension.
- Tension is *choice under pressure*: a tempting bad idea + a clock. Reaching for something
  just off the safe path while the light bleeds.
- Because thinking costs light, **even hesitation has a price.** Good.

---

## Core interaction (the verb)

The player **picks the next hold** from a few candidates, then **commits physically**.

1. A few candidate holds glow above the climber (2–4). Each shows its rough **light cost**
   and **stamina cost**, shown honestly.
2. The player **presses and drags** toward a chosen hold. (Mouse for now; finger later.)
3. The player must **HOLD** while the climb **slowly resolves** via animation. They watch it
   commit and cannot rush it.
4. **Releasing early aborts the move** — the climber is left mid-vulnerable: stamina bleeds,
   possibly slips back. This is the embodiment of commitment: the hold-through is the ritual.
5. Light drains the entire time — deliberation, drag, and resolve.

### Critical: the drag is a COMMITMENT RITUAL, not a skill check
- Do **not** make the drag require accuracy or steadiness. If a shaky/imprecise drag causes a
  slip, we've accidentally rebuilt the dexterity game we explicitly rejected.
- The drag's job is to make the player *physically enact a decision already made with the head*.
  Slowness is the point. The tension is "I've started this and must see it through," not
  "can I drag straight."

### Limb handling: AUTO for this prototype
- Real climbing is 4 points of contact, move one limb at a time — that's a rich future mechanic
  (vulnerability while a limb is in transit, stamina tied to anchored-limb count, etc.).
- For THIS prototype: **auto-limb**. The player just drags toward a hold; the game picks the
  sensible limb. This isolates the one thing we're testing without dragging the fiddly
  4-limb interaction problem into the experiment. Manual limb control is a later question,
  only if the core feeling is proven.

### Darkness mechanic — the emotional arc, made playable
Do not merely dim the screen (though do that too). **Darkness steals information:**
- Full light → many holds visible far up the wall → real multi-move planning → calm.
- Light draining → visible range shrinks: fewer holds, closer in.
- Near-dark → only the single next hold is visible, lit by what the climber carries →
  committing nearly blind → claustrophobic, reactive.

This single mechanic = the entire tension curve, built into the sightline. Early calm,
late dread. The dark isn't a corner timer; it slowly removes your ability to see what you
are committing to.

### Resolve style (decided)
- Move resolves via a **slow climb animation the player watches and cannot cancel** (other
  than aborting by releasing). The helplessness of watching a committed bad choice play out
  IS the horror we want. (Chosen over instant/board-game resolution.)

---

## What the prototype literally contains (build #1)

- A vertical wall; climber starts at the bottom; viewport follows the climber upward.
- Two always-visible meters: **light** (global, draining) and **stamina** (drains on moves,
  recovers when planted/resting).
- At any moment, 2–3 candidate holds visible above, each showing rough light + stamina cost.
- Press-and-**drag** toward a hold → **hold** while it slowly resolves → success moves you up;
  **release early** = aborted/vulnerable move (extra stamina/light cost, possible slip).
- As light drops, fewer holds are visible and closer in (shrinking sightline).
- End states: reach the top (made it) / light hits zero (the dark takes you).

### Explicitly OUT of scope for build #1 (do not build)
- Pitons / checkpoints — this is build #2, the first thing to add once the core feels right
  (it's the "spend a resource to buy safety" layer).
- Loot, inventory — belongs to a loot spine we deliberately rejected. Maybe never.
- Monsters.
- Story / lore.
- Art, sprites, sound. **Gray boxes only.** The prototype must be ugly and disposable.
- Manual limb selection.

---

## Tech stack (decided)

**TypeScript + HTML5 Canvas (2D context). No framework. No Three.js. No engine.**

Reasoning:
- We want the absolute lowest friction to first-playable and the tightest edit→refresh→feel
  loop, because the whole prototype is "tune the climb timing until it feels like dread."
- Three.js was considered and **rejected**: it's a 3D library; this is a 2D game. Plain Canvas
  draws a rectangle in one line with zero dependencies.
- **TypeScript over plain JS:** the type checker catches a class of mistakes for free during the
  many edit→refresh cycles this prototype will go through. Worth the tiny build step.
- Godot was the other serious candidate and is the likely choice for the *real* game later
  (true 2D engine, free/MIT, gentle GDScript, native iOS export). But for the *disposable
  validation prototype*, web + Canvas answers the one question faster.
- **Caution flagged:** do not let this web prototype silently become the real game. A web→iOS
  path means wrapping in a webview (e.g. Capacitor), which puts touch latency and drag *feel* —
  the exact thing we're testing — at the mercy of the browser engine. Validate the feeling
  here, then **deliberately** decide whether to rebuild in Godot. Treat this code as throwaway.
- For now, prototype and playtest on a computer with **mouse-drag standing in for finger-drag**.
  iOS export is a problem for weeks/months from now and must not influence current decisions.

### Build form
- **Multiple small TypeScript files** — a single massive file is discouraged. Coding agents (and
  humans) reason better over focused modules. Split by responsibility (see suggested layout below).
- Minimal toolchain: a lightweight dev setup (e.g. Vite, or `tsc` + a static server) so there's a
  one-command run and an instant edit→refresh loop. No heavyweight framework or bundler config.
- An `index.html` that mounts a `<canvas>` and loads the compiled entry point.

### Suggested file layout (a starting point, not a mandate)
- `config.ts` — **all feel-critical tuning constants in one place** (see list below). This file is
  where almost all the iteration happens; keep it isolated and heavily commented.
- `state.ts` — the game state types/model (climber position, meter values, current candidate holds,
  phase: deliberating / dragging / resolving / ended).
- `input.ts` — mouse press / drag / hold / release handling, mapped to commit + abort.
- `climb.ts` — move resolution: starting a committed move, advancing it over
  `CLIMB_RESOLVE_DURATION`, completing vs aborting.
- `holds.ts` — generating candidate holds and their light/stamina costs.
- `render.ts` — drawing the wall, climber, holds, meters, and the darkening/sightline effect.
- `sightline.ts` — mapping current light level → how many holds are visible and how far up.
- `main.ts` — the game loop (tick meters, update, render) and wiring.

Keep each file small and single-purpose. This is a disposable experiment optimized for fast
iteration on feel, not for architecture or reuse — but small modules make the agent's job easier.

---

## Implementation requirements for Claude Code

1. **Multi-file TypeScript project that runs with one command.** A simple dev setup (Vite or
   `tsc` + static server) and an `index.html` mounting the canvas. No heavy framework. See the
   suggested file layout above.
2. **All feel-critical numbers as named constants in `config.ts`**, clearly grouped and
   commented, so they can be tuned live by editing + refreshing. At minimum:
   - `CLIMB_RESOLVE_DURATION` — **the single most important number.** How long a committed move
     takes to play out. Too fast = no dread; too slow = tedious. Expect to tune this most.
   - `LIGHT_DRAIN_RATE` — light lost per second (drains always).
   - `STAMINA_DRAIN_PER_MOVE`, `STAMINA_RECOVER_RATE` (while resting/planted).
   - `ABORT_PENALTY` — extra cost / slip distance when a hold is released early.
   - Per-hold cost model (how light/stamina cost scales with reach distance / direction).
   - Sightline mapping: how visible range (number + distance of holds shown) shrinks as light falls.
3. **Tuning order — important:**
   - First get the **climb *feel* right** with generous (non-punishing) meters. Do not tune
     tension on a verb that doesn't yet feel good.
   - **Only then** tighten light vs stamina against each other to create the squeeze.
4. **Input:** press-and-drag-and-hold with the mouse. Holding through `CLIMB_RESOLVE_DURATION`
   completes the move; releasing early aborts (apply `ABORT_PENALTY`, leave climber vulnerable).
   The drag must be forgiving — commitment, not precision.
5. **Rendering:** gray boxes / simple shapes only. Climber, wall, candidate holds, two meter bars,
   and a darkening/sightline effect tied to the light meter. No art assets.
6. **End states:** clear "you made it" (reached top) and "the dark took you" (light = 0).
7. Keep it small and readable. This is a disposable experiment, optimized for fast iteration on
   feel, not for architecture or reuse.

---

## Success criterion (restate)

Build it, then **play it with your hands.** If reaching a limb into shrinking light and holding
through the slow resolve makes you tense — if committing to a move you're unsure about makes you
hesitate — the spine works, and pitons/art/lore/etc. are just turning the dial up.

If it reads as friction (impatient, waiting for the animation to be over) rather than fear, the
slowness isn't landing as dread — tune `CLIMB_RESOLVE_DURATION` and the meters before building
anything else.

---

## Appendix: how we got here (context behind the decisions)

This section is background for anyone (human or agent) who wants the *reasoning*, not just the
spec. The spec above is what to build; this is why it looks the way it does. If the two ever seem
to conflict, the spec wins — but this should help resolve ambiguity in the spec's spirit.

### Starting wishlist (the developer's initial instincts)
- Art style: old-Diablo feel — pixelated, distinctive, niche over mainstream. (For LATER.)
- 2D (cuts production time enormously).
- Single player (simpler). No story yet; maybe background lore much later.
- Topic: climbing — but **not a climbing game per se**. Wanted a "that's clever / new take"
  angle, à la The Last of Us being "a story that happens to be set among zombies."
- Open question the developer felt stuck on: *do you start from a small fun core mechanic and
  expand, or does it only become fun after piling on art/sound/mechanics/story?*

### Key reasoning steps that produced the design
1. **Start from the core mechanic, not the trimmings.** Art, sound, story, and "more mechanics"
   *amplify* a core; they don't rescue a boring one. If the loop isn't fun as gray boxes, it
   won't be fun pretty. So: find the ~10-second action you'd happily repeat a thousand times.
   This directly answers the developer's stuck question.
2. **Find the "aha" by noticing what was said twice:** the *horror of finite time before dark*
   and *anticipation*. That's not a climbing mechanic — it's a dread/resource mechanic that
   *happens to* be wrapped in climbing. That is the Last-of-Us move for this game.
3. **Three framings were considered** for marrying Diablo-ish appetite to climbing horror:
   - (a) *The mountain is a dungeon that goes up* — dark chases you, climbing is the trap.
   - (b) *The climb is the loot run; the descent is the horror* — greed literally weighs you
     down; you must get back down overloaded in the dark.
   - (c) *The mountain rearranges itself* — the route you memorized is gone (weird, less Diablo).
   These are parked as possible *directions for the full game*, NOT prototype scope.
4. **The spine was chosen explicitly: TENSION, not loot dopamine.** This was a deliberate fork.
   Choosing tension makes loot/upgrades/monsters all *subordinate to the clock* — they exist
   only to cost or buy time. It also tells us what NOT to build. Every feature must answer:
   does this tighten or release tension? If neither, cut it.
5. **Tension ≠ stress.** Stress is "can you execute a hard move" (dexterity). Tension is "choice
   under pressure" (a tempting bad idea + a clock). We want the second. This is *the* reason the
   game is deliberately slow and the drag is forgiving — see the "commitment ritual" note.
6. **Monsters, if ever added, are time-pressure made physical** — best avoided, not fought,
   because fighting spends the resource that matters (light/time). This keeps it from collapsing
   into a generic hack-and-slash. For the prototype: no monsters at all.
7. **Tension is fragile** — it dies if the player feels fully safe OR fully doomed. The craft is
   keeping them in the narrow "I might *just barely* make it" band. That's a *tuning* problem,
   which is why the prototype (gray boxes + tunable constants) can answer almost everything.

### Interaction decisions and why
- **Slow & deliberate, NOT Temple Run** — the developer was firm on this. It flips the verb from
  "execute under time" to "commit under time." Reflexes are explicitly not the challenge.
- **Resolve = slow watch-it-happen animation** (chosen over instant/board-game resolution),
  because the helplessness of watching a committed bad choice play out *is* the intended horror.
- **Press-drag-HOLD to commit** (developer's idea, and a good one): it puts the slowness in the
  player's own hand and makes commitment a physical act, rather than a passive watch. The big
  caveat — kept prominent in the spec — is that the drag must NOT become a steadiness/accuracy
  test, or we've rebuilt the dexterity game we rejected. It's a *ritual of commitment*, not a
  skill check.
- **Four-limb climbing** was explored as a rich future mechanic (vulnerability while a limb is in
  transit; stamina tied to how many limbs are anchored — you're least safe exactly when making
  progress). It's genuinely promising but fiddly on a touchscreen, and fumbling controls kills
  tension. So it's deferred: **auto-limb for the prototype**, manual limb control only if the
  core feeling proves out.
- **Darkness-steals-information** was the unlock that turns the emotional arc into one mechanic:
  shrinking sightline = early calm/planning → late blind/reactive. The tension curve lives in the
  sightline, not just in screen brightness.

### Tech-stack decision trail
- The developer's #1 actual risk was identified as *not building the prototype at all* (self-
  described difficulty making something fun enough to enjoy). So the overriding criterion is
  **lowest friction to first-playable** + **tightest edit→refresh→feel loop**.
- **Godot** was recommended as the best *real-game* engine for this (true 2D, free/MIT, gentle
  GDScript, native iOS export; confirmed mature — Godot 4.6 as of early 2026). Its weak spot is a
  fiddly iOS export/signing dance, but that's an Apple problem in every engine and is months away.
- **Web (TS + Canvas)** was chosen for the *prototype* because zero/near-zero setup and instant
  iteration beat everything else for answering the one question fast. The prototype is disposable
  by design, so rebuild cost later is acceptable and expected.
- **Three.js was explicitly rejected** — it's 3D; this is 2D. Importing a 3D scene-graph to draw
  flat boxes is the wrong tool.
- **TypeScript over plain JS** and **multiple files over one big file**: both chosen to make the
  coding agent more effective (type checking catches mistakes; focused modules are easier to
  reason about than one sprawling file).
- **Standing decision to revisit:** validate the *feel* in the browser with mouse-drag, then make
  a deliberate (not accidental) call about rebuilding in Godot for the real iOS game. Do not let
  the web prototype quietly become the shipping product, because the webview touch-latency/feel
  risk compounds exactly where it hurts most.

### Build order beyond the prototype (for orientation only — DO NOT build now)
1. This prototype (core feel).
2. **Pitons / checkpoints** — the "spend a limited resource to buy safety" layer; first thing to
   add once the core feels right.
3. Everything else (loot?, lore?, art, sound, manual limbs, monsters?) — only ever as dials that
   turn up a spine already proven to work.
