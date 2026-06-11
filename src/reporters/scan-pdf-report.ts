import PDFDocument from 'pdfkit';
import { createHash } from 'crypto';
import type { Finding, ScanResult, ResolvedBranding, Severity } from '../types.js';
import { brandFooterText, brandPreparedBy, pdfLogoPath } from './branding.js';

const COLORS = {
  primary: '#4f46e5',
  headerStart: '#667eea',
  text: '#1f2937',
  secondary: '#6b7280',
  muted: '#9ca3af',
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb',
  info: '#6b7280',
  background: '#f9fafb',
  border: '#e5e7eb',
  white: '#ffffff',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: COLORS.critical,
  high: COLORS.high,
  medium: COLORS.medium,
  low: COLORS.low,
  info: COLORS.info,
};

export interface ScanPdfReportOptions {
  organizationName?: string;
  reportPeriod?: string;
  auditorName?: string;
  includeBaseline?: boolean;
  branding?: ResolvedBranding;
}

/**
 * Generate a branded PDF compliance report from a scan result.
 *
 * Mirrors the HTML auditor report: a cover with the brand logo + "Prepared by",
 * a scan summary, a findings table, and a footer that repeats on every page
 * ("Prepared by {brand} · Powered by VLayer"). With no branding it falls back
 * to default VLayer presentation.
 *
 * @returns the PDF as a Buffer plus its SHA256 hash for integrity verification.
 */
