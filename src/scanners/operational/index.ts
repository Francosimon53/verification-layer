/**
 * Operational Security Scanner
 * Detects database backup, data retention, and API security issues
 */

import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_OPERATIONAL_PATTERNS, DATABASE_WITHOUT_BACKUP } from './patterns.js';
import * as fs from 'fs/promises';

export const operationalScanner: Scanner = {
  name: 'Operational Security Scanner',
  category: 'data-retention',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Handle BACKUP-001 separately (requires project-wide scan)
    const backupFinding = await scanForBackupConfiguration(files);
    if (backupFinding) {
      findings.push(backupFinding);
    }

    // Handle other patterns with line-by-line scanning
    for (const file of files) {
      // Skip non-code files
      if (!file.match(/\.(ts|tsx|js|jsx|mjs|cjs)$/)) {
        continue;
      }

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (const pattern of ALL_OPERATIONAL_PATTERNS) {
          // Skip BACKUP-001 (already handled)
          if (pattern.id === 'BACKUP-001') {
            continue;
          }

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Skip comment lines
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
              continue;
            }

            // Check if line matches any positive pattern
            const matched = pattern.patterns.some(p => p.test(line));
            if (!matched) continue;

            // Get context for negative pattern checking
            let contextLines: string[];

            if (pattern.id === 'RETENTION-001') {
              // Check 15 lines of context for retention fields (larger object definition)
              const start = Math.max(0, i - 5);
              const end = Math.min(lines.length, i + 10);
              contextLines = lines.slice(start, end);
            } else if (pattern.id === 'API-002') {
              // Check 5 lines of context for limit configuration
              const start = Math.max(0, i - 2);
              const end = Math.min(lines.length, i + 3);
              contextLines = lines.slice(start, end);
            } else {
              contextLines = [line];
            }

            const context = contextLines.join('\n');

            // Filter out comments from context
            const contextWithoutComments = context
              .split('\n')
              .filter(l => {
                const t = l.trim();
                return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
              })
              .join('\n');

            // Check negative patterns
            if (pattern.negativePatterns) {
              const hasNegativeMatch = pattern.negativePatterns.some(np =>
                np.test(contextWithoutComments)
              );
              if (hasNegativeMatch) {
                continue;
              }
            }

            // Determine category based on pattern
            let category: 'data-retention' | 'access-control' = 'data-retention';
            if (pattern.id === 'API-002') {
              category = 'access-control';
            }

            findings.push({
              id: pattern.id,
              title: pattern.name,
              description: `${pattern.description}\n\nCode: ${line.trim()}`,
              severity: pattern.severity,
              category: category,
              file,
              line: i + 1,
              column: line.indexOf(line.trim()) + 1,
              recommendation: pattern.recommendation,
              hipaaReference: pattern.hipaaReference,
              confidence: 'medium',
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return findings;
  },
};

/**
 * Scan entire project for database usage and backup configuration
 * Returns a finding if database is used but no backup configuration is found
 */
async function scanForBackupConfiguration(files: string[]): Promise<Finding | null> {
  let hasDatabaseUsage = false;
  let hasBackupConfig = false;
  let firstDbFile: string | null = null;
  let firstDbLine = 0;
  let firstDbCode = '';

  // Scan all files to detect database usage and backup configuration
  for (const file of files) {
    if (!file.match(/\.(ts|tsx|js|jsx|mjs|cjs|json|yml|yaml)$/)) {
      continue;
    }

    try {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // Check for database usage
      if (!hasDatabaseUsage) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const matched = DATABASE_WITHOUT_BACKUP.patterns.some(p => p.test(line));
          if (matched) {
            hasDatabaseUsage = true;
            if (!firstDbFile) {
              firstDbFile = file;
              firstDbLine = i + 1;
              firstDbCode = line.trim();
            }
          }
        }
      }

      // Check for backup configuration (negative patterns)
      if (!hasBackupConfig && DATABASE_WITHOUT_BACKUP.negativePatterns) {
        const hasBackup = DATABASE_WITHOUT_BACKUP.negativePatterns.some(np =>
          np.test(content)
        );
        if (hasBackup) {
          hasBackupConfig = true;
        }
      }

      // If we found both, we can stop early
      if (hasDatabaseUsage && hasBackupConfig) {
        break;
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  // If database is used but no backup config found, create a finding
  if (hasDatabaseUsage && !hasBackupConfig && firstDbFile) {
    return {
      id: DATABASE_WITHOUT_BACKUP.id,
      title: DATABASE_WITHOUT_BACKUP.name,
      description: `${DATABASE_WITHOUT_BACKUP.description}\n\nCode: ${firstDbCode}`,
      severity: DATABASE_WITHOUT_BACKUP.severity,
      category: 'data-retention',
      file: firstDbFile,
      line: firstDbLine,
      recommendation: DATABASE_WITHOUT_BACKUP.recommendation,
      hipaaReference: DATABASE_WITHOUT_BACKUP.hipaaReference,
      confidence: 'low', // Low confidence since this is advisory
    };
  }

  return null;
}
