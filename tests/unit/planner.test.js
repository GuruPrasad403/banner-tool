import { describe, it, expect } from 'vitest';
import { calculateScrollPositions } from '../../src/screenshots/screenshot-planner.js';

describe('Screenshot Planner Unit Tests', () => {
  it('should return [0] when content is non-scrollable (scrollHeight <= clientHeight)', () => {
    const positions = calculateScrollPositions(150, 200, 10);
    expect(positions).toEqual([0]);
  });

  it('should correctly calculate scroll positions with overlap', () => {
    // scrollHeight: 500, clientHeight: 200, maxScrollTop: 300, overlap: 20 -> step: 180
    const positions = calculateScrollPositions(500, 200, 20);
    expect(positions).toEqual([0, 180, 300]);
  });

  it('should always include maxScrollTop as the final scroll position', () => {
    const positions = calculateScrollPositions(450, 100, 10); // step: 90, max: 350
    expect(positions[positions.length - 1]).toBe(350);
  });

  it('should deduplicate scroll positions', () => {
    const positions = calculateScrollPositions(210, 200, 10);
    const unique = new Set(positions);
    expect(positions.length).toBe(unique.size);
  });
});
