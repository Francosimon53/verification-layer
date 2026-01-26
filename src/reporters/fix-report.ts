import chalk from 'chalk';
import type { FixReport, FixResult, FixType } from '../types.js';

const FIX_TYPE_DESCRIPTIONS: Record<FixType, string> = {
  'sql-injection-template': 'SQL injection -> parameterized query',
  'sql-injection-concat': 'SQL injection -> parameterized query',
  'hardcoded-password': 'Hardcoded password -> process.env',
  'hardcoded-secret': 'Hardcoded secret -> process.env',
  'api-key-exposed': 'Exposed API key -> process.env',
  'phi-console-log': 'PHI in console.log -> commented out',
  'http-url': 'HTTP URL -> HTTPS',
  'innerhtml-unsanitized': 'innerHTML -> textContent',
  'phi-localstorage': 'PHI in localStorage -> encrypted storage',
  'phi-url-param': 'PHI in URL -> removed from URL',
  'phi-log-unredacted': 'Unredacted PHI in log -> redactPHI()',
  'cookie-insecure': 'Insecure cookie -> secure cookie options',
  'backup-unencrypted': 'Unencrypted backup -> encrypted backup',
};

interface FileFixGroup {
  filePath: string;
  fixes: FixResult[];
}

function groupFixesByFile(fixes: FixResult[]): FileFixGroup[] {
  const groups = new Map<string, FixResult[]>();

  for (const fix of fixes) {
    const filePath = fix.finding.file;
    const existing = groups.get(filePath) ?? [];
    existing.push(fix);
    groups.set(filePath, existing);
  }

  return Array.from(groups.entries())
    .map(([filePath, fixes]) => ({
      filePath,
      fixes: fixes.sort((a, b) => (a.finding.line ?? 0) - (b.finding.line ?? 0)),
    }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));
}

export function generateFixReport(report: FixReport): string {
  const lines: string[] = [
    '',
    chalk.bold.cyan('=== vlayer Fix Report ==='),
    '',
  ];

  // Summary line
  if (report.fixedCount > 0) {
    lines.push(
      chalk.green(`Fixed ${report.fixedCount} of ${report.totalFindings} issues`)
    );
  } else {
    lines.push(
      chalk.yellow(`No issues were auto-fixed (${report.totalFindings} total issues)`)
    );
  }
  lines.push('');

  // Group fixes by file
  const appliedFixes = report.fixes.filter(f => f.fixed);
  const skippedFixes = report.fixes.filter(f => !f.fixed);

  if (appliedFixes.length > 0) {
    lines.push(chalk.bold('Changes by file:'));
    const fileGroups = groupFixesByFile(appliedFixes);

    for (const group of fileGroups) {
      lines.push(chalk.blue(`  ${group.filePath}`));
      for (const fix of group.fixes) {
        const lineNum = fix.finding.line ?? '?';
        const description = FIX_TYPE_DESCRIPTIONS[fix.fixType] || fix.fixType;
        lines.push(chalk.gray(`    Line ${lineNum}: ${description}`));
      }
      lines.push('');
    }
  }

  // Skipped fixes requiring manual review
  if (skippedFixes.length > 0 || report.skippedCount > report.fixes.filter(f => !f.fixed).length) {
    lines.push(chalk.bold('Skipped (manual review needed):'));
    lines.push(chalk.gray(`  - ${report.skippedCount} issues require manual intervention`));
    lines.push('');
  }

  return lines.join('\n');
}
