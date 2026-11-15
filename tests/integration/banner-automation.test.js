import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createAndLoadPage } from '../../src/browser/page-loader.js';
import { waitForRenderingStability } from '../../src/browser/renderer.js';
import { detectBannerSections } from '../../src/sections/section-detector.js';
import { runValidationRules } from '../../src/validation/rule-engine.js';
import { executeNestedScrollCapture } from '../../src/screenshots/nested-scroll-engine.js';
import { closeBrowserInstance } from '../../src/browser/browser-manager.js';
import { createJobOutputDir, createJobTempDir } from '../../src/utils/paths.js';

// The US-110097 banner folder held client material that the repo owner
// deliberately removed from the repository (commit 998ba7f, 11 Oct 2026).
// It must NOT be restored; the US-110097 test below is skipped whenever the
// folder is absent and only runs where the folder exists locally.
const us110097BannerPath = path.resolve(process.cwd(), './US-110097-300x250');
const us110097BannerExists = existsSync(us110097BannerPath);

describe('Puppeteer Banner Automation Integration Test', () => {
  afterAll(async () => {
    await closeBrowserInstance();
  });

  it('should validate sample 300x250 banner and generate nested ISI screenshots', async () => {
    const fixturePath = path.resolve(process.cwd(), './fixtures/sample-banner-300x250/index.html');
    expect(existsSync(fixturePath)).toBe(true);

    const jobId = `test_integration_${Date.now()}`;
    const { jobOutputDir, screenshotsDir } = await createJobOutputDir(jobId);

    const loaded = await createAndLoadPage(fixturePath, {
      width: 300,
      height: 250,
      deviceScaleFactor: 2
    });

    await waitForRenderingStability(loaded.page);

    // 1. Detect sections
    const sectionData = await detectBannerSections(loaded.page, {
      rootSelector: '#banner',
      fixedSelectors: ['#header', '#body-copy'],
      isiSelector: '#isi-container'
    });

    expect(sectionData.root.selector).toBe('#banner');
    expect(sectionData.root.box.width).toBe(300);
    expect(sectionData.root.box.height).toBe(250);
    expect(sectionData.isi.isScrollable).toBe(true);

    // 2. Validate rules
    const validation = await runValidationRules(loaded.page, fixturePath, sectionData, {
      expectedWidth: 300,
      expectedHeight: 250
    });

    expect(validation.overallStatus).toBe('passed');

    // 3. Execute nested ISI scroll screenshot engine
    const scrollResult = await executeNestedScrollCapture(
      loaded.page,
      sectionData,
      screenshotsDir,
      { overlap: 10, jobId }
    );

    expect(scrollResult.totalScreenshots).toBeGreaterThan(1);
    expect(scrollResult.coverage.status).toBe('passed');

    // Verify screenshot file exists on disk
    const firstShot = scrollResult.screenshots[0];
    expect(existsSync(firstShot.filePath)).toBe(true);

    await loaded.page.close();
    await loaded.context.close();
  }, 30000); // 30s timeout

  // Skipped when the US-110097 folder is absent (see note at the top of this
  // file: the folder held client material the owner removed from the repo).
  it.skipIf(!us110097BannerExists)('should validate and capture US-110097 Studio banner with third-party ad loader', async () => {
    const bannerPath = us110097BannerPath;

    const jobId = `test_us110097_${Date.now()}`;
    const tempDir = await createJobTempDir(jobId);
    const { jobOutputDir, screenshotsDir } = await createJobOutputDir(jobId);

    // 1. Load from directory input
    const { loadInputSource } = await import('../../src/input/html-loader.js');
    const loadResult = await loadInputSource(bannerPath, tempDir);
    expect(existsSync(loadResult.primaryHtmlFile)).toBe(true);

    const loaded = await createAndLoadPage(loadResult.primaryHtmlFile, {
      width: 300,
      height: 250,
      deviceScaleFactor: 2
    });

    await waitForRenderingStability(loaded.page);

    // 2. Section detection should detect #wrapper and #viewport
    const sectionData = await detectBannerSections(loaded.page, {
      rootSelector: '#wrapper',
      isiSelector: '#viewport'
    });

    expect(sectionData.root.selector).toBe('#wrapper');
    expect(sectionData.root.box.width).toBe(300);
    expect(sectionData.root.box.height).toBe(250);
    expect(sectionData.isi.selector).toBe('#viewport');
    expect(sectionData.isi.isScrollable).toBe(true);

    // 3. Validation should pass
    const validation = await runValidationRules(loaded.page, loadResult.primaryHtmlFile, sectionData, {
      expectedWidth: 300,
      expectedHeight: 250
    });

    expect(validation.overallStatus).toBe('passed');

    await loaded.page.close();
    await loaded.context.close();
  }, 35000);

  it('should auto-detect and capture dynamic grid banner out of the box with zero user selectors', async () => {
    const fixturePath = path.resolve(process.cwd(), './fixtures/sample-banner-dynamic-300x250/index.html');
    expect(existsSync(fixturePath)).toBe(true);

    const jobId = `test_dynamic_${Date.now()}`;
    const { screenshotsDir } = await createJobOutputDir(jobId);

    const loaded = await createAndLoadPage(fixturePath, {
      width: 300,
      height: 250,
      deviceScaleFactor: 2
    });

    await waitForRenderingStability(loaded.page);

    // 1. Detect sections with ZERO user selectors (empty config)
    const sectionData = await detectBannerSections(loaded.page, {});

    expect(sectionData.root.selector).toBe('#ad-stage');
    expect(sectionData.root.box.width).toBe(300);
    expect(sectionData.root.box.height).toBe(250);
    expect(sectionData.isi.selector).toBe('#safety-scroll-pane');
    expect(sectionData.isi.isScrollable).toBe(true);

    // Verify fixed regions detected (header, body, footer)
    expect(sectionData.fixedRegions.length).toBeGreaterThanOrEqual(2);

    // 2. Validate rules
    const validation = await runValidationRules(loaded.page, fixturePath, sectionData, {
      expectedWidth: 300,
      expectedHeight: 250
    });

    expect(validation.overallStatus).toBe('passed');

    // 3. Capture nested ISI scroll frames
    const scrollResult = await executeNestedScrollCapture(
      loaded.page,
      sectionData,
      screenshotsDir,
      { overlap: 10, jobId }
    );

    expect(scrollResult.totalScreenshots).toBeGreaterThan(1);
    expect(scrollResult.coverage.status).toBe('passed');
    expect(existsSync(scrollResult.screenshots[0].filePath)).toBe(true);

    await loaded.page.close();
    await loaded.context.close();
  }, 35000);
});
