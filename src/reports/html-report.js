import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Creates a standalone, self-contained HTML summary report (summary.html)
 * with a dark professional theme, embedded screenshot gallery, and diagnostics.
 */
export async function createHtmlReport(jobId, jsonReport, scrollResult, outputDir) {
  const screenshots = scrollResult?.screenshots || [];

  const statusBadgeColor = jsonReport.status === 'passed' 
    ? '#10b981' 
    : (jsonReport.status === 'passed_with_warnings' ? '#f59e0b' : '#ef4444');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Banner Validation Summary - ${jobId}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #111827;
      --border: #1f2937;
      --text: #f9fafb;
      --subtext: #9ca3af;
      --accent: #0284c7;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    .metric-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .metric-label { font-size: 13px; color: var(--subtext); margin-bottom: 4px; }
    .metric-val { font-size: 20px; font-weight: 700; }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    .shot-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
    }
    .shot-card img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: #ffffff;
    }
    .shot-meta {
      margin-top: 10px;
      font-size: 12px;
      color: var(--subtext);
      text-align: center;
    }
    .rules-list {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .rule-item {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rule-item:last-child { border-bottom: none; }
    .status-passed { color: var(--success); font-weight: 600; }
    .status-failed { color: var(--danger); font-weight: 600; }
    .status-warning { color: var(--warning); font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-card">
      <div>
        <h1 style="margin: 0 0 6px 0; font-size: 24px;">XYZ Banner Validation Summary</h1>
        <div style="color: var(--subtext); font-size: 14px;">Job ID: <strong>${jobId}</strong> | Generated: ${new Date(jsonReport.timestamp).toLocaleString()}</div>
      </div>
      <div>
        <span class="badge" style="background: ${statusBadgeColor}22; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeColor};">
          ${jsonReport.status.replace('_', ' ')}
        </span>
      </div>
    </div>

    <div class="grid">
      <div class="metric-card">
        <div class="metric-label">Expected Dimensions</div>
        <div class="metric-val">${jsonReport.expected.width} × ${jsonReport.expected.height} px</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Actual Dimensions</div>
        <div class="metric-val">${jsonReport.actual.width} × ${jsonReport.actual.height} px</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Screenshots Generated</div>
        <div class="metric-val">${jsonReport.scrollMetrics?.totalScreenshots || 0} Frames</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">ISI Scroll Height</div>
        <div class="metric-val">${jsonReport.scrollMetrics?.metrics?.scrollHeight || 0} px</div>
      </div>
    </div>

    <div class="section-title">Validation Rule Checks</div>
    <div class="rules-list" style="margin-bottom: 32px;">
      ${jsonReport.rules.map(r => `
        <div class="rule-item">
          <div>
            <strong>${r.ruleId}</strong>: ${r.message}
          </div>
          <div class="status-${r.status}">${r.status.toUpperCase()}</div>
        </div>
      `).join('')}
    </div>

    <div class="section-title">Captured Banner Frames (Fixed Frame + Nested ISI Scroll)</div>
    <div class="gallery">
      ${screenshots.map((s, idx) => `
        <div class="shot-card">
          <img src="screenshots/${s.filename}" alt="Frame ${s.index}" />
          <div class="shot-meta">
            <div><strong>Frame #${s.index}</strong></div>
            <div>scrollTop: ${s.scrollTop}px</div>
            <div>Stability: <span class="status-${s.stability}">${s.stability.toUpperCase()}</span></div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

  const htmlPath = path.join(outputDir, 'summary.html');
  await fs.writeFile(htmlPath, htmlContent, 'utf-8');

  return { htmlPath };
}
