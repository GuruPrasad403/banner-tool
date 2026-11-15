import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeValidationReport,
  summarizeRules,
  deriveOverallStatus,
  getValidationStatus
} from '../../src/validation/report-normalizer.js';
import { selectStableSlideFrames } from '../../src/browser/slide-cycle.js';
import { createCaptureManifest } from '../../src/screenshots/capture-manifest.js';

const RULES = [
  { ruleId: 'ROOT_ELEMENT_EXISTS', status: 'passed' },
  { ruleId: 'WIDTH_VALIDATION', status: 'passed' },
  { ruleId: 'HEIGHT_VALIDATION', status: 'passed' },
  { ruleId: 'HORIZONTAL_OVERFLOW', status: 'passed' },
  { ruleId: 'ISI_ELEMENT_EXISTS', status: 'passed' },
  { ruleId: 'ISI_SCROLLABLE', status: 'passed' },
  { ruleId: 'ASSET_INTEGRITY', status: 'passed' }
];
const SUMMARY = { total: 7, passed: 7, failed: 0, warnings: 0, skipped: 0 };

// The rule-engine shape (VALIDATE route / job.validationReport).
const ENGINE_SHAPE = { overallStatus: 'passed', summary: SUMMARY, rules: RULES };
// The JSON-report shape (CAPTURE route's `report` field) — same data,
// different field names. This mismatch is what made the dashboard header
// show "Ran 0 rules / VALIDATION FAILED" over 7 passed rules.
const JSON_REPORT_SHAPE = { status: 'passed', validationSummary: SUMMARY, rules: RULES };

describe('Validation Report Normalisation (Defect 1)', () => {
  it('should pass the rule-engine shape through unchanged', () => {
    const n = normalizeValidationReport(ENGINE_SHAPE);
    expect(n.overallStatus).toBe('passed');
    expect(n.summary).toEqual(SUMMARY);
    expect(n.rules).toHaveLength(7);
  });

  it('should normalise the JSON-report shape to the same status and summary as the rule-engine shape', () => {
    const fromJson = normalizeValidationReport(JSON_REPORT_SHAPE);
    const fromEngine = normalizeValidationReport(ENGINE_SHAPE);
    expect(fromJson.overallStatus).toBe(fromEngine.overallStatus);
    expect(fromJson.summary).toEqual(fromEngine.summary);
    expect(fromJson.summary.total).toBe(7);
    expect(fromJson.summary.passed).toBe(7);
  });

  it('should compute the summary from the rules when no summary is present', () => {
    const n = normalizeValidationReport({ overallStatus: 'passed', rules: RULES });
    expect(n.summary).toEqual(SUMMARY);
  });

  it('should derive the status from the rules when both status fields are absent', () => {
    expect(normalizeValidationReport({ rules: RULES }).overallStatus).toBe('passed');
    expect(
      normalizeValidationReport({ rules: [...RULES, { ruleId: 'X', status: 'failed' }] }).overallStatus
    ).toBe('failed');
    expect(
      normalizeValidationReport({ rules: [...RULES, { ruleId: 'X', status: 'warning' }] }).overallStatus
    ).toBe('passed_with_warnings');
  });

  it('should count warnings and skipped rules from the rules array', () => {
    const rules = [
      { ruleId: 'A', status: 'passed' },
      { ruleId: 'B', status: 'warning' },
      { ruleId: 'C', status: 'skipped' },
      { ruleId: 'D', status: 'failed' }
    ];
    expect(summarizeRules(rules)).toEqual({ total: 4, passed: 1, failed: 1, warnings: 1, skipped: 1 });
    expect(deriveOverallStatus(rules)).toBe('failed');
    expect(deriveOverallStatus([])).toBeNull();
  });

  it('getValidationStatus should read overallStatus (jobs-list stats regression)', () => {
    // GET /api/jobs used to read `.status` off the rule-engine object,
    // which only has `overallStatus` — completed jobs always read
    // 'pending' and the Passed/Failed counters stayed at 0.
    expect(getValidationStatus(ENGINE_SHAPE)).toBe('passed');
    expect(getValidationStatus(JSON_REPORT_SHAPE)).toBe('passed');
    expect(getValidationStatus(null)).toBeNull();
    expect(getValidationStatus(undefined)).toBeNull();
  });

  it('should record slideFrames with urls in the capture manifest', async () => {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'manifest-slides-'));
    const jobConfig = {
      profile: 'mobile-small',
      expectedWidth: 300,
      expectedHeight: 250,
      deviceScaleFactor: 2,
      overlap: 10,
      slideFrames: [
        { index: 1, file: 'slide-01.png', atMs: 1200 },
        { index: 2, file: 'slide-02.png', atMs: 3300 },
        { index: 3, file: 'slide-03.png', atMs: 5400 }
      ]
    };
    const sectionData = {
      root: { selector: '#banner' },
      fixedRegions: [],
      isi: { selector: '#isi-container' }
    };
    const scrollResult = {
      initialIsiMetrics: { scrollTop: 0, clientHeight: 86, scrollHeight: 567, maxScrollTop: 481 },
      totalScreenshots: 8,
      coverage: { status: 'passed' },
      screenshots: []
    };

    const { manifest } = await createCaptureManifest('job_test_slides', jobConfig, sectionData, scrollResult, outputDir);

    expect(manifest.slideFrames).toHaveLength(3);
    expect(manifest.slideFrames[0]).toEqual({
      index: 1,
      file: 'slide-01.png',
      url: '/output/job_test_slides/slides/slide-01.png',
      atMs: 1200
    });

    await fs.rm(outputDir, { recursive: true, force: true });
  });
});

describe('Stable Slide Frame Selection (Defect 2)', () => {
  const sample = (regionHash, atMs) => ({ regionHash, atMs, buffer: Buffer.from(regionHash) });

  it('should keep the last frame of each stable slide state and drop crossfade transients', () => {
    const samples = [
      sample('S1', 0), sample('S1', 450), sample('S1', 900), sample('S1', 1350), sample('S1', 1800),
      sample('FADE_A', 2250),
      sample('S2', 2700), sample('S2', 3150), sample('S2', 3600),
      sample('FADE_B', 4050),
      sample('S3', 4500), sample('S3', 4950), sample('S3', 5400),
      sample('FADE_C', 5850)
    ];
    const selected = selectStableSlideFrames(samples);
    expect(selected.map((s) => s.regionHash)).toEqual(['S1', 'S2', 'S3']);
    expect(selected.map((s) => s.atMs)).toEqual([1800, 3600, 5400]);
  });

  it('should fall back to per-run dedupe when no state is stable', () => {
    const samples = [sample('A', 0), sample('B', 450), sample('C', 900)];
    const selected = selectStableSlideFrames(samples);
    expect(selected.map((s) => s.regionHash)).toEqual(['A', 'B', 'C']);
  });

  it('should cap the number of kept frames', () => {
    const samples = [];
    for (let i = 1; i <= 8; i++) {
      samples.push(sample(`S${i}`, i * 1000), sample(`S${i}`, i * 1000 + 400));
    }
    expect(selectStableSlideFrames(samples)).toHaveLength(6);
    expect(selectStableSlideFrames(samples, { maxFrames: 3 })).toHaveLength(3);
  });

  it('should return an empty list for no samples', () => {
    expect(selectStableSlideFrames([])).toEqual([]);
    expect(selectStableSlideFrames(undefined)).toEqual([]);
  });
});
