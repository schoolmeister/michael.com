# Climbing Horror Game — Prototype Brief #2 (the "maintain the hold" pivot)

A design + build handoff for Claude Code. This supersedes the *verb* in Prototype Brief #1.
Everything about the **game's spine, tone, and goals is unchanged** — read Brief #1 for the
"why." This document records why Brief #1's verb failed, and the new verb we're testing instead.

---

## Why we're on Brief #2 (what playtesting Brief #1 taught us)

Brief #1's prototype was built and played. It was **boring**, and three rounds of diagnosis
established *why* — this is the most valuable thing we know, so it's written down so we don't
re-walk it:

1. **Raw hold-selection was hollow.** "Tap the next hold, hold to commit" had no depth — there
   was no tactic, every move was an obvious one-shot choice.
2. **Adding reach-constraints (a route-planning layer) didn't fix it.** It turned the game into a
   *pathfinding puzzle*: there was always an obvious, computable best move. A puzzle with a knowable
   right answer is not tense — solving is calm, being stuck is frustrating, neither is dread.
3. **Pure uncertainty is NOT the fix either.** Hiding costs / randomizing outcomes was considered
   and **rejected by the designer** with a key insight (see below). Randomness makes a game feel
   like a *random chore*; if your choices don't determine the outcome, they don't matter.

### The insight that unlocked Brief #2
> Climbing isn't fun because it's *risky*. It's fun because you **convert risk into safety through
> deliberate, careful action.** You face something dangerous and, by moving slowly and correctly,
> you *make it not-dangerous*. The satisfaction is "that was scary and I **handled** it."

This reframes the whole design:
- The verb is **not** "pick a hold" (a choice) and **not** "guess a hold" (a gamble).
- The verb is **"secure yourself before you commit."** Danger is real and visible; the player's
  slow, deliberate input is *how they tame it*. The player's effort is the mechanic — not a tax on it.
- This finally gives the slow drag/hold a JOB. In Brief #1 the slowness was something the player
  *endured* (waiting on an animation). Here slowness is something the player *spends strategically*:
  careful settling is the tool that converts danger → safety, and using exactly the right amount is
  the skill.
- Information stays **visible** (the designer disliked hidden-info guessing). Depth comes from *what
  you do about what you see*, not from concealment. Risk is a legible judgment, not a dice roll.

---

## The new core verb: maintain the hold in the zone, then choose to commit

When the player reaches for a hold, they do **not** instantly get it. The hold starts **unstable**,
and the player must physically *stabilize* it by maintaining control, then decide when it's secure
enough to trust their weight and move up.

### The maintain mechanic (keep it SIMPLE for this prototype)
- There is a **drifting marker** and a **secure zone**. A handle/marker wants to fall (you're
  slipping). **Holding the mouse button pushes it up; releasing lets it fall.** The player *feathers*
  the input to keep the marker inside the secure zone.
- While the marker is **in the zone**, the hold **secures** (a safety level builds up).
- While the marker is **out of the zone**, securing stalls/reverses and **stamina bleeds faster**.
- This is the dumbest tactile version on purpose ("hover a wobbling point in a zone"). If keeping a
  sketchy hold steady while the light drains makes the player focus, the verb works and we refine the
  feel. If even this is boring, the maintain-a-zone idea itself is suspect — and we learn that cheaply.
- **Feel is everything here.** Maintaining must feel like a *physical negotiation with the hold*
  (resistance, wobble, the marker fighting you), NOT like watching a progress bar fill. If it reads
  as "wait for the bar," we've failed the same way Brief #1 failed.

### The three rules that define the feel (DECIDED with the designer)
1. **Losing the zone bleeds, it does not kill.** Drifting out of the secure zone *stalls securing
   and accelerates stamina drain* — a real cost you can recover from by pulling back into the zone.
   Actual failure only comes from the broader squeeze (stamina hits zero while hanging; or committing
   weight to an insufficiently-secured hold). No twitchy instant-death — that would be the opposite
   of "calculated."
2. **The PLAYER decides when to commit upward.** Securing fills a safety level while the zone is
   held; the player chooses the moment to trust their weight and ascend.
   - Commit **early** = faster, less light spent, but you're trusting an under-secured hold (risk
     carries into the next move / worse starting position).
   - Commit **late** = safe, but you've burned more light and stamina.
   - *This decision IS the calculated-risk mindset, on every single hold.*
3. **Stamina drains continuously while hanging — slower when in the zone, faster when out.** This
   creates "don't dawdle" pressure that makes hard holds genuinely scary, without randomness.

### Difficulty model (the compounding squeeze — the good part)
- **Harder holds are hard TWICE, from one variable.** A hard hold costs more stamina to attempt AND
  is harder to maintain in the zone (marker falls faster, and/or the secure zone is narrower, and/or
  the zone wanders).
- **Low stamina feeds back into control.** The more depleted you are, the weaker your "push," so the
  marker falls faster and holds get harder to keep in the zone. Difficulty scales naturally with both
  hold hardness *and* remaining stamina — a difficulty curve from a single resource, no extra systems.

### Why this produces real strategy (not one optimal path)
Because a hard hold is survivable *if you commit fast and don't linger*, genuinely distinct play
styles become viable — these are risk *styles*, not a puzzle with a solution:
- Go for one **hard hold** knowing the ones after it are **easier** (spend big, then recover).
- Take a **chain of very hard holds** that gain height quickly (brutal, fast, high-drain — a gamble
  on your stamina lasting).
