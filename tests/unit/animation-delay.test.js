import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { waitForRenderingStability } from '../../src/browser/renderer.js';

/**
 * Minimal fake Puppeteer page: renderer only calls page.evaluate (stubbed to
 * resolve immediately) and page.addStyleTag (only when pauseAnimations=true).
 */
function createFakePage() {
  return {
    evaluate: async () => undefined,
    addStyleTag: async () => undefined
  };
}

describe('Animation Delay Configuration', () => {
  it('should define a default animation delay of 2000ms in DEFAULT_CONFIG', () => {
    expect(DEFAULT_CONFIG.defaultTimeouts.animationDelay).toBe(2000);
  });

  it('should actually wait for the configured animation delay before returning', async () => {
    const page = createFakePage();
    const start = Date.now();
    const result = await waitForRenderingStability(page, {
      settleDelay: 0,
      animationDelay: 300
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(280);
    expect(result.animationDelayApplied).toBeGreaterThanOrEqual(280);
  });

  it('should not wait when animation delay is 0 (disabled)', async () => {
    const page = createFakePage();
    const start = Date.now();
    const result = await waitForRenderingStability(page, {
      settleDelay: 0,
      animationDelay: 0
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(250);
    expect(result.animationDelayApplied).toBe(0);
  });
});
