/**
 * Error Handling Security Scanner
 * Detects unsafe error responses and PHI in error logs
 */

import * as fs from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_ERROR_PATTERNS } from './patterns.js';

export const errorsScanner: Scanner = {
  name: 'Error Handling Security Scanner',
  category: 'audit-logging',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Filter to code files
    const codeFiles = files.filter((f) =>
      /\.(ts|tsx|js|jsx)$/.test(f)
    );

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Check if this is a test file (check filename)
        const isTestFile = /\.(?:test|spec)\.[jt]sx?$/.test(file);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNumber = i + 1;

          // Skip empty lines
          if (/^\s*$/.test(line)) continue;

          // Scan each pattern
          for (const pattern of ALL_ERROR_PATTERNS) {
            // Check if line matches any pattern
            const matched = pattern.patterns.some((regex) => regex.test(line));

            if (!matched) continue;

            // For ERROR-002, skip test files
            if (pattern.id === 'ERROR-002' && isTestFile) continue;

            // Get surrounding context (5 lines before and after)
            const contextStart = Math.max(0, i - 5);
            const contextEnd = Math.min(lines.length, i + 6);
            const context = lines.slice(contextStart, contextEnd).join('\n');

            // Check negative patterns (safe usage indicators)
            // For ERROR-001, only check development env in context, rest in current line
            // For ERROR-002, check redaction/masking in context, test file in filename
            const isSafe = pattern.negativePatterns?.some((regex) => {
              const patternStr = regex.source;
              // Check development environment and redaction/masking in context
              if (
                /NODE_ENV|isDevelopment|redact|mask|sanitize|obfuscate/i.test(
                  patternStr
                )
              ) {
                return regex.test(context);
              }
              // All other patterns check current line only
              return regex.test(line);
            });

            if (isSafe) continue;

            // Create finding
            const finding: Finding = {
              id: pattern.id,
              category: pattern.category as any,
              severity: pattern.severity,
              title: pattern.name,
              description: `${pattern.description}\n\nCode: ${line.trim()}`,
              file: file,
              line: lineNumber,
              recommendation: pattern.recommendation,
              hipaaReference: pattern.hipaaReference,
              confidence: 'high',
            };

            findings.push(finding);
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return findings;
  },
};

export default errorsScanner;
