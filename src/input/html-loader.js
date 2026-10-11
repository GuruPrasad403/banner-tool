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

  const stat = await fs.stat(inputPath);

  // 1. Directory Input: scan for primary HTML and copy contents
  if (stat.isDirectory()) {
    logger.info(`Processing Directory input: ${inputPath}`);
    await ensureDir(workDir);

    const htmlFiles = await findHtmlFilesRecursive(inputPath);
    if (htmlFiles.length === 0) {
      throw new ValidationError(`No HTML entry file found in directory: ${inputPath}`);
    }

    // Prioritize index.html
    const primarySrc = htmlFiles.find(f => path.basename(f).toLowerCase() === 'index.html') || htmlFiles[0];
    const baseSourceDir = path.dirname(primarySrc);

    // Copy directory containing the primary HTML file
    await copyDirectoryContents(baseSourceDir, workDir);

    const destHtml = path.join(workDir, path.basename(primarySrc));
    const copiedFiles = await fs.readdir(workDir);

    return {
      primaryHtmlFile: destHtml,
      htmlFiles: [destHtml],
      allFilesCount: copiedFiles.length
    };
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

    // If local HTML file on disk (not uploaded to temp uploads), copy sibling assets from its parent directory
    const isTempUpload = inputPath.includes(path.join('temp', 'uploads')) || inputPath.includes('temp/uploads');
    if (!isTempUpload) {
      const parentDir = path.dirname(inputPath);
      await copyDirectoryContents(parentDir, workDir);
    } else {
      await fs.copyFile(inputPath, destPath);
    }

    const copiedFiles = await fs.readdir(workDir);

    return {
      primaryHtmlFile: destPath,
      htmlFiles: [destPath],
      allFilesCount: copiedFiles.length
    };
  }

  throw new ValidationError(`Unsupported file extension: "${ext}". Expected .html, .htm, or .zip.`);
}

/**
 * Recursively finds all HTML files in a directory
 */
async function findHtmlFilesRecursive(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findHtmlFilesRecursive(full)));
    } else if (['.html', '.htm'].includes(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
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
