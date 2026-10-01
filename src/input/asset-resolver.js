import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 * Scans an HTML file content for referenced local asset files (images, css, scripts, webfonts)
 * and verifies their existence.
 */
export async function auditBannerAssets(htmlFilePath) {
  if (!existsSync(htmlFilePath)) {
    return { missingAssets: [{ type: 'HTML_MISSING', path: htmlFilePath }], references: [] };
  }

  const baseDir = path.dirname(htmlFilePath);
  const htmlContent = await fs.readFile(htmlFilePath, 'utf-8');

  const assetRegexes = [
    { type: 'script', regex: /<script[^>]+src=["']([^"']+)["']/gi },
    { type: 'stylesheet', regex: /<link[^>]+href=["']([^"']+)["']/gi },
    { type: 'image', regex: /<img[^>]+src=["']([^"']+)["']/gi },
    { type: 'css-url', regex: /url\(["']?([^"')]+)["']?\)/gi },
  ];

  const references = [];
  const missingAssets = [];
  const checked = new Set();

  for (const item of assetRegexes) {
    let match;
    while ((match = item.regex.exec(htmlContent)) !== null) {
      const ref = match[1];
      if (!ref || ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('data:')) {
        continue; // Skip remote or inline data URLs
      }

      const cleanRef = ref.split('?')[0].split('#')[0];
      if (checked.has(cleanRef)) continue;
      checked.add(cleanRef);

      const resolvedPath = path.resolve(baseDir, cleanRef);
      const exists = existsSync(resolvedPath);

      const assetInfo = {
        type: item.type,
        ref: cleanRef,
        resolvedPath,
        exists
      };

      references.push(assetInfo);
      if (!exists) {
        missingAssets.push({
          type: item.type.toUpperCase() + '_MISSING',
          ref: cleanRef,
          message: `Referenced ${item.type} asset not found: "${cleanRef}"`
        });
      }
    }
  }

  return {
    totalReferences: references.length,
    missingCount: missingAssets.length,
    references,
    missingAssets
  };
}
