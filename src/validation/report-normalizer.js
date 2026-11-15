/**
 * Validation-report shape normalisation.
 *
 * Two report shapes exist in this codebase:
 *  - the rule-engine shape (src/validation/rule-engine.js):
 *      { overallStatus, summary: { total, passed, failed, warnings, skipped }, rules }
 *  - the JSON-report shape (src/reports/json-report.js):
 *      { status, validationSummary: { ...same counts... }, rules }
 *
 * The VALIDATE route returns the first; the CAPTURE route returns the
 * second. Any consumer (dashboard view, jobs-list stats) that reads only
 * one shape silently breaks on the other — e.g. the dashboard header
 * showed "Ran 0 rules / VALIDATION FAILED" over a list of passed rules
 * after a capture run. These pure helpers fold both shapes into the
 * canonical rule-engine shape so header counts and listed rules always
 * agree. Kept dependency-free so the dashboard (Vite) and unit tests can
 * import the same module.
 */

export function summarizeRules(rules) {
  const list = Array.isArray(rules) ? rules : [];
  return {
    total: list.length,
    passed: list.filter((r) => r.status === 'passed').length,
    failed: list.filter((r) => r.status === 'failed').length,
    warnings: list.filter((r) => r.status === 'warning').length,
    skipped: list.filter((r) => r.status === 'skipped').length
  };
}

export function deriveOverallStatus(rules) {
  const list = Array.isArray(rules) ? rules : [];
  if (list.length === 0) return null;
  if (list.some((r) => r.status === 'failed')) return 'failed';
  if (list.some((r) => r.status === 'warning')) return 'passed_with_warnings';
  return 'passed';
}

/**
 * Folds either report shape into { overallStatus, summary, rules }.
 * Status resolution: overallStatus ?? status ?? derived from the rules.
 * Summary resolution: summary ?? validationSummary, completed from the
 * rules array so missing counts can never disagree with the listed rules.
 */
export function normalizeValidationReport(report) {
  if (!report || typeof report !== 'object') {
    return { overallStatus: null, summary: summarizeRules([]), rules: [] };
  }

  const rules = Array.isArray(report.rules) ? report.rules : [];
  const providedSummary = report.summary ?? report.validationSummary ?? null;
  const summary = { ...summarizeRules(rules), ...(providedSummary || {}) };
  const overallStatus = report.overallStatus ?? report.status ?? deriveOverallStatus(rules);

  return { overallStatus, summary, rules };
}

/** Convenience: just the canonical status string (or null). */
export function getValidationStatus(report) {
  return normalizeValidationReport(report).overallStatus;
}
