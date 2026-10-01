import { DEFAULT_CONFIG } from '../config/defaults.js';
import { logger } from '../utils/logger.js';

/**
 * Runs multi-priority section detection on the loaded Puppeteer page.
 */
export async function detectBannerSections(page, userConfig = {}) {
  const {
    rootSelector: userRoot,
    fixedSelectors: userFixed = [],
    isiSelector: userIsi
  } = userConfig;

  return await page.evaluate(
    ({ userRoot, userFixed, userIsi, defaultKnown }) => {
      const generateCssSelector = (el) => {
        if (!el) return null;
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === 'string' && el.className.trim()) {
          const classes = el.className.trim().split(/\s+/).join('.');
          return `${el.tagName.toLowerCase()}.${classes}`;
        }
        return el.tagName.toLowerCase();
      };

      // 1. Detect Root Banner Element
      let rootEl = null;
      let rootReason = '';
      let rootConfidence = 0;

      if (userRoot && document.querySelector(userRoot)) {
        rootEl = document.querySelector(userRoot);
        rootReason = `Priority 1: User explicit config (${userRoot})`;
        rootConfidence = 100;
      } else {
        const dataRoot = document.querySelector('[data-banner-section="root"]');
        if (dataRoot) {
          rootEl = dataRoot;
          rootReason = 'Priority 2: Semantic attribute [data-banner-section="root"]';
          rootConfidence = 95;
        } else {
          for (const sel of defaultKnown.root) {
            const found = document.querySelector(sel);
            if (found) {
              rootEl = found;
              rootReason = `Priority 3: Known selector pattern (${sel})`;
              rootConfidence = 85;
              break;
            }
          }
        }
      }

      if (!rootEl) {
        rootEl = document.body;
        rootReason = 'Priority 4: Heuristic fallback (document.body)';
        rootConfidence = 50;
      }

      const rootSelector = generateCssSelector(rootEl);
      const rootRect = rootEl.getBoundingClientRect();
      const rootComputed = window.getComputedStyle(rootEl);

      // 2. Detect Scrollable ISI Element
      let isiEl = null;
      let isiReason = '';
      let isiConfidence = 0;
      const candidates = [];

      // Check user explicit ISI
      if (userIsi && document.querySelector(userIsi)) {
        isiEl = document.querySelector(userIsi);
        isiReason = `Priority 1: User explicit config (${userIsi})`;
        isiConfidence = 100;
      }

      // Check semantic attribute
      if (!isiEl) {
        const dataIsi = document.querySelector('[data-banner-section="isi"]');
        if (dataIsi) {
          isiEl = dataIsi;
          isiReason = 'Priority 2: Semantic attribute [data-banner-section="isi"]';
          isiConfidence = 95;
        }
      }

      // Check known selectors
      if (!isiEl) {
        for (const sel of defaultKnown.isi) {
          const found = document.querySelector(sel);
          if (found) {
            isiEl = found;
            isiReason = `Priority 3: Known selector pattern (${sel})`;
            isiConfidence = 85;
            break;
          }
        }
      }

      // Priority 4: DOM Heuristic Scan for scrollable candidates
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollableStyle = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
        const hasScrollableHeight = el.scrollHeight > el.clientHeight + 2;
        const text = (el.innerText || el.textContent || '').toLowerCase();
        const hasIsiKeywords = text.includes('safety') || text.includes('isi') || text.includes('indication') || text.includes('prescribing');

        if (isScrollableStyle || (hasScrollableHeight && el !== document.documentElement && el !== document.body)) {
          let score = 0;
          if (isScrollableStyle) score += 40;
          if (hasScrollableHeight) score += 40;
          if (hasIsiKeywords) score += 20;

          const candidateSelector = generateCssSelector(el);
          candidates.push({
            selector: candidateSelector,
            id: el.id || null,
            className: el.className || null,
            overflowY,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            maxScrollTop: el.scrollHeight - el.clientHeight,
            isScrollable: el.scrollHeight > el.clientHeight,
            confidence: score,
            reason: `Overflow: ${overflowY}, ScrollHeight: ${el.scrollHeight}px, ClientHeight: ${el.clientHeight}px`
          });
        }
      }

      // Sort candidates by confidence descending
      candidates.sort((a, b) => b.confidence - a.confidence);

      if (!isiEl && candidates.length > 0) {
        const topCandidate = candidates[0];
        isiEl = document.querySelector(topCandidate.selector);
        isiReason = `Priority 4: Heuristic DOM scan (${topCandidate.reason})`;
        isiConfidence = topCandidate.confidence;
      }

      const isiSelector = generateCssSelector(isiEl);
      let isiMetrics = null;

      if (isiEl) {
        const rect = isiEl.getBoundingClientRect();
        isiMetrics = {
          selector: isiSelector,
          exists: true,
          scrollHeight: isiEl.scrollHeight,
          clientHeight: isiEl.clientHeight,
          maxScrollTop: Math.max(0, isiEl.scrollHeight - isiEl.clientHeight),
          isScrollable: isiEl.scrollHeight > isiEl.clientHeight,
          box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        };
      }

      // 3. Detect Fixed Regions (Header, Body)
      const fixedRegions = [];

      // Add user specified fixed selectors
      if (userFixed && userFixed.length > 0) {
        for (const sel of userFixed) {
          const el = document.querySelector(sel);
          if (el) {
            const rect = el.getBoundingClientRect();
            fixedRegions.push({
              selector: sel,
              reason: 'User explicit fixed selector',
              box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            });
          }
        }
      }

      // Auto-detect header if missing
      if (!fixedRegions.some((f) => f.selector.includes('header'))) {
        for (const sel of defaultKnown.header) {
          const el = document.querySelector(sel);
          if (el) {
            const rect = el.getBoundingClientRect();
            fixedRegions.push({
              selector: sel,
              reason: `Detected header selector (${sel})`,
              box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            });
            break;
          }
        }
      }

      // Auto-detect body if missing
      if (!fixedRegions.some((f) => f.selector.includes('body'))) {
        for (const sel of defaultKnown.body) {
          const el = document.querySelector(sel);
          if (el) {
            const rect = el.getBoundingClientRect();
            fixedRegions.push({
              selector: sel,
              reason: `Detected body-copy selector (${sel})`,
              box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            });
            break;
          }
        }
      }

      return {
        root: {
          selector: rootSelector,
          reason: rootReason,
          confidence: rootConfidence,
          box: {
            x: rootRect.x,
            y: rootRect.y,
            width: rootRect.width,
            height: rootRect.height
          },
          computed: {
            width: rootComputed.width,
            height: rootComputed.height,
            boxSizing: rootComputed.boxSizing,
            overflowX: rootComputed.overflowX,
            overflowY: rootComputed.overflowY
          }
        },
        isi: isiMetrics,
        isiDetection: {
          selector: isiSelector,
          reason: isiReason,
          confidence: isiConfidence,
          candidates
        },
        fixedRegions
      };
    },
    {
      userRoot,
      userFixed,
      userIsi,
      defaultKnown: DEFAULT_CONFIG.knownSelectors
    }
  );
}
