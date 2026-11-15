import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { DEFAULT_CONFIG } from './config/defaults.js';
import { defaultBannerProfiles } from './config/banner-profiles.js';
import { ensureDir, createJobTempDir, createJobOutputDir, cleanupTempDir } from './utils/paths.js';
import { loadInputSource } from './input/html-loader.js';
import { createAndLoadPage } from './browser/page-loader.js';
import { waitForRenderingStability } from './browser/renderer.js';
import { detectBannerSections } from './sections/section-detector.js';
import { runValidationRules } from './validation/rule-engine.js';
import { executeNestedScrollCapture } from './screenshots/nested-scroll-engine.js';
import { createCaptureManifest } from './screenshots/capture-manifest.js';
import { createJsonReport } from './reports/json-report.js';
import { createHtmlReport } from './reports/html-report.js';
import { logger } from './utils/logger.js';
import { AppError } from './utils/errors.js';

const app = express();
app.use(cors());
app.use(express.json());

// Ensure base folders exist
ensureDir(DEFAULT_CONFIG.outputDir);
ensureDir(DEFAULT_CONFIG.tempDir);

// Serve output directory statically for screenshot images and reports
app.use('/output', express.static(DEFAULT_CONFIG.outputDir));

// Multer storage for uploaded HTML and ZIP files
const upload = multer({
  dest: path.join(DEFAULT_CONFIG.tempDir, 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// In-memory job state store
const jobsStore = new Map();
let customBannerProfiles = { ...defaultBannerProfiles };

/**
 * Helper to get or initialize job record
 */
function getJob(jobId) {
  const job = jobsStore.get(jobId);
  if (!job) {
    throw new AppError('JOB_NOT_FOUND', `Job with ID "${jobId}" not found.`, {}, 'Provide a valid jobId.');
  }
  return job;
}

// --------------------------------------------------------------------------
// PROFILES API
// --------------------------------------------------------------------------
app.get('/api/profiles', (req, res) => {
  res.json({ profiles: Object.values(customBannerProfiles) });
});

app.post('/api/profiles', (req, res) => {
  const profile = req.body;
  if (!profile.id || !profile.name) {
    return res.status(400).json({ error: 'Profile must contain id and name.' });
  }
  customBannerProfiles[profile.id] = profile;
  res.json({ success: true, profile });
});

app.put('/api/profiles/:profileId', (req, res) => {
  const { profileId } = req.params;
  customBannerProfiles[profileId] = { ...customBannerProfiles[profileId], ...req.body };
  res.json({ success: true, profile: customBannerProfiles[profileId] });
});

app.delete('/api/profiles/:profileId', (req, res) => {
  const { profileId } = req.params;
  delete customBannerProfiles[profileId];
  res.json({ success: true });
});

// --------------------------------------------------------------------------
// JOBS & UPLOAD API
// --------------------------------------------------------------------------
app.get('/api/jobs', (req, res) => {
  const list = Array.from(jobsStore.values()).map(j => ({
    jobId: j.jobId,
    status: j.status,
    inputName: j.inputName,
    profile: j.profile,
    createdAt: j.createdAt,
    validationStatus: j.validationReport?.status || 'pending',
    screenshotsCount: j.scrollResult?.totalScreenshots || 0
  }));
  res.json({ jobs: list.reverse() });
});

app.post('/api/jobs', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return next(err);

    try {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const jobTempDir = await createJobTempDir(jobId);
      const { jobOutputDir, screenshotsDir } = await createJobOutputDir(jobId);

      let inputPath = null;
      let inputName = 'Local Input';

      if (req.file) {
        inputPath = req.file.path;
        inputName = req.file.originalname;
      } else if (req.body && req.body.localPath) {
        inputPath = req.body.localPath;
        inputName = path.basename(req.body.localPath);
      } else {
        return res.status(400).json({ error: 'No uploaded file or localPath provided.' });
      }

    // Process input (copy or extract ZIP into temp processing directory)
    const loadResult = await loadInputSource(inputPath, jobTempDir, inputName);

    const jobRecord = {
      jobId,
      status: 'initialized',
      createdAt: new Date().toISOString(),
      inputName,
      inputPath,
      jobTempDir,
      jobOutputDir,
      screenshotsDir,
      primaryHtmlFile: loadResult.primaryHtmlFile,
      profile: req.body.profile || 'mobile-small',
      config: {
        expectedWidth: Number(req.body.expectedWidth) || 300,
        expectedHeight: Number(req.body.expectedHeight) || 250,
        widthTolerance: Number(req.body.widthTolerance) || 0,
        heightTolerance: Number(req.body.heightTolerance) || 0,
        deviceScaleFactor: Number(req.body.deviceScaleFactor) || 2,
        overlap: Number(req.body.overlap) || 10,
        animationDelay: (req.body.animationDelay !== undefined && req.body.animationDelay !== '' && !Number.isNaN(Number(req.body.animationDelay)))
          ? Math.max(0, Number(req.body.animationDelay))
          : DEFAULT_CONFIG.defaultTimeouts.animationDelay,
        rootSelector: req.body.rootSelector || null,
        fixedSelectors: req.body.fixedSelectors ? (Array.isArray(req.body.fixedSelectors) ? req.body.fixedSelectors : [req.body.fixedSelectors]) : [],
        isiSelector: req.body.isiSelector || null
      },
      detectionData: null,
      validationReport: null,
      scrollResult: null
    };

    jobsStore.set(jobId, jobRecord);
    logger.info(`Job created: ${jobId} (${inputName})`);

    res.json({ success: true, jobId, job: jobRecord });
    } catch (err) {
      next(err);
    }
  });
});

app.get('/api/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  res.json({ job });
});

