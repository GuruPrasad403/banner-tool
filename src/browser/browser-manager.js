import puppeteer from 'puppeteer';
import { logger } from '../utils/logger.js';

let sharedBrowser = null;

/**
 * Gets or launches a shared Puppeteer browser instance.
 */
export async function getBrowserInstance() {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }

  logger.info('Launching Puppeteer browser instance...');
  sharedBrowser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--hide-scrollbars'
    ]
  });

  sharedBrowser.on('disconnected', () => {
    logger.info('Browser instance disconnected.');
    sharedBrowser = null;
  });

  return sharedBrowser;
}

/**
 * Closes the browser instance if open.
 */
export async function closeBrowserInstance() {
  if (sharedBrowser) {
    logger.info('Closing Puppeteer browser instance...');
    try {
      await sharedBrowser.close();
    } catch (err) {
      logger.warn('Error closing browser:', err.message);
    } finally {
      sharedBrowser = null;
    }
  }
}
