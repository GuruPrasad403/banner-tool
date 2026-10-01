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
});
