import { DEFAULT_CONFIG } from '../config/defaults.js';
import { logger } from '../utils/logger.js';

/**
 * Ensures browser page layout, fonts, images, and rendering have fully stabilized before screenshot or validation.
 */
export async function waitForRenderingStability(page, options = {}) {
  const {
    fontsTimeout = DEFAULT_CONFIG.defaultTimeouts.fontsReady,
    settleDelay = DEFAULT_CONFIG.defaultTimeouts.renderSettle,
    pauseAnimations = false
  } = options;

  try {
    // 1. Wait for document.fonts.ready
    await page.evaluate(async (timeoutMs) => {
      if (document.fonts && document.fonts.ready) {
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, timeoutMs));
        await Promise.race([document.fonts.ready, timeoutPromise]);
      }
    }, fontsTimeout);

    // 2. Wait for all <img> elements to finish loading
    await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        })
      );
    });

    // 3. Optionally pause CSS animations and transitions to guarantee deterministic screenshots
    if (pauseAnimations) {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-play-state: paused !important;
            transition-duration: 0s !important;
          }
        `
      });
    }

    // 4. Settling delay
    if (settleDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, settleDelay));
    }
  } catch (err) {
    logger.warn('Warning during rendering stability wait:', err.message);
  }
}
