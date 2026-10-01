export function validateBannerWidth(actualWidth, expectedWidth, tolerance = 0) {
  const diff = Math.abs(actualWidth - expectedWidth);
  const passed = diff <= tolerance;

  if (passed) {
    return {
      ruleId: 'WIDTH_VALIDATION',
      status: 'passed',
      severity: 'error',
      message: `Banner width ${actualWidth}px matches expected width ${expectedWidth}px (tolerance ±${tolerance}px).`,
      details: { expected: expectedWidth, actual: actualWidth, diff, tolerance }
    };
  }

  return {
    ruleId: 'WIDTH_VALIDATION',
    status: 'failed',
    severity: 'error',
    message: `Width mismatch: Expected ${expectedWidth}px, but detected ${actualWidth}px (diff: ${diff}px).`,
    details: { expected: expectedWidth, actual: actualWidth, diff, tolerance }
  };
}
