import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { SecurityError } from './errors.js';

/**
 * Ensures directory exists synchronously
 */
export function ensureDirSync(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * Ensures directory exists asynchronously
 */
export async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  return dirPath;
}

/**
 * Prevents zip path traversal attacks by validating target path is within output root.
 */
export function sanitizeExtractPath(targetDir, entryName) {
  const resolvedPath = path.resolve(targetDir, entryName);
  const normalizedTarget = path.resolve(targetDir);

  if (!resolvedPath.startsWith(normalizedTarget + path.sep) && resolvedPath !== normalizedTarget) {
    throw new SecurityError(`Zip path traversal detected for entry "${entryName}"`, { entryName, targetDir });
  }

  return resolvedPath;
}

/**
 * Creates an isolated temporary directory for job processing
 */
export async function createJobTempDir(jobId) {
  const jobTempPath = path.join(DEFAULT_CONFIG.tempDir, jobId);
  await ensureDir(jobTempPath);
  return jobTempPath;
}

/**
 * Creates the output directory for a job's artifacts
 */
export async function createJobOutputDir(jobId) {
  const jobOutputDir = path.join(DEFAULT_CONFIG.outputDir, jobId);
  const screenshotsDir = path.join(jobOutputDir, 'screenshots');
  await ensureDir(screenshotsDir);
  return { jobOutputDir, screenshotsDir };
}

/**
 * Removes temporary directory safely
 */
export async function cleanupTempDir(dirPath) {
  try {
    if (dirPath && existsSync(dirPath)) {
      await fs.rm(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`[Cleanup Warning] Failed to delete temp dir ${dirPath}:`, err.message);
  }
}
