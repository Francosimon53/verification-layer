/**
 * Multi-Factor Authentication (MFA) Scanner
 * Detects missing or bypassed MFA in authentication flows
 */

import * as fs from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_MFA_PATTERNS, type MFAPattern } from './patterns.js';
import { isImportLine, findWindowedViolations } from '../utils.js';

export const authenticationScanner: Scanner = {
  name: 'Multi-Factor Authentication Scanner',
  category: 'access-control',

  async scan(files: string[], _options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    const relevantFiles = files.filter((f) =>
      /\.(js|ts|jsx|tsx|json|yaml|yml|env)$/i.test(f)
    );

    for (const file of relevantFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (const pattern of ALL_MFA_PATTERNS) {
          if (pattern.id === 'MFA-001') {
            await scanAuthConfig(file, content, lines, pattern, findings);
            continue;
          }

          if (pattern.id === 'MFA-003' && /\.(?:test|spec)\.[jt]sx?$/i.test(file)) {
            continue;
          }

          const windowedNegatives = (pattern.negativePatterns ?? []).filter(
            (p) => !/console/i.test(p.source),
          );
          const violations = findWindowedViolations(
            lines,
            pattern.patterns,
            windowedNegatives,
            { skipCommentLines: true, skipImportLines: true },
          );

          for (const v of violations) {
            if (
              pattern.id === 'MFA-003' &&
              /console\.(?:log|warn|error)/i.test(lines[v.lineIndex])
            ) {
              continue;
            }
            findings.push({
              id: pattern.id,
              category: 'access-control',
              severity: pattern.severity,
              title: pattern.name,
              description: `${pattern.description}\n\nCode: ${v.code}`,
              file: file,
              line: v.lineIndex + 1,
              recommendation: pattern.recommendation,
              hipaaReference: pattern.hipaaReference,
              confidence: 'high',
            });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return findings;
  },
};

/**
 * Scan auth configuration files for missing MFA.
 */
async function scanAuthConfig(
  file: string,
  content: string,
  lines: string[],
  pattern: MFAPattern,
  findings: Finding[]
): Promise<void> {
  const isAuthFile =
    /(?:auth|clerk|supabase|next-auth)/i.test(file) ||
    pattern.patterns.some((p) => p.test(content));

  if (!isAuthFile) return;

  const hasAuthConfig = pattern.patterns.some((p) => p.test(content));
  if (!hasAuthConfig) return;

  const hasMfaConfig = pattern.negativePatterns?.some((p) => p.test(content));
  if (hasMfaConfig) return;

  // First prefer a direct line-level pattern match so the finding points to the
  // exact executable/configuration line and never to an import.
  let configLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isImportLine(lines[i])) continue;
    if (pattern.patterns.some((p) => p.test(lines[i]))) {
      configLine = i + 1;
      break;
    }
  }

  // Some provider configuration signatures intentionally span multiple lines
  // (for example createClient( followed by a Supabase URL on the next line).
  // If the whole-file pattern matched but no single line did, anchor to the
  // executable createClient call rather than dropping a valid finding.
  if (configLine === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (isImportLine(lines[i])) continue;
      if (/\bcreateClient\s*\(/i.test(lines[i])) {
        configLine = i + 1;
        break;
      }
    }
  }

  if (configLine === 0) return;

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
