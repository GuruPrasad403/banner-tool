import { DEFAULT_CONFIG } from '../config/defaults.js';
import { logger } from '../utils/logger.js';

/**
 * Ensures browser page layout, fonts, images, and rendering have fully stabilized before screenshot or validation.
 */
export async function waitForRenderingStability(page, options = {}) {
  const {
    fontsTimeout = DEFAULT_CONFIG.defaultTimeouts.fontsReady,
    settleDelay = DEFAULT_CONFIG.defaultTimeouts.renderSettle,
    animationDelay = DEFAULT_CONFIG.defaultTimeouts.animationDelay,
    pauseAnimations = false
  } = options;

  let animationDelayApplied = 0;

  try {
    // 0. Ensure third-party ad loaders (e.g. Enabler.js / pageLoadedHandler) have triggered
    await page.evaluate(() => {
      try {
        if (typeof window.pageLoadedHandler === 'function') {
          const wrap = document.getElementById('wrapper');
          if (!wrap || window.getComputedStyle(wrap).display === 'none') {
            window.pageLoadedHandler();
          }
        }
        if (typeof window.Enabler !== 'undefined') {
          if (window.studio && window.studio.events && window.studio.events.StudioEvent) {
            try {
              window.Enabler.dispatchEvent(window.studio.events.StudioEvent.PAGE_LOADED);
            } catch (e) {}
          }
        }
      } catch (e) {
        // Ignore if error during trigger
      }
    });

    // Wait briefly if root banner (e.g. #wrapper, #banner) is hidden or transitioning
    await page.evaluate(async (maxWaitMs) => {
      const start = Date.now();
      while (Date.now() - start < maxWaitMs) {
        const wrap = document.getElementById('wrapper') || document.getElementById('banner');
        if (wrap && window.getComputedStyle(wrap).display !== 'none') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }, 1500);

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

    // 5. Animation delay: give animated banners time to play/finish their
    // animation before the first screenshot is taken, so frames are not
    // captured mid-animation (the fixed render settle alone is too short for
    // banners with multi-second entrance animations). Applied once per page
    // load, not per scroll step (scrollSettle covers scroll steps).
    const delayMs = Number(animationDelay);
    if (Number.isFinite(delayMs) && delayMs > 0) {
      const waitStart = Date.now();
      logger.info(`Waiting ${delayMs}ms animation delay for banner animation to complete before capture...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      animationDelayApplied = Date.now() - waitStart;
      logger.info(`Animation delay completed: waited ${animationDelayApplied}ms.`);
    }
  } catch (err) {
    logger.warn('Warning during rendering stability wait:', err.message);
  }

  return { animationDelayApplied };
}
