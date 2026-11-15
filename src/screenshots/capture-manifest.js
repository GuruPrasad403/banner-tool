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
      slidesMode: jobConfig.slidesMode ?? DEFAULT_CONFIG.defaultTimeouts.slidesMode,
      slidesDurationMs: jobConfig.slidesDuration ?? DEFAULT_CONFIG.defaultTimeouts.slidesDuration,
      detectedCycleMs: jobConfig.detectedCycleMs ?? null,
      slidesWaitMs: jobConfig.slidesWaitMs ?? jobConfig.slidesDuration ?? DEFAULT_CONFIG.defaultTimeouts.slidesDuration,
      slidesFreeze: jobConfig.slidesFreeze ?? null,
      overlap: jobConfig.overlap ?? DEFAULT_CONFIG.defaultOverlap
    },
    selectors: {
      rootSelector: sectionData.root?.selector,
      fixedSelectors: sectionData.fixedRegions?.map(f => f.selector) || [],
      isiSelector: sectionData.isi?.selector
    },
    isiMetrics: scrollResult.initialIsiMetrics,
    totalScreenshots: scrollResult.totalScreenshots,
    // Distinct slide frames photographed while the slides played (before
    // the ISI scrolled); the ISI screenshots below all hold slide 1.
    slideFrames: (jobConfig.slideFrames || []).map(f => ({
      index: f.index,
      file: f.file,
      url: `/output/${jobId}/slides/${f.file}`,
      atMs: f.atMs
    })),
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
