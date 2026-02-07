/**
 * Credential Security Scanner
 * Detects weak password hashing, hardcoded credentials, and exposed secrets
 */

import * as fs from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import {
  ALL_CREDENTIAL_PATTERNS,
  type CredentialPattern,
} from './patterns.js';

export const credentialsScanner: Scanner = {
  name: 'Credential Security Scanner',
  category: 'encryption',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Filter to code and config files
    const codeFiles = files.filter((f) =>
      /\.(js|ts|jsx|tsx|py|java|go|rb|php|cs|env|yml|yaml|json)$/i.test(f)
    );

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (const pattern of ALL_CREDENTIAL_PATTERNS) {
          // Special handling for CRED-001 (weak password hashing)
          if (pattern.id === 'CRED-001') {
            await scanWeakPasswordHashing(
              file,
              content,
              lines,
              pattern,
              findings
            );
            continue;
          }

          // Standard pattern matching for CRED-002 and CRED-003
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;

            // Skip comments and empty lines
            if (/^\s*(?:\/\/|#|\/\*|\*|$)/.test(line)) continue;

            // Check if line matches violation pattern
            const matched = pattern.patterns.some((p) => p.test(line));
            if (!matched) continue;

            // Check if negative patterns indicate safe usage
            const isSafe = pattern.negativePatterns?.some((p) => {
              // Check current line for safe indicators
              if (p.test(line)) return true;

              // For CRED-002, check if it's an env var or placeholder
              if (pattern.id === 'CRED-002') {
                // Extract the value being assigned
                const valueMatch = line.match(/[:=]\s*['"`]([^'"`]+)['"`]/);
                if (valueMatch) {
                  const value = valueMatch[1];
                  // Check if value looks like a placeholder
                  if (
                    /^(?:your|my|the|a|an|test|example|demo|sample|placeholder|xxx|changeme|replace|todo)/i.test(
                      value
                    )
                  ) {
                    return true;
                  }
                  // Check if value is too short or generic
                  if (
                    value.length < 8 ||
                    /^(?:12345|qwerty|password|admin|test)/i.test(value)
                  ) {
                    return true;
                  }
                }
              }

              return false;
            });

            if (isSafe) continue;

            // Create finding
            findings.push({
              id: pattern.id,
              category: 'encryption',
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
 * Scan for weak password hashing algorithms
 */
async function scanWeakPasswordHashing(
  file: string,
  content: string,
  lines: string[],
  pattern: CredentialPattern,
  findings: Finding[]
): Promise<void> {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Skip comments
    if (/^\s*(?:\/\/|#|\/\*|\*)/.test(line)) continue;

    // Check if line contains weak hashing
    const hasWeakHash = pattern.patterns.some((p) => p.test(line));
    if (!hasWeakHash) continue;

    // Check surrounding context (5 lines before and after) for password-related code
    const contextStart = Math.max(0, i - 5);
    const contextEnd = Math.min(lines.length, i + 6);
    const context = lines.slice(contextStart, contextEnd).join('\n');

    // Check if this is related to password hashing
    const isPasswordRelated =
      /password|passwd|pwd|credential|auth/i.test(context);

    // Check if secure algorithms are present (indicates awareness/migration)
    const hasSecureAlgo = pattern.negativePatterns?.some((p) =>
      p.test(context)
    );

    if (hasSecureAlgo) continue;

    // Check if it's for non-password use (checksums, file hashing)
    const isNonPasswordUse = pattern.negativePatterns?.some(
      (p) => p.test(line) && /checksum|file|integrity/i.test(p.source)
    );

    if (isNonPasswordUse) continue;

    // Only flag if it's likely password-related
    if (isPasswordRelated) {
      findings.push({
        id: pattern.id,
        category: 'encryption',
        severity: pattern.severity,
        title: pattern.name,
        description: `${pattern.description}\n\nCode: ${line.trim()}\n\nWeak hashing algorithm detected in password-related code.`,
        file: file,
        line: lineNumber,
        recommendation: pattern.recommendation,
        hipaaReference: pattern.hipaaReference,
        confidence: 'high',
      });
    }
  }
}
