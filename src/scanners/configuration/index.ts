/**
 * Configuration Security Scanner
 * Detects insecure configuration settings and missing security controls
 */

import * as fs from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_CONFIGURATION_PATTERNS } from './patterns.js';

export const configurationScanner: Scanner = {
  name: 'Configuration Security Scanner',
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

        // Check if this is a test file for CONFIG-003
        const isTestFile = /\.(?:test|spec)\.[jt]sx?$/.test(file);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNumber = i + 1;

          // Skip empty lines and full-line comments
          if (/^\s*$/.test(line) || /^\s*\/\//.test(line)) continue;

          // Scan each pattern
          for (const pattern of ALL_CONFIGURATION_PATTERNS) {
            // CONFIG-003: Skip test files entirely
            if (pattern.id === 'CONFIG-003' && isTestFile) continue;

            // Check if line matches violation pattern
            const matched = pattern.patterns.some((regex) => regex.test(line));

            if (!matched) continue;

            // Get surrounding context
            const contextBefore = pattern.id === 'CONFIG-001' ? 5 :
                                  pattern.id === 'CONFIG-002' ? 20 : 0;
            const contextAfter = pattern.id === 'CONFIG-001' ? 5 :
                                 pattern.id === 'CONFIG-002' ? 10 : 0;

            const contextStart = Math.max(0, i - contextBefore);
            const contextEnd = Math.min(lines.length, i + contextAfter + 1);
            const contextLines = lines.slice(contextStart, contextEnd);

            // Filter out comment lines from context
            const codeOnlyContext = contextLines
              .filter(l => !/^\s*\/\//.test(l) && !/^\s*\/\*/.test(l) && !/^\s*\*/.test(l))
              .join('\n');

            // Check negative patterns (safe usage indicators)
            const isSafe = pattern.negativePatterns?.some((regex) => {
              // For CONFIG-001, check if there's NODE_ENV gate in context
              if (pattern.id === 'CONFIG-001') {
                return regex.test(codeOnlyContext);
              }

              // For CONFIG-002, check if security headers are set in context
              if (pattern.id === 'CONFIG-002') {
                return regex.test(codeOnlyContext);
              }

              // For CONFIG-003, no negative patterns to check (handled by filename)
              return false;
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

export default configurationScanner;
