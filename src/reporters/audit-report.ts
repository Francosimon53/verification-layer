import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { createHash } from 'crypto';
import type { AuditTrail, AuditEvidence, ManualReviewItem, AuditReportOptions } from '../types.js';

const COLORS = {
  primary: '#1e40af',
  secondary: '#6b7280',
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
  info: '#2563eb',
  background: '#f9fafb',
  border: '#e5e7eb',
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Human Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  accepted_risk: 'Risk Accepted',
};

const CATEGORY_THREATS: Record<string, string> = {
  'phi-exposure': 'Unauthorized PHI Disclosure',
  'encryption': 'Data Breach / Interception',
  'audit-logging': 'Lack of Accountability',
  'access-control': 'Unauthorized Access',
  'data-retention': 'Non-Compliance with Retention',
};

/**
 * Generate PDF audit report
 */
export async function generateAuditReport(
  trail: AuditTrail,
  options: AuditReportOptions
): Promise<{ path: string; hash: string }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'HIPAA Compliance Audit Report',
        Author: options.auditorName || 'vlayer',
        Subject: 'Security Audit Evidence',
        Creator: 'vlayer - HIPAA Compliance Scanner',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      const hash = createHash('sha256').update(pdfBuffer).digest('hex');
      resolve({ path: options.outputPath, hash });
    });
    doc.on('error', reject);

    const stream = createWriteStream(options.outputPath);
    doc.pipe(stream);

    // Cover Page
    renderCoverPage(doc, trail, options);

    // Executive Summary
    doc.addPage();
    renderExecutiveSummary(doc, trail);

    // Risk Analysis
    doc.addPage();
    renderRiskAnalysisSection(doc, trail);

    // Auto-Fixed Issues (Evidence)
    if (options.includeEvidence !== false && trail.evidence.length > 0) {
      doc.addPage();
      renderEvidenceSection(doc, trail.evidence);
    }

    // Manual Review Items
    if (options.includeManualReviews !== false && trail.manualReviews.length > 0) {
      doc.addPage();
      renderManualReviewSection(doc, trail.manualReviews);
    }

    // Verification Page
    doc.addPage();
    renderVerificationPage(doc, trail);

    doc.end();
  });
}

function renderCoverPage(doc: PDFKit.PDFDocument, trail: AuditTrail, options: AuditReportOptions) {
  const pageWidth = doc.page.width - 100;

  // Header
  doc.rect(0, 0, doc.page.width, 200).fill(COLORS.primary);

  doc.fillColor('#ffffff')
    .fontSize(32)
    .font('Helvetica-Bold')
    .text('HIPAA Compliance', 50, 60, { width: pageWidth })
    .text('Audit Report', 50, 100, { width: pageWidth });

  doc.fontSize(14)
    .font('Helvetica')
    .text('Security Vulnerability Assessment & Remediation Evidence', 50, 150, { width: pageWidth });

  // Project Info Box
  doc.fillColor('#000000');
  const boxY = 250;

  doc.rect(50, boxY, pageWidth, 180)
    .fill(COLORS.background);

  doc.rect(50, boxY, pageWidth, 180)
    .stroke(COLORS.border);

  doc.fillColor(COLORS.primary)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('Project Information', 70, boxY + 20);

  doc.fillColor('#000000')
    .fontSize(11)
    .font('Helvetica');

  const infoItems = [
    ['Project Name:', trail.projectName],
    ['Project Path:', trail.projectPath],
    ['Scan Date:', new Date(trail.createdAt).toLocaleString()],
    ['Report ID:', trail.id],
    ['Organization:', options.organizationName || 'Not specified'],
    ['Auditor:', options.auditorName || 'vlayer automated scan'],
  ];

  let y = boxY + 50;
  for (const [label, value] of infoItems) {
    doc.font('Helvetica-Bold').text(label, 70, y, { continued: true });
    doc.font('Helvetica').text(` ${value}`, { width: pageWidth - 50 });
    y += 20;
  }

  // Summary Stats
  const statsY = 480;
  doc.fillColor(COLORS.primary)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('Scan Summary', 70, statsY);

  const stats = [
    { label: 'Files Scanned', value: trail.scannedFiles.toString(), color: COLORS.info },
    { label: 'Total Findings', value: trail.totalFindings.toString(), color: COLORS.critical },
    { label: 'Auto-Fixed', value: trail.autoFixedCount.toString(), color: COLORS.low },
    { label: 'Manual Review', value: trail.manualReviewCount.toString(), color: COLORS.medium },
  ];

  const statWidth = (pageWidth - 30) / 4;
  stats.forEach((stat, i) => {
    const x = 50 + i * (statWidth + 10);
    doc.rect(x, statsY + 30, statWidth, 70).fill(stat.color);
    doc.fillColor('#ffffff')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(stat.value, x, statsY + 45, { width: statWidth, align: 'center' });
    doc.fontSize(10)
      .font('Helvetica')
      .text(stat.label, x, statsY + 75, { width: statWidth, align: 'center' });
  });

  // Footer
  doc.fillColor(COLORS.secondary)
    .fontSize(10)
    .font('Helvetica')
    .text('Generated by vlayer - HIPAA Compliance Scanner', 50, doc.page.height - 50, {
      width: pageWidth,
      align: 'center',
    });
}

