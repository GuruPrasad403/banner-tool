import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { logger } from '../utils/logger.js';
import { ensureDir } from '../utils/paths.js';
import { computeSlideCycle, resolveSlidesMode, selectStableSlideFrames, MAX_SLIDE_CYCLE_MS } from './slide-cycle.js';

/**
 * Ensures browser page layout, fonts, images, and rendering have fully stabilized before screenshot or validation.
 */
export async function waitForRenderingStability(page, options = {}) {
  const {
    fontsTimeout = DEFAULT_CONFIG.defaultTimeouts.fontsReady,
    settleDelay = DEFAULT_CONFIG.defaultTimeouts.renderSettle,
    animationDelay = DEFAULT_CONFIG.defaultTimeouts.animationDelay,
    slidesDuration = DEFAULT_CONFIG.defaultTimeouts.slidesDuration,
    slidesMode = undefined,
    isiSelector = null,
    rootSelector = null,
    slidesDir = null,
    slideSampleIntervalMs = 450,
    maxSlideFrames = 6,
    pauseAnimations = false
  } = options;

  let animationDelayApplied = 0;
  let slidesDurationApplied = 0;
  let slidesFreeze = null;
  let slideFrames = [];
  let isiScrollTopSamples = [];
  let slidesModeResolved = null;
  let detectedCycleMs = null;
  let slidesEffectiveWaitMs = 0;

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

    // 6. Slides-first flow: team requirement — FIRST all banner slides play
    // one full cycle while the ISI does NOT scroll, THEN the banner is
    // frozen on the FIRST slide, and only after that may ISI scroll capture
    // begin (section detection + scroll engine run after this function
    // returns), with slide 1 held in the fixed frame throughout.
    // The wait length depends on the slides mode:
    //   'auto'   (DEFAULT) — the cycle is auto-detected from the banner's
    //              own Web Animations timings; no user input needed. If no
    //              usable animations exist (static banner), the flow is
    //              skipped and capture proceeds normally.
    //   'manual' — the fixed `slidesDuration` value is waited.
    //   'off'    — the flow never runs.
    // Backward compatibility: an explicit slidesDuration > 0 with no
    // slidesMode resolves to 'manual' (see resolveSlidesMode).
    slidesModeResolved = resolveSlidesMode(slidesMode, slidesDuration, DEFAULT_CONFIG.defaultTimeouts.slidesMode);

    let slidesWaitMs = 0;
    if (slidesModeResolved === 'auto') {
      const detection = await detectSlideCycleMs(page);
      detectedCycleMs = detection.cycleMs;
      if (detection.capped) {
        logger.info(`Slides flow (auto): detected slide cycle ${detection.rawMs}ms exceeds the ${MAX_SLIDE_CYCLE_MS}ms cap — waiting ${detection.cycleMs}ms instead.`);
      }
      if (detection.cycleMs > 0) {
        slidesWaitMs = detection.cycleMs;
        logger.info(`Slides flow (auto): detected a ${detection.cycleMs}ms slide cycle from ${detection.animationsCount} animation timing(s) — all slides will play first, ISI held at top, then the banner is frozen on slide 1.`);
      } else {
        logger.info('Slides flow (auto): no slide animations detected — slides-first skipped, capture proceeds normally.');
      }
    } else if (slidesModeResolved === 'manual') {
      const slidesMs = Number(slidesDuration);
      if (Number.isFinite(slidesMs) && slidesMs > 0) {
        slidesWaitMs = slidesMs;
      }
    }

    slidesEffectiveWaitMs = slidesWaitMs;
    if (slidesWaitMs > 0) {
      const slidesResult = await runSlidesFirstFlow(page, slidesWaitMs, isiSelector, {
        rootSelector,
        slidesDir,
        slideSampleIntervalMs,
        maxSlideFrames
      });
      slidesDurationApplied = slidesResult.waitedMs;
      slidesFreeze = slidesResult.freeze;
      slideFrames = slidesResult.slideFrames || [];
      isiScrollTopSamples = slidesResult.samples;
    }
  } catch (err) {
    logger.warn('Warning during rendering stability wait:', err.message);
  }

  return {
    animationDelayApplied,
    slidesDurationApplied,
    slidesFreeze,
    slideFrames,
    isiScrollTopSamples,
    slidesMode: slidesModeResolved,
    detectedCycleMs,
    slidesEffectiveWaitMs
  };
}

