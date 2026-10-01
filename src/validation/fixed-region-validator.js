import { compareFixedRegions } from '../browser/stability-checker.js';

export function validateFixedRegionStability(baselineRegions, currentRegions) {
  const comparison = compareFixedRegions(baselineRegions, currentRegions);

  if (!comparison.isStable) {
    return {
      ruleId: 'FIXED_REGION_STABILITY',
      status: 'failed',
      severity: 'error',
      message: `Fixed region instability detected across ISI scroll frames! ${comparison.issues.length} issue(s) found.`,
      details: {
        issues: comparison.issues,
        results: comparison.results
      }
    };
  }

  return {
    ruleId: 'FIXED_REGION_STABILITY',
    status: 'passed',
    severity: 'error',
    message: 'Fixed regions (Header, Body) remained 100% stable across all scroll positions.',
    details: { results: comparison.results }
  };
}
