import { createHash } from 'crypto';
import type { ScanResult, Finding, ComplianceScore } from '../types.js';
import { generateComplianceScoreGauge, generateExecutiveSummary, generateEnhancedCSS } from './enhanced-html.js';

interface AuditorReportOptions {
  organizationName?: string;
  reportPeriod?: string;
  auditorName?: string;
  includeBaseline?: boolean;
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
  } = options;

  const timestamp = new Date().toISOString();
  const score = result.complianceScore!;

  // Calculate findings
  const activeFindings = result.findings.filter(f => !f.isBaseline && !f.suppressed);
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
      <div class="logo-placeholder">VL</div>
      <h1>HIPAA Compliance Audit Report</h1>
      <div class="subtitle">${organizationName} - ${reportPeriod}</div>
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
      <div class="filters">
        <div class="filter-buttons">
          <button class="filter-btn active" onclick="filterFindings('all')">All (${activeFindings.length})</button>
          <button class="filter-btn" onclick="filterFindings('critical')">Critical (${activeFindings.filter(f => f.severity === 'critical').length})</button>
          <button class="filter-btn" onclick="filterFindings('high')">High (${activeFindings.filter(f => f.severity === 'high').length})</button>
          <button class="filter-btn" onclick="filterFindings('medium')">Medium (${activeFindings.filter(f => f.severity === 'medium').length})</button>
          <button class="filter-btn" onclick="filterFindings('low')">Low (${activeFindings.filter(f => f.severity === 'low').length})</button>
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
          ${activeFindings.map(f => `
            <tr class="finding-row" data-severity="${f.severity}">
              <td><span class="severity-badge severity-${f.severity}">${f.severity}</span></td>
              <td>${escapeHtml(f.title)}</td>
              <td style="font-family: monospace; font-size: 0.875rem;">${escapeHtml(f.file)}:${f.line || 'N/A'}</td>
              <td>${f.hipaaReference || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

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
      <p><strong>VLayer HIPAA Compliance Scanner</strong></p>
      <p>Automated compliance scanning for healthcare applications</p>
      <p style="margin-top: 1rem; font-size: 0.875rem;">Generated: ${new Date(timestamp).toLocaleString()}</p>
    </div>
  </div>

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
