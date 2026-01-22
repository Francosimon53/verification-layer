import { readFile, writeFile } from 'fs/promises';
import type { Finding, FixResult, FixReport, FixType, AuditEvidence, AuditTrail } from '../types.js';
import { applyFixStrategy } from './strategies.js';
import { createEvidence, hashContent } from '../audit/evidence.js';
import {
  createAuditTrail,
  addEvidence,
  addManualReviews,
  updateScanStats,
  finalizeAuditTrail,
  saveAuditTrail,
} from '../audit/index.js';

interface FileFixGroup {
  filePath: string;
  findings: Finding[];
}

interface FixReportWithAudit extends FixReport {
  auditTrail: AuditTrail;
}

function groupFindingsByFile(findings: Finding[]): FileFixGroup[] {
  const groups = new Map<string, Finding[]>();

  for (const finding of findings) {
    if (!finding.fixType || !finding.line) continue;

    const existing = groups.get(finding.file) ?? [];
    existing.push(finding);
    groups.set(finding.file, existing);
  }

  return Array.from(groups.entries()).map(([filePath, findings]) => ({
    filePath,
    findings: findings.sort((a, b) => (b.line ?? 0) - (a.line ?? 0)), // Sort descending by line
  }));
}

export async function applyFixes(
  findings: Finding[],
  projectPath: string,
  scannedFiles: number = 0,
  scanDuration: number = 0
): Promise<FixReportWithAudit> {
  const fixableFindings = findings.filter(f => f.fixType);
  const fixes: FixResult[] = [];

  // Create audit trail
  const auditTrail = createAuditTrail(projectPath);

  const fileGroups = groupFindingsByFile(fixableFindings);

  for (const group of fileGroups) {
    try {
      const contentBefore = await readFile(group.filePath, 'utf-8');
      const linesBefore = contentBefore.split('\n');
      const lines = [...linesBefore]; // Copy for modification
      let modified = false;

      // Process findings from bottom to top to preserve line numbers
      for (const finding of group.findings) {
        if (!finding.line || !finding.fixType) continue;

        const lineIndex = finding.line - 1;
        if (lineIndex < 0 || lineIndex >= lines.length) continue;

        const originalLine = lines[lineIndex];
        const fixedLine = applyFixStrategy(originalLine, finding.fixType);

        if (fixedLine !== null && fixedLine !== originalLine) {
          lines[lineIndex] = fixedLine;
          modified = true;

          // Create evidence BEFORE writing (using original content and proposed new content)
          const contentAfterFix = lines.join('\n');
          const evidence = await createEvidence(
            finding,
            group.filePath,
            contentBefore,
            contentAfterFix,
            lineIndex,
            finding.fixType
          );

          addEvidence(auditTrail, evidence);

          fixes.push({
            finding,
            fixed: true,
            originalLine,
            fixedLine,
            fixType: finding.fixType,
          });
        } else {
          fixes.push({
            finding,
            fixed: false,
            originalLine,
            fixedLine: originalLine,
            fixType: finding.fixType,
          });
        }
      }

      if (modified) {
        await writeFile(group.filePath, lines.join('\n'));
      }
    } catch {
      // If we can't read/write the file, mark all findings as not fixed
      for (const finding of group.findings) {
        if (!finding.fixType) continue;
        fixes.push({
          finding,
          fixed: false,
          originalLine: '',
          fixedLine: '',
          fixType: finding.fixType,
        });
      }
    }
  }

  // Add manual review items for non-fixable findings
  addManualReviews(auditTrail, findings);

  // Update scan statistics
  const nonFixableCount = findings.filter(f => !f.fixType).length;
  const fixedCount = fixes.filter(f => f.fixed).length;
  const skippedFixableCount = fixes.filter(f => !f.fixed).length;

  updateScanStats(auditTrail, findings.length, scannedFiles, scanDuration);

  // Finalize and save audit trail
  finalizeAuditTrail(auditTrail);
  await saveAuditTrail(auditTrail, projectPath);

  return {
    totalFindings: findings.length,
    fixedCount,
    skippedCount: nonFixableCount + skippedFixableCount,
    fixes,
    auditTrail,
  };
}

/**
 * Apply fixes without audit trail (for backwards compatibility)
 */
export async function applyFixesSimple(findings: Finding[]): Promise<FixReport> {
  const fixableFindings = findings.filter(f => f.fixType);
  const fixes: FixResult[] = [];

  const fileGroups = groupFindingsByFile(fixableFindings);

  for (const group of fileGroups) {
    try {
      const content = await readFile(group.filePath, 'utf-8');
      const lines = content.split('\n');
      let modified = false;

      for (const finding of group.findings) {
        if (!finding.line || !finding.fixType) continue;

        const lineIndex = finding.line - 1;
        if (lineIndex < 0 || lineIndex >= lines.length) continue;

        const originalLine = lines[lineIndex];
        const fixedLine = applyFixStrategy(originalLine, finding.fixType);

        if (fixedLine !== null && fixedLine !== originalLine) {
          lines[lineIndex] = fixedLine;
          modified = true;

          fixes.push({
            finding,
            fixed: true,
            originalLine,
            fixedLine,
            fixType: finding.fixType,
          });
        } else {
          fixes.push({
            finding,
            fixed: false,
            originalLine,
            fixedLine: originalLine,
            fixType: finding.fixType,
          });
        }
      }

      if (modified) {
        await writeFile(group.filePath, lines.join('\n'));
      }
    } catch {
      for (const finding of group.findings) {
        if (!finding.fixType) continue;
        fixes.push({
          finding,
          fixed: false,
          originalLine: '',
          fixedLine: '',
          fixType: finding.fixType,
        });
      }
    }
  }

  const nonFixableCount = findings.filter(f => !f.fixType).length;
  const fixedCount = fixes.filter(f => f.fixed).length;
  const skippedFixableCount = fixes.filter(f => !f.fixed).length;

  return {
    totalFindings: findings.length,
    fixedCount,
    skippedCount: nonFixableCount + skippedFixableCount,
    fixes,
  };
}
