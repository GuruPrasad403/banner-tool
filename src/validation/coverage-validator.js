export function validateScrollCoverage(screenshots = [], isiMetrics = {}) {
  if (!screenshots || screenshots.length === 0) {
    return {
      ruleId: 'COVERAGE_VALIDATION',
      status: 'failed',
      severity: 'error',
      message: 'No screenshots were generated for coverage analysis.',
      details: { count: 0 }
    };
  }

  const { clientHeight = 0, scrollHeight = 0, maxScrollTop = 0 } = isiMetrics;

  if (maxScrollTop === 0 || scrollHeight <= clientHeight) {
    return {
      ruleId: 'COVERAGE_VALIDATION',
      status: 'passed',
      severity: 'info',
      message: 'ISI content is non-scrollable (scrollHeight <= clientHeight). Single frame fully covers content.',
      details: { totalScreenshots: screenshots.length, coveragePercent: 100 }
    };
  }

  // Verify first screenshot starts at 0
  const firstFrame = screenshots[0];
  if (firstFrame.scrollTop !== 0) {
    return {
      ruleId: 'COVERAGE_VALIDATION',
      status: 'failed',
      severity: 'error',
      message: `Initial screenshot did not start at scrollTop 0 (started at ${firstFrame.scrollTop}).`,
      details: { screenshots }
    };
  }

  // Verify last screenshot covers maxScrollTop
  const lastFrame = screenshots[screenshots.length - 1];
  if (Math.abs(lastFrame.scrollTop - maxScrollTop) > 2) {
    return {
      ruleId: 'COVERAGE_VALIDATION',
      status: 'failed',
      severity: 'error',
      message: `Final screenshot scrollTop (${lastFrame.scrollTop}) did not reach maximum scroll position (${maxScrollTop}).`,
      details: { lastScrollTop: lastFrame.scrollTop, maxScrollTop }
    };
  }

  // Verify no gaps between consecutive screenshots
  let currentCoveredEnd = 0;
  for (let i = 0; i < screenshots.length; i++) {
    const frame = screenshots[i];
    const frameStart = frame.scrollTop;
    const frameEnd = frame.scrollTop + clientHeight;

    if (i > 0 && frameStart > currentCoveredEnd) {
      return {
        ruleId: 'COVERAGE_VALIDATION',
        status: 'failed',
        severity: 'error',
        message: `Coverage gap detected between screenshot ${i} and ${i + 1}. Uncovered range: ${currentCoveredEnd}px to ${frameStart}px.`,
        details: { frameStart, currentCoveredEnd, screenshots }
      };
    }

    currentCoveredEnd = Math.max(currentCoveredEnd, frameEnd);
  }

  return {
    ruleId: 'COVERAGE_VALIDATION',
    status: 'passed',
    severity: 'error',
    message: `100% ISI scroll coverage verified across ${screenshots.length} screenshots. Content scrollHeight: ${scrollHeight}px.`,
    details: {
      totalScreenshots: screenshots.length,
      scrollHeight,
      clientHeight,
      maxScrollTop,
      coveragePercent: 100
    }
  };
}
