export async function validateHorizontalOverflow(page, rootSelector) {
  const result = await page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    const bodyScrollWidth = document.body.scrollWidth;
    const bodyClientWidth = document.body.clientWidth;
    const rootScrollWidth = root.scrollWidth;
    const rootClientWidth = root.clientWidth;
    const rootOffsetWidth = root.offsetWidth || rootClientWidth;
    const rootOverflowX = window.getComputedStyle(root).overflowX;

    const hasPageOverflow = bodyScrollWidth > bodyClientWidth + 1;
    // Allow for borders (offsetWidth) and subpixel rounding (1px tolerance)
    const hasRootOverflow = !['hidden', 'clip'].includes(rootOverflowX) && (rootScrollWidth > Math.max(rootClientWidth, rootOffsetWidth) + 1);

    return {
      hasPageOverflow,
      hasRootOverflow,
      bodyScrollWidth,
      bodyClientWidth,
      rootScrollWidth,
      rootClientWidth,
      rootOffsetWidth
    };
  }, rootSelector);

  if (result.hasPageOverflow || result.hasRootOverflow) {
    return {
      ruleId: 'HORIZONTAL_OVERFLOW',
      status: 'failed',
      severity: 'error',
      message: `Horizontal overflow detected! Page scrollWidth (${result.bodyScrollWidth}px) exceeds clientWidth (${result.bodyClientWidth}px).`,
      details: result
    };
  }

  return {
    ruleId: 'HORIZONTAL_OVERFLOW',
    status: 'passed',
    severity: 'error',
    message: 'No horizontal overflow detected.',
    details: result
  };
}
