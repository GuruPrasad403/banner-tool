#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { defaultBannerProfiles } from './config/banner-profiles.js';
import { DEFAULT_CONFIG } from './config/defaults.js';
import { createJobTempDir, createJobOutputDir } from './utils/paths.js';
import { loadInputSource } from './input/html-loader.js';
import { createAndLoadPage } from './browser/page-loader.js';
import { waitForRenderingStability } from './browser/renderer.js';
import { resolveSlidesMode } from './browser/slide-cycle.js';
import { detectBannerSections } from './sections/section-detector.js';
import { runValidationRules } from './validation/rule-engine.js';
import { executeNestedScrollCapture } from './screenshots/nested-scroll-engine.js';
import { createCaptureManifest } from './screenshots/capture-manifest.js';
import { createJsonReport } from './reports/json-report.js';
import { createHtmlReport } from './reports/html-report.js';
import { closeBrowserInstance } from './browser/browser-manager.js';
import { logger } from './utils/logger.js';

/**
 * Parses an animation-delay CLI value (ms). Falls back to the configured
 * default when the value is missing or invalid; 0 is valid (disables wait).
 */
function parseAnimationDelay(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_CONFIG.defaultTimeouts.animationDelay;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CONFIG.defaultTimeouts.animationDelay;
}

/**
 * Parses a slides-duration CLI value (ms) for the slides-first flow. Falls
 * back to the configured default (0 = off) when missing or invalid.
 */
function parseSlidesDuration(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_CONFIG.defaultTimeouts.slidesDuration;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CONFIG.defaultTimeouts.slidesDuration;
}

/**
 * Resolves the slides-flow mode for a CLI run: an explicit --slides-mode
 * wins; an explicit --slides-duration > 0 with no mode implies 'manual';
 * otherwise the configured default ('auto') applies.
 */
function parseSlidesMode(value, slidesDuration) {
  return resolveSlidesMode(value, slidesDuration, DEFAULT_CONFIG.defaultTimeouts.slidesMode);
}

const program = new Command();

program
  .name('xyz-banner-validator')
  .description('XYZ HTML Banner Validator and Automated Screenshot Generator')
  .version('1.0.0');

/**
 * Validate Command
 */
program
  .command('validate')
  .description('Validate banner dimensions and layout structure')
  .requiredOption('-i, --input <path>', 'Path to HTML file or ZIP package')
  .option('-p, --profile <profile>', 'Banner profile name (mobile-small, mobile-large, etc.)', 'mobile-small')
  .option('-w, --width <number>', 'Expected width in CSS pixels')
  .option('-h, --height <number>', 'Expected height in CSS pixels')
  .option('-r, --root <selector>', 'CSS selector for root banner container')
  .option('-s, --isi <selector>', 'CSS selector for nested scrollable ISI container')
  .option('-f, --fixed <selectors>', 'Comma-separated fixed section selectors (e.g. #header,#body-copy)')
  .option('--animation-delay <ms>', 'Animation delay in ms to wait for banner animation before validation', String(DEFAULT_CONFIG.defaultTimeouts.animationDelay))
  .option('--slides-duration <ms>', 'Slides-first flow (manual mode): ms for all slides to play once (ISI held at top), then freeze on slide 1 before validation', String(DEFAULT_CONFIG.defaultTimeouts.slidesDuration))
  .option('--slides-mode <mode>', 'Slides flow mode: auto (detect the slide cycle from the banner animations; default) | manual (use --slides-duration) | off')
  .action(async (options) => {
    let loaded = null;
    try {
      const profile = defaultBannerProfiles[options.profile] || defaultBannerProfiles['mobile-small'];
      const expectedWidth = Number(options.width) || profile.width || 300;
      const expectedHeight = Number(options.height) || profile.height || 250;
      const rootSelector = options.root || profile.rootSelector;
      const isiSelector = options.isi || profile.isiSelector;
      const fixedSelectors = options.fixed ? options.fixed.split(',').map(s => s.trim()) : profile.fixedSelectors;
      const animationDelay = parseAnimationDelay(options.animationDelay);
      const slidesDuration = parseSlidesDuration(options.slidesDuration);
      const slidesMode = parseSlidesMode(options.slidesMode, slidesDuration);

      const jobId = `cli_val_${Date.now()}`;
      const tempDir = await createJobTempDir(jobId);

      logger.info(`Starting banner validation for input: ${options.input}`);
      const loadResult = await loadInputSource(options.input, tempDir);

      loaded = await createAndLoadPage(loadResult.primaryHtmlFile, {
        width: expectedWidth,
        height: expectedHeight,
        deviceScaleFactor: 2
      });

      await waitForRenderingStability(loaded.page, { animationDelay, slidesDuration, slidesMode, isiSelector });

      const sectionData = await detectBannerSections(loaded.page, {
        rootSelector,
        fixedSelectors,
        isiSelector
      });

      const validation = await runValidationRules(loaded.page, loadResult.primaryHtmlFile, sectionData, {
        expectedWidth,
        expectedHeight
      });

      console.log('\n========================================');
      console.log('BANNER VALIDATION REPORT');
      console.log('========================================');
      console.log(`Status:          ${validation.overallStatus.toUpperCase()}`);
      console.log(`Expected Dims:   ${expectedWidth}x${expectedHeight} px`);
      console.log(`Actual Dims:     ${sectionData.root?.box?.width || 0}x${sectionData.root?.box?.height || 0} px`);
      console.log(`Root Selector:   ${sectionData.root?.selector} (${sectionData.root?.reason})`);
      console.log(`ISI Selector:    ${sectionData.isi?.selector || 'Not Found'}`);
      console.log('----------------------------------------');
      console.log('Rule Results:');
      validation.rules.forEach(r => {
        const symbol = r.status === 'passed' ? '✓' : (r.status === 'warning' ? '⚠' : '✗');
        console.log(` [${symbol}] ${r.ruleId}: ${r.message}`);
      });
      console.log('========================================\n');

      if (validation.overallStatus === 'failed') {
        process.exitCode = 1;
      }
    } catch (err) {
      logger.error('CLI Validation Error:', err.message);
      process.exitCode = 1;
    } finally {
      if (loaded) {
        await loaded.page.close().catch(() => {});
        await loaded.context.close().catch(() => {});
      }
      await closeBrowserInstance();
    }
  });