// --------------------------------------------------------------------------
// VALIDATE & DETECT ROUTE
// --------------------------------------------------------------------------
app.post('/api/jobs/:jobId/validate', async (req, res, next) => {
  let loaded = null;
  try {
    const job = getJob(req.params.jobId);
    job.status = 'validating';

    if (req.body.config) {
      job.config = { ...job.config, ...req.body.config };
    }

    // Launch browser and load page
    loaded = await createAndLoadPage(job.primaryHtmlFile, {
      width: job.config.expectedWidth,
      height: job.config.expectedHeight,
      deviceScaleFactor: job.config.deviceScaleFactor
    });

    await waitForRenderingStability(loaded.page, { animationDelay: job.config.animationDelay });

    // Section detection
    const sectionData = await detectBannerSections(loaded.page, {
      rootSelector: job.config.rootSelector,
      fixedSelectors: job.config.fixedSelectors,
      isiSelector: job.config.isiSelector
    });

    job.detectionData = sectionData;

    // Execute Rule Engine Validation
    const validationResult = await runValidationRules(loaded.page, job.primaryHtmlFile, sectionData, job.config);
    job.validationReport = validationResult;
    job.status = 'validated';

    res.json({
      success: true,
      detectionData: sectionData,
      validationReport: validationResult
    });
  } catch (err) {
    next(err);
  } finally {
    if (loaded) {
      await loaded.page.close().catch(() => {});
      await loaded.context.close().catch(() => {});
    }
  }
});

// --------------------------------------------------------------------------
// CAPTURE ROUTE (Nested ISI Scroll Screenshot Generation)
// --------------------------------------------------------------------------
app.post('/api/jobs/:jobId/capture', async (req, res, next) => {
  let loaded = null;
  try {
    const job = getJob(req.params.jobId);
    job.status = 'capturing';

    if (req.body.config) {
      job.config = { ...job.config, ...req.body.config };
    }

    // Load page in Puppeteer
    loaded = await createAndLoadPage(job.primaryHtmlFile, {
      width: job.config.expectedWidth,
      height: job.config.expectedHeight,
      deviceScaleFactor: job.config.deviceScaleFactor
    });

    await waitForRenderingStability(loaded.page, { animationDelay: job.config.animationDelay });

    // Re-run section detection with updated config
    job.detectionData = await detectBannerSections(loaded.page, {
      rootSelector: job.config.rootSelector,
      fixedSelectors: job.config.fixedSelectors,
      isiSelector: job.config.isiSelector
    });

    // Re-run validation rules
    job.validationReport = await runValidationRules(loaded.page, job.primaryHtmlFile, job.detectionData, job.config);

    // Execute Nested Scroll Engine
    const scrollResult = await executeNestedScrollCapture(
      loaded.page,
      job.detectionData,
      job.screenshotsDir,
      {
        overlap: job.config.overlap,
        jobId: job.jobId
      }
    );

    job.scrollResult = scrollResult;

    // Create JSON Report and Capture Manifest
    const { report } = await createJsonReport(job.jobId, job.config, job.detectionData, job.validationReport, scrollResult, job.jobOutputDir);
    const { manifest } = await createCaptureManifest(job.jobId, job.config, job.detectionData, scrollResult, job.jobOutputDir);
    await createHtmlReport(job.jobId, report, scrollResult, job.jobOutputDir);

    job.status = 'completed';
    logger.info(`Completed screenshot capture for job ${job.jobId}: ${scrollResult.totalScreenshots} frames generated.`);

    res.json({
      success: true,
      status: job.status,
      scrollResult,
      report,
      manifest
    });
  } catch (err) {
    if (req.params.jobId && jobsStore.has(req.params.jobId)) {
      jobsStore.get(req.params.jobId).status = 'failed';
    }
    next(err);
  } finally {
    if (loaded) {
      await loaded.page.close().catch(() => {});
      await loaded.context.close().catch(() => {});
    }
  }
});

// --------------------------------------------------------------------------
// REPORTS & SCREENSHOTS API
// --------------------------------------------------------------------------
app.get('/api/jobs/:jobId/report', (req, res) => {
  const job = getJob(req.params.jobId);
  const reportPath = path.join(job.jobOutputDir, 'validation-report.json');
  if (existsSync(reportPath)) {
    return res.sendFile(reportPath);
  }
  res.json({ validationReport: job.validationReport });
});

app.get('/api/jobs/:jobId/screenshots', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job.scrollResult) {
    return res.json({ screenshots: [] });
  }

  const list = job.scrollResult.screenshots.map(s => ({
    ...s,
    url: `/output/${job.jobId}/screenshots/${s.filename}`
  }));

  res.json({
    total: list.length,
    screenshots: list,
    manifestUrl: `/output/${job.jobId}/screenshot-manifest.json`,
    htmlReportUrl: `/output/${job.jobId}/summary.html`,
    jsonReportUrl: `/output/${job.jobId}/validation-report.json`
  });
});

// --------------------------------------------------------------------------
// PRODUCTION FRONTEND (single-service hosting, e.g. Render)
// --------------------------------------------------------------------------
// When a production build exists (dist/), serve the dashboard from this same
// Express service alongside the API, with an SPA fallback so refreshing a
// non-root route returns index.html instead of a 404. In local development
// (no dist/ build) Vite serves the frontend on port 3000 and this block is
// inactive, so dev behaviour is unchanged.
const distDir = path.resolve(process.cwd(), './dist');
if (existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/output')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('API Error:', err);
  const statusCode = err instanceof AppError ? 400 : 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR',
    details: err.details || {},
    suggestion: err.suggestion || ''
  });
});

const PORT = process.env.PORT || DEFAULT_CONFIG.port;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Express API Server listening on http://localhost:${PORT}`);
  });
}

export default app;
