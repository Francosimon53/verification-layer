/**
 * Token Revocation Security Scanner
 * Detects JWT usage without revocation and excessive token expiration
 */

import * as fs from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_REVOCATION_PATTERNS } from './patterns.js';

export const revocationScanner: Scanner = {
  name: 'Token Revocation Security Scanner',
  category: 'access-control',

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

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNumber = i + 1;

          // Skip empty lines and comments
          if (/^\s*$/.test(line) || /^\s*\/\//.test(line)) continue;

          // Scan each pattern
          for (const pattern of ALL_REVOCATION_PATTERNS) {
            // Check if line matches violation pattern
            const matched = pattern.patterns.some((regex) => regex.test(line));

            if (!matched) continue;

            // Get surrounding context (20 lines before and 10 after for REVOKE-001)
            // (10 lines before and 5 after for REVOKE-002)
            const contextBefore = pattern.id === 'REVOKE-001' ? 20 : 10;
            const contextAfter = pattern.id === 'REVOKE-001' ? 10 : 5;

            const contextStart = Math.max(0, i - contextBefore);
            const contextEnd = Math.min(lines.length, i + contextAfter + 1);
            const contextLines = lines.slice(contextStart, contextEnd);

            // Filter out comment lines from context
            const codeOnlyContext = contextLines
              .filter(l => !/^\s*\/\//.test(l) && !/^\s*\/\*/.test(l) && !/^\s*\*/.test(l))
              .join('\n');

            // Check negative patterns (safe usage indicators)
            const isSafe = pattern.negativePatterns?.some((regex) => {
              // For REVOKE-001, check wider context for revocation mechanisms
              // For REVOKE-002, check current line and immediate context
              if (pattern.id === 'REVOKE-001') {
                // Check surrounding code for revocation mechanisms
                return regex.test(codeOnlyContext);
              }

              if (pattern.id === 'REVOKE-002') {
                // Check if this is a refresh token or other acceptable long-lived token
                // Check both the line and surrounding context
                return regex.test(line) || regex.test(codeOnlyContext);
              }

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

export default revocationScanner;
