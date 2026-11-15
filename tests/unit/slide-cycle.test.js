import { describe, it, expect } from 'vitest';
import {
  computeSlideCycleMs,
  computeSlideCycle,
  resolveSlidesMode,
  MAX_SLIDE_CYCLE_MS
} from '../../src/browser/slide-cycle.js';

describe('Slide Cycle Computation (auto slides-mode detection)', () => {
  it('should return the duration of a single infinitely-looping animation', () => {
    expect(computeSlideCycleMs([{ delay: 0, duration: 6000, iterations: Infinity }])).toBe(6000);
  });

  it('should treat the string "Infinity" iterations marker as one cycle', () => {
    expect(computeSlideCycleMs([{ delay: 0, duration: 6000, iterations: 'Infinity' }])).toBe(6000);
  });

  it('should take the max of delay + duration across staggered infinite animations', () => {
    const timings = [
      { delay: 0, duration: 6000, iterations: Infinity },
      { delay: 2000, duration: 6000, iterations: Infinity },
      { delay: 4000, duration: 6000, iterations: Infinity }
    ];
    expect(computeSlideCycleMs(timings)).toBe(10000);
  });

  it('should multiply duration by finite iteration counts and add the delay', () => {
    expect(computeSlideCycleMs([{ delay: 500, duration: 1000, iterations: 3 }])).toBe(3500);
  });

  it('should return 0 for an empty timing list (static banner)', () => {
    expect(computeSlideCycleMs([])).toBe(0);
  });

  it('should return 0 for missing or unusable input', () => {
    expect(computeSlideCycleMs(undefined)).toBe(0);
    expect(computeSlideCycleMs(null)).toBe(0);
    expect(computeSlideCycleMs([{ delay: 0, duration: 0, iterations: Infinity }])).toBe(0);
  });

  it('should cap a huge computed cycle at MAX_SLIDE_CYCLE_MS', () => {
    const timings = [{ delay: 0, duration: 60000, iterations: 5 }]; // raw 300000
    expect(computeSlideCycleMs(timings)).toBe(MAX_SLIDE_CYCLE_MS);
    expect(MAX_SLIDE_CYCLE_MS).toBe(30000);

    const detailed = computeSlideCycle(timings);
    expect(detailed.cycleMs).toBe(30000);
    expect(detailed.rawMs).toBe(300000);
    expect(detailed.capped).toBe(true);
  });

  it('should report capped=false when the cycle is under the cap', () => {
    const detailed = computeSlideCycle([{ delay: 0, duration: 6000, iterations: Infinity }]);
    expect(detailed).toEqual({ cycleMs: 6000, rawMs: 6000, capped: false });
  });
});

describe('Slides Mode Resolution', () => {
  it('should honour an explicit mode', () => {
    expect(resolveSlidesMode('auto', 0)).toBe('auto');
    expect(resolveSlidesMode('manual', 6000)).toBe('manual');
    expect(resolveSlidesMode('off', 6000)).toBe('off');
    expect(resolveSlidesMode('AUTO', 0)).toBe('auto');
  });

  it('should imply manual when slidesDuration > 0 and no mode is given (backward compatibility)', () => {
    expect(resolveSlidesMode(undefined, 6000)).toBe('manual');
    expect(resolveSlidesMode(null, 1)).toBe('manual');
    expect(resolveSlidesMode('bogus', 6000)).toBe('manual');
  });

  it('should fall back to auto when neither mode nor duration is given', () => {
    expect(resolveSlidesMode(undefined, 0)).toBe('auto');
    expect(resolveSlidesMode(undefined, undefined)).toBe('auto');
    expect(resolveSlidesMode('bogus', 0)).toBe('auto');
  });
});
