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