function renderRiskAnalysisSection(doc: PDFKit.PDFDocument, trail: AuditTrail) {
  const pageWidth = doc.page.width - 100;

  doc.fillColor(COLORS.primary)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Risk Analysis', 50, 50);

  doc.moveTo(50, 80).lineTo(pageWidth + 50, 80).stroke(COLORS.border);

  doc.fillColor(COLORS.secondary)
    .fontSize(10)
    .font('Helvetica')
    .text(
      'Comprehensive risk assessment of identified HIPAA compliance findings with threat categorization and remediation tracking.',
      50, 90, { width: pageWidth }
    );

  let y = 120;

  // Risk Summary Table
  doc.fillColor(COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('Risk Summary', 50, y);

  y += 25;

  // Count by severity from manual reviews
  // Note: Evidence items are auto-fixed so they're not in the active risk table
  const findings = trail.manualReviews.map(r => r.finding);

  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalFindings = findings.length;

  // Summary table header
  const tableX = 50;
  const colWidths = [150, 80, 100];
  const rowHeight = 25;

  // Header
  doc.rect(tableX, y, colWidths[0] + colWidths[1] + colWidths[2], rowHeight).fill(COLORS.background);

  doc.fillColor('#000000')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Risk Level', tableX + 5, y + 8)
    .text('Count', tableX + colWidths[0] + 5, y + 8)
    .text('Percentage', tableX + colWidths[0] + colWidths[1] + 5, y + 8);

  y += rowHeight;

  // Summary rows
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const severityLabels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  for (const severity of severityOrder) {
    const count = severityCounts[severity] || 0;
    const percentage = totalFindings > 0 ? ((count / totalFindings) * 100).toFixed(0) : '0';
    const color = COLORS[severity as keyof typeof COLORS] || COLORS.secondary;

    // Row with colored left border
    doc.rect(tableX, y, 4, rowHeight).fill(color);
    doc.rect(tableX, y, colWidths[0] + colWidths[1] + colWidths[2], rowHeight).stroke(COLORS.border);

    doc.fillColor('#000000')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(severityLabels[severity], tableX + 10, y + 8)
      .font('Helvetica')
      .text(count.toString(), tableX + colWidths[0] + 5, y + 8)
      .text(`${percentage}%`, tableX + colWidths[0] + colWidths[1] + 5, y + 8);

    y += rowHeight;
  }

  // Total row
  doc.rect(tableX, y, colWidths[0] + colWidths[1] + colWidths[2], rowHeight).fill('#f3f4f6');

  doc.fillColor('#000000')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Total', tableX + 5, y + 8)
    .text(totalFindings.toString(), tableX + colWidths[0] + 5, y + 8)
    .text('100%', tableX + colWidths[0] + colWidths[1] + 5, y + 8);

  y += rowHeight + 30;

  // Detailed Risk Assessment
  doc.fillColor(COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('Detailed Risk Assessment', 50, y);

  y += 25;

  // Note about table continuation
  if (findings.length > 0) {
    doc.fillColor(COLORS.secondary)
      .fontSize(8)
      .font('Helvetica-Oblique')
      .text('Note: Table shows first 5 open findings requiring manual review. Auto-fixed issues shown in Evidence section.', 50, y);

    y += 20;

    // Detailed table (show first few findings)
    renderDetailedRiskTable(doc, findings.slice(0, 5), y);
  } else {
    doc.fillColor(COLORS.secondary)
      .fontSize(10)
      .font('Helvetica')
      .text('No open risks. All findings were automatically remediated.', 50, y);
  }
}

function renderDetailedRiskTable(doc: PDFKit.PDFDocument, findings: any[], startY: number) {
  const tableX = 50;
  const pageWidth = doc.page.width - 100;
  const rowHeight = 50; // Taller rows for detailed content
  let y = startY;

  // Column widths (adjusted for A4)
  const colWidths = [85, 100, 50, 85, 110, 65];

  // Header
  doc.rect(tableX, y, pageWidth, 20).fill(COLORS.background);

  doc.fillColor('#000000')
    .fontSize(7)
    .font('Helvetica-Bold');

  const headers = ['Threat', 'Vulnerability', 'Risk', 'Mitigation', 'Remediation', 'HIPAA'];
  let x = tableX;
  headers.forEach((header, i) => {
    doc.text(header, x + 3, y + 6, { width: colWidths[i] - 6 });
    x += colWidths[i];
  });

  y += 20;

  // Data rows
  for (const finding of findings) {
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 50;
    }

    const threat = CATEGORY_THREATS[finding.category] || 'Security Vulnerability';
    const vulnerability = finding.title;
    const riskLevel = finding.severity.toUpperCase();
    const status = finding.fixType ? 'Auto-fix' : 'Open';
    const remediation = truncateCode(finding.recommendation, 60);
    const hipaa = finding.hipaaReference || 'N/A';

    const color = COLORS[finding.severity as keyof typeof COLORS] || COLORS.secondary;

    // Row with colored left border
    doc.rect(tableX, y, 3, rowHeight).fill(color);
    doc.rect(tableX, y, pageWidth, rowHeight).stroke(COLORS.border);

    doc.fillColor('#000000')
      .fontSize(7)
      .font('Helvetica');

    x = tableX;

    // Threat
    doc.text(threat, x + 4, y + 4, { width: colWidths[0] - 8, height: rowHeight - 8 });
    x += colWidths[0];

    // Vulnerability
    doc.font('Helvetica-Bold')
      .text(vulnerability, x + 3, y + 4, { width: colWidths[1] - 6, height: rowHeight - 8 })
      .font('Helvetica');
    x += colWidths[1];

    // Risk Level
    doc.fillColor(color)
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(riskLevel.substring(0, 4).toUpperCase(), x + 3, y + 4, { width: colWidths[2] - 6 })
      .fillColor('#000000')
      .font('Helvetica');
    x += colWidths[2];

    // Mitigation Status
    const statusColor = finding.fixType ? COLORS.low : COLORS.critical;
    doc.fillColor(statusColor)
      .text(status, x + 3, y + 4, { width: colWidths[3] - 6 })
      .fillColor('#000000');
    x += colWidths[3];

    // Remediation
    doc.fontSize(6)
      .text(remediation, x + 3, y + 4, { width: colWidths[4] - 6, height: rowHeight - 8 })
      .fontSize(7);
    x += colWidths[4];

    // HIPAA Reference
    doc.fontSize(6)
      .font('Courier')
      .text(hipaa.substring(0, 20), x + 3, y + 4, { width: colWidths[5] - 6, height: rowHeight - 8 })
      .font('Helvetica')
      .fontSize(7);

    y += rowHeight;
  }
}

function renderExecutiveSummary(doc: PDFKit.PDFDocument, trail: AuditTrail) {
  const pageWidth = doc.page.width - 100;

  doc.fillColor(COLORS.primary)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Executive Summary', 50, 50);

  doc.moveTo(50, 80).lineTo(pageWidth + 50, 80).stroke(COLORS.border);

  let y = 100;

  // Overview
  doc.fillColor('#000000')
    .fontSize(12)
    .font('Helvetica')
    .text(
      `This report documents the security assessment conducted on ${new Date(trail.createdAt).toLocaleDateString()}. ` +
      `The scan analyzed ${trail.scannedFiles} files and identified ${trail.totalFindings} potential HIPAA compliance issues.`,
      50, y, { width: pageWidth }
    );

  y += 60;

  // Remediation Summary
  doc.fillColor(COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('Remediation Status', 50, y);

  y += 25;

  const remediationRate = trail.totalFindings > 0
    ? ((trail.autoFixedCount / trail.totalFindings) * 100).toFixed(1)
    : '0';

  doc.fillColor('#000000')
    .fontSize(11)
    .font('Helvetica');

  const bulletPoints = [
    `${trail.autoFixedCount} issues were automatically remediated (${remediationRate}% auto-fix rate)`,
    `${trail.manualReviewCount} issues require manual review and human decision`,
    `All auto-fixes include cryptographic evidence (SHA256 hashes) for verification`,
    `Each fix is mapped to specific HIPAA regulation references`,
  ];

  for (const point of bulletPoints) {
    doc.text(`\u2022 ${point}`, 60, y, { width: pageWidth - 20 });
    y += 20;
  }

  y += 20;

  // Risk Assessment
  doc.fillColor(COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('Risk Assessment', 50, y);

  y += 25;

  // Count by severity
  const severityCounts = trail.manualReviews.reduce((acc, r) => {
    acc[r.finding.severity] = (acc[r.finding.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
  const severityLabels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Informational',
  };

  doc.fontSize(11).font('Helvetica');

  for (const severity of severityOrder) {
    const count = severityCounts[severity] || 0;
    if (count > 0) {
      doc.fillColor(COLORS[severity as keyof typeof COLORS] || COLORS.secondary)
        .text(`${severityLabels[severity]}: ${count} issues pending review`, 60, y);
      y += 18;
    }
  }

  y += 30;

  // HIPAA Compliance Note
  doc.rect(50, y, pageWidth, 80).fill('#fef3c7');

  doc.fillColor('#92400e')
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('HIPAA Compliance Note', 60, y + 15);

  doc.font('Helvetica')
    .text(
      'This report provides evidence of security controls and remediation efforts as required by HIPAA ' +
      'Security Rule (45 CFR Part 164). Organizations should retain this documentation for a minimum of 6 years.',
      60, y + 35, { width: pageWidth - 20 }
    );
}

function renderEvidenceSection(doc: PDFKit.PDFDocument, evidence: AuditEvidence[]) {
  const pageWidth = doc.page.width - 100;

  doc.fillColor(COLORS.primary)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Automated Fix Evidence', 50, 50);

  doc.moveTo(50, 80).lineTo(pageWidth + 50, 80).stroke(COLORS.border);

  doc.fillColor(COLORS.secondary)
    .fontSize(10)
    .font('Helvetica')
    .text(
      'Each entry below documents an automated security fix with cryptographic verification.',
      50, 90
    );

  let y = 120;

  for (let i = 0; i < evidence.length; i++) {
    const ev = evidence[i];

    // Check if we need a new page
    if (y > doc.page.height - 250) {
      doc.addPage();
      y = 50;
    }

    // Evidence header
    doc.rect(50, y, pageWidth, 25).fill(COLORS.primary);
    doc.fillColor('#ffffff')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(`Evidence #${i + 1}: ${ev.description}`, 60, y + 7);

    y += 35;

    // Details
    doc.fillColor('#000000').fontSize(9).font('Helvetica');

    const details = [
      ['File:', ev.filePath],
      ['Line:', ev.before.lineNumber.toString()],
      ['Timestamp:', new Date(ev.timestamp).toLocaleString()],
      ['HIPAA Reference:', ev.hipaaReference],
      ['Fix Type:', ev.fixType],
    ];

    for (const [label, value] of details) {
      doc.font('Helvetica-Bold').text(label, 60, y, { continued: true });
      doc.font('Helvetica').text(` ${value}`);
      y += 14;
    }

    y += 5;

    // Code before
    doc.fillColor(COLORS.critical)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('BEFORE:', 60, y);

    y += 12;

    doc.rect(60, y, pageWidth - 20, 30).fill('#1e1e1e');
    doc.fillColor('#d4d4d4')
      .fontSize(8)
      .font('Courier')
      .text(truncateCode(ev.before.content), 65, y + 8, { width: pageWidth - 30 });

    y += 35;

    // Code after
    doc.fillColor(COLORS.low)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('AFTER:', 60, y);

    y += 12;

    doc.rect(60, y, pageWidth - 20, 30).fill('#1e1e1e');
    doc.fillColor('#d4d4d4')
      .fontSize(8)
      .font('Courier')
      .text(truncateCode(ev.after.content), 65, y + 8, { width: pageWidth - 30 });

    y += 35;

    // Hashes
    doc.fillColor(COLORS.secondary)
      .fontSize(7)
      .font('Courier')
      .text(`SHA256 Before: ${ev.fileHashBefore}`, 60, y);

    y += 10;

    doc.text(`SHA256 After:  ${ev.fileHashAfter}`, 60, y);

    y += 25;

    // Separator
    doc.moveTo(50, y).lineTo(pageWidth + 50, y).stroke(COLORS.border);
    y += 15;
  }
}

function renderManualReviewSection(doc: PDFKit.PDFDocument, reviews: ManualReviewItem[]) {
  const pageWidth = doc.page.width - 100;

  doc.fillColor(COLORS.primary)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Manual Review Required', 50, 50);

  doc.moveTo(50, 80).lineTo(pageWidth + 50, 80).stroke(COLORS.border);

  doc.fillColor(COLORS.secondary)
    .fontSize(10)
    .font('Helvetica')
    .text(
      'The following issues require human review and decision. Suggested deadlines are based on severity.',
      50, 90
    );

  let y = 120;

  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];

    if (y > doc.page.height - 200) {
      doc.addPage();
      y = 50;
    }

    // Severity badge color
    const severityColor = COLORS[review.finding.severity as keyof typeof COLORS] || COLORS.secondary;

    // Review header
    doc.rect(50, y, pageWidth, 25).fill(severityColor);
    doc.fillColor('#ffffff')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`#${i + 1} [${review.finding.severity.toUpperCase()}] ${review.finding.title}`, 60, y + 7, {
        width: pageWidth - 20,
      });

    y += 35;

    doc.fillColor('#000000').fontSize(9).font('Helvetica');

    // Status box
    doc.rect(60, y, 150, 20).fill('#fef2f2');
    doc.fillColor(COLORS.critical)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(`Status: ${STATUS_LABELS[review.status]}`, 65, y + 5);

    y += 30;

    // Details
    doc.fillColor('#000000').font('Helvetica');

    const details = [
      ['File:', review.finding.file + (review.finding.line ? `:${review.finding.line}` : '')],
      ['Category:', review.finding.category],
      ['HIPAA Ref:', review.finding.hipaaReference || 'N/A'],
      ['Suggested Deadline:', new Date(review.suggestedDeadline).toLocaleDateString()],
      ['Assigned To:', review.assignedTo || '__________________ (fill in)'],
    ];

    for (const [label, value] of details) {
      doc.font('Helvetica-Bold').text(label, 60, y, { continued: true });
      doc.font('Helvetica').text(` ${value}`);
      y += 14;
    }

    y += 5;

    // Description
    doc.fillColor(COLORS.secondary)
      .fontSize(9)
      .text(review.finding.description, 60, y, { width: pageWidth - 20 });

    y += 30;

    // Recommendation
    doc.fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Recommendation:', 60, y);

    y += 12;

    doc.font('Helvetica')
      .text(review.finding.recommendation, 60, y, { width: pageWidth - 20 });

    y += 35;

    // Separator
    doc.moveTo(50, y).lineTo(pageWidth + 50, y).stroke(COLORS.border);
    y += 15;
  }
}

function renderVerificationPage(doc: PDFKit.PDFDocument, trail: AuditTrail) {
  const pageWidth = doc.page.width - 100;

  doc.fillColor(COLORS.primary)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Report Verification', 50, 50);

  doc.moveTo(50, 80).lineTo(pageWidth + 50, 80).stroke(COLORS.border);

  let y = 100;

  doc.fillColor('#000000')
    .fontSize(11)
    .font('Helvetica')
    .text(
      'This page provides cryptographic verification of the audit trail integrity. ' +
      'The hash below can be used to verify that this report has not been tampered with.',
      50, y, { width: pageWidth }
    );

  y += 50;

  // Hash box
  doc.rect(50, y, pageWidth, 80).fill('#f0f9ff');
  doc.rect(50, y, pageWidth, 80).stroke(COLORS.primary);

  doc.fillColor(COLORS.primary)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Report Verification Hash (SHA256)', 60, y + 15);

  doc.fillColor('#000000')
    .fontSize(10)
    .font('Courier')
    .text(trail.reportHash || 'Hash will be generated on report save', 60, y + 40, {
      width: pageWidth - 20,
    });

  y += 110;

  // Verification instructions
  doc.fillColor(COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('How to Verify', 50, y);

  y += 25;

  doc.fillColor('#000000')
    .fontSize(10)
    .font('Helvetica');

  const steps = [
    '1. Locate the audit-trail.json file in the .vlayer directory of the scanned project',
    '2. Compute the SHA256 hash of the evidence array using the same algorithm',
    '3. Compare the computed hash with the hash shown above',
    '4. If hashes match, the audit trail has not been modified since generation',
  ];

  for (const step of steps) {
    doc.text(step, 60, y, { width: pageWidth - 20 });
    y += 20;
  }

  y += 30;

  // Audit Trail Location
  doc.fillColor(COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('Audit Trail Location', 50, y);

  y += 25;

  doc.rect(50, y, pageWidth, 40).fill('#1e1e1e');
  doc.fillColor('#d4d4d4')
    .fontSize(10)
    .font('Courier')
    .text(`${trail.projectPath}/.vlayer/audit-trail.json`, 60, y + 12);

  y += 70;

  // Signature lines
  doc.fillColor(COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('Signatures', 50, y);

  y += 30;

  doc.fillColor('#000000').fontSize(10).font('Helvetica');

  const signatures = [
    { label: 'Security Officer', line: true },
    { label: 'Date', line: true },
    { label: 'Reviewer', line: true },
    { label: 'Date', line: true },
  ];

  let col = 0;
  for (const sig of signatures) {
    const x = 50 + (col % 2) * (pageWidth / 2 + 10);
    const sigY = y + Math.floor(col / 2) * 50;

    doc.text(`${sig.label}:`, x, sigY);
    doc.moveTo(x + 80, sigY + 10).lineTo(x + pageWidth / 2 - 20, sigY + 10).stroke('#000000');

    col++;
  }

  // Footer
  doc.fillColor(COLORS.secondary)
    .fontSize(8)
    .font('Helvetica')
    .text(
      `Report generated on ${new Date().toLocaleString()} | Report ID: ${trail.id}`,
      50, doc.page.height - 40,
      { width: pageWidth, align: 'center' }
    );
}

function truncateCode(code: string, maxLength: number = 100): string {
  const cleaned = code.trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength - 3) + '...';
}

/**
 * Generate text-based audit report (for environments without PDF support)
 */
export function generateTextAuditReport(trail: AuditTrail): string {
  const lines: string[] = [];
  const separator = '='.repeat(80);
  const subSeparator = '-'.repeat(80);

  lines.push(separator);
  lines.push('HIPAA COMPLIANCE AUDIT REPORT');
  lines.push(separator);
  lines.push('');
  lines.push(`Project: ${trail.projectName}`);
  lines.push(`Path: ${trail.projectPath}`);
  lines.push(`Date: ${new Date(trail.createdAt).toLocaleString()}`);
  lines.push(`Report ID: ${trail.id}`);
  lines.push('');

  lines.push(subSeparator);
  lines.push('SUMMARY');
  lines.push(subSeparator);
  lines.push(`Files Scanned: ${trail.scannedFiles}`);
  lines.push(`Total Findings: ${trail.totalFindings}`);
  lines.push(`Auto-Fixed: ${trail.autoFixedCount}`);
  lines.push(`Manual Review: ${trail.manualReviewCount}`);
  lines.push('');

  if (trail.evidence.length > 0) {
    lines.push(subSeparator);
    lines.push('AUTOMATED FIX EVIDENCE');
    lines.push(subSeparator);

    for (let i = 0; i < trail.evidence.length; i++) {
      const ev = trail.evidence[i];
      lines.push('');
      lines.push(`[${i + 1}] ${ev.description}`);
      lines.push(`    File: ${ev.filePath}:${ev.before.lineNumber}`);
      lines.push(`    Time: ${new Date(ev.timestamp).toLocaleString()}`);
      lines.push(`    HIPAA: ${ev.hipaaReference}`);
      lines.push(`    BEFORE: ${ev.before.content.trim()}`);
      lines.push(`    AFTER:  ${ev.after.content.trim()}`);
      lines.push(`    Hash Before: ${ev.fileHashBefore}`);
      lines.push(`    Hash After:  ${ev.fileHashAfter}`);
    }
    lines.push('');
  }

  if (trail.manualReviews.length > 0) {
    lines.push(subSeparator);
    lines.push('MANUAL REVIEW REQUIRED');
    lines.push(subSeparator);

    for (let i = 0; i < trail.manualReviews.length; i++) {
      const review = trail.manualReviews[i];
      lines.push('');
      lines.push(`[${i + 1}] [${review.finding.severity.toUpperCase()}] ${review.finding.title}`);
      lines.push(`    Status: ${STATUS_LABELS[review.status]}`);
      lines.push(`    File: ${review.finding.file}${review.finding.line ? `:${review.finding.line}` : ''}`);
      lines.push(`    Deadline: ${new Date(review.suggestedDeadline).toLocaleDateString()}`);
      lines.push(`    Assigned: ${review.assignedTo || '(unassigned)'}`);
      lines.push(`    ${review.finding.description}`);
    }
    lines.push('');
  }

  lines.push(subSeparator);
  lines.push('VERIFICATION');
  lines.push(subSeparator);
  lines.push(`Report Hash: ${trail.reportHash || 'N/A'}`);
  lines.push(`Audit Trail: ${trail.projectPath}/.vlayer/audit-trail.json`);
  lines.push('');
  lines.push(separator);

  return lines.join('\n');
}
