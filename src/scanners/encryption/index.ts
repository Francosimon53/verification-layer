import { readFile } from 'fs/promises';
import type { Scanner, Finding, ScanOptions, FixType } from '../../types.js';
import { isSafeHttpUrl, DEFAULT_CONFIG } from '../../config.js';
import { getContextLines } from '../../utils/context.js';

const WEAK_CRYPTO_PATTERNS = [
  { regex: /\bmd5\s*\(/i, issue: 'MD5 hash function', severity: 'high' as const },
  { regex: /\bsha1\s*\(/i, issue: 'SHA1 hash function', severity: 'medium' as const },
  { regex: /\bdes\b/i, issue: 'DES encryption', severity: 'critical' as const },
  { regex: /\b(rc4|arcfour)\b/i, issue: 'RC4 encryption', severity: 'critical' as const },
  { regex: /createCipher\s*\(/i, issue: 'Deprecated cipher method', severity: 'high' as const },
  { regex: /\bECB\b/, issue: 'ECB mode encryption', severity: 'high' as const },
];

const MISSING_ENCRYPTION_PATTERNS: Array<{
  regex: RegExp;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  checkSafe?: boolean;
  fixType?: FixType;
}> = [
  { regex: /http:\/\/(?!localhost|127\.0\.0\.1)/i, issue: 'Unencrypted HTTP URL', severity: 'high' as const, checkSafe: true, fixType: 'http-url' },
  { regex: /ssl\s*[:=]\s*false/i, issue: 'SSL disabled', severity: 'critical' as const },
  { regex: /verify\s*[:=]\s*false.*ssl/i, issue: 'SSL verification disabled', severity: 'critical' as const },
  { regex: /rejectUnauthorized\s*:\s*false/i, issue: 'TLS certificate validation disabled', severity: 'critical' as const },
  // Unencrypted backup patterns
  { regex: /backup.*encrypt\s*[:=]\s*false|encrypt\s*[:=]\s*false.*backup/i, issue: 'Backup encryption disabled', severity: 'critical' as const, fixType: 'backup-unencrypted' as FixType },
  { regex: /mysqldump(?!.*--ssl).*password|pg_dump(?!.*--ssl)/i, issue: 'Database backup without SSL', severity: 'high' as const },
  { regex: /backup.*(\.sql|\.csv|\.json|\.txt)\b(?!.*encrypt|.*gpg|.*aes)/i, issue: 'Unencrypted backup file format', severity: 'high' as const, fixType: 'backup-unencrypted' as FixType },
  { regex: /writeFile.*backup.*patient|patient.*backup.*writeFile/i, issue: 'PHI backup without encryption', severity: 'critical' as const, fixType: 'backup-unencrypted' as FixType },
  { regex: /s3.*upload.*backup(?!.*encrypt|.*sse|.*kms)/i, issue: 'S3 backup without server-side encryption', severity: 'high' as const },
  { regex: /backup.*storage(?!.*encrypt)|storage.*backup(?!.*encrypt)/i, issue: 'Backup storage without encryption specified', severity: 'medium' as const },
];

export const encryptionScanner: Scanner = {
  name: 'Encryption Scanner',
  category: 'encryption',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];
    const config = options.config ?? DEFAULT_CONFIG;
    const contextSize = config.contextLines ?? 2;
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php', '.env', '.yaml', '.yml', '.json', '.xml'];
    const codeFiles = files.filter(f => codeExtensions.some(ext => f.endsWith(ext)));

    for (const filePath of codeFiles) {
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
                context: getContextLines(lines, lineNum, contextSize),
              });
            }
          }

          for (const pattern of MISSING_ENCRYPTION_PATTERNS) {
            if (pattern.regex.test(line)) {
              // Check if this is a safe HTTP URL (CDN, namespace, etc.)
              if (pattern.checkSafe && isSafeHttpUrl(line, config)) {
                continue;
              }

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
                context: getContextLines(lines, lineNum, contextSize),
                fixType: pattern.fixType,
              });
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return findings;
  },
};
