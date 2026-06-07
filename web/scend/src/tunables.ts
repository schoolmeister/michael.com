/**
 * tunables.ts — the subset of config that the in-game CONFIG menu edits live. These are
 * mutable (a plain object, not `const`) so the menu can change them at runtime; sim.ts and
 * world.ts read from TUNE so a new run immediately reflects any tweak. Everything else stays
 * in config.ts as fixed consts.
 */

export const TUNE = {
  baseSpeed: 360,
  rampGain: 4, // cranked — you accelerate hard
  jumpV: 1010,
  gravity: 3000,
  platMin: 3, // path platform length (tiles) — ↑ less scarce
  platMax: 7,
  gapDrop: 0.011, // (legacy) gap width per px/s of speed
  gapScale: 0.8, // ×the landing-aligned gap. <1 = platforms closer together (less scarce)
  patternChance: 0.12, // chance/segment to start a 1-tile-step / staircase pattern (0 = off)
  multiFloor: 1, // how often platforms span MULTIPLE floors at once (parallel options)
  spikeClusterF: 0.42, // adjacent-spike run length as a fraction of jump reach (scales w/ speed)
  hazardEnd: 0.25, // ↑ harder: more hazards late
  ghostEnd: 0.42,
  bootsBoost: 39, // ↓ another 30% (effectiveness cut; they drop more often instead)
  invulnDur: 1.6, // seconds of "ram-through everything" after a speed boost
  geyserUnlock: 300, // geysers/lava appear sooner
  ghostUnlock: 660,
  zoomMin: 0.62
};

export type TuneKey = keyof typeof TUNE;

export interface TuneField {
  key: TuneKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** how many decimals to show */
  dp?: number;
}

/** Order + bounds for the config menu. */
export const TUNE_FIELDS: TuneField[] = [
  { key: 'baseSpeed', label: 'Base speed', min: 120, max: 900, step: 20 },
  { key: 'rampGain', label: 'Speed ramp', min: 0, max: 5, step: 0.1, dp: 1 },
  { key: 'jumpV', label: 'Jump power', min: 600, max: 1500, step: 20 },
  { key: 'gravity', label: 'Gravity', min: 1500, max: 5000, step: 100 },
  { key: 'platMin', label: 'Platform min', min: 1, max: 14, step: 1 },
  { key: 'platMax', label: 'Platform max', min: 2, max: 22, step: 1 },
  { key: 'gapScale', label: 'Gap scale', min: 0.4, max: 1.4, step: 0.05, dp: 2 },
  { key: 'patternChance', label: 'Stair patterns', min: 0, max: 0.5, step: 0.02, dp: 2 },
  { key: 'multiFloor', label: 'Multi-floor freq', min: 0, max: 1, step: 0.05, dp: 2 },
  { key: 'spikeClusterF', label: 'Spike cluster', min: 0, max: 1, step: 0.04, dp: 2 },
  { key: 'hazardEnd', label: 'Hazard density', min: 0, max: 0.9, step: 0.02, dp: 2 },
  { key: 'ghostEnd', label: 'Ghost density', min: 0, max: 0.9, step: 0.02, dp: 2 },
  { key: 'bootsBoost', label: 'Boost pickup +', min: 0, max: 200, step: 8 },
  { key: 'invulnDur', label: 'Invuln time', min: 0, max: 5, step: 0.2, dp: 1 },
  { key: 'geyserUnlock', label: 'Geyser @ speed', min: 0, max: 1500, step: 40 },
  { key: 'ghostUnlock', label: 'Ghost @ speed', min: 0, max: 1500, step: 40 },
  { key: 'zoomMin', label: 'Max zoom-out', min: 0.4, max: 1, step: 0.02, dp: 2 }
];

export function adjustTune(field: TuneField, dir: 1 | -1): void {
  const v = TUNE[field.key] + dir * field.step;
  TUNE[field.key] = Math.max(field.min, Math.min(field.max, Math.round(v / field.step) * field.step));
}

export function formatTune(field: TuneField): string {
  return TUNE[field.key].toFixed(field.dp ?? 0);
}
