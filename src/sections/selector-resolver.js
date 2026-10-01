import { DEFAULT_CONFIG } from '../config/defaults.js';

/**
 * Resolves element matching given selector or candidate list on page.
 */
export async function resolveElementSelector(page, selectors = []) {
  if (typeof selectors === 'string') {
    selectors = [selectors];
  }

  return await page.evaluate((selArray) => {
    for (const sel of selArray) {
      if (!sel) continue;
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        return {
          selector: sel,
          found: true,
          tagName: el.tagName.toLowerCase(),
          id: el.id || null,
          className: el.className || null,
          box: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      }
    }
    return { found: false, selector: null };
  }, selectors);
}
