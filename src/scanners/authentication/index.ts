/**
 * Multi-Factor Authentication (MFA) Scanner
 * Detects missing or bypassed MFA in authentication flows
 */

import * as fs from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_MFA_PATTERNS, type MFAPattern } from './patterns.js';

export const authenticationScanner: Scanner = {
  name: 'Multi-Factor Authentication Scanner',
  category: 'access-control', // Map to existing category for now

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Filter to code and config files
    const relevantFiles = files.filter((f) =>
      /\.(js|ts|jsx|tsx|json|yaml|yml|env)$/i.test(f)
    );

    // Common auth config file patterns
    const authConfigFiles = relevantFiles.filter((f) =>
      /(?:auth|clerk|supabase|next-auth).*\.(?:ts|js|json|config)/i.test(f)
    );

    for (const file of relevantFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (const pattern of ALL_MFA_PATTERNS) {
          // Special handling for MFA-001 (auth config files)
          if (pattern.id === 'MFA-001') {
            await scanAuthConfig(file, content, lines, pattern, findings);
            continue;
          }

          // Standard pattern matching for MFA-002 and MFA-003
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;

            // Skip comments
            if (/^\s*(?:\/\/|#|\*)/.test(line)) continue;

            // Check if line matches violation pattern
            const matched = pattern.patterns.some((p) => p.test(line));
            if (!matched) continue;

            // Check if negative patterns indicate compliance
            const isCompliant = pattern.negativePatterns?.some((p) => {
              // Check current line and next 5 lines for compliance indicators
              const context = lines.slice(i, i + 6).join('\n');
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
 * Scan auth configuration files for missing MFA
 */
async function scanAuthConfig(
  file: string,
  content: string,
  lines: string[],
  pattern: MFAPattern,
  findings: Finding[]
): Promise<void> {
  // Check if this is an auth-related file
  const isAuthFile =
    /(?:auth|clerk|supabase|next-auth)/i.test(file) ||
    pattern.patterns.some((p) => p.test(content));

  if (!isAuthFile) return;

  // Check if file has any auth provider configuration
  const hasAuthConfig = pattern.patterns.some((p) => p.test(content));
  if (!hasAuthConfig) return;

  // Check if MFA is configured
  const hasMfaConfig = pattern.negativePatterns?.some((p) => p.test(content));
  if (hasMfaConfig) return;

  // Find the line with auth configuration
  let configLine = 1;
  for (let i = 0; i < lines.length; i++) {
    if (pattern.patterns.some((p) => p.test(lines[i]))) {
      configLine = i + 1;
      break;
    }
  }

  // Create finding for auth config without MFA
  findings.push({
    id: pattern.id,
    category: 'access-control',
    severity: pattern.severity,
    title: pattern.name,
    description: `${pattern.description}\n\nFile contains auth configuration but no MFA setup detected.`,
    file: file,
    line: configLine,
    recommendation: pattern.recommendation,
    hipaaReference: pattern.hipaaReference,
    confidence: 'high',
  });
}
