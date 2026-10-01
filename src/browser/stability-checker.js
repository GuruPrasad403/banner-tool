import { logger } from '../utils/logger.js';

/**
 * Measures current bounding boxes of specified fixed section selectors.
 */
export async function getFixedRegionsState(page, selectors = []) {
  if (!selectors || selectors.length === 0) return [];

  return await page.evaluate((selList) => {
    return selList.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) {
        return {
          selector: sel,
          exists: false,
          visible: false,
          box: null
        };
      }

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

      return {
        selector: sel,
        exists: true,
        visible,
        box: {
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100
        },
        textSnippet: (el.innerText || el.textContent || '').trim().substring(0, 40)
      };
    });
  }, selectors);
}

/**
 * Compares current fixed regions state against baseline state to detect layout shifts.
 */
export function compareFixedRegions(baseline, current, tolerance = 1.0) {
  const issues = [];
  const results = [];

  for (const baseItem of baseline) {
    const curItem = current.find((c) => c.selector === baseItem.selector);

    if (!curItem) {
      issues.push({
        type: 'FIXED_REGION_MISSING',
        selector: baseItem.selector,
        message: `Fixed region element "${baseItem.selector}" missing in current state.`
      });
      results.push({ selector: baseItem.selector, status: 'failed', reason: 'MISSING' });
      continue;
    }

    if (!baseItem.exists || !curItem.exists) {
      issues.push({
        type: 'FIXED_REGION_NOT_FOUND',
        selector: baseItem.selector,
        message: `Fixed region element "${baseItem.selector}" could not be located in DOM.`
      });
      results.push({ selector: baseItem.selector, status: 'failed', reason: 'NOT_FOUND' });
      continue;
    }

    if (!curItem.visible) {
      issues.push({
        type: 'FIXED_REGION_HIDDEN',
        selector: baseItem.selector,
        message: `Fixed region element "${baseItem.selector}" became invisible during scroll.`
      });
      results.push({ selector: baseItem.selector, status: 'failed', reason: 'HIDDEN' });
      continue;
    }

    // Compare bounding box coordinates with floating point tolerance
    const dx = Math.abs(curItem.box.x - baseItem.box.x);
    const dy = Math.abs(curItem.box.y - baseItem.box.y);
    const dw = Math.abs(curItem.box.width - baseItem.box.width);
    const dh = Math.abs(curItem.box.height - baseItem.box.height);

    if (dx > tolerance || dy > tolerance || dw > tolerance || dh > tolerance) {
      const msg = `Layout shift detected in fixed region "${baseItem.selector}": ` +
        `Baseline (${baseItem.box.x}, ${baseItem.box.y}, ${baseItem.box.width}x${baseItem.box.height}) vs ` +
        `Current (${curItem.box.x}, ${curItem.box.y}, ${curItem.box.width}x${curItem.box.height})`;
      
      issues.push({
        type: 'FIXED_REGION_LAYOUT_SHIFT',
        selector: baseItem.selector,
        message: msg,
        baseline: baseItem.box,
        current: curItem.box
      });

      results.push({
        selector: baseItem.selector,
        status: 'failed',
        reason: 'LAYOUT_SHIFT',
        baseline: baseItem.box,
        current: curItem.box
      });
    } else {
      results.push({
        selector: baseItem.selector,
        status: 'passed',
        box: curItem.box
      });
    }
  }

  return {
    isStable: issues.length === 0,
    issues,
    results
  };
}
