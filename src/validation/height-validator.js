export function validateBannerHeight(actualHeight, expectedHeight, tolerance = 0) {
  const diff = Math.abs(actualHeight - expectedHeight);
  const passed = diff <= tolerance;

  if (passed) {
    return {
      ruleId: 'HEIGHT_VALIDATION',
      status: 'passed',
      severity: 'error',
      message: `Banner height ${actualHeight}px matches expected height ${expectedHeight}px (tolerance ±${tolerance}px).`,
      details: { expected: expectedHeight, actual: actualHeight, diff, tolerance }
    };
  }

  return {
    ruleId: 'HEIGHT_VALIDATION',
    status: 'failed',
    severity: 'error',
    message: `Height mismatch: Expected ${expectedHeight}px, but detected ${actualHeight}px (diff: ${diff}px).`,
    details: { expected: expectedHeight, actual: actualHeight, diff, tolerance }
  };
}
