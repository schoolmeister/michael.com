# Climbing Horror Game — Prototype Brief #3 (the four-limb / center-of-gravity verb)

A design + build handoff for Claude Code. This documents the **third and current** verb, which —
unlike briefs #1 and #2 — actually showed signs of fun in playtesting. The spine, tone, and goals
of the whole game are unchanged from Brief #1 (read it for the "why": tension as the spine, the dark
as antagonist, slow & deliberate, gray boxes, eventual iOS). This brief records the verb we've
landed on, how it works mechanically, and what's still open.

There is a working gray-box prototype (single HTML file, vanilla JS + Canvas) that implements
everything described under "Mechanics as currently built." The production version should be
TypeScript + multiple files (see Brief #1 tech section), but the HTML prototype is the source of
truth for *how it should feel and behave*.

---

## How we got here (so the reasoning isn't lost)

Three verbs were prototyped and playtested in order:

1. **Brief #1 — pick a hold, drag-and-hold to commit.** Boring. A single isolated choice with an
   obvious answer has no depth.
2. **Brief #1b — add reach-constraints / route-planning.** Still boring: it became a *pathfinding
   puzzle* with a knowable best move. Puzzles are calm to solve, not tense.
3. **Brief #2 — "maintain a wobbling marker in a zone, then choose when to commit."** Rejected by
   the designer: holding a marker steady wasn't fun, felt like babysitting a meter.
4. **Brief #3 (THIS) — four limbs + center of gravity on a spray wall.** First version that felt
   fun. The reason it works where the others didn't: it's a **spatial system with continuous,
   coupled trade-offs and no single optimum** — you manage a body under load, not solve a puzzle.

**Two rejected ideas, recorded so they're not re-proposed:**
- *Pure randomness / hidden costs* — rejected. Randomness makes choices feel like a chore; if the
  outcome isn't determined by the player's decisions, the decisions don't matter.
- The design philosophy throughout: **don't forbid bad options, make them cost.** Difficulty should
  come from *decisions*, never from fighting the controls (the QWOP failure mode). The player
  controls *intentions* ("put this hand here", "shift my weight left"); the system resolves the
  physics, predictably and readably.

---

## The core idea (one paragraph)

You are a climber with **four limbs** (2 hands, 2 feet) and a **center of gravity (CoG)**. You climb
a **spray wall** (holds scattered all around you). The depth comes from the relationship between
*where your weight is* and *where/how your limbs are placed*: a hold is only "good" if your CoG is
positioned correctly relative to it, and a limb only tires in proportion to how much load it's
actually bearing. Managing your body so that struggling limbs get relieved — by shifting weight onto
your feet, onto a better hand, or by flagging a free limb out as a counterweight — is the verb. The
dark/light doom clock from Brief #1 is NOT in this prototype yet; this prototype isolates the body
mechanic.

---

## Mechanics as currently built

### Limbs, holds, CoG
- The climber = **4 limbs** (LH, RH = hands; LF, RF = feet) + a **body/CoG** point.
- **CoG = the centroid of all four limb *positions* + a small manual "lean".** Crucially, a limb
  contributes to CoG **whether or not it is gripping a hold** — an ungrabbed limb still has mass, so
  *flagging a free limb out to the side genuinely shifts your weight* (a real balancing tactic).
- **Support polygon = only the limbs currently gripping holds.** This is DISTINCT from CoG: gripping
  limbs define the polygon your weight must stay inside; ungrabbed limbs do not.
  - **If the CoG leaves the support polygon → you fall.** (Auto-reset in the prototype.)
  - This mass/support split is the source of flagging tactics: a free limb can pull your CoG toward
    a good support point — or, overdone, drag your CoG outside support and make you fall.
- **Holds have a "good side"** = a direction, drawn as a **triangle whose point aims toward the good
  side** (the direction you should be pulling from). Holding it from the good side is solid; from the
  wrong side it's bad.

### Hold "goodness"
- For a gripping hand, **goodness** = how well the current CoG sits on the hold's good side
  (dot product of "hold→CoG" direction vs. the hold's good-side direction, with a tolerance).
  1 = perfect, 0 = terrible. It updates live as you move your weight.
- **Goodness above a margin (`GOOD_MARGIN`) = the hold is "good" (no badness).** Below it, "badness"
  ramps from 0 up to 1 as alignment worsens. A well-set hold is restful *with respect to angle*.

### Load distribution (what makes "good hand relieves the others" work)
- Total bodyweight (=1) is **distributed across the gripping limbs by geometry**: contacts that are
  **near the CoG** and **below it** (feet you stand on) take more load; far/above contacts take less.
- **Feet absorb load greedily but capped** (`FOOT_ABSORB_MAX`), so shifting your weight onto your feet
  relieves your hands — but only partially.
- **Every gripping hand keeps a minimum load** (`HAND_MIN_LOAD`), so hands NEVER fully stop tiring.
  (This was a deliberate design choice: the clock always ticks at least faintly → preserves dread.)

### Stamina drain (hands only; feet never tire)
- **A hand drains by `load × badness`**, not badness alone. A hand only tires in proportion to how
  hard it is actually *working*. Consequences that fall out of this automatically:
  - A perfectly-placed hand bearing lots of load → ~zero drain (badness ~0).
  - A *bad* hold that's barely loaded (because a good hand + feet carry you) → drains *slowly*.
    This is the "if one good hand carries you, a free/dangling hand shouldn't bleed" behaviour —
    it emerges from the load model, not a special case.
  - All hands bad *and* bearing real weight → everything bleeds (tension preserved).
  - Let a limb go → its load redistributes to the others → their load and drain rise (coupling,
    now physically motivated rather than a flat multiplier).
- If a hand's stamina hits 0 → it **slips off** the hold (no instant death; you deal with the
  redistributed load / possible fall).

### Movement: aim-then-commit (preview before you act)
- Dragging a limb does **not** move it immediately. It enters an **aim** state:
  - The real limb stays put (so your CoG/stability don't change while you think — no blind falls).
  - A **ghost** shows where the limb will land, plus the **resulting CoG and support polygon**
    computed as if the move were done. The previewed CoG **follows the aimed limb's mass live.**
  - The preview is **color-coded: green = the move leaves you stable, red = "would fall".**
  - **Release commits the move** (instant placement — "mode (a)"). Release over a hold to grip it;
    release in open air to deliberately go to fewer contact points (also previewed).
- **Lean:** dragging the body/CoG dot shifts weight within a limited range (`LEAN_RANGE`) — the fine
  control, vs. moving a limb (coarse control).

### Load is made VISIBLE
- The **connecting line from CoG to each limb is thick/bright when that limb bears load, thin/dim when
  it's just dangling for balance.** This keeps "why is this hand draining?" answerable at a glance —
  important because load is otherwise an invisible variable (avoids a new "fell and don't know why").

### Feel rules (decided with the designer)
- **Failure = bleed, not instant death.** Slipping a hand or a bad move costs you and may cascade, but
  the only hard fail is CoG leaving support.
- **You start stable.** Initial holds are placed under the limbs and their good-sides are angled toward
  the starting CoG, so the opening is restful — tension comes from what you do, not from spawning in
  crisis.
- **Hands never fully rest** (the load floor) — relentless, dread-preserving, the designer's choice
  over a fully-restful option.

---

## Tunable constants (all at top of the script — tune these for feel)
- `GOOD_MARGIN` — goodness above this = no angle-badness. Higher = narrower restful cone (harder).
- `DRAIN_BAD` — max hand drain/sec when fully loaded on a fully bad hold.
- `LOAD_BELOW_BIAS`, `LOAD_NEAR_BIAS` — how strongly load concentrates on near/below contacts.
- `FOOT_ABSORB_MAX` — cap on how much weight feet soak up (higher = feet rescue hands more = easier).
- `HAND_MIN_LOAD` — per-hand minimum load (higher = hands always work harder = more relentless).
- `LIMB_REACH` — max limb distance from CoG.
- `LEAN_RANGE` — how far you can lean without moving a limb.
- `GRAB_DIST`, `HOLD_R`, `HOLD_COUNT`, `ANGLE_TOLERANCE`.

---

## Spray-wall prototype scope (deliberately no goal)
- The prototype **has no objective on purpose.** The question it answers is narrow: *does operating
  this body — relieving a struggling hand by shifting weight / flagging / re-gripping — feel like a
  tense, satisfying physical negotiation, or like fighting the controls?* It showed signs of the
  former, which is why we're continuing on this verb.
- Holds surround the climber (spray wall). "Reset climber" re-places you stable; "New spray wall"
  reshuffles holds.

---

## Open design problem (NEXT pass — item 4, NOT yet built)

The solution space is currently **too broad / too naive**: limbs can be placed anywhere (feet above
hands, all four cramped into one spot). This feels unconstrained. Agreed direction for the next pass,
in the established "show, don't forbid; cost, don't block" philosophy:

- **4a — body topology via soft "home regions".** Each limb has a comfortable region relative to the
  body (LH upper-left, RF lower-right, etc.). Awkward placements (e.g. foot above hand) are **allowed
  but penalized** — worse load-bearing / faster drain / reduced effective reach — rather than
  forbidden. Realism emerges as "good technique is efficient," without a full skeleton sim (avoid
  QWOP). **Afford it visually**: directional reach zones (the reachable area pinches where placement
  is awkward) and/or a "strain" tint on the limb line / aim-preview ghost (green = natural, red =
  contorted), shown *before* committing.
- **4b — minimum limb separation.** Limbs cramping into the same spot is degenerate, not a tactic.
  Use a soft minimum-separation constraint (limbs repel / placement disallowed within a small radius).
  This is just closing an exploit, not adding depth.

Build 4 as its **own focused pass** so its tuning doesn't get muddied with the mechanics above.

---

## Future / deferred (do NOT build into this prototype)
- The **light/dark doom clock** and shrinking-sightline darkness arc from Brief #1 — layer back in only
  once the body verb is fully proven and the objective is added.
- **Objective** (e.g. "reach the top", "fewest holds / least stamina") — add as Prototype 3b once the
  goalless body mechanic is confirmed fun.
- **Timed/animated limb transit + CoG trajectory preview** (designer's idea): currently a move is
  instant on release ("mode a"). Future: the limb *travels* over time and is briefly unweighted
  mid-move; show the **CoG's trajectory** along the path so the player can see if the *journey* (not
  just the destination) passes outside support. The preview math is already factored to support this
  (sample the CoG function along the path instead of only at the endpoint).
- **Transit load penalty ("mode b")**: lifting a limb drops you to fewer contacts and raises drain
  *while you aim* — adds time pressure to planning. Deferred to keep current difficulty manageable.
- Pitons/checkpoints, loot, monsters, story, art/sound. Gray boxes only for now.

---

## The question this prototype is still answering
> Does operating a four-limb body on a wall — reading the CoG-vs-hold-angle relationship, watching
> load shift between limbs, and relieving a struggling hand by moving your weight or flagging a free
> limb — feel like a tense, masterable physical negotiation?

Early playtesting: **promising** ("a little bit of fun"). The work now is (a) constraining the
too-broad solution space (item 4) without making it fight the player, then (b) adding an objective,
then (c) layering the darkness/doom clock back on top.