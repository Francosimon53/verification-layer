import { writeFile } from 'fs/promises';
import chalk from 'chalk';
import type { ScanResult, Report, ReportOptions, Finding, ContextLine } from '../types.js';

function buildReport(result: ScanResult, targetPath: string): Report {
  const summary = {
    total: result.findings.length,
    critical: result.findings.filter(f => f.severity === 'critical').length,
    high: result.findings.filter(f => f.severity === 'high').length,
    medium: result.findings.filter(f => f.severity === 'medium').length,
    low: result.findings.filter(f => f.severity === 'low').length,
    info: result.findings.filter(f => f.severity === 'info').length,
  };

  return {
    timestamp: new Date().toISOString(),
    targetPath,
    summary,
    findings: result.findings,
    scannedFiles: result.scannedFiles,
    scanDuration: result.scanDuration,
  };
}

function generateJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

function renderContextMarkdown(context?: ContextLine[]): string {
  if (!context || context.length === 0) return '';

  const lines = context.map(c => {
    const prefix = c.isMatch ? '>' : ' ';
    const lineNum = String(c.lineNumber).padStart(4, ' ');
    return `${prefix} ${lineNum} | ${c.content}`;
  });

  return '\n```\n' + lines.join('\n') + '\n```\n';
}

function generateMarkdown(report: Report): string {
  const lines: string[] = [
    '# HIPAA Compliance Report',
    '',
    `**Generated:** ${report.timestamp}`,
    `**Target:** ${report.targetPath}`,
    `**Files Scanned:** ${report.scannedFiles}`,
    `**Duration:** ${report.scanDuration}ms`,
    '',
    '## Summary',
    '',
    `| Severity | Count |`,
    `|----------|-------|`,
    `| Critical | ${report.summary.critical} |`,
    `| High | ${report.summary.high} |`,
    `| Medium | ${report.summary.medium} |`,
    `| Low | ${report.summary.low} |`,
    `| Info | ${report.summary.info} |`,
    `| **Total** | **${report.summary.total}** |`,
    '',
  ];

  if (report.findings.length > 0) {
    lines.push('## Findings', '');

    const groupedByCategory = report.findings.reduce((acc, f) => {
      acc[f.category] = acc[f.category] || [];
      acc[f.category].push(f);
      return acc;
    }, {} as Record<string, Finding[]>);

    for (const [category, findings] of Object.entries(groupedByCategory)) {
      lines.push(`### ${formatCategory(category)}`, '');

      for (const finding of findings) {
        lines.push(
          `#### ${severityBadge(finding.severity)} ${finding.title}`,
          '',
          `**File:** \`${finding.file}\`${finding.line ? `:${finding.line}` : ''}`,
          '',
          finding.description,
          ''
        );

        // Add context if available
        if (finding.context && finding.context.length > 0) {
          lines.push(renderContextMarkdown(finding.context));
        }

        lines.push(
          `**Recommendation:** ${finding.recommendation}`,
          ''
        );
        if (finding.hipaaReference) {
          lines.push(`**HIPAA Reference:** ${finding.hipaaReference}`, '');
        }
        lines.push('---', '');
      }
    }
  } else {
    lines.push('## No Issues Found', '', 'The scan did not detect any HIPAA compliance issues.');
  }

  return lines.join('\n');
}

function renderContextHtml(context?: ContextLine[]): string {
  if (!context || context.length === 0) return '';

  const lines = context.map(c => {
    const lineNum = String(c.lineNumber).padStart(4, ' ');
    const highlightClass = c.isMatch ? 'highlight' : '';
    return `<div class="context-line ${highlightClass}"><span class="line-num">${lineNum}</span><span class="line-content">${escapeHtml(c.content)}</span></div>`;
  });

  return `<div class="context">${lines.join('')}</div>`;
}

function generateHtml(report: Report): string {
  const severityColors = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
    info: '#6b7280',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HIPAA Compliance Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #111827; margin-bottom: 1rem; }
    .meta { color: #6b7280; margin-bottom: 2rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .summary-card { background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .summary-card .count { font-size: 2rem; font-weight: bold; }
    .findings { display: flex; flex-direction: column; gap: 1rem; }
    .finding { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid; }
    .finding h3 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: white; text-transform: uppercase; }
    .file { font-family: monospace; background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; word-break: break-all; }
    .context { margin: 1rem 0; background: #1e1e1e; border-radius: 6px; padding: 0.75rem; overflow-x: auto; }
    .context-line { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 0.8rem; line-height: 1.5; white-space: pre; color: #d4d4d4; }
    .context-line.highlight { background: rgba(234, 88, 12, 0.2); color: #fff; }
    .context-line .line-num { color: #6b7280; margin-right: 1rem; user-select: none; }
    .context-line .line-content { }
    .recommendation { margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 4px; }
    .hipaa-ref { color: #6b7280; font-size: 0.875rem; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>HIPAA Compliance Report</h1>
    <div class="meta">
      <p>Generated: ${report.timestamp}</p>
      <p>Target: ${report.targetPath}</p>
      <p>Files Scanned: ${report.scannedFiles} | Duration: ${report.scanDuration}ms</p>
    </div>

    <div class="summary">
      <div class="summary-card" style="border-top: 4px solid ${severityColors.critical}">
        <div class="count">${report.summary.critical}</div>
        <div>Critical</div>
      </div>
      <div class="summary-card" style="border-top: 4px solid ${severityColors.high}">
        <div class="count">${report.summary.high}</div>
        <div>High</div>
      </div>
      <div class="summary-card" style="border-top: 4px solid ${severityColors.medium}">
        <div class="count">${report.summary.medium}</div>
        <div>Medium</div>
      </div>
      <div class="summary-card" style="border-top: 4px solid ${severityColors.low}">
        <div class="count">${report.summary.low}</div>
        <div>Low</div>
      </div>
    </div>

    <h2>Findings</h2>
    <div class="findings">
      ${report.findings.map(f => `
        <div class="finding" style="border-left-color: ${severityColors[f.severity]}">
          <h3>
            <span class="badge" style="background: ${severityColors[f.severity]}">${f.severity}</span>
            ${escapeHtml(f.title)}
          </h3>
          <p class="file">${escapeHtml(f.file)}${f.line ? `:${f.line}` : ''}</p>
          <p>${escapeHtml(f.description)}</p>
          ${renderContextHtml(f.context)}
          <div class="recommendation">
            <strong>Recommendation:</strong> ${escapeHtml(f.recommendation)}
          </div>
          ${f.hipaaReference ? `<p class="hipaa-ref">HIPAA Reference: ${escapeHtml(f.hipaaReference)}</p>` : ''}
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCategory(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function severityBadge(severity: string): string {
  const badges: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    info: '⚪',
  };
  return badges[severity] || '⚪';
}

export async function generateReport(
  result: ScanResult,
  targetPath: string,
  options: ReportOptions
): Promise<void> {
  const report = buildReport(result, targetPath);

  let content: string;
  let extension: string;

  switch (options.format) {
    case 'html':
      content = generateHtml(report);
      extension = 'html';
      break;
    case 'markdown':
      content = generateMarkdown(report);
      extension = 'md';
      break;
    case 'json':
    default:
      content = generateJson(report);
      extension = 'json';
  }

  if (options.outputPath) {
    await writeFile(options.outputPath, content);
    console.log(chalk.green(`\nReport saved to: ${options.outputPath}`));
  } else {
    const defaultPath = `vlayer-report.${extension}`;
    await writeFile(defaultPath, content);
    console.log(chalk.green(`\nReport saved to: ${defaultPath}`));
  }
}
