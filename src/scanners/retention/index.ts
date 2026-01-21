import { readFile } from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { DEFAULT_CONFIG } from '../../config.js';
import { getContextLines } from '../../utils/context.js';

const RETENTION_ISSUES = [
  {
    regex: /deleteAfter\s*[:=]\s*(\d+)\s*(day|hour|minute)/i,
    id: 'short-retention',
    check: (match: RegExpMatchArray) => {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      // HIPAA requires 6 years minimum for most records
      if (unit === 'day' && value < 2190) return true; // ~6 years in days
      if (unit === 'hour' || unit === 'minute') return true;
      return false;
    },
    severity: 'high' as const,
    title: 'PHI retention period may be too short',
    description: 'Data deletion configured with period shorter than HIPAA requirements.',
    recommendation: 'HIPAA requires PHI retention for 6 years from creation or last effective date.',
  },
  {
    regex: /\.delete\s*\(\s*\)(?!.*audit|.*log)/i,
    id: 'unlogged-delete',
    severity: 'medium' as const,
    title: 'Data deletion without apparent logging',
    description: 'Data deletion operation without visible audit logging.',
    recommendation: 'Log all PHI deletions with timestamp, user, and record identifiers.',
  },
  {
    regex: /truncate\s+table|drop\s+table/i,
    id: 'bulk-delete',
    severity: 'critical' as const,
    title: 'Bulk data deletion operation',
    description: 'Bulk deletion (TRUNCATE/DROP) could delete PHI without proper retention.',
    recommendation: 'Implement soft-delete with retention periods before permanent deletion.',
  },
  {
    regex: /backup.*disable|disable.*backup/i,
    id: 'backup-disabled',
    severity: 'high' as const,
    title: 'Backup may be disabled',
    description: 'Code pattern suggests backups might be disabled.',
    recommendation: 'Maintain encrypted backups with proper retention for disaster recovery.',
  },
  {
    regex: /cache.*patient|patient.*cache/i,
    id: 'phi-cache',
    severity: 'medium' as const,
    title: 'PHI caching detected',
    description: 'Patient data may be cached, requiring retention policy consideration.',
    recommendation: 'Ensure cached PHI has appropriate TTL and is encrypted at rest.',
  },
];

export const retentionScanner: Scanner = {
  name: 'Data Retention Scanner',
  category: 'data-retention',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];
    const config = options.config ?? DEFAULT_CONFIG;
    const contextSize = config.contextLines ?? 2;
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php', '.sql', '.yaml', '.yml'];
    const codeFiles = files.filter(f => codeExtensions.some(ext => f.endsWith(ext)));

    for (const filePath of codeFiles) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];

          for (const issue of RETENTION_ISSUES) {
            const match = line.match(issue.regex);
            if (match) {
              // Check if there's a custom check function
              if ('check' in issue && issue.check) {
                if (!issue.check(match)) continue;
              }

              findings.push({
                id: `retention-${issue.id}-${lineNum}`,
                category: 'data-retention',
                severity: issue.severity,
                title: issue.title,
                description: issue.description,
                file: filePath,
                line: lineNum + 1,
                recommendation: issue.recommendation,
                hipaaReference: '§164.530(j)',
                context: getContextLines(lines, lineNum, contextSize),
              });
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return findings;
  },
};