- Play **safe and steady** (secure everything fully) and race your own light budget.
The plan is "what sequence of control-tests can I actually survive at my current stamina?" — a
climber's judgment, not a pathfinder's.

---

## What the Brief #2 prototype contains

- A vertical wall; climber starts at the bottom; viewport follows upward. (Same as #1.)
- Two meters: **light** (global, always draining) and **stamina** (drains continuously *while
  hanging/maintaining* — slow in-zone, fast out-of-zone; recovers when planted/resting on a good hold).
- The player reaches for a hold → enters the **maintain** state → feathers the input to keep the
  drifting marker in the **secure zone** → a **safety level** builds while in-zone → the player
  **chooses when to commit** weight and ascend.
- Holds vary in **hardness**, shown honestly (visible, not hidden): harder = faster drift / narrower
  or wandering zone / higher stamina cost.
- End states: reach the top (made it) / stamina or light gives out (the dark takes you).

### Carried over unchanged from Brief #1
- **Tension is the spine.** Everything subordinate to it. Cut anything that doesn't tighten/release it.
- **The dark is the antagonist**, light is the doom clock, slow & deliberate (NOT Temple Run).
- **Darkness steals information** (shrinking sightline) — still the intended emotional arc. Can be
  layered back in once the maintain-verb feels good; don't let it distract from testing the verb.
- **Gray boxes only.** Ugly, disposable. (Note: the designer dressed up #1 with sprites/animation,
  which muddied the "is it boring" read. For #2, resist that until the verb is proven.)

### Explicitly OUT of scope for Brief #2
- Four-point / manual limb climbing — this is the designer's *next* direction to explore IF the
  maintain-verb also fails. Do not build it yet.
- Pitons/checkpoints, loot, inventory, monsters, story/lore, art/sound.
- Hidden-information / randomized-outcome mechanics — explicitly rejected (see above).

---

## Tech stack (unchanged from Brief #1)

- **TypeScript + HTML5 Canvas (2D).** No framework, no Three.js, no engine.
- **Multiple small files** over one massive file (agents and humans reason better over focused
  modules). Suggested split unchanged from Brief #1: `config.ts` (all tuning constants), `state.ts`,
  `input.ts`, `render.ts`, `main.ts`, plus a `maintain.ts` for the new zone/secure mechanic.
- One-command run (Vite or `tsc` + static server). Instant edit→refresh loop. Mouse stands in for
  finger; iOS is months away and must not influence current decisions. Treat code as throwaway.

---

## Implementation requirements for Claude Code

1. **Multi-file TypeScript project that runs with one command.**
2. **All feel-critical numbers as named constants in `config.ts`**, grouped and commented. At minimum:
   - `MARKER_FALL_RATE` — how fast the marker drifts down at base difficulty. **A top feel number.**
   - `PUSH_STRENGTH` — how hard holding the button pushes the marker up (scaled down by low stamina).
   - `ZONE_HEIGHT` — size of the secure zone (shrinks with hold hardness).
   - `ZONE_WANDER` — how much the zone itself drifts on hard holds (0 for easy holds).
   - `SECURE_RATE` — how fast the safety level builds while in-zone.
   - `STAMINA_DRAIN_IN_ZONE`, `STAMINA_DRAIN_OUT_ZONE` — continuous hang drain (out > in).
   - `STAMINA_RECOVER_RATE` — recovery when planted/resting on a good hold.
   - `LIGHT_DRAIN_RATE` — light lost per second (always).
   - `HOLD_HARDNESS` model — how a hold's hardness maps to fall rate, zone height, wander, and cost.
   - `COMMIT_RISK` model — consequence of committing below full safety (e.g. worse start / stamina hit
     on the next hold), scaling with how under-secured you were.
3. **Input:** press-and-HOLD to push the marker up; release to let it fall. A separate, deliberate
   **commit** action (e.g. a key, or a second control) so committing upward is the player's *choice*,
   not an accident of releasing. The maintain must be forgiving — control under strain, not a precision
   twitch test.
4. **Rendering:** gray boxes / simple shapes only. Wall, climber, the current hold's **maintain UI**
   (drifting marker + secure zone + safety level), two meters. A hold's **hardness must be visible**
   before you commit to reaching it.
5. **Tuning order:** get the **maintain *feel* right first** with generous meters (does feathering a
   wobbling marker in a zone feel like a tense physical negotiation?). **Only then** tighten light vs
   stamina to create the squeeze. Do not tune tension on a verb that doesn't yet feel good.
6. **End states:** clear "you made it" and "the dark took you."
7. Small, readable, disposable. Optimized for fast iteration on feel.

---

## The one question this prototype must answer

> Does **feathering a sketchy hold into its secure zone while the light drains — and choosing the
> moment to trust your weight to it — feel like calculated risk you *handled*** (tense, satisfying,
> "that was scary and I did it") — or does it feel like babysitting a meter (a chore)?

Handled = the verb works; refine feel, then layer the squeeze, then the darkness arc.
Chore = the maintain idea is wrong; the four-point body mechanic is the next thing to try.

As before: **play it with your hands.** Watch whether your focus *sharpens* (dread) or your patience
*thins* (friction). Those are a hair apart and only your hand can tell them apart.