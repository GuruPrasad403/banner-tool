import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getBrowserInstance } from './browser-manager.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Loads an HTML file into a Puppeteer browser page with configured viewport dimensions and deviceScaleFactor.
 */
export async function createAndLoadPage(htmlFilePath, options = {}) {
  const {
    width = 300,
    height = 250,
    deviceScaleFactor = DEFAULT_CONFIG.defaultDeviceScaleFactor,
    timeout = DEFAULT_CONFIG.defaultTimeouts.navigation
  } = options;

  const browser = await getBrowserInstance();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  const fileUrl = pathToFileURL(path.resolve(htmlFilePath)).href;

  try {
    // Set viewport dimensions
    await page.setViewport({
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      deviceScaleFactor: deviceScaleFactor
    });

    logger.info(`Loading page: ${fileUrl} [Viewport: ${width}x${height} @ scale ${deviceScaleFactor}]`);

    await page.goto(fileUrl, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout
    });

    return { page, context, fileUrl };
  } catch (err) {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    throw new BrowserError(`Failed to load page in Puppeteer: ${err.message}`, { htmlFilePath, fileUrl });
  }
}
