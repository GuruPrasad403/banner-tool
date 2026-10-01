import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { validateBannerWidth } from '../../src/validation/width-validator.js';
import { validateBannerHeight } from '../../src/validation/height-validator.js';
import { validateScrollCoverage } from '../../src/validation/coverage-validator.js';
import { sanitizeExtractPath } from '../../src/utils/paths.js';
import { loadInputSource } from '../../src/input/html-loader.js';

describe('Validators & Security Unit Tests', () => {
  it('should pass width validation when width matches expected', () => {
    const res = validateBannerWidth(300, 300, 0);
    expect(res.status).toBe('passed');
    expect(res.details.diff).toBe(0);
  });

  it('should fail width validation when width mismatches', () => {
    const res = validateBannerWidth(305, 300, 0);
    expect(res.status).toBe('failed');
    expect(res.details.diff).toBe(5);
  });

  it('should pass height validation within tolerance', () => {
    const res = validateBannerHeight(252, 250, 3);
    expect(res.status).toBe('passed');
  });

  it('should detect coverage gap in scroll screenshots', () => {
    const screenshots = [
      { index: 1, scrollTop: 0 },
      { index: 2, scrollTop: 150 }, // Gap! clientHeight is 100, so frame 1 end was 100. Uncovered 100->150
      { index: 3, scrollTop: 200 }
    ];
    const res = validateScrollCoverage(screenshots, { clientHeight: 100, scrollHeight: 300, maxScrollTop: 200 });
    expect(res.status).toBe('failed');
    expect(res.message).toContain('Coverage gap detected');
  });

  it('should block zip path traversal attempts', () => {
    expect(() => {
      sanitizeExtractPath('/safe/target', '../../etc/passwd');
    }).toThrow('Zip path traversal detected');
  });

  it('should process uploaded HTML file with Multer hash path and original filename', async () => {
    const fixturePath = path.resolve(process.cwd(), './fixtures/sample-banner-300x250/index.html');
    const workDir = path.resolve(process.cwd(), './temp/unit_test_upload');
    const res = await loadInputSource(fixturePath, workDir, 'xyz-banner-test.html');
    expect(res.primaryHtmlFile).toContain('xyz-banner-test.html');
    expect(existsSync(res.primaryHtmlFile)).toBe(true);
  });
});
