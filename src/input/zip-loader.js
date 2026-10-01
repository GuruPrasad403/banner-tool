import AdmZip from 'adm-zip';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ensureDir, sanitizeExtractPath } from '../utils/paths.js';
import { SecurityError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Extracts a ZIP package into a target directory safely preventing path traversal.
 * Finds all HTML files and identifies the primary HTML entry file.
 */
export async function extractAndProcessZip(zipFilePath, targetDir) {
  if (!existsSync(zipFilePath)) {
    throw new ValidationError(`ZIP file not found: ${zipFilePath}`);
  }

  try {
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();
    await ensureDir(targetDir);

    const htmlFiles = [];

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      // Validate security - path traversal check
      const safePath = sanitizeExtractPath(targetDir, entry.entryName);
      
      // Ensure target directory exists for nested asset structure
      await ensureDir(path.dirname(safePath));

      // Extract entry file buffer and write to safe path
      const content = entry.getData();
      await fs.writeFile(safePath, content);

      if (entry.entryName.toLowerCase().endsWith('.html') || entry.entryName.toLowerCase().endsWith('.htm')) {
        htmlFiles.push({
          entryName: entry.entryName,
          fullPath: safePath,
          basename: path.basename(entry.entryName)
        });
      }
    }

    if (htmlFiles.length === 0) {
      throw new ValidationError('No HTML files found inside the uploaded ZIP package.');
    }

    // Determine primary HTML file: index.html or main.html or first available
    let primaryHtml = htmlFiles.find(f => f.basename.toLowerCase() === 'index.html');
    if (!primaryHtml) {
      primaryHtml = htmlFiles.find(f => f.basename.toLowerCase() === 'main.html');
    }
    if (!primaryHtml) {
      primaryHtml = htmlFiles[0];
    }

    logger.info(`Extracted ${zipEntries.length} files from ZIP. Primary HTML: ${primaryHtml.entryName}`);

    return {
      primaryHtmlFile: primaryHtml.fullPath,
      htmlFiles: htmlFiles.map(h => h.fullPath),
      allFilesCount: zipEntries.length
    };
  } catch (err) {
    if (err instanceof SecurityError || err instanceof ValidationError) throw err;
    throw new ValidationError(`Failed to extract ZIP package: ${err.message}`, { zipFilePath });
  }
}
