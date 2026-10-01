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
    root: ['#banner', '.banner', '#ad-container', '.ad-frame', '#app'],
    header: ['#header', '.header', '.banner-header', '[data-banner-section="header"]'],
    body: ['#body-copy', '#body', '.body-copy', '.main-text', '[data-banner-section="body"]'],
    isi: [
      '#isi-container',
      '#isi',
      '.isi-container',
      '.isi-content',
      '.isi',
      '.important-safety-information',
      '[data-banner-section="isi"]'
    ]
  }
};
