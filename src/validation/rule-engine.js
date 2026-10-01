import { validateBannerWidth } from './width-validator.js';
import { validateBannerHeight } from './height-validator.js';
import { validateHorizontalOverflow } from './overflow-validator.js';
import { validateFixedRegionStability } from './fixed-region-validator.js';
import { validateScrollCoverage } from './coverage-validator.js';
import { auditBannerAssets } from '../input/asset-resolver.js';

export async function runValidationRules(page, htmlFilePath, sectionData, config = {}) {
  const {
    expectedWidth = 300,
    expectedHeight = 250,
    widthTolerance = 0,
    heightTolerance = 0
  } = config;

  const rules = [];

  // 1. Root Element Rule
  if (!sectionData.root || !sectionData.root.box) {
    rules.push({
      ruleId: 'ROOT_ELEMENT_EXISTS',
      status: 'failed',
      severity: 'error',
      message: 'Banner root element could not be found.',
      details: {}
    });
  } else {
    rules.push({
      ruleId: 'ROOT_ELEMENT_EXISTS',
      status: 'passed',
      severity: 'error',
      message: `Banner root element detected: "${sectionData.root.selector}" (${sectionData.root.reason}).`,
      details: sectionData.root
    });

    // 2. Width Rule
    const widthRes = validateBannerWidth(sectionData.root.box.width, expectedWidth, widthTolerance);
    rules.push(widthRes);

    // 3. Height Rule
    const heightRes = validateBannerHeight(sectionData.root.box.height, expectedHeight, heightTolerance);
    rules.push(heightRes);
  }

  // 4. Horizontal Overflow Rule
  try {
    const overflowRes = await validateHorizontalOverflow(page, sectionData.root?.selector);
    rules.push(overflowRes);
  } catch (err) {
    rules.push({
      ruleId: 'HORIZONTAL_OVERFLOW',
      status: 'skipped',
      severity: 'warning',
      message: `Could not evaluate overflow: ${err.message}`,
      details: {}
    });
  }

  // 5. ISI Scrollable Container Rule
  if (!sectionData.isi) {
    rules.push({
      ruleId: 'ISI_ELEMENT_EXISTS',
      status: 'failed',
      severity: 'error',
      message: 'No ISI element or candidates could be located.',
      details: {}
    });
  } else {
    rules.push({
      ruleId: 'ISI_ELEMENT_EXISTS',
      status: 'passed',
      severity: 'error',
      message: `ISI container found: "${sectionData.isi.selector}" (${sectionData.isiDetection.reason}).`,
      details: sectionData.isi
    });

    if (sectionData.isi.isScrollable) {
      rules.push({
        ruleId: 'ISI_SCROLLABLE',
        status: 'passed',
        severity: 'info',
        message: `ISI container is scrollable (scrollHeight: ${sectionData.isi.scrollHeight}px > clientHeight: ${sectionData.isi.clientHeight}px).`,
        details: sectionData.isi
      });
    } else {
      rules.push({
        ruleId: 'ISI_SCROLLABLE',
        status: 'warning',
        severity: 'warning',
        message: `ISI container is present but not scrollable (scrollHeight: ${sectionData.isi.scrollHeight}px <= clientHeight: ${sectionData.isi.clientHeight}px).`,
        details: sectionData.isi
      });
    }
  }

  // 6. Asset Audit Rule
  const assetAudit = await auditBannerAssets(htmlFilePath);
  if (assetAudit.missingCount > 0) {
    rules.push({
      ruleId: 'ASSET_INTEGRITY',
      status: 'warning',
      severity: 'warning',
      message: `Detected ${assetAudit.missingCount} missing referenced asset(s).`,
      details: assetAudit.missingAssets
    });
  } else {
    rules.push({
      ruleId: 'ASSET_INTEGRITY',
      status: 'passed',
      severity: 'info',
      message: `All ${assetAudit.totalReferences} referenced assets exist locally.`,
      details: { count: assetAudit.totalReferences }
    });
  }

  // Summary status calculation
  const hasFailures = rules.some(r => r.status === 'failed');
  const hasWarnings = rules.some(r => r.status === 'warning');

  const overallStatus = hasFailures ? 'failed' : (hasWarnings ? 'passed_with_warnings' : 'passed');

  return {
    overallStatus,
    summary: {
      total: rules.length,
      passed: rules.filter(r => r.status === 'passed').length,
      failed: rules.filter(r => r.status === 'failed').length,
      warnings: rules.filter(r => r.status === 'warning').length,
      skipped: rules.filter(r => r.status === 'skipped').length
    },
    rules
  };
}
