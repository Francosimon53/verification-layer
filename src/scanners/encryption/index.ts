import { readFile } from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';

const WEAK_CRYPTO_PATTERNS = [
  { regex: /\bmd5\s*\(/i, issue: 'MD5 hash function', severity: 'high' as const },
  { regex: /\bsha1\s*\(/i, issue: 'SHA1 hash function', severity: 'medium' as const },
  { regex: /\bdes\b/i, issue: 'DES encryption', severity: 'critical' as const },
  { regex: /\b(rc4|arcfour)\b/i, issue: 'RC4 encryption', severity: 'critical' as const },
  { regex: /createCipher\s*\(/i, issue: 'Deprecated cipher method', severity: 'high' as const },
  { regex: /\bECB\b/, issue: 'ECB mode encryption', severity: 'high' as const },
];

const MISSING_ENCRYPTION_PATTERNS = [
  { regex: /http:\/\/(?!localhost|127\.0\.0\.1)/i, issue: 'Unencrypted HTTP URL', severity: 'high' as const },
  { regex: /ssl\s*[:=]\s*false/i, issue: 'SSL disabled', severity: 'critical' as const },
  { regex: /verify\s*[:=]\s*false.*ssl/i, issue: 'SSL verification disabled', severity: 'critical' as const },
  { regex: /rejectUnauthorized\s*:\s*false/i, issue: 'TLS certificate validation disabled', severity: 'critical' as const },
];

async function scanFile(filePath: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const pattern of WEAK_CRYPTO_PATTERNS) {
        if (pattern.regex.test(line)) {
          findings.push({
            id: `enc-weak-${lineNum}`,
            category: 'encryption',
            severity: pattern.severity,
            title: `Weak cryptography: ${pattern.issue}`,
            description: `${pattern.issue} is not suitable for protecting PHI.`,
            file: filePath,
            line: lineNum + 1,
            recommendation: 'Use AES-256-GCM for encryption and SHA-256 or stronger for hashing.',
            hipaaReference: '§164.312(a)(2)(iv), §164.312(e)(2)(ii)',
          });
        }
      }

      for (const pattern of MISSING_ENCRYPTION_PATTERNS) {
        if (pattern.regex.test(line)) {
          findings.push({
            id: `enc-missing-${lineNum}`,
            category: 'encryption',
            severity: pattern.severity,
            title: `Encryption issue: ${pattern.issue}`,
            description: `${pattern.issue} may expose PHI during transmission.`,
            file: filePath,
            line: lineNum + 1,
            recommendation: 'Enforce TLS 1.2+ for all data transmission containing PHI.',
            hipaaReference: '§164.312(e)(1)',
          });
        }
      }
    }
  } catch {
    // Skip files that can't be read
  }

  return findings;
}

export const encryptionScanner: Scanner = {
  name: 'Encryption Scanner',
  category: 'encryption',

  async scan(files: string[], _options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php', '.env', '.yaml', '.yml', '.json', '.xml'];
    const codeFiles = files.filter(f => codeExtensions.some(ext => f.endsWith(ext)));

    for (const file of codeFiles) {
      const fileFindings = await scanFile(file);
      findings.push(...fileFindings);
    }

    return findings;
  },
};
