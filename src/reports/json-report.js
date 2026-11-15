import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Creates and writes validation-report.json to output directory.
 */
export async function createJsonReport(jobId, jobConfig, sectionData, validationResults, scrollResult, outputDir) {
  const report = {
    jobId,
    timestamp: new Date().toISOString(),
    status: validationResults.overallStatus,
    profile: jobConfig.profile || 'custom',
    expected: {
      width: jobConfig.expectedWidth,
      height: jobConfig.expectedHeight,
      widthTolerance: jobConfig.widthTolerance || 0,
      heightTolerance: jobConfig.heightTolerance || 0
    },
    actual: {
      width: sectionData.root?.box?.width,
      height: sectionData.root?.box?.height,
      selector: sectionData.root?.selector
    },
    sectionsDetected: {
      root: sectionData.root,
      isi: sectionData.isi,
      fixedRegions: sectionData.fixedRegions,
      candidates: sectionData.isiDetection?.candidates || []
    },
    validationSummary: validationResults.summary,
    rules: validationResults.rules,
    slidesFlow: jobConfig.slidesFlow ?? null,
    scrollMetrics: scrollResult ? {
      isiSelector: scrollResult.isiSelector,
      metrics: scrollResult.initialIsiMetrics,
      totalScreenshots: scrollResult.totalScreenshots,
      coverage: scrollResult.coverage
    } : null
  };

  const reportPath = path.join(outputDir, 'validation-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return { report, reportPath };
}
