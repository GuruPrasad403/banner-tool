import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ensureDir } from '../utils/paths.js';
import { ValidationError } from '../utils/errors.js';
import { extractAndProcessZip } from './zip-loader.js';
import { logger } from '../utils/logger.js';

/**
 * Loads an input source (single HTML file, local path, or ZIP archive)
 * into a target working directory. Preserves original file extension when uploaded via Multer.
 */
export async function loadInputSource(inputPath, workDir, originalName = null) {
  if (!existsSync(inputPath)) {
    throw new ValidationError(`Input path does not exist: ${inputPath}`, { inputPath }, 'Provide a valid local path to an HTML file or ZIP archive.');
  }

  const targetName = originalName || inputPath;
  const ext = path.extname(targetName).toLowerCase();

  if (ext === '.zip') {
    logger.info(`Processing ZIP package input: ${inputPath}`);
    return await extractAndProcessZip(inputPath, workDir);
  }

  if (ext === '.html' || ext === '.htm') {
    logger.info(`Processing HTML file input: ${inputPath} (Original name: ${targetName})`);
    await ensureDir(workDir);

    const filename = originalName ? path.basename(originalName) : path.basename(inputPath);
    const destPath = path.join(workDir, filename);

    const stat = await fs.stat(inputPath);
    if (stat.isDirectory()) {
      await copyDirectoryContents(inputPath, workDir);
    } else {
      await fs.copyFile(inputPath, destPath);
    }

    return {
      primaryHtmlFile: destPath,
      htmlFiles: [destPath],
      allFilesCount: 1
    };
  }

  throw new ValidationError(`Unsupported file extension: "${ext}". Expected .html, .htm, or .zip.`);
}

/**
 * Copies files from source to destination recursively
 */
async function copyDirectoryContents(src, dest) {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryContents(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
