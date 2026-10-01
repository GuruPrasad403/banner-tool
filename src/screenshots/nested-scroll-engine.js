import path from 'node:path';
import { calculateScrollPositions } from './screenshot-planner.js';
import { captureBannerFrame } from './viewport-capture.js';
import { getFixedRegionsState, compareFixedRegions } from '../browser/stability-checker.js';
import { validateScrollCoverage } from '../validation/coverage-validator.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { logger } from '../utils/logger.js';
import { BrowserError } from '../utils/errors.js';

/**
 * Core engine to systematically scroll a nested ISI container element,
 * check fixed header/body stability, capture banner screenshots, and validate coverage.
 */
export async function executeNestedScrollCapture(page, sectionData, screenshotsOutputDir, options = {}) {
  const {
    overlap = DEFAULT_CONFIG.defaultOverlap,
    settleDelay = DEFAULT_CONFIG.defaultTimeouts.scrollSettle,
    jobId = 'job'
  } = options;

  const rootSelector = sectionData.root?.selector || '#banner';
  const isiSelector = sectionData.isi?.selector || rootSelector;
  const fixedSelectors = sectionData.fixedRegions?.map((f) => f.selector) || [];

  // 1. Capture baseline fixed regions state before any scrolling
  const baselineFixedState = await getFixedRegionsState(page, fixedSelectors);

  // 2. Read initial ISI dimensions from browser context
  let initialIsiMetrics = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    return {
      scrollTop: el.scrollTop || 0,
      clientHeight: el.clientHeight || 250,
      scrollHeight: el.scrollHeight || 250,
      maxScrollTop: Math.max(0, (el.scrollHeight || 250) - (el.clientHeight || 250))
    };
  }, isiSelector);

  if (!initialIsiMetrics) {
    initialIsiMetrics = {
      scrollTop: 0,
      clientHeight: 250,
      scrollHeight: 250,
      maxScrollTop: 0
    };
  }

  const { scrollHeight, clientHeight, maxScrollTop } = initialIsiMetrics;
  const plannedPositions = calculateScrollPositions(scrollHeight, clientHeight, overlap);

  logger.info(`Nested ISI Scroll Engine planned ${plannedPositions.length} position(s): [${plannedPositions.join(', ')}]`);

  const screenshotManifestItems = [];
  const stabilityLogs = [];

  // 3. Iterate through planned scroll positions
  for (let index = 0; index < plannedPositions.length; index++) {
    const targetScrollTop = plannedPositions[index];

    // Execute scrolling inside browser page
    const actualScrollState = await page.evaluate(
      ({ selector, targetTop }) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Scroll target element not found: ${selector}`);

        el.scrollTop = targetTop;

        return {
          scrollTop: el.scrollTop,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          maxScrollTop: Math.max(0, el.scrollHeight - el.clientHeight)
        };
      },
      { selector: isiSelector, targetTop: targetScrollTop }
    );

    // Wait for scroll settling
    if (settleDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, settleDelay));
    }

    // 4. Check fixed region stability after scrolling
    const currentFixedState = await getFixedRegionsState(page, fixedSelectors);
    const stabilityComparison = compareFixedRegions(baselineFixedState, currentFixedState);
    stabilityLogs.push({ frameIndex: index + 1, stabilityComparison });

    if (!stabilityComparison.isStable) {
      logger.warn(`Fixed region shift detected on screenshot frame ${index + 1}:`, stabilityComparison.issues);
    }

    // 5. Capture complete banner frame PNG
    const padIndex = String(index + 1).padStart(3, '0');
    const filename = `${String(index + 1).padStart(2, '0')}-frame-isi-${padIndex}.png`;
    const outputPath = path.join(screenshotsOutputDir, filename);

    const captureResult = await captureBannerFrame(page, rootSelector, outputPath);

    screenshotManifestItems.push({
      index: index + 1,
      filename,
      filePath: captureResult.outputPath,
      scrollTop: actualScrollState.scrollTop,
      targetScrollTop,
      visibleRange: {
        start: actualScrollState.scrollTop,
        end: actualScrollState.scrollTop + actualScrollState.clientHeight
      },
      isiMetrics: actualScrollState,
      stability: stabilityComparison.isStable ? 'passed' : 'warning',
      stabilityDetails: stabilityComparison,
      timestamp: new Date().toISOString()
    });
  }

  // 6. Validate scroll coverage
  const coverageResult = validateScrollCoverage(screenshotManifestItems, {
    clientHeight,
    scrollHeight,
    maxScrollTop
  });

  return {
    isiSelector,
    initialIsiMetrics,
    plannedPositions,
    totalScreenshots: screenshotManifestItems.length,
    screenshots: screenshotManifestItems,
    coverage: coverageResult,
    baselineFixedState,
    stabilityLogs
  };
}
