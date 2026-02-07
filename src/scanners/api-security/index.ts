/**
 * API Security Scanner
 * Detects authentication routes without rate limiting, open CORS, and PHI in URLs
 */

import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_API_SECURITY_PATTERNS } from './patterns.js';
import * as fs from 'fs/promises';

export const apiSecurityScanner: Scanner = {
  name: 'API Security Scanner',
  category: 'access-control',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of files) {
      // Skip non-code files
      if (!file.match(/\.(ts|tsx|js|jsx|mjs|cjs)$/)) {
        continue;
      }

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (const pattern of ALL_API_SECURITY_PATTERNS) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Skip comment lines for all patterns
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
              continue;
            }

            // For CORS-001, check multi-line context
            if (pattern.id === 'CORS-001') {
              // Trigger check on lines containing cors, setHeader, .header, or origin
              if (!/cors|setHeader|\.header|headers\.set|origin.*\*/i.test(line)) {
                continue;
              }

              // Get 5 lines of context
              const start = Math.max(0, i - 2);
              const end = Math.min(lines.length, i + 3);
              const contextLines = lines.slice(start, end);
              const context = contextLines.join(' ').replace(/\s+/g, ' ');

              // Check if any pattern matches the context
              const matched = pattern.patterns.some(p => p.test(context));
              if (!matched) continue;

              // Check negative patterns
              const contextWithoutComments = contextLines
                .filter(l => {
                  const t = l.trim();
                  return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
                })
                .join('\n');

              if (pattern.negativePatterns) {
                const hasNegativeMatch = pattern.negativePatterns.some(np =>
                  np.test(contextWithoutComments)
                );
                if (hasNegativeMatch) {
                  continue;
                }
              }

              // Determine category
              const category: 'access-control' | 'phi-exposure' = 'access-control';

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
                confidence: 'high',
              });

              continue;
            }

            // For other patterns, check line-by-line
            const matched = pattern.patterns.some(p => p.test(line));
            if (!matched) continue;

            // Get context for negative pattern checking
            let contextLines: string[];

            if (pattern.id === 'RATE-001') {
              // Check 20 lines of context for rate limiting middleware
              const start = Math.max(0, i - 10);
              const end = Math.min(lines.length, i + 10);
              contextLines = lines.slice(start, end);
            } else if (pattern.id === 'API-001') {
              // Check 3 lines of context for POST body usage (current line + 1 before/after)
              const start = Math.max(0, i - 1);
              const end = Math.min(lines.length, i + 2);
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
            let category: 'access-control' | 'phi-exposure' = 'access-control';
            if (pattern.id === 'API-001') {
              category = 'phi-exposure';
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
              confidence: 'high',
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
