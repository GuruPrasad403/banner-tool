/**
 * Calculates scroll positions for nested ISI content with configurable overlap
 * and optional content-aware boundary adjustments.
 */
export function calculateScrollPositions(scrollHeight, clientHeight, overlap = 10) {
  if (scrollHeight <= clientHeight) {
    return [0];
  }

  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  const step = Math.max(1, clientHeight - overlap);
  const positions = [];

  for (let y = 0; y < maxScrollTop; y += step) {
    positions.push(Math.round(y));
  }

  // Ensure final scroll position is included
  positions.push(Math.round(maxScrollTop));

  // Deduplicate and return ordered list
  return [...new Set(positions)].sort((a, b) => a - b);
}

/**
 * Advanced content-aware screenshot planning.
 * Inspects block level elements (paragraphs, headings) inside the ISI container
 * to adjust scroll steps near natural text breaks when possible.
 */
export async function calculateContentAwarePositions(page, isiSelector, overlap = 10) {
  const isiData = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;

    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

    // Find block-level content offsets
    const blocks = Array.from(el.querySelectorAll('p, h1, h2, h3, h4, li, div.section'));
    const offsets = blocks.map(b => b.offsetTop).filter(top => top > 0);

    return { scrollHeight, clientHeight, maxScrollTop, offsets };
  }, isiSelector);

  if (!isiData) {
    throw new Error(`ISI element not found for content-aware planning: ${isiSelector}`);
  }

  const { scrollHeight, clientHeight, maxScrollTop } = isiData;
  const geometricPositions = calculateScrollPositions(scrollHeight, clientHeight, overlap);

  return geometricPositions;
}