/**
 * AUTO slides-mode detection: reads every animation's timing from the page
 * via the Web Animations API and computes ONE full slide cycle from them
 * (see computeSlideCycle in slide-cycle.js). Returns the capped cycle plus
 * diagnostics; cycleMs is 0 when no usable animation timing exists.
 */
async function detectSlideCycleMs(page) {
  const timings = await page.evaluate(() => {
    if (typeof document.getAnimations !== 'function') return [];
    const collected = [];
    for (const anim of document.getAnimations()) {
      try {
        const effect = anim.effect;
        if (!effect) continue;
        const timing = typeof effect.getComputedTiming === 'function'
          ? effect.getComputedTiming()
          : (effect.timing || {});
        const duration = Number(timing.duration);
        collected.push({
          delay: Number(timing.delay) || 0,
          duration: Number.isFinite(duration) ? duration : 0,
          // Infinity must cross the Puppeteer boundary as a string marker.
          iterations: timing.iterations === Infinity ? 'Infinity' : (Number(timing.iterations) || 0)
        });
      } catch (e) { /* skip unusable animation */ }
    }
    return collected;
  }).catch(() => null);

  const list = Array.isArray(timings) ? timings : [];
  const { cycleMs, rawMs, capped } = computeSlideCycle(list);
  return { cycleMs, rawMs, capped, animationsCount: list.length };
}

/**
 * Slides-first flow, executed inside waitForRenderingStability when an
 * effective slides wait applies (auto-detected cycle in 'auto' mode, or a
 * positive `slidesDuration` in 'manual' mode):
 *   1. Resolve the ISI container (configured selector first, then the known
 *      ISI selectors) and explicitly pin it to scrollTop 0.
 *   2. Wait the full slide cycle WITHOUT any scrolling, sampling the ISI
 *      scrollTop during the wait so the "ISI did not scroll" requirement is
 *      evidenced, not assumed.
 *   3. Freeze the banner on the FIRST slide (best effort): Web Animations
 *      API — pause every animation at currentTime 0; GSAP — pause the global
 *      timeline at time 0. Counts what was found/paused. If nothing could be
 *      frozen, a clear warning is logged and recorded (never silently
 *      pretend the freeze worked).
 *
 * Before the wait, animations are restarted at time 0 so the playback that
 * is sampled is one full cycle FROM slide 1 (this also makes the recorded
 * slide frames deterministic). While waiting, when `slidesDir` is given,
 * the banner is photographed every ~450 ms: the slide region (everything
 * above the ISI container) of each sample is hashed, samples are grouped
 * into stable slide states (see selectStableSlideFrames), and the last
 * frame of each distinct slide is written to slidesDir as slide-01.png,
 * slide-02.png, … — the owner's proof that slides 2, 3, … exist and
 * played, even though the ISI frames below all hold slide 1 by rule.
 */
