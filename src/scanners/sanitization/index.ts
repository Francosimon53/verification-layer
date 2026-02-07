/**
 * Input Sanitization Security Scanner
 * Detects unsafe user input handling and file upload configurations
 */

import * as fs from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_SANITIZATION_PATTERNS } from './patterns.js';

export const sanitizationScanner: Scanner = {
  name: 'Input Sanitization Security Scanner',
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
          for (const pattern of ALL_SANITIZATION_PATTERNS) {
            // Check if line matches violation pattern
            const matched = pattern.patterns.some((regex) => regex.test(line));

            if (!matched) continue;

            // Get surrounding context (10 lines before and 5 after), excluding comments
            const contextStart = Math.max(0, i - 10);
            const contextEnd = Math.min(lines.length, i + 6);
            const contextLines = lines.slice(contextStart, contextEnd);

            // Filter out comment lines from context
            const codeOnlyContext = contextLines
              .filter(l => !/^\s*\/\//.test(l) && !/^\s*\/\*/.test(l) && !/^\s*\*/.test(l))
              .join('\n');

            // Check negative patterns (safe usage indicators)
            // For SANITIZE-001, check context for validation
            // For SANITIZE-002, check if config object has required fields
            const isSafe = pattern.negativePatterns?.some((regex) => {
              const patternStr = regex.source;

              // For file upload patterns, check the entire config block
              if (pattern.id === 'SANITIZE-002') {
                // Check if the line has the required validation fields
                // or if they appear in the surrounding context
                return regex.test(codeOnlyContext);
              }

              // For SANITIZE-001, check surrounding context for validation
              if (pattern.id === 'SANITIZE-001') {
                // Check if validation happens in surrounding code (excluding comments)
                return regex.test(codeOnlyContext);
              }

              return regex.test(line);
            });

            if (isSafe) continue;

            // Additional check for SANITIZE-002: ensure it's an actual configuration
            if (pattern.id === 'SANITIZE-002') {
              // Skip if it's just a variable reference or import
              if (
                /^import\s/i.test(line) ||
                /^const\s+\w+\s*=\s*require/i.test(line)
              ) {
                continue;
              }

              // Only flag if it looks like actual middleware configuration
              if (
                !/\bmulter\s*\(/i.test(line) &&
                !/\bformidable\s*\(/i.test(line) &&
                !/\bBusboy\s*\(/i.test(line) &&
                !/IncomingForm\s*\(/i.test(line)
              ) {
                continue;
              }
            }

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

export default sanitizationScanner;
