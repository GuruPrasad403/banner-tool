import path from 'node:path';
import { logger } from '../utils/logger.js';

/**
 * Captures a crisp PNG screenshot of the complete banner frame bounding box.
 */
export async function captureBannerFrame(page, rootSelector, outputPath) {
  const boundingBox = await page.evaluate((sel) => {
    const el = document.querySelector(sel) || document.body;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, rect.x || 0),
      y: Math.max(0, rect.y || 0),
      width: Math.max(1, rect.width || 300),
      height: Math.max(1, rect.height || 250)
    };
  }, rootSelector);

  const currentViewport = page.viewport() || { width: 300, height: 250, deviceScaleFactor: 2 };
  const requiredWidth = Math.max(currentViewport.width, Math.ceil(boundingBox.x + boundingBox.width));
  const requiredHeight = Math.max(currentViewport.height, Math.ceil(boundingBox.y + boundingBox.height));

  if (requiredWidth > currentViewport.width || requiredHeight > currentViewport.height) {
    await page.setViewport({
      ...currentViewport,
      width: requiredWidth,
      height: requiredHeight
    });
  }

  const clipX = Math.max(0, Math.floor(boundingBox.x));
  const clipY = Math.max(0, Math.floor(boundingBox.y));
  const clipWidth = Math.max(1, Math.min(Math.ceil(boundingBox.width), requiredWidth - clipX));
  const clipHeight = Math.max(1, Math.min(Math.ceil(boundingBox.height), requiredHeight - clipY));

  logger.info(`Capturing frame screenshot [${clipWidth}x${clipHeight} at (${clipX}, ${clipY})]: ${outputPath}`);

  await page.screenshot({
    path: outputPath,
    type: 'png',
    clip: {
      x: clipX,
      y: clipY,
      width: clipWidth,
      height: clipHeight
    }
  });

  return {
    outputPath,
    filename: path.basename(outputPath),
    boundingBox
  };
}
