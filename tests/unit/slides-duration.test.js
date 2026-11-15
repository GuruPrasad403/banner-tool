import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { waitForRenderingStability } from '../../src/browser/renderer.js';
import { createCaptureManifest } from '../../src/screenshots/capture-manifest.js';

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

describe('Slides Duration Configuration (slides-first flow)', () => {
  it('should default slidesDuration to 0 (off) in DEFAULT_CONFIG', () => {
    expect(DEFAULT_CONFIG.defaultTimeouts.slidesDuration).toBe(0);
  });

  it('should wait the full slides duration and attempt the slide-1 freeze when enabled', async () => {
    const page = createFakePage();
    const start = Date.now();
    const result = await waitForRenderingStability(page, {
      settleDelay: 0,
      animationDelay: 0,
      slidesDuration: 300
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(280);
    expect(result.slidesDurationApplied).toBeGreaterThanOrEqual(280);
    expect(result.slidesFreeze).not.toBeNull();
    expect(result.slidesFreeze.attempted).toBe(true);
  });

  it('should record an honest freeze warning when no animations can be frozen', async () => {
    const page = createFakePage();
    const result = await waitForRenderingStability(page, {
      settleDelay: 0,
      animationDelay: 0,
      slidesDuration: 50
    });

    // Fake page has no animations: the freeze must NOT pretend it worked.
    expect(result.slidesFreeze.animationsFound).toBe(0);
    expect(result.slidesFreeze.animationsPaused).toBe(0);
    expect(result.slidesFreeze.warning).toBeTruthy();
  });

  it('should skip the slides-first flow entirely when slidesDuration is 0', async () => {
    const page = createFakePage();
    const start = Date.now();
    const result = await waitForRenderingStability(page, {
      settleDelay: 0,
      animationDelay: 0,
      slidesDuration: 0
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(250);
    expect(result.slidesDurationApplied).toBe(0);
    expect(result.slidesFreeze).toBeNull();
    expect(result.isiScrollTopSamples).toEqual([]);
  });

  it('should default slidesMode to auto in DEFAULT_CONFIG', () => {
    expect(DEFAULT_CONFIG.defaultTimeouts.slidesMode).toBe('auto');
  });

  it('should skip the flow in auto mode when no slide animations are detected', async () => {
    const page = createFakePage();
    const start = Date.now();
    const result = await waitForRenderingStability(page, {
      settleDelay: 0,
      animationDelay: 0
      // no slidesMode / slidesDuration: defaults apply (auto, 0)
    });
    const elapsed = Date.now() - start;

    expect(result.slidesMode).toBe('auto');
    expect(result.detectedCycleMs).toBe(0);
    expect(result.slidesEffectiveWaitMs).toBe(0);
    expect(result.slidesDurationApplied).toBe(0);
    expect(result.slidesFreeze).toBeNull();
    expect(elapsed).toBeLessThan(250);
  });

  it('should record slidesMode, detectedCycleMs and slidesWaitMs in the capture manifest', async () => {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'manifest-test-'));
    const jobConfig = {
      profile: 'mobile-small',
      expectedWidth: 300,
      expectedHeight: 250,
      deviceScaleFactor: 2,
      overlap: 10,
      animationDelay: 0,
      slidesMode: 'auto',
      slidesDuration: 0,
      detectedCycleMs: 6000,
      slidesWaitMs: 6001,
      slidesFreeze: {
        attempted: true,
        isiFound: true,
        isiSelector: '#isi-container',
        animationsFound: 3,
        animationsPaused: 3,
        gsapFound: false,
        gsapPaused: false,
        warning: null
      }
    };
    const sectionData = {
      root: { selector: '#banner' },
      fixedRegions: [{ selector: '#header' }],
      isi: { selector: '#isi-container' }
    };
    const scrollResult = {
      initialIsiMetrics: { scrollTop: 0, clientHeight: 90, scrollHeight: 600, maxScrollTop: 510 },
      totalScreenshots: 1,
      coverage: { status: 'passed' },
      screenshots: []
    };

    const { manifest } = await createCaptureManifest('job_test_auto', jobConfig, sectionData, scrollResult, outputDir);

    expect(manifest.captureSettings.slidesMode).toBe('auto');
    expect(manifest.captureSettings.detectedCycleMs).toBe(6000);
    expect(manifest.captureSettings.slidesWaitMs).toBe(6001);
    expect(manifest.captureSettings.slidesDurationMs).toBe(0);

    await fs.rm(outputDir, { recursive: true, force: true });
  });

  it('should record slidesDurationMs and the freeze result in the capture manifest', async () => {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'manifest-test-'));
    const jobConfig = {
      profile: 'mobile-small',
      expectedWidth: 300,
      expectedHeight: 250,
      deviceScaleFactor: 2,
      overlap: 10,
      animationDelay: 0,
      slidesDuration: 6000,
      slidesFreeze: {
        attempted: true,
        isiFound: true,
        isiSelector: '#isi-container',
        animationsFound: 3,
        animationsPaused: 3,
        gsapFound: false,
        gsapPaused: false,
        warning: null
      }
    };
    const sectionData = {
      root: { selector: '#banner' },
      fixedRegions: [{ selector: '#header' }],
      isi: { selector: '#isi-container' }
    };
    const scrollResult = {
      initialIsiMetrics: { scrollTop: 0, clientHeight: 90, scrollHeight: 600, maxScrollTop: 510 },
      totalScreenshots: 1,
      coverage: { status: 'passed' },
      screenshots: []
    };

    const { manifest } = await createCaptureManifest('job_test', jobConfig, sectionData, scrollResult, outputDir);

    expect(manifest.captureSettings.slidesDurationMs).toBe(6000);
    expect(manifest.captureSettings.slidesFreeze.animationsFound).toBe(3);
    expect(manifest.captureSettings.slidesFreeze.animationsPaused).toBe(3);

    await fs.rm(outputDir, { recursive: true, force: true });
  });
});
