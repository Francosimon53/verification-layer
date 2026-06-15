import { createHash } from 'crypto';
import type { ScanResult, ResolvedBranding } from '../types.js';
import { generateComplianceScoreGauge, generateExecutiveSummary, generateEnhancedCSS } from './enhanced-html.js';
import { brandFooterText, brandPreparedBy, logoDataUri } from './branding.js';
import {
  groupFindingsByLocation,
  countGroupsBySeverity,
  formatHipaaRef,
  partitionFindingsByStatus,
  sortProposedFindings,
} from './finding-presentation.js';

interface AuditorReportOptions {
  organizationName?: string;
  reportPeriod?: string;
  auditorName?: string;
  includeBaseline?: boolean;
  branding?: ResolvedBranding;
}

/**
 * Generate auditor-ready HTML report with compliance score and SHA256 hash
 */
export function generateAuditorReport(
  result: ScanResult,
  targetPath: string,
  options: AuditorReportOptions = {}
): { html: string; hash: string } {
  const {
    organizationName = 'Organization',
    reportPeriod = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
    auditorName = 'VLayer Automated Scan',
    includeBaseline = false,
    branding,
  } = options;

  // White-label branding. When a brand is supplied the cover shows the brand
  // logo + "Prepared by {brand}", and a footer line repeats on every printed
  // page. With no branding the report renders exactly as before (default VLayer).
  const brandLogo = logoDataUri(branding);
  const hasBrand = Boolean(branding?.name || brandLogo);
  const preparedBy = brandPreparedBy(branding);
  const footerLine = brandFooterText(branding);

  const timestamp = new Date().toISOString();
  const score = result.complianceScore!;

  // Calculate findings
  const activeFindings = result.findings.filter(f => !f.isBaseline && !f.suppressed);
  // Presentation-only: separate proposed (NPRM) findings from current ones, then
  // collapse multiple rules on the same file:line into one grouped entry. The
  // findings themselves are untouched (count is preserved).
  const { current: currentFindings, proposed: proposedRaw } = partitionFindingsByStatus(activeFindings);
  const proposedFindings = sortProposedFindings(proposedRaw);
  const locationGroups = groupFindingsByLocation(currentFindings);
  const groupCounts = countGroupsBySeverity(locationGroups);
  const acknowledgedFindings = result.findings.filter(f => f.acknowledged && !f.acknowledgment?.expired);
  const suppressedFindings = result.findings.filter(f => f.suppressed);
  const baselineFindings = result.findings.filter(f => f.isBaseline);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HIPAA Compliance Audit Report - ${organizationName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; background: white; }

    /* Header with branding */
    .report-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 3rem 2rem;
      text-align: center;
    }

    .logo-placeholder {
      width: 80px;
      height: 80px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      margin: 0 auto 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: bold;
    }

    .brand-logo {
      max-height: 80px;
      max-width: 240px;
      margin: 0 auto 1rem;
      display: block;
      object-fit: contain;
    }

    .report-header .prepared-by {
      opacity: 0.95;
      font-size: 0.95rem;
      margin-top: 0.5rem;
    }

    .report-header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .report-header .subtitle {
      opacity: 0.9;
      font-size: 1.1rem;
    }

    .report-meta {
      background: #f3f4f6;
      padding: 1.5rem 2rem;
      border-bottom: 2px solid #e5e7eb;
    }

    .report-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-size: 0.75rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }

    .meta-value {
      font-size: 1rem;
      color: #1f2937;
      font-weight: 600;
    }

    .content {
      padding: 2rem;
    }

    h2 {
      color: #374151;
      margin: 2rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
    }

    h3 {
      color: #4b5563;
      margin: 1.5rem 0 1rem;
    }

    /* Enhanced styles from enhanced-html */
    ${generateEnhancedCSS()}

    /* Findings table */
    .findings-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .findings-table th {
      background: #f3f4f6;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }

    .findings-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .findings-table tr:hover {
      background: #f9fafb;
    }

    .severity-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      display: inline-block;
    }

    .severity-critical { background: #dc2626; }
    .severity-high { background: #ea580c; }
    .severity-medium { background: #ca8a04; }
    .severity-low { background: #2563eb; }
    .severity-info { background: #6b7280; }
    /* Proposed (NPRM) — deliberately neutral: not a current violation. */
    .severity-proposed { background: #64748b; }

    .upcoming-subtitle {
      font-size: 0.85rem;
      font-weight: 500;
      color: #64748b;
    }

    .upcoming-note {
      background: #f1f5f9;
      border-left: 3px solid #64748b;
      padding: 0.75rem 1rem;
      margin: 0.5rem 0 1rem;
      font-size: 0.9rem;
      color: #475569;
    }

    .upcoming-inline {
      color: #475569;
      font-weight: 600;
    }

    /* Consolidated multi-rule location entries */
    .findings-count-note {
      color: #4b5563;
      font-size: 0.95rem;
      margin: 0.25rem 0 0.75rem;
    }

    .finding-group td { vertical-align: top; }

    .group-location {
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .group-location-path {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.9rem;
    }

    .group-controls {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .group-control {
      display: grid;
      grid-template-columns: 90px 1fr auto;
      gap: 0.75rem;
      align-items: baseline;
      padding: 0.35rem 0;
      border-top: 1px solid #f3f4f6;
    }

    .group-control:first-child { border-top: none; }
    .group-control-sev { justify-self: start; }
    .group-control-title { color: #1f2937; }

    .group-control-ref {
      color: #6b7280;
      font-size: 0.85rem;
      text-align: right;
      white-space: normal;
    }

    @media (max-width: 640px) {
      .group-control {
        grid-template-columns: 1fr;
        gap: 0.15rem;
      }
      .group-control-ref { text-align: left; }
    }

    .evidence-box {
      background: #f9fafb;
      border-left: 3px solid #667eea;
      padding: 1rem;
      margin: 1rem 0;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.875rem;
    }

    .audit-trail {
      background: #fef3c7;
      border-left: 3px solid #f59e0b;
      padding: 1rem;
      margin: 1rem 0;
    }

    .report-footer {
      background: #f3f4f6;
      padding: 2rem;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
    }

    /* Per-page footer: only visible when printing / exporting to PDF. */
    .brand-page-footer { display: none; }
    @media print {
      .brand-page-footer {
        display: block;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 0.7rem;
        color: #6b7280;
        padding: 0.4rem 0;
      }
      @page { margin-bottom: 2.2cm; }
    }

    .report-hash {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 1rem;
      word-break: break-all;
    }

    /* Filters */
    .filters {
      background: #f9fafb;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
    }

    .filter-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #e5e7eb;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    }

    .filter-btn:hover {
      background: #f3f4f6;
      border-color: #667eea;
    }

    .filter-btn.active {
      background: #667eea;
      color: white;
      border-color: #667eea;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="report-header">
      ${brandLogo
        ? `<img src="${brandLogo}" alt="${escapeHtml(preparedBy)} logo" class="brand-logo">`
        : '<div class="logo-placeholder">VL</div>'}
      <h1>HIPAA Compliance Audit Report</h1>
      <div class="subtitle">${escapeHtml(organizationName)} - ${escapeHtml(reportPeriod)}</div>
      ${hasBrand ? `<div class="prepared-by">Prepared by ${escapeHtml(preparedBy)}</div>` : ''}
    </div>

    <div class="report-meta">
      <div class="report-meta-grid">
        <div class="meta-item">
          <div class="meta-label">Report Generated</div>
          <div class="meta-value">${new Date(timestamp).toLocaleString()}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Auditor</div>
          <div class="meta-value">${auditorName}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Target Path</div>
          <div class="meta-value">${targetPath}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Files Scanned</div>
          <div class="meta-value">${result.scannedFiles}</div>
        </div>
      </div>
    </div>

    <div class="content">
      ${generateExecutiveSummary(score, result.scannedFiles, result.scanDuration)}

      ${generateComplianceScoreGauge(score)}

      <h2>📋 Findings Summary</h2>
      <p class="findings-count-note">
        <strong>${currentFindings.length} current findings</strong> across
        <strong>${locationGroups.length} entries</strong>
        — grouped by file, line &amp; control family. Filters count entries.
        ${proposedFindings.length > 0
          ? `<br><span class="upcoming-inline">+ ${proposedFindings.length} upcoming requirement${proposedFindings.length === 1 ? '' : 's'} (NPRM — proposed rule)</span> — listed separately below.`
          : ''}
      </p>
      <div class="filters">
        <div class="filter-buttons">
          <button class="filter-btn active" onclick="filterFindings('all')">All (${locationGroups.length})</button>
          <button class="filter-btn" onclick="filterFindings('critical')">Critical (${groupCounts.critical})</button>
          <button class="filter-btn" onclick="filterFindings('high')">High (${groupCounts.high})</button>
          <button class="filter-btn" onclick="filterFindings('medium')">Medium (${groupCounts.medium})</button>
          <button class="filter-btn" onclick="filterFindings('low')">Low (${groupCounts.low})</button>
        </div>
      </div>

      <table class="findings-table" id="findings-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Finding</th>
            <th>File</th>
            <th>HIPAA Ref</th>
          </tr>
        </thead>
        <tbody>
          ${locationGroups.map(g => {
            const fileLine = `${escapeHtml(g.file)}:${g.line ?? 'N/A'}`;
            if (g.members.length === 1) {
              const f = g.members[0];
              return `
            <tr class="finding-row" data-severity="${g.severity}">
              <td><span class="severity-badge severity-${g.severity}">${g.severity}</span></td>
              <td>${escapeHtml(f.title)}</td>
              <td style="font-family: monospace; font-size: 0.875rem;">${fileLine}</td>
              <td>${escapeHtml(formatHipaaRef(f.hipaaReference))}</td>
            </tr>`;
            }
            const controls = g.members.map(f => `
                <li class="group-control">
                  <span class="severity-badge severity-${f.severity} group-control-sev">${f.severity}</span>
                  <span class="group-control-title">${escapeHtml(f.title)}</span>
                  <span class="group-control-ref">${escapeHtml(formatHipaaRef(f.hipaaReference))}</span>
                </li>`).join('');
            return `
            <tr class="finding-row finding-group" data-severity="${g.severity}">
              <td><span class="severity-badge severity-${g.severity}">${g.severity}</span></td>
              <td colspan="3">
                <div class="group-location"><span class="group-location-path">${fileLine}</span> · ${g.members.length} controls flagged at this location</div>
                <ul class="group-controls">${controls}
                </ul>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      ${proposedFindings.length > 0 ? `
        <h2>🕓 Upcoming Requirements <span class="upcoming-subtitle">(NPRM — proposed rule, not yet in effect)</span></h2>
        <p class="upcoming-note">
          These reference the proposed 2026 HIPAA Security Rule (NPRM). They are
          <strong>not current obligations</strong> and are excluded from the severity counts above.
          They will apply if and when the rule is finalized — treat them as forward-looking guidance.
        </p>
        <table class="findings-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Requirement</th>
              <th>File</th>
              <th>HIPAA Ref</th>
            </tr>
          </thead>
          <tbody>
            ${proposedFindings.map(f => `
              <tr>
                <td><span class="severity-badge severity-proposed">Proposed</span></td>
                <td>${escapeHtml(f.title)}</td>
                <td style="font-family: monospace; font-size: 0.875rem;">${escapeHtml(f.file)}:${f.line ?? 'N/A'}</td>
                <td>${escapeHtml(formatHipaaRef(f.hipaaReference))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${suppressedFindings.length > 0 ? `
        <h2>🔕 Suppression Audit Trail</h2>
        <p>The following findings have been suppressed with documented justifications:</p>
        <table class="findings-table">
          <thead>
            <tr>
              <th>Finding</th>
              <th>Reason</th>
              <th>File</th>
            </tr>
          </thead>
          <tbody>
            ${suppressedFindings.map(f => `
              <tr>
                <td>${escapeHtml(f.title)}</td>
                <td>${f.suppression?.reason || 'No reason provided'}</td>
                <td style="font-family: monospace; font-size: 0.875rem;">${escapeHtml(f.file)}:${f.line || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${acknowledgedFindings.length > 0 ? `
        <h2>✅ Acknowledged Findings</h2>
        <p>The following findings have been formally acknowledged:</p>
        <table class="findings-table">
          <thead>
            <tr>
              <th>Finding</th>
              <th>Reason</th>
              <th>Acknowledged By</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${acknowledgedFindings.map(f => `
              <tr>
                <td>${escapeHtml(f.title)}</td>
                <td>${f.acknowledgment?.reason || 'No reason provided'}</td>
                <td>${f.acknowledgment?.acknowledgedBy || 'Unknown'}</td>
                <td>${f.acknowledgment?.acknowledgedAt ? new Date(f.acknowledgment.acknowledgedAt).toLocaleDateString() : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${includeBaseline && baselineFindings.length > 0 ? `
        <h2>📊 Baseline Comparison</h2>
        <p>${baselineFindings.length} finding(s) tracked in baseline (no change from previous scan).</p>
      ` : ''}

      <h2>📜 Report Integrity</h2>
      <div class="evidence-box">
        <strong>Digital Signature:</strong> SHA256 hash of this report
        <div class="report-hash" id="report-hash">Computing...</div>
      </div>
      <p style="color: #6b7280; font-size: 0.875rem; margin-top: 1rem;">
        This report was generated by <strong>vlayer</strong> - an automated HIPAA compliance scanner.
        The SHA256 hash above can be used to verify the integrity of this document.
      </p>
    </div>

    <div class="report-footer">
      ${hasBrand
        ? `<p><strong>${escapeHtml(footerLine)}</strong></p>`
        : '<p><strong>VLayer HIPAA Compliance Scanner</strong></p>'}
      <p>Automated compliance scanning for healthcare applications</p>
      <p style="margin-top: 1rem; font-size: 0.875rem;">Generated: ${new Date(timestamp).toLocaleString()}</p>
    </div>
  </div>
  ${hasBrand ? `<div class="brand-page-footer">${escapeHtml(footerLine)}</div>` : ''}

  <script>
    function filterFindings(severity) {
      const rows = document.querySelectorAll('.finding-row');
      const buttons = document.querySelectorAll('.filter-btn');

      buttons.forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');

      rows.forEach(row => {
        if (severity === 'all' || row.dataset.severity === severity) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    // Calculate and display report hash
    window.addEventListener('load', async () => {
      const html = document.documentElement.outerHTML;
      const encoder = new TextEncoder();
      const data = encoder.encode(html);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      document.getElementById('report-hash').textContent = hashHex;
    });
  </script>
</body>
</html>`;

  // Calculate SHA256 hash
  const hash = createHash('sha256').update(html).digest('hex');

  return { html, hash };
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
