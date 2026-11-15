/**
 * Slide-cycle computation for the slides-first flow (AUTO mode).
 *
 * Pure, dependency-free helpers so the detection maths can be unit-tested
 * without a browser. The renderer collects animation timings from the page
 * via the Web Animations API (delay / duration / iterations per animation)
 * and asks these functions how long ONE full slide cycle lasts.
 */

/** Hard cap for an auto-detected slide cycle (ms). */
export const MAX_SLIDE_CYCLE_MS = 30000;

const VALID_SLIDES_MODES = ['auto', 'manual', 'off'];

/**
 * Normalizes one timing entry's iteration count. The Web Animations API
 * reports `Infinity` for endlessly looping animations; across the
 * Puppeteer boundary it may also arrive as the string 'Infinity'. Both mean
 * "loops forever", which for ONE cycle counts as a single iteration.
 */
function normalizeIterations(iterations) {
  if (iterations === Infinity || iterations === 'Infinity') return 1;
  const n = Number(iterations);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function rawSlideCycleMs(timings) {
  if (!Array.isArray(timings)) return 0;
  let max = 0;
  for (const t of timings) {
    if (!t) continue;
    const duration = Number(t.duration);
    if (!Number.isFinite(duration) || duration <= 0) continue; // ignore duration 0 / unusable
    const delay = Number(t.delay) || 0;
    const total = delay + duration * normalizeIterations(t.iterations);
    if (total > max) max = total;
  }
  return Math.round(max);
}

/**
 * Computes ONE full slide cycle (ms) from a list of animation timings
 * ({ delay, duration, iterations }): the maximum, over all animations, of
 * delay + duration × iterations (infinite iterations count as 1). The
 * result is capped at MAX_SLIDE_CYCLE_MS. Returns 0 when no usable
 * animation timing is present (e.g. a static banner).
 */
export function computeSlideCycleMs(timings) {
  return Math.min(rawSlideCycleMs(timings), MAX_SLIDE_CYCLE_MS);
}

/**
 * Same computation as computeSlideCycleMs, but also reports the uncapped
 * value and whether the cap was applied (so callers can log the cap).
 */
export function computeSlideCycle(timings) {
  const rawMs = rawSlideCycleMs(timings);
  return {
    cycleMs: Math.min(rawMs, MAX_SLIDE_CYCLE_MS),
    rawMs,
    capped: rawMs > MAX_SLIDE_CYCLE_MS
  };
}

/**
 * Resolves the effective slides-flow mode from a (possibly missing/invalid)
 * requested mode and a slides duration:
 *  - an explicit 'auto' | 'manual' | 'off' always wins;
 *  - otherwise, an explicit slidesDuration > 0 implies 'manual'
 *    (backward compatibility with pre-slidesMode callers);
 *  - otherwise the fallback ('auto' by default) applies.
 */
export function resolveSlidesMode(slidesMode, slidesDuration, fallback = 'auto') {
  const normalized = typeof slidesMode === 'string' ? slidesMode.trim().toLowerCase() : null;
  if (VALID_SLIDES_MODES.includes(normalized)) return normalized;
  const duration = Number(slidesDuration);
  if (Number.isFinite(duration) && duration > 0) return 'manual';
  return VALID_SLIDES_MODES.includes(fallback) ? fallback : 'auto';
}

/**
 * Selects the slide frames to keep from the samples taken during the
 * slides-first wait. Each sample is { regionHash, atMs, ... } where
 * regionHash identifies the slide region's pixels (identical pixels ⇒
 * identical hash). Consecutive samples with the same hash form a state
 * run; a run that persists across at least `minStableSamples` samples is
 * a stable slide state (crossfade transitions flash through in a single
 * sample and are dropped). The LAST sample of each stable state is kept,
 * in playback order. If no run is stable (e.g. a continuously-animating
 * banner), falls back to the last sample of every run. The result is
 * capped at `maxFrames`.
 */
export function selectStableSlideFrames(samples, options = {}) {
  const { minStableSamples = 2, maxFrames = 6 } = options || {};
  if (!Array.isArray(samples) || samples.length === 0) return [];

  const groups = [];
  for (const sample of samples) {
    const last = groups[groups.length - 1];
    if (last && last.hash === sample.regionHash) {
      last.items.push(sample);
    } else {
      groups.push({ hash: sample.regionHash, items: [sample] });
    }
  }

  const stableGroups = groups.filter((g) => g.items.length >= minStableSamples);
  const chosen = stableGroups.length > 0 ? stableGroups : groups;
  const cap = Math.max(0, Number(maxFrames) || 0);
  return chosen.map((g) => g.items[g.items.length - 1]).slice(0, cap);
}
