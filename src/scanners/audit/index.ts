import { readFile } from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { DEFAULT_CONFIG } from '../../config.js';
import { getContextLines } from '../../utils/context.js';

const LOGGING_FRAMEWORKS = [
  'winston', 'bunyan', 'pino', 'log4js', 'morgan',
  'logging', 'logger', 'structlog', 'loguru',
];

const AUDIT_REQUIRED_ACTIONS = [
  { pattern: /\.(create|insert|save|add)\s*\(/i, action: 'create' },
  { pattern: /\.(update|modify|patch|put)\s*\(/i, action: 'update' },
  { pattern: /\.(delete|remove|destroy)\s*\(/i, action: 'delete' },
  { pattern: /\.(read|get|find|fetch|select)\s*\(/i, action: 'read' },
  { pattern: /\.(login|authenticate|authorize)\s*\(/i, action: 'auth' },
];

export const auditScanner: Scanner = {
  name: 'Audit Logging Scanner',
  category: 'audit-logging',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];
    const config = options.config ?? DEFAULT_CONFIG;
    const contextSize = config.contextLines ?? 2;

    // Check for logging framework presence
    const packageJsonFiles = files.filter(f => f.endsWith('package.json'));
    let hasLoggingFramework = false;

    for (const pkgFile of packageJsonFiles) {
      try {
        const content = await readFile(pkgFile, 'utf-8');
        if (LOGGING_FRAMEWORKS.some(fw => content.includes(fw))) {
          hasLoggingFramework = true;
          break;
        }
      } catch {
        // Skip
      }
    }

    if (!hasLoggingFramework && packageJsonFiles.length > 0) {
      findings.push({
        id: 'audit-no-framework',
        category: 'audit-logging',
        severity: 'high',
        title: 'No audit logging framework detected',
        description: 'No recognized logging framework found in dependencies.',
        file: packageJsonFiles[0],
        recommendation: 'Implement structured audit logging using winston, pino, or similar.',
        hipaaReference: '§164.312(b)',
      });
    }

    // Check code files for unlogged operations
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go'];
    const codeFiles = files.filter(f => codeExtensions.some(ext => f.endsWith(ext)));

    for (const filePath of codeFiles) {
      // Skip test files
      if (filePath.includes('test') || filePath.includes('spec')) {
        continue;
      }

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Simple heuristic: check if file has PHI-related operations without logging
        const hasPhiKeywords = /patient|health|medical|diagnosis|treatment/i.test(content);
        const hasLogging = /\.(log|info|warn|error|audit)\s*\(/i.test(content) ||
                          /logger\./i.test(content);

        if (hasPhiKeywords) {
          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];

            for (const { pattern, action } of AUDIT_REQUIRED_ACTIONS) {
              if (pattern.test(line) && !hasLogging) {
                findings.push({
                  id: `audit-unlogged-${action}-${lineNum}`,
                  category: 'audit-logging',
                  severity: 'medium',
                  title: `PHI ${action} operation may lack audit logging`,
                  description: `A ${action} operation on PHI-related data was found without apparent audit logging in this file.`,
                  file: filePath,
                  line: lineNum + 1,
                  recommendation: `Log all ${action} operations on PHI with timestamp, user ID, and action details.`,
                  hipaaReference: '§164.312(b)',
                  context: getContextLines(lines, lineNum, contextSize),
                });
                break; // One finding per file for this pattern
              }
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
