import { writeFile } from 'fs/promises';
import chalk from 'chalk';
import type { ScanResult, Report, ReportOptions, Finding, ContextLine, StackInfo } from '../types.js';
import { getRemediationGuide, type RemediationGuide } from './remediation-guides.js';
import { getStackSpecificGuides, type StackGuide } from '../stack-detector/stack-guides.js';

function buildReport(result: ScanResult, targetPath: string): Report {
  const acknowledged = result.findings.filter(f => f.acknowledged && !f.acknowledgment?.expired);
  const unacknowledged = result.findings.filter(f => !f.acknowledged || f.acknowledgment?.expired);

  const summary = {
    total: result.findings.length,
    acknowledged: acknowledged.length,
    unacknowledged: unacknowledged.length,
    critical: unacknowledged.filter(f => f.severity === 'critical').length,
    high: unacknowledged.filter(f => f.severity === 'high').length,
    medium: unacknowledged.filter(f => f.severity === 'medium').length,
    low: unacknowledged.filter(f => f.severity === 'low').length,
    info: unacknowledged.filter(f => f.severity === 'info').length,
  };

  return {
    timestamp: new Date().toISOString(),
    targetPath,
    summary,
    findings: result.findings,
    scannedFiles: result.scannedFiles,
    scanDuration: result.scanDuration,
    stack: result.stack,
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

function renderRemediationGuide(guide: RemediationGuide): string {
  return `
    <div class="remediation-guide">
      <div class="hipaa-impact">
        <h5>HIPAA Impact</h5>
        <p>${escapeHtml(guide.hipaaImpact).replace(/\n/g, '<br>')}</p>
      </div>

      <div class="fix-options">
        <h5>How to Fix</h5>
        ${guide.options.map((option, index) => `
          <details class="fix-option" ${index === 0 ? 'open' : ''}>
            <summary>${escapeHtml(option.title)}</summary>
            <p class="option-desc">${escapeHtml(option.description)}</p>
            <pre class="code-block"><code class="language-${option.language}">${escapeHtml(option.code)}</code></pre>
          </details>
        `).join('')}
      </div>

      <div class="documentation-links">
        <h5>Documentation</h5>
        <ul>
          ${guide.documentation.map(doc => `
            <li><a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">${escapeHtml(doc.title)}</a></li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderStackGuide(guide: StackGuide): string {
  return `
    <div class="stack-guide">
      <details class="fix-option" open>
        <summary>${escapeHtml(guide.title)}</summary>
        <p class="option-desc">${escapeHtml(guide.description)}</p>
        <pre class="code-block"><code class="language-${guide.language}">${escapeHtml(guide.code)}</code></pre>
      </details>
    </div>
  `;
}

function renderStackSection(stack: StackInfo): string {
  // Get stack-specific guides
  const detectedStack = {
    framework: stack.framework as any,
    database: stack.database as any,
    auth: stack.auth as any,
    dependencies: [],
    confidence: { framework: 1, database: 1, auth: 1 },
    details: {},
  };
  const guides = getStackSpecificGuides(detectedStack);

  return `
    <div class="stack-section">
      <h2>Stack Detected</h2>
      <div class="stack-cards">
        <div class="stack-card">
          <div class="stack-icon">⚡</div>
          <div class="stack-label">Framework</div>
          <div class="stack-value">${escapeHtml(stack.frameworkDisplay)}</div>
        </div>
        <div class="stack-card">
          <div class="stack-icon">🗄️</div>
          <div class="stack-label">Database</div>
          <div class="stack-value">${escapeHtml(stack.databaseDisplay)}</div>
        </div>
        <div class="stack-card">
          <div class="stack-icon">🔐</div>
          <div class="stack-label">Authentication</div>
          <div class="stack-value">${escapeHtml(stack.authDisplay)}</div>
        </div>
      </div>

      ${stack.recommendations.length > 0 ? `
      <div class="stack-recommendations">
        <h3>Stack-Specific Recommendations</h3>
        <ul>
          ${stack.recommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${guides.session.length > 0 || guides.database.length > 0 || guides.auth.length > 0 ? `
      <div class="stack-guides">
        <h3>Code Examples for Your Stack</h3>

        ${guides.session.length > 0 ? `
        <div class="guide-category">
          <h4>🔒 Session Management (${stack.frameworkDisplay})</h4>
          ${guides.session.map(g => renderStackGuide(g)).join('')}
        </div>
        ` : ''}

        ${guides.database.length > 0 ? `
        <div class="guide-category">
          <h4>🗄️ Database Security (${stack.databaseDisplay})</h4>
          ${guides.database.map(g => renderStackGuide(g)).join('')}
        </div>
        ` : ''}

        ${guides.auth.length > 0 ? `
        <div class="guide-category">
          <h4>🔐 Authentication (${stack.authDisplay})</h4>
          ${guides.auth.map(g => renderStackGuide(g)).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}
    </div>
  `;
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
  <title>HIPAA Compliance Report - vlayer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; padding: 2rem; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #111827; margin-bottom: 0.5rem; }
    h2 { color: #374151; margin: 2rem 0 1rem; }
    .meta { color: #6b7280; margin-bottom: 2rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .summary-card { background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .summary-card .count { font-size: 2rem; font-weight: bold; }
    .findings { display: flex; flex-direction: column; gap: 1.5rem; }
    .finding { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid; }
    .finding h3 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: white; text-transform: uppercase; }
    .badge-fixable { background: #059669; margin-left: 0.5rem; }
    .file { font-family: 'SF Mono', Monaco, 'Courier New', monospace; background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; word-break: break-all; }
    .context { margin: 1rem 0; background: #1e1e1e; border-radius: 6px; padding: 0.75rem; overflow-x: auto; }
    .context-line { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 0.8rem; line-height: 1.5; white-space: pre; color: #d4d4d4; }
    .context-line.highlight { background: rgba(234, 88, 12, 0.3); color: #fff; }
    .context-line .line-num { color: #6b7280; margin-right: 1rem; user-select: none; }
    .recommendation { margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 6px; border-left: 3px solid #3b82f6; }
    .hipaa-ref { color: #6b7280; font-size: 0.875rem; margin-top: 0.5rem; }

    /* Remediation Guide Styles */
    .guide-toggle { margin-top: 1rem; }
    .guide-toggle summary { cursor: pointer; padding: 0.75rem 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 6px; font-weight: 600; list-style: none; display: flex; align-items: center; gap: 0.5rem; }
    .guide-toggle summary::-webkit-details-marker { display: none; }
    .guide-toggle summary::before { content: '▶'; font-size: 0.75rem; transition: transform 0.2s; }
    .guide-toggle[open] summary::before { transform: rotate(90deg); }
    .guide-toggle summary:hover { opacity: 0.9; }

    .remediation-guide { padding: 1.5rem; background: #fefefe; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; }
    .remediation-guide h5 { color: #374151; margin: 1rem 0 0.5rem; font-size: 0.95rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }
    .remediation-guide h5:first-child { margin-top: 0; }

    .hipaa-impact { background: #fef2f2; padding: 1rem; border-radius: 6px; border-left: 3px solid #dc2626; margin-bottom: 1rem; }
    .hipaa-impact p { color: #7f1d1d; font-size: 0.9rem; }

    .fix-options { margin: 1rem 0; }
    .fix-option { margin: 0.75rem 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .fix-option summary { padding: 0.75rem 1rem; background: #f9fafb; cursor: pointer; font-weight: 500; color: #1f2937; }
    .fix-option summary:hover { background: #f3f4f6; }
    .fix-option[open] summary { border-bottom: 1px solid #e5e7eb; }
    .option-desc { padding: 1rem; color: #4b5563; font-size: 0.9rem; background: #fff; }

    .code-block { margin: 0; padding: 1rem; background: #1e1e1e; border-radius: 0 0 6px 6px; overflow-x: auto; }
    .code-block code { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 0.8rem; color: #d4d4d4; white-space: pre; }

    .documentation-links { margin-top: 1rem; }
    .documentation-links ul { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .documentation-links li a { display: inline-block; padding: 0.35rem 0.75rem; background: #e0e7ff; color: #3730a3; border-radius: 4px; text-decoration: none; font-size: 0.85rem; transition: background 0.2s; }
    .documentation-links li a:hover { background: #c7d2fe; }

    /* Syntax highlighting (basic) */
    .code-block .keyword { color: #c586c0; }
    .code-block .string { color: #ce9178; }
    .code-block .comment { color: #6a9955; }
    .code-block .function { color: #dcdcaa; }

    /* Stack Section Styles */
    .stack-section { margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 12px; border: 1px solid #e5e7eb; }
    .stack-section h2 { color: #374151; margin-bottom: 1rem; }
    .stack-section h3 { color: #4b5563; margin: 1.5rem 0 1rem; font-size: 1.1rem; }
    .stack-section h4 { color: #6b7280; margin: 1rem 0 0.5rem; font-size: 1rem; }
    .stack-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stack-card { background: white; padding: 1.25rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-align: center; border: 1px solid #e5e7eb; }
    .stack-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .stack-label { color: #6b7280; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .stack-value { color: #1f2937; font-size: 1.25rem; font-weight: 600; margin-top: 0.25rem; }
    .stack-recommendations { background: white; padding: 1rem 1.5rem; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 1.5rem; }
    .stack-recommendations ul { margin: 0.5rem 0 0 1.5rem; }
    .stack-recommendations li { margin: 0.5rem 0; color: #374151; }
    .stack-guides { background: white; padding: 1.5rem; border-radius: 8px; }
    .guide-category { margin-bottom: 1.5rem; }
    .guide-category:last-child { margin-bottom: 0; }
    .stack-guide { margin: 0.75rem 0; }

    @media (max-width: 768px) {
      body { padding: 1rem; }
      .summary { grid-template-columns: repeat(2, 1fr); }
      .stack-cards { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>HIPAA Compliance Report</h1>
    <p style="color: #6b7280; margin-bottom: 1rem;">Generated by <strong>vlayer</strong> - HIPAA Compliance Scanner</p>
    <div class="meta">
      <p><strong>Generated:</strong> ${report.timestamp}</p>
      <p><strong>Target:</strong> ${report.targetPath}</p>
      <p><strong>Files Scanned:</strong> ${report.scannedFiles} | <strong>Duration:</strong> ${report.scanDuration}ms</p>
    </div>

    <div class="summary">
      <div class="summary-card" style="border-top: 4px solid ${severityColors.critical}">
        <div class="count" style="color: ${severityColors.critical}">${report.summary.critical}</div>
        <div>Critical</div>
      </div>
      <div class="summary-card" style="border-top: 4px solid ${severityColors.high}">
        <div class="count" style="color: ${severityColors.high}">${report.summary.high}</div>
        <div>High</div>
      </div>
      <div class="summary-card" style="border-top: 4px solid ${severityColors.medium}">
        <div class="count" style="color: ${severityColors.medium}">${report.summary.medium}</div>
        <div>Medium</div>
      </div>
      <div class="summary-card" style="border-top: 4px solid ${severityColors.low}">
        <div class="count" style="color: ${severityColors.low}">${report.summary.low}</div>
        <div>Low</div>
      </div>
    </div>

    ${report.stack && report.stack.framework !== 'unknown' ? renderStackSection(report.stack) : ''}

    <h2>Findings</h2>
    <div class="findings">
      ${report.findings.map(f => {
        const guide = getRemediationGuide(f);
        return `
        <div class="finding" style="border-left-color: ${severityColors[f.severity]}">
          <h3>
            <span class="badge" style="background: ${severityColors[f.severity]}">${f.severity}</span>
            ${escapeHtml(f.title)}
            ${f.fixType ? '<span class="badge badge-fixable">Auto-fixable</span>' : ''}
          </h3>
          <p class="file">${escapeHtml(f.file)}${f.line ? `:${f.line}` : ''}</p>
          <p style="margin-top: 0.5rem;">${escapeHtml(f.description)}</p>
          ${renderContextHtml(f.context)}
          <div class="recommendation">
            <strong>Quick Recommendation:</strong> ${escapeHtml(f.recommendation)}
          </div>
          ${f.hipaaReference ? `<p class="hipaa-ref"><strong>HIPAA Reference:</strong> ${escapeHtml(f.hipaaReference)}</p>` : ''}

          ${guide ? `
          <details class="guide-toggle">
            <summary>View Detailed Remediation Guide</summary>
            ${renderRemediationGuide(guide)}
          </details>
          ` : ''}
        </div>
      `}).join('')}
    </div>

    <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.875rem;">
      <p>Generated by <strong>vlayer</strong> v0.2.0 - HIPAA Compliance Scanner for Healthcare Applications</p>
      <p>Run with <code>--fix</code> flag to automatically fix issues marked as "Auto-fixable"</p>
    </footer>
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