/**
 * Capture Command
 */
program
  .command('capture')
  .description('Generate nested ISI scroll frame screenshots and validation reports')
  .requiredOption('-i, --input <path>', 'Path to HTML file or ZIP package')
  .option('-p, --profile <profile>', 'Banner profile name', 'mobile-small')
  .option('-w, --width <number>', 'Expected width')
  .option('-h, --height <number>', 'Expected height')
  .option('-r, --root <selector>', 'Root selector')
  .option('-s, --isi <selector>', 'ISI selector')
  .option('-f, --fixed <selectors>', 'Comma separated fixed region selectors')
  .option('-o, --output <dir>', 'Output directory path', './output')
  .option('--scale <scale>', 'Device scale factor', '2')
  .option('--overlap <pixels>', 'Scroll overlap in pixels', '10')
  .option('--animation-delay <ms>', 'Animation delay in ms to wait for banner animation before capture', String(DEFAULT_CONFIG.defaultTimeouts.animationDelay))
  .option('--slides-duration <ms>', 'Slides-first flow (manual mode): ms for all slides to play once (ISI held at top), then freeze on slide 1 before ISI scroll capture', String(DEFAULT_CONFIG.defaultTimeouts.slidesDuration))
  .option('--slides-mode <mode>', 'Slides flow mode: auto (detect the slide cycle from the banner animations; default) | manual (use --slides-duration) | off')
  .action(async (options) => {
    let loaded = null;
    try {
      const profile = defaultBannerProfiles[options.profile] || defaultBannerProfiles['mobile-small'];
      const expectedWidth = Number(options.width) || profile.width || 300;
      const expectedHeight = Number(options.height) || profile.height || 250;
      const rootSelector = options.root || profile.rootSelector;
      const isiSelector = options.isi || profile.isiSelector;
      const fixedSelectors = options.fixed ? options.fixed.split(',').map(s => s.trim()) : profile.fixedSelectors;
      const deviceScaleFactor = Number(options.scale) || profile.deviceScaleFactor || 2;
      const overlap = Number(options.overlap) || profile.overlap || 10;
      const animationDelay = parseAnimationDelay(options.animationDelay);
      const slidesDuration = parseSlidesDuration(options.slidesDuration);
      const slidesMode = parseSlidesMode(options.slidesMode, slidesDuration);

      const jobId = `cli_cap_${Date.now()}`;
      const tempDir = await createJobTempDir(jobId);
      const { jobOutputDir, screenshotsDir } = await createJobOutputDir(jobId);
      const slidesDir = path.join(jobOutputDir, 'slides');

      logger.info(`Starting automated screenshot capture for: ${options.input}`);
      const loadResult = await loadInputSource(options.input, tempDir);

      loaded = await createAndLoadPage(loadResult.primaryHtmlFile, {
        width: expectedWidth,
        height: expectedHeight,
        deviceScaleFactor
      });

      const stabilityResult = await waitForRenderingStability(loaded.page, { animationDelay, slidesDuration, slidesMode, isiSelector, rootSelector, slidesDir });

      const sectionData = await detectBannerSections(loaded.page, {
        rootSelector,
        fixedSelectors,
        isiSelector
      });

      const validation = await runValidationRules(loaded.page, loadResult.primaryHtmlFile, sectionData, {
        expectedWidth,
        expectedHeight
      });

      const scrollResult = await executeNestedScrollCapture(
        loaded.page,
        sectionData,
        screenshotsDir,
        { overlap, jobId }
      );

      const jobConfig = {
        profile: options.profile,
        expectedWidth,
        expectedHeight,
        deviceScaleFactor,
        overlap,
        animationDelay,
        slidesDuration,
        slidesMode: stabilityResult?.slidesMode ?? slidesMode,
        detectedCycleMs: stabilityResult?.detectedCycleMs ?? null,
        slidesWaitMs: stabilityResult?.slidesDurationApplied ?? 0,
        slidesFreeze: stabilityResult?.slidesFreeze ?? null,
        slideFrames: stabilityResult?.slideFrames ?? [],
        slidesFlow: {
          mode: stabilityResult?.slidesMode ?? slidesMode,
          detectedCycleMs: stabilityResult?.detectedCycleMs ?? null,
          waitedMs: stabilityResult?.slidesDurationApplied ?? 0,
          freeze: stabilityResult?.slidesFreeze ?? null
        }
      };

      const { report } = await createJsonReport(jobId, jobConfig, sectionData, validation, scrollResult, jobOutputDir);
      await createCaptureManifest(jobId, jobConfig, sectionData, scrollResult, jobOutputDir);
      await createHtmlReport(jobId, report, scrollResult, jobOutputDir);

      console.log('\n========================================');
      console.log('SCREENSHOT GENERATION COMPLETED');
      console.log('========================================');
      console.log(`Job ID:              ${jobId}`);
      console.log(`Output Directory:    ${jobOutputDir}`);
      console.log(`Validation Status:   ${validation.overallStatus.toUpperCase()}`);
      console.log(`Total Screenshots:   ${scrollResult.totalScreenshots} frames`);
      console.log(`Coverage Verified:   ${scrollResult.coverage.status === 'passed' ? 'YES (100%)' : 'NO'}`);
      console.log(`Slides Flow:         ${jobConfig.slidesFlow.mode}${jobConfig.slidesFlow.detectedCycleMs != null ? ` (detected cycle ${jobConfig.slidesFlow.detectedCycleMs}ms)` : ''} — waited ${jobConfig.slidesFlow.waitedMs}ms, freeze ${jobConfig.slidesFlow.freeze ? (jobConfig.slidesFlow.freeze.warning ? 'WARNING' : 'held on slide 1') : 'skipped'}`);
      console.log(`Slide Frames:        ${jobConfig.slideFrames.length} distinct slide(s) recorded during playback${jobConfig.slideFrames.length ? ` (${jobConfig.slideFrames.map(f => f.file).join(', ')})` : ''}`);
      console.log('----------------------------------------');
      scrollResult.screenshots.forEach(s => {
        console.log(` [Frame ${s.index}] ${s.filename} -> scrollTop: ${s.scrollTop}px (Stability: ${s.stability.toUpperCase()})`);
      });
      console.log('========================================\n');

      if (validation.overallStatus === 'failed') {
        process.exitCode = 1;
      }
    } catch (err) {
      logger.error('CLI Capture Error:', err.message);
      process.exitCode = 1;
    } finally {
      if (loaded) {
        await loaded.page.close().catch(() => {});
        await loaded.context.close().catch(() => {});
      }
      await closeBrowserInstance();
    }
  });

program.parse();
