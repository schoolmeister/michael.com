# SCEND — Prototype #1 brief

**Spine:** can *radical simplicity* be fun? One control (jump), one verb (tap-time), one run
(survive 10:00 at maximum speed).

**The one question:** with your only choice being *when* to tap jump, does threading between
deadly tiles and speed-boosting ones — at an ever-rising speed — feel like a tense, readable
**flow state**, or like **coin-flip guessing**?

## What this prototype is

- An auto-running, auto-battling platformer reduced to a single button. The world is a tile
  grid; the camera scrolls right at `speed`. Tap = one fixed-arc hop.
- Three outcomes from one button, terrain-driven: **UP** (tap onto a higher tile / over a
  hazard), **STAY** (ride the surface), **DOWN** (don't tap, step/fall off a ledge).
- **Speed is the score and the difficulty.** A base ramp over the 10 minutes + boostable
  bonuses (wet→lava, boots). Peak speed is the headline number.
- **One life.** Any lethal tile/enemy ends the run; restart from 0:00.

## Decisions locked for #1

- Control = **tile-hop** (terrain-driven), not lanes or hold-to-rise.
- Speed = **ramps + boostable + scored**; win at 10:00.
- Death = **one life, instant restart**.
- Ground is a **gentle ±1-tile heightmap, no bottomless pits** — deaths come from hazards, not
  terrain, so the "is dodging fun?" signal stays clean. (Pits / forced-jump walls are a later
  knob if dodging proves fun.)

## Out of scope for #1 (deliberately)

- Art, audio, juice beyond glow/strobe.
- Meta-progression, multiple levels, difficulty modes.
- Mobile tuning (works via tap, not tuned for it).

## How we'll answer the question

Build it, play it, then iterate purely in `config.ts`. If hopping hazards at speed feels like
flow → the simplicity thesis holds, invest in art (Blade/rave) + the boost economy. If it feels
like guessing → the verb is at the wrong altitude; rethink before any art (the `ascend` lesson).
