/**
 * Role-Based Access Control (RBAC) Scanner
 * Detects missing authorization checks and HIPAA minimum necessary violations
 */

import * as fs from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_RBAC_PATTERNS, type RBACPattern } from './patterns.js';

export const rbacScanner: Scanner = {
  name: 'Role-Based Access Control Scanner',
  category: 'access-control',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Filter to code files
    const codeFiles = files.filter((f) =>
      /\.(js|ts|jsx|tsx|sql|prisma)$/i.test(f)
    );

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Determine if this is a client-side file for RBAC-002
        const isClientFile = isClientSideFile(file, content);

        for (const pattern of ALL_RBAC_PATTERNS) {
          // Special handling for RBAC-002 (only scan client-side files)
          if (pattern.id === 'RBAC-002' && !isClientFile) {
            continue;
          }

          // Special handling for RBAC-001 (check authorization in surrounding context)
          if (pattern.id === 'RBAC-001') {
            await scanPHIAccessWithoutAuthz(
              file,
              content,
              lines,
              pattern,
              findings
            );
            continue;
          }

          // Standard pattern matching for RBAC-002 and RBAC-003
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;

            // Skip comments
            if (/^\s*(?:\/\/|#|\/\*|\*)/.test(line)) continue;

            // Check if line matches violation pattern
            const matched = pattern.patterns.some((p) => p.test(line));
            if (!matched) continue;

            // Check if negative patterns indicate compliance
            const isCompliant = pattern.negativePatterns?.some((p) => {
              // For RBAC-002, check if in server-side context
              if (pattern.id === 'RBAC-002') {
                return p.test(file) || p.test(content);
              }
              // For RBAC-003, check current line and surrounding lines
              const context = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
              return p.test(context);
            });

            if (isCompliant) continue;

            // Create finding
            findings.push({
              id: pattern.id,
              category: 'access-control',
              severity: pattern.severity,
              title: pattern.name,
              description: `${pattern.description}\n\nCode: ${line.trim()}`,
              file: file,
              line: lineNumber,
              recommendation: pattern.recommendation,
              hipaaReference: pattern.hipaaReference,
              confidence: 'high',
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return findings;
  },
};

/**
 * Determine if a file is client-side code
 */
function isClientSideFile(file: string, content: string): boolean {
  // Client-side indicators
  const clientPatterns = [
    /\/(?:components?|pages?|app)\//i,
    /\.client\./i,
    /use client/i,
    /useState|useEffect|useContext/i,
    /window\./i,
    /document\./i,
  ];

  // Server-side indicators (take precedence)
  const serverPatterns = [
    /\/api\//i,
    /\.server\./i,
    /getServerSideProps/i,
    /getStaticProps/i,
    /use server/i,
  ];

  // If file has server indicators, it's server-side
  if (serverPatterns.some((p) => p.test(file) || p.test(content))) {
    return false;
  }

  // If file has client indicators, it's client-side
  if (clientPatterns.some((p) => p.test(file) || p.test(content))) {
    return true;
  }

  // Default: treat as client-side if in common web directories
  return /\/(?:src|components?|pages?|app|views?)\//i.test(file);
}

/**
 * Scan for PHI data access without authorization checks
 */
async function scanPHIAccessWithoutAuthz(
  file: string,
  content: string,
  lines: string[],
  pattern: RBACPattern,
  findings: Finding[]
): Promise<void> {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Skip comments
    if (/^\s*(?:\/\/|#|\/\*|\*)/.test(line)) continue;

    // Check if line contains PHI data access
    const hasPHIAccess = pattern.patterns.some((p) => p.test(line));
    if (!hasPHIAccess) continue;

    // Check surrounding context (10 lines before and 5 lines after) for authorization
    const contextStart = Math.max(0, i - 10);
    const contextEnd = Math.min(lines.length, i + 6);
    const context = lines.slice(contextStart, contextEnd).join('\n');

    // Check if authorization is present in context
    const hasAuthorization = pattern.negativePatterns?.some((p) =>
      p.test(context)
    );

    if (hasAuthorization) continue;

    // Create finding
    findings.push({
      id: pattern.id,
      category: 'access-control',
      severity: pattern.severity,
      title: pattern.name,
      description: `${pattern.description}\n\nCode: ${line.trim()}\n\nNo authorization check found in surrounding code.`,
      file: file,
      line: lineNumber,
      recommendation: pattern.recommendation,
      hipaaReference: pattern.hipaaReference,
      confidence: 'high',
    });
  }
}