async function runSlidesFirstFlow(page, slidesMs, isiSelector, captureOptions = {}) {
  const candidates = [isiSelector, ...DEFAULT_CONFIG.knownSelectors.isi].filter(Boolean);

  // 1. Pin the ISI container to the very top before the slides play.
  const isiPin = await page.evaluate((selectors) => {
    let firstMatch = null;
    for (const selector of selectors) {
      let el = null;
      try { el = document.querySelector(selector); } catch (e) { /* invalid selector */ }
      if (!el) continue;
      if (!firstMatch) firstMatch = { el, selector };
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop = 0;
        return { found: true, selector, scrollTop: el.scrollTop };
      }
    }
    if (firstMatch) {
      firstMatch.el.scrollTop = 0;
      return { found: true, selector: firstMatch.selector, scrollTop: firstMatch.el.scrollTop };
    }
    return { found: false, selector: null, scrollTop: null };
  }, candidates).catch(() => ({ found: false, selector: null, scrollTop: null }))
    .then((r) => r || { found: false, selector: null, scrollTop: null });

  if (isiPin && isiPin.found) {
    logger.info(`Slides-first: ISI container "${isiPin.selector}" pinned to scrollTop 0 before slide playback.`);
  } else {
    logger.warn('Slides-first: ISI container not found before slide playback; slides will still play and freeze, but the ISI-at-top pin could not be applied.');
  }

  // 1b. Restart animations at time 0 so the sampled playback is one full
  // cycle starting from slide 1 (best effort; harmless when absent).
  await page.evaluate(() => {
    try {
      const animations = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
      for (const anim of animations) {
        try { anim.currentTime = 0; } catch (e) { /* some animations reject seeking */ }
        try { if (anim.playState !== 'running') anim.play(); } catch (e) { /* best effort */ }
      }
    } catch (e) { /* getAnimations unavailable */ }
    try {
      if (window.gsap && window.gsap.globalTimeline) {
        window.gsap.globalTimeline.play(0);
      }
    } catch (e) { /* no GSAP */ }
  }).catch(() => {});

  // Slide-frame sampling setup (only when an output dir was provided).
  const wantSlideFrames = Boolean(captureOptions.slidesDir);
  const slideGeometry = wantSlideFrames
    ? await computeSlideGeometry(page, captureOptions.rootSelector, isiPin && isiPin.found ? isiPin.selector : null)
    : null;
  const slideSamples = [];

  // 2. Wait the full slide cycle with NO scrolling; sample ISI scrollTop.
  logger.info(`Slides-first: playing all slides for ${slidesMs}ms — ISI must NOT scroll during slide playback...`);
  const waitStart = Date.now();
  const samples = [];
  const sampleIsiScrollTop = async () => {
    if (!isiPin || !isiPin.found) return;
    const top = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? el.scrollTop : null;
    }, isiPin.selector).catch(() => null);
    samples.push({ atMs: Date.now() - waitStart, scrollTop: top });
  };

  const captureSlideSample = async () => {
    if (!slideGeometry) return;
    try {
      const buffer = await page.screenshot({ clip: slideGeometry.rootClip });
      const region = await page.screenshot({ clip: slideGeometry.regionClip });
      const regionHash = createHash('sha256').update(region).digest('hex');
      slideSamples.push({ buffer, regionHash, atMs: Date.now() - waitStart });
    } catch (e) { /* slide sampling is best effort */ }
  };

  await sampleIsiScrollTop();
  await captureSlideSample();
  const sampleIntervalMs = Math.max(100, Number(captureOptions.slideSampleIntervalMs) || 450);
  while (Date.now() - waitStart < slidesMs) {
    const remaining = slidesMs - (Date.now() - waitStart);
    await new Promise((resolve) => setTimeout(resolve, Math.min(sampleIntervalMs, remaining)));
    await sampleIsiScrollTop();
    await captureSlideSample();
  }
  const waitedMs = Date.now() - waitStart;
  logger.info(`Slides-first: slide playback wait completed: waited ${waitedMs}ms. ISI scrollTop samples during wait: ${JSON.stringify(samples)}`);

  // 3. Freeze on the FIRST slide (best effort).
  const freezeRaw = await page.evaluate(() => {
    const result = {
      animationsFound: 0,
      animationsPaused: 0,
      gsapFound: false,
      gsapPaused: false
    };

    // (a) Web Animations API: hold every animation at its first frame.
    try {
      const animations = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
      result.animationsFound = animations.length;
      for (const anim of animations) {
        try {
          anim.pause();
          try { anim.currentTime = 0; } catch (e) { /* some animations reject seeking */ }
          if (anim.playState === 'paused') result.animationsPaused++;
        } catch (e) { /* best effort per animation */ }
      }
    } catch (e) { /* getAnimations unavailable */ }

    // (b) GSAP: pause the global timeline at time 0 (slide 1).
    try {
      if (window.gsap && window.gsap.globalTimeline) {
        result.gsapFound = true;
        try {
          window.gsap.globalTimeline.pause(0);
          result.gsapPaused = true;
        } catch (e) {
          try {
            window.gsap.globalTimeline.progress(0);
            window.gsap.globalTimeline.pause();
            result.gsapPaused = true;
          } catch (e2) { /* best effort */ }
        }
      }
    } catch (e) { /* no GSAP */ }

    return result;
  }).catch(() => null).then((r) => r || { animationsFound: 0, animationsPaused: 0, gsapFound: false, gsapPaused: false });

  const freeze = {
    attempted: true,
    isiFound: Boolean(isiPin && isiPin.found),
    isiSelector: isiPin ? isiPin.selector : null,
    animationsFound: freezeRaw.animationsFound || 0,
    animationsPaused: freezeRaw.animationsPaused || 0,
    gsapFound: Boolean(freezeRaw.gsapFound),
    gsapPaused: Boolean(freezeRaw.gsapPaused),
    warning: null
  };

  if (freeze.animationsPaused > 0 || freeze.gsapPaused) {
    logger.info(`Slides-first: banner frozen on first slide — paused ${freeze.animationsPaused}/${freeze.animationsFound} Web Animation(s) at currentTime 0${freeze.gsapPaused ? ' and the GSAP global timeline at time 0' : ''}. ISI scroll capture may now begin.`);
  } else {
    freeze.warning = 'No CSS/Web animations or GSAP timeline found to freeze; the banner could not be verifiably held on slide 1 during ISI scroll capture.';
    logger.warn(`Slides-first: ${freeze.warning}`);
  }

  // 4. Persist the distinct slide frames recorded during the wait: the
  // last frame of each stable slide state, in playback order.
  let slideFrames = [];
  if (slideGeometry && slideSamples.length > 0) {
    try {
      const selected = selectStableSlideFrames(slideSamples, {
        maxFrames: captureOptions.maxSlideFrames ?? 6
      });
      await ensureDir(captureOptions.slidesDir);
      for (let i = 0; i < selected.length; i++) {
        const file = `slide-${String(i + 1).padStart(2, '0')}.png`;
        await fs.writeFile(path.join(captureOptions.slidesDir, file), selected[i].buffer);
        slideFrames.push({ index: i + 1, file, atMs: selected[i].atMs });
      }
      logger.info(`Slides-first: recorded ${slideFrames.length} distinct slide frame(s) from ${slideSamples.length} samples during slide playback.`);
    } catch (err) {
      logger.warn(`Slides-first: could not save slide frames: ${err.message}`);
      slideFrames = [];
    }
  }

  return { waitedMs, freeze, samples, slideFrames };
}