export function generateScanPdf(
  result: ScanResult,
  targetPath: string,
  options: ScanPdfReportOptions = {}
): Promise<{ buffer: Buffer; hash: string }> {
  return new Promise((resolve, reject) => {
    const branding = options.branding;
    const preparedBy = brandPreparedBy(branding);
    const footerLine = brandFooterText(branding);
    const logoPath = pdfLogoPath(branding);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: 'HIPAA Compliance Report',
        Author: preparedBy,
        Subject: 'HIPAA Compliance Assessment',
        Creator: 'vlayer - HIPAA Compliance Scanner',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const hash = createHash('sha256').update(buffer).digest('hex');
      resolve({ buffer, hash });
    });
    doc.on('error', reject);

    const activeFindings = result.findings.filter(f => !f.isBaseline && !f.suppressed);

    try {
      renderCover(doc, result, targetPath, options, preparedBy, logoPath);
      doc.addPage();
      renderFindings(doc, activeFindings);
      stampFooters(doc, footerLine);
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

const PAGE_WIDTH = (doc: PDFKit.PDFDocument) => doc.page.width - doc.page.margins.left - doc.page.margins.right;

function renderCover(
  doc: PDFKit.PDFDocument,
  result: ScanResult,
  targetPath: string,
  options: ScanPdfReportOptions,
  preparedBy: string,
  logoPath: string | null
) {
  const left = doc.page.margins.left;
  const contentWidth = PAGE_WIDTH(doc);

  // Header band
  doc.rect(0, 0, doc.page.width, 210).fill(COLORS.headerStart);

  // Brand logo (PNG/JPG only — SVG is skipped upstream and falls through to text).
  if (logoPath) {
    try {
      doc.image(logoPath, left, 36, { fit: [180, 60] });
    } catch {
      // Corrupt/unsupported image data: render without the logo rather than fail.
    }
  }

  doc.fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(30)
    .text('HIPAA Compliance Report', left, 108, { width: contentWidth });

  doc.font('Helvetica')
    .fontSize(13)
    .text(`Prepared by ${preparedBy}`, left, 150, { width: contentWidth });

  if (options.reportPeriod) {
    doc.fontSize(11).text(options.reportPeriod, left, 172, { width: contentWidth });
  }

  // Project info box
  doc.fillColor(COLORS.text);
  const boxY = 250;
  doc.rect(left, boxY, contentWidth, 150).fill(COLORS.background);
  doc.rect(left, boxY, contentWidth, 150).stroke(COLORS.border);

  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(15)
    .text('Project Information', left + 20, boxY + 18);

  const infoItems: Array<[string, string]> = [
    ['Target Path:', targetPath],
    ['Organization:', options.organizationName || 'Not specified'],
    ['Report Generated:', new Date().toLocaleString()],
    ['Files Scanned:', String(result.scannedFiles)],
  ];

  let y = boxY + 48;
  doc.fontSize(11);
  for (const [label, value] of infoItems) {
    doc.fillColor(COLORS.secondary).font('Helvetica-Bold').text(label, left + 20, y, { continued: true });
    doc.fillColor(COLORS.text).font('Helvetica').text(` ${value}`, { width: contentWidth - 40 });
    y += 22;
  }

  // Summary stat cards
  const statsY = 430;
  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(15)
    .text('Scan Summary', left + 20, statsY);

  const counts = countBySeverity(result.findings.filter(f => !f.isBaseline && !f.suppressed));
  const stats: Array<{ label: string; value: string; color: string }> = [
    { label: 'Critical', value: String(counts.critical), color: COLORS.critical },
    { label: 'High', value: String(counts.high), color: COLORS.high },
    { label: 'Medium', value: String(counts.medium), color: COLORS.medium },
    { label: 'Low', value: String(counts.low), color: COLORS.low },
  ];

  const gap = 10;
  const cardW = (contentWidth - gap * 3) / 4;
  const cardsY = statsY + 30;
  stats.forEach((stat, i) => {
    const x = left + i * (cardW + gap);
    doc.rect(x, cardsY, cardW, 70).fill(stat.color);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(24)
      .text(stat.value, x, cardsY + 14, { width: cardW, align: 'center' });
    doc.font('Helvetica').fontSize(10)
      .text(stat.label, x, cardsY + 46, { width: cardW, align: 'center' });
  });

  // Compliance score
  if (result.complianceScore) {
    const score = result.complianceScore;
    const scoreY = cardsY + 100;
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(13)
      .text(`Compliance Score: ${score.score}/100  (Grade ${score.grade})`, left + 20, scoreY);
    doc.fillColor(COLORS.secondary).font('Helvetica').fontSize(11)
      .text(`Status: ${score.status}`, left + 20, scoreY + 18);
  }
}

function renderFindings(doc: PDFKit.PDFDocument, findings: Finding[]) {
  const left = doc.page.margins.left;
  const contentWidth = PAGE_WIDTH(doc);

  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(20)
    .text('Findings', left, doc.page.margins.top);
  doc.moveDown(0.5);

  if (findings.length === 0) {
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(12)
      .text('No active compliance findings. ✅', { width: contentWidth });
    return;
  }

  // Column layout: severity | finding (title + file) | HIPAA ref
  const cols = {
    sev: left,
    sevW: 70,
    finding: left + 80,
    findingW: contentWidth - 80 - 110,
    hipaa: left + contentWidth - 110,
    hipaaW: 110,
  };

  drawFindingsHeader(doc, cols);

  doc.font('Helvetica').fontSize(10);
  for (const f of findings) {
    const titleHeight = doc.heightOfString(f.title, { width: cols.findingW });
    const fileText = `${f.file}${f.line ? `:${f.line}` : ''}`;
    const fileHeight = doc.heightOfString(fileText, { width: cols.findingW });
    const rowHeight = Math.max(titleHeight + fileHeight + 10, 26);

    // Page break with header repeat.
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(20)
        .text('Findings (continued)', left, doc.page.margins.top);
      doc.moveDown(0.5);
      drawFindingsHeader(doc, cols);
      doc.font('Helvetica').fontSize(10);
    }

    const rowY = doc.y;

    // Severity badge
    const sevColor = SEVERITY_COLOR[f.severity] || COLORS.info;
    doc.roundedRect(cols.sev, rowY, cols.sevW - 8, 16, 3).fill(sevColor);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(8)
      .text(f.severity.toUpperCase(), cols.sev, rowY + 4, { width: cols.sevW - 8, align: 'center' });

    // Finding title + file
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
      .text(f.title, cols.finding, rowY, { width: cols.findingW });
    doc.fillColor(COLORS.muted).font('Courier').fontSize(8)
      .text(fileText, cols.finding, doc.y + 1, { width: cols.findingW });

    // HIPAA ref
    doc.fillColor(COLORS.secondary).font('Helvetica').fontSize(8)
      .text(f.hipaaReference || '-', cols.hipaa, rowY, { width: cols.hipaaW });

    doc.y = rowY + rowHeight;
    doc.moveTo(left, doc.y - 5).lineTo(left + contentWidth, doc.y - 5).strokeColor(COLORS.border).stroke();
  }
}

function drawFindingsHeader(
  doc: PDFKit.PDFDocument,
  cols: { sev: number; sevW: number; finding: number; findingW: number; hipaa: number; hipaaW: number }
) {
  const headerY = doc.y;
  doc.fillColor(COLORS.secondary).font('Helvetica-Bold').fontSize(9);
  doc.text('SEVERITY', cols.sev, headerY, { width: cols.sevW });
  doc.text('FINDING', cols.finding, headerY, { width: cols.findingW });
  doc.text('HIPAA REF', cols.hipaa, headerY, { width: cols.hipaaW });
  doc.y = headerY + 16;
  doc.moveTo(cols.sev, doc.y - 4)
    .lineTo(cols.hipaa + cols.hipaaW, doc.y - 4)
    .strokeColor(COLORS.border)
    .stroke();
  doc.moveDown(0.3);
}

/** Stamp the brand footer + page numbers on every buffered page. */
function stampFooters(doc: PDFKit.PDFDocument, footerLine: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Drop the bottom margin so footer text near the page edge doesn't spill
    // onto a fresh page.
    doc.page.margins.bottom = 0;

    const width = PAGE_WIDTH(doc);
    const footerY = doc.page.height - 40;
    doc.fillColor(COLORS.secondary).font('Helvetica').fontSize(8)
      .text(footerLine, doc.page.margins.left, footerY, { width, align: 'center', lineBreak: false });
    doc.fillColor(COLORS.muted).fontSize(7)
      .text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.margins.left, footerY + 12, {
        width,
        align: 'center',
        lineBreak: false,
      });
  }
}

function countBySeverity(findings: Finding[]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
  }
  return counts;
}
