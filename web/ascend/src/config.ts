/**
 * config.ts — ALL feel-critical tuning constants for Prototype #3: the four-limb /
 * center-of-gravity verb. Ported from climb-4limb-test_5.html (the source of truth for
 * feel) and extended with an OBJECTIVE: a tall, scrolling wall with a finish line to
 * reach. The body mechanic is unchanged from the HTML; tune these for feel.
 *
 * Spine (from Brief #1, unchanged): tension. The dark/doom-clock is NOT here yet — this
 * prototype isolates the body mechanic + adds a goal + designed levels.
 */

// ── The body mechanic (verbatim from the proven HTML prototype) ──────────────
export const HOLD_R = 13; // visual hold radius (world px)
export const GRAB_DIST = 30; // how close a limb must be dropped to a hold to grab it
export const LIMB_REACH = 150; // max distance a limb can be from the CoG
export const LEAN_RANGE = 70; // how far the body can lean from the support centroid
// (was 46 — widened so a deliberate lean can actually relocate the CoG enough to relieve
//  a loaded hand / fix a bad angle. "Fine control" needs real range to matter.)
export const HAND_STAM_MAX = 100;
export const GOOD_MARGIN = 0.78; // goodness ≥ this ⇒ no angle-badness (narrower = harder)
export const DRAIN_BAD = 40; // hand stamina/sec when fully loaded on a fully bad hold
export const ANGLE_TOLERANCE = 1.0; // good-side cone forgiveness (higher = more forgiving)
/** Drain = DRAIN_BAD × badness × (load × LOAD_DRAIN_GAIN). The gain maps a "full limb's
 *  worth" of load (~0.25 share) on a fully-bad hold to ~DRAIN_BAD/sec. Named (was a magic
 *  `*4` in sim.ts) so the drain↔load coupling lives with the other feel knobs. */
export const LOAD_DRAIN_GAIN = 4;

// load model
export const LOAD_BELOW_BIAS = 1.8; // a contact BELOW the CoG (feet you stand on) takes more
export const LOAD_NEAR_BIAS = 1.2; // proximity-to-CoG concentrates load
/** Feet soak at most this fraction of total load; the rest is forced onto the hands.
 *  Lowered 0.62 → 0.45 so hands carry MEANINGFUL, variable weight (the neutral stance no
 *  longer parks most of it on the feet) — which is what makes shifting weight FELT. */
export const FOOT_ABSORB_MAX = 0.45;
/** Per-hand minimum load (hands never fully rest). Lowered 0.12 → 0.05 so the working
 *  range (resting → straining) is wide enough that relieving a hand is a real, felt change
 *  rather than a rounding error. Still nonzero → the clock never fully stops. */
export const HAND_MIN_LOAD = 0.05;

/** Stamina restored to a re-gripped hand that had slipped to 0 (HTML used 60%). */
export const REGRAB_STAM_FRAC = 0.6;

// ── Objective / level / camera (new in #3 — gives the verb a goal) ───────────
/** The climbable column is a fixed world width, centred in the viewport. Levels author
 *  hold x in [0, WORLD_WIDTH]. The wall scrolls vertically; +Y is DOWN (canvas-style),
 *  so the TOP of a level (the finish) is the SMALLEST y. */
export const WORLD_WIDTH = 460;

/** Camera keeps the CoG at this fraction down the viewport; lerps for smoothness. */
export const CAM_ANCHOR = 0.55;
export const CAMERA_LERP = 8;

/** After a fall, this long until the level resets to its start. */
export const FALL_RESET_DELAY = 1.0;

export const MAX_DT = 1 / 20;