/**
 * Geometry for slide-frame sampling: the clip of the whole banner root,
 * and the clip of the "slide region" — everything in the root above the
 * ISI container (header + slide stage). Identical slide pixels hash
 * identically, which is what the stable-state dedupe keys on. Falls back
 * to the whole root when no ISI element is found.
 */
async function computeSlideGeometry(page, rootSelector, isiSelector) {
  const geo = await page.evaluate((args) => {
    let rootEl = null;
    for (const sel of args.rootCandidates) {
      if (!sel) continue;
      try { rootEl = document.querySelector(sel); } catch (e) { /* invalid selector */ }
      if (rootEl) break;
    }
    if (!rootEl) rootEl = document.body;
    if (!rootEl) return null;

    const r = rootEl.getBoundingClientRect();
    const rootClip = {
      x: Math.max(0, Math.floor(r.x)),
      y: Math.max(0, Math.floor(r.y)),
      width: Math.max(1, Math.round(r.width)),
      height: Math.max(1, Math.round(r.height))
    };

    let regionClip = { ...rootClip };
    if (args.isiSelector) {
      let isiEl = null;
      try { isiEl = document.querySelector(args.isiSelector); } catch (e) { /* invalid selector */ }
      if (isiEl) {
        const ir = isiEl.getBoundingClientRect();
        const h = Math.round(ir.y - r.y);
        if (h > 0 && h < rootClip.height) {
          regionClip = { ...rootClip, height: h };
        }
      }
    }

    return { rootClip, regionClip };
  }, {
    rootCandidates: [rootSelector, ...DEFAULT_CONFIG.knownSelectors.root],
    isiSelector: isiSelector || null
  }).catch(() => null);

  return geo || null;
}
