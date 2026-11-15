import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG } from '../config/defaults.js';

/**
 * Builds and writes screenshot-manifest.json to the output directory.
 */
export async function createCaptureManifest(jobId, jobConfig, sectionData, scrollResult, outputDir) {
  const manifest = {
    jobId,
    timestamp: new Date().toISOString(),
    profile: jobConfig.profile || 'custom',
    dimensions: {
      cssWidth: jobConfig.expectedWidth,
      cssHeight: jobConfig.expectedHeight,
      deviceScaleFactor: jobConfig.deviceScaleFactor || 2
    },
    captureSettings: {
      animationDelayMs: jobConfig.animationDelay ?? DEFAULT_CONFIG.defaultTimeouts.animationDelay,
      overlap: jobConfig.overlap ?? DEFAULT_CONFIG.defaultOverlap
    },
    selectors: {
      rootSelector: sectionData.root?.selector,
      fixedSelectors: sectionData.fixedRegions?.map(f => f.selector) || [],
      isiSelector: sectionData.isi?.selector
    },
    isiMetrics: scrollResult.initialIsiMetrics,
    totalScreenshots: scrollResult.totalScreenshots,
    coverageStatus: scrollResult.coverage.status,
    coverageDetails: scrollResult.coverage,
    screenshots: scrollResult.screenshots.map(s => ({
      index: s.index,
      filename: s.filename,
      scrollTop: s.scrollTop,
      targetScrollTop: s.targetScrollTop,
      visibleRange: s.visibleRange,
      stability: s.stability
    }))
  };

  const manifestPath = path.join(outputDir, 'screenshot-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return { manifest, manifestPath };
}
