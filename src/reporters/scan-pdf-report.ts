import PDFDocument from 'pdfkit';
import { createHash } from 'crypto';
import type { Finding, ScanResult, ResolvedBranding, Severity } from '../types.js';
import { brandFooterText, brandPreparedBy, pdfLogoPath } from './branding.js';
import { groupFindingsByLocation, formatHipaaRef, type LocationGroup } from './finding-presentation.js';

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
      const groups = groupFindingsByLocation(activeFindings);
      renderCover(doc, result, targetPath, options, preparedBy, logoPath, activeFindings.length, groups.length);
      doc.addPage();
      renderFindings(doc, groups, activeFindings.length);
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
  logoPath: string | null,
  findingCount: number,
  locationCount: number
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
  doc.fillColor(COLORS.secondary).font('Helvetica').fontSize(10)
    .text(`${findingCount} findings across ${locationCount} entries`, left + 20, statsY + 20);

  const counts = countBySeverity(result.findings.filter(f => !f.isBaseline && !f.suppressed));
  const stats: Array<{ label: string; value: string; color: string }> = [
    { label: 'Critical', value: String(counts.critical), color: COLORS.critical },
    { label: 'High', value: String(counts.high), color: COLORS.high },
    { label: 'Medium', value: String(counts.medium), color: COLORS.medium },
    { label: 'Low', value: String(counts.low), color: COLORS.low },
  ];

  const gap = 10;
  const cardW = (contentWidth - gap * 3) / 4;
  const cardsY = statsY + 44;
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

/**
 * Render findings grouped by location. A location with a single finding renders
 * as one entry; a location with several rules renders as one consolidated entry
 * with the file:line header and an indented list of the controls flagged there.
 * No finding is dropped — every member of every group is printed.
 */
function renderFindings(doc: PDFKit.PDFDocument, groups: LocationGroup[], findingCount: number) {
  const left = doc.page.margins.left;
  const contentWidth = PAGE_WIDTH(doc);

  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(20)
    .text('Findings by Location', left, doc.page.margins.top);
  doc.fillColor(COLORS.secondary).font('Helvetica').fontSize(10)
    .text(`${findingCount} findings across ${groups.length} entries — grouped by file, line & control family.`, { width: contentWidth });
  doc.moveDown(0.6);

  if (groups.length === 0) {
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(12)
      .text('No active compliance findings. ✅', { width: contentWidth });
    return;
  }

  const refX = left + 16;
  const refW = contentWidth - 16;

  for (const g of groups) {
    if (g.members.length === 1) {
      renderSingleEntry(doc, g.members[0], left, contentWidth);
    } else {
      renderGroupedEntry(doc, g, left, contentWidth, refX, refW);
    }
  }
}

/** Add a page (with a continued header) if `needed` vertical space is unavailable. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(14)
      .text('Findings by Location (continued)', doc.page.margins.left, doc.page.margins.top);
    doc.moveDown(0.6);
  }
}

function severityBadge(doc: PDFKit.PDFDocument, severity: Severity, x: number, y: number, width = 62) {
  const color = SEVERITY_COLOR[severity] || COLORS.info;
  doc.roundedRect(x, y, width, 15, 3).fill(color);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.5)
    .text(severity.toUpperCase(), x, y + 4, { width, align: 'center' });
}

function renderSingleEntry(doc: PDFKit.PDFDocument, f: Finding, left: number, contentWidth: number) {
  const textX = left + 72;
  const textW = contentWidth - 72;
  const ref = formatHipaaRef(f.hipaaReference);
  const titleH = doc.font('Helvetica-Bold').fontSize(10.5).heightOfString(f.title, { width: textW });
  const refH = doc.font('Helvetica').fontSize(8).heightOfString(ref, { width: textW });
  const blockH = Math.max(titleH + refH + 8, 30);

  ensureSpace(doc, blockH + 8);
  const y = doc.y;

  severityBadge(doc, f.severity, left, y);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.5)
    .text(f.title, textX, y, { width: textW });
  doc.fillColor(COLORS.muted).font('Courier').fontSize(8)
    .text(`${f.file}${f.line ? `:${f.line}` : ''}`, textX, doc.y + 1, { width: textW });
  doc.fillColor(COLORS.secondary).font('Helvetica').fontSize(8)
    .text(ref, textX, doc.y + 1, { width: textW });

  doc.y = y + blockH;
  doc.moveTo(left, doc.y - 4).lineTo(left + contentWidth, doc.y - 4).strokeColor(COLORS.border).stroke();
}

function renderGroupedEntry(
  doc: PDFKit.PDFDocument,
  g: LocationGroup,
  left: number,
  contentWidth: number,
  refX: number,
  refW: number,
) {
  // Header: group-severity badge + file:line + control count.
  const headerText = `${g.file}${g.line ? `:${g.line}` : ''}  ·  ${g.members.length} controls flagged at this location`;
  const headerH = doc.font('Helvetica-Bold').fontSize(10).heightOfString(headerText, { width: contentWidth - 72 });
  ensureSpace(doc, Math.max(headerH, 16) + 14);

  const hy = doc.y;
  severityBadge(doc, g.severity, left, hy);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
    .text(headerText, left + 72, hy, { width: contentWidth - 72 });
  doc.y = Math.max(doc.y, hy + 16) + 4;

  // One indented line block per control.
  for (const f of g.members) {
    const label = `${f.severity.toUpperCase()} · ${f.title}`;
    const ref = formatHipaaRef(f.hipaaReference);
    const labelH = doc.font('Helvetica').fontSize(9.5).heightOfString(label, { width: refW });
    const refH = doc.font('Helvetica').fontSize(8).heightOfString(ref, { width: refW - 12 });
    const memberH = labelH + refH + 6;

    ensureSpace(doc, memberH + 2);
    const my = doc.y;
    doc.fillColor(SEVERITY_COLOR[f.severity] || COLORS.info).font('Helvetica-Bold').fontSize(9.5)
      .text(`${f.severity.toUpperCase()} · `, refX, my, { continued: true });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9.5)
      .text(f.title, { width: refW });
    doc.fillColor(COLORS.secondary).font('Helvetica').fontSize(8)
      .text(ref, refX + 12, doc.y + 1, { width: refW - 12 });
    doc.y = my + memberH;
  }

  doc.moveDown(0.2);
  doc.moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).strokeColor(COLORS.border).stroke();
  doc.moveDown(0.4);
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
