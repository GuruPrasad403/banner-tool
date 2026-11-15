import path from 'node:path';

export const DEFAULT_CONFIG = {
  port: 3001,
  host: 'localhost',
  outputDir: path.resolve(process.cwd(), './output'),
  tempDir: path.resolve(process.cwd(), './temp'),
  defaultProfile: 'mobile-small',
  defaultDeviceScaleFactor: 2,
  defaultOverlap: 10,
  defaultValidationMode: 'tolerance', // 'exact' | 'tolerance' | 'report-only'
  defaultTimeouts: {
    navigation: 30000,
    renderSettle: 500,
    scrollSettle: 300,
    fontsReady: 5000,
    // Time (ms) to wait after render settle, before the first screenshot, so
    // animated banners can play/finish their animation instead of being
    // captured mid-animation. Set per job via the `animationDelay` option
    // (dashboard field / API config / CLI --animation-delay). 0 disables it.
    animationDelay: 2000,
    // Slides-first flow mode: 'auto' | 'manual' | 'off'. DEFAULT is 'auto':
    // the slide cycle is auto-detected from the banner's own animations
    // (Web Animations API timings) so all slides play fully while the ISI
    // is held at scrollTop 0, the banner is frozen on the first slide, and
    // only then does ISI scroll capture begin — no user input needed.
    // 'manual' uses the fixed `slidesDuration` below; 'off' disables the
    // flow entirely. Set per job via the `slidesMode` option (dashboard
    // select / API config / CLI --slides-mode). For backward compatibility,
    // an explicit slidesDuration > 0 with no slidesMode implies 'manual'.
    slidesMode: 'auto',
    // Slides-first flow, MANUAL mode value (ms): total time for ALL banner
    // slides to play one full cycle while the ISI is held at scrollTop 0
    // (no ISI scrolling). After this wait the banner animations are frozen
    // on the first slide (Web Animations API / GSAP, best effort) and only
    // then does ISI scroll capture begin, with slide 1 held in the fixed
    // frame. Set per job via the `slidesDuration` option (dashboard field /
    // API config / CLI --slides-duration). 0 = no manual wait.
    slidesDuration: 0,
  },
  knownSelectors: {
    root: ['#banner', '#wrapper', '#wrapper1', '.banner', '#ad-container', '#container', '.ad-frame', '#ad-stage', '#ad-experience', '.ad-stage', '#app'],
    header: ['#header', '.header', '.banner-header', '#brand-header', '.ad-header', '#logo', '.logo', '[data-banner-section="header"]'],
    body: ['#body-copy', '#body', '.body-copy', '.main-text', '#hero-block', '.ad-hero', '#bg', '#piBg', '#piText', '[data-banner-section="body"]'],
    isi: [
      '#isi-container',
      '#isi',
      '#viewport',
      '#overview',
      '#scrollbar1',
      '#footer_content_main',
      '#safety-scroll-pane',
      '#safety-scroll',
      '.isi-container',
      '.isi-content',
      '.isi',
      '.important-safety-information',
      '.safety-scroll',
      '[data-banner-section="isi"]'
    ],
    footer: [
      '#legal-bar',
      '.legal-bar',
      '#footer',
      '.footer',
      '.ad-footer',
      '#legal',
      '[data-banner-section="footer"]'
    ]
  }
};
