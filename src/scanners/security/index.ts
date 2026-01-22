import { readFile } from 'fs/promises';
import type { Scanner, Finding, ScanOptions, FixType } from '../../types.js';
import { DEFAULT_CONFIG } from '../../config.js';
import { getContextLines } from '../../utils/context.js';

const SECURITY_PATTERNS: Array<{
  regex: RegExp;
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  recommendation: string;
  fixType?: FixType;
}> = [
  // === Hardcoded Passwords ===
  {
    regex: /password\s*[:=]\s*['"`][^'"`]{4,}['"`]/i,
    id: 'hardcoded-password',
    severity: 'critical' as const,
    title: 'Hardcoded password detected',
    description: 'A password appears to be hardcoded in the source code.',
    recommendation: 'Use environment variables or a secrets manager for credentials. Never commit passwords to source control.',
    fixType: 'hardcoded-password',
  },
  {
    regex: /pwd\s*[:=]\s*['"`][^'"`]{4,}['"`]/i,
    id: 'hardcoded-pwd',
    severity: 'critical' as const,
    title: 'Hardcoded password (pwd) detected',
    description: 'A password appears to be hardcoded using "pwd" variable.',
    recommendation: 'Use environment variables or a secrets manager for credentials.',
    fixType: 'hardcoded-password',
  },
  {
    regex: /secret\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,
    id: 'hardcoded-secret',
    severity: 'critical' as const,
    title: 'Hardcoded secret detected',
    description: 'A secret value appears to be hardcoded in the source code.',
    recommendation: 'Use environment variables or a secrets manager for secrets.',
    fixType: 'hardcoded-secret',
  },
  {
    regex: /credentials?\s*[:=]\s*\{[^}]*password\s*:/i,
    id: 'credentials-object',
    severity: 'high' as const,
    title: 'Credentials object with password',
    description: 'A credentials object containing password field was detected.',
    recommendation: 'Load credentials from secure configuration, not source code.',
  },

  // === API Keys Exposure ===
  {
    regex: /api[_-]?key\s*[:=]\s*['"`][A-Za-z0-9_\-]{20,}['"`]/i,
    id: 'api-key-exposed',
    severity: 'critical' as const,
    title: 'API key exposed in source',
    description: 'An API key appears to be hardcoded in the source code.',
    recommendation: 'Use environment variables for API keys. Add to .gitignore and use .env files.',
    fixType: 'api-key-exposed',
  },
  {
    regex: /apikey\s*[:=]\s*['"`][A-Za-z0-9_\-]{20,}['"`]/i,
    id: 'apikey-exposed',
    severity: 'critical' as const,
    title: 'API key (apikey) exposed in source',
    description: 'An API key appears to be hardcoded.',
    recommendation: 'Use environment variables for API keys.',
    fixType: 'api-key-exposed',
  },
  {
    regex: /(sk|pk)[_-](live|test)[_-][A-Za-z0-9]{20,}/i,
    id: 'stripe-key-exposed',
    severity: 'critical' as const,
    title: 'Stripe API key exposed',
    description: 'A Stripe API key pattern was detected in the source code.',
    recommendation: 'Never commit Stripe keys. Use environment variables and restrict key permissions.',
  },
  {
    regex: /AKIA[0-9A-Z]{16}/,
    id: 'aws-key-exposed',
    severity: 'critical' as const,
    title: 'AWS Access Key exposed',
    description: 'An AWS Access Key ID pattern was detected.',
    recommendation: 'Rotate this key immediately. Use IAM roles or environment variables instead.',
  },
  {
    regex: /bearer\s+[A-Za-z0-9_\-\.]{20,}/i,
    id: 'bearer-token-exposed',
    severity: 'high' as const,
    title: 'Bearer token in source',
    description: 'A bearer token appears to be hardcoded.',
    recommendation: 'Tokens should be fetched at runtime, not hardcoded.',
  },
  {
    regex: /auth[_-]?token\s*[:=]\s*['"`][A-Za-z0-9_\-\.]{20,}['"`]/i,
    id: 'auth-token-exposed',
    severity: 'critical' as const,
    title: 'Auth token exposed in source',
    description: 'An authentication token appears to be hardcoded.',
    recommendation: 'Use secure token management. Never commit tokens to source control.',
  },
  {
    regex: /private[_-]?key\s*[:=]\s*['"`]-----BEGIN/i,
    id: 'private-key-exposed',
    severity: 'critical' as const,
    title: 'Private key exposed in source',
    description: 'A private key appears to be embedded in source code.',
    recommendation: 'Never commit private keys. Use secure key management services.',
  },

  // === Database Credentials ===
  {
    regex: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/i,
    id: 'mongodb-uri-credentials',
    severity: 'critical' as const,
    title: 'MongoDB URI with credentials',
    description: 'A MongoDB connection string with embedded credentials was detected.',
    recommendation: 'Use environment variables for database connection strings.',
  },
  {
    regex: /postgres(ql)?:\/\/[^:]+:[^@]+@/i,
    id: 'postgres-uri-credentials',
    severity: 'critical' as const,
    title: 'PostgreSQL URI with credentials',
    description: 'A PostgreSQL connection string with embedded credentials was detected.',
    recommendation: 'Use environment variables for database connection strings.',
  },
  {
    regex: /mysql:\/\/[^:]+:[^@]+@/i,
    id: 'mysql-uri-credentials',
    severity: 'critical' as const,
    title: 'MySQL URI with credentials',
    description: 'A MySQL connection string with embedded credentials was detected.',
    recommendation: 'Use environment variables for database connection strings.',
  },

  // === Input Sanitization Issues ===
  {
    regex: /innerHTML\s*=\s*[^'"`\s;]+/i,
    id: 'innerhtml-unsanitized',
    severity: 'high' as const,
    title: 'Unsanitized innerHTML assignment',
    description: 'Direct innerHTML assignment without sanitization can lead to XSS vulnerabilities.',
    recommendation: 'Use textContent for text, or sanitize HTML with DOMPurify before innerHTML assignment.',
    fixType: 'innerhtml-unsanitized',
  },
  {
    regex: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:/i,
    id: 'dangerous-innerhtml-react',
    severity: 'high' as const,
    title: 'dangerouslySetInnerHTML usage',
    description: 'Using dangerouslySetInnerHTML can expose the application to XSS attacks.',
    recommendation: 'Sanitize content with DOMPurify before using dangerouslySetInnerHTML.',
  },
  {
    regex: /eval\s*\(\s*[^)]*\)/i,
    id: 'eval-usage',
    severity: 'critical' as const,
    title: 'eval() usage detected',
    description: 'Using eval() can execute arbitrary code and is a security risk.',
    recommendation: 'Avoid eval(). Use safer alternatives like JSON.parse() for data parsing.',
  },
  {
    regex: /new\s+Function\s*\([^)]*\)/i,
    id: 'function-constructor',
    severity: 'high' as const,
    title: 'Function constructor usage',
    description: 'The Function constructor can execute arbitrary code like eval().',
    recommendation: 'Avoid dynamic code execution. Use predefined functions instead.',
  },
  {
    regex: /document\.write\s*\(/i,
    id: 'document-write',
    severity: 'medium' as const,
    title: 'document.write usage',
    description: 'document.write can be exploited for XSS and blocks page rendering.',
    recommendation: 'Use DOM manipulation methods (appendChild, insertAdjacentHTML) instead.',
  },

  // === SQL Injection Risks ===
  {
    regex: /['"`]\s*\+\s*[^+]+\s*\+\s*['"`]\s*(FROM|WHERE|AND|OR|INSERT|UPDATE|DELETE|SELECT)/i,
    id: 'sql-string-concat',
    severity: 'critical' as const,
    title: 'SQL query string concatenation',
    description: 'Building SQL queries with string concatenation is vulnerable to SQL injection.',
    recommendation: 'Use parameterized queries or prepared statements. Never concatenate user input into SQL.',
    fixType: 'sql-injection-concat',
  },
  {
    regex: /\$\{[^}]+\}\s*(FROM|WHERE|AND|OR|INSERT|UPDATE|DELETE|SELECT)/i,
    id: 'sql-template-literal',
    severity: 'critical' as const,
    title: 'SQL query with template literal interpolation',
    description: 'Interpolating variables directly into SQL queries enables SQL injection.',
    recommendation: 'Use parameterized queries. Pass variables as parameters, not interpolated strings.',
    fixType: 'sql-injection-template',
  },
  {
    regex: /query\s*\(\s*['"`].*\$\{/i,
    id: 'query-template-injection',
    severity: 'critical' as const,
    title: 'Database query with template interpolation',
    description: 'Template literal interpolation in database queries can lead to injection attacks.',
    recommendation: 'Use parameterized queries: query("SELECT * FROM users WHERE id = $1", [userId])',
    fixType: 'sql-injection-template',
  },
  {
    regex: /execute\s*\(\s*['"`].*\+/i,
    id: 'execute-string-concat',
    severity: 'critical' as const,
    title: 'SQL execute with string concatenation',
    description: 'Concatenating strings in SQL execute statements enables injection.',
    recommendation: 'Use parameterized queries instead of string concatenation.',
    fixType: 'sql-injection-concat',
  },
  {
    regex: /raw\s*\(\s*['"`].*\$\{/i,
    id: 'raw-query-injection',
    severity: 'critical' as const,
    title: 'Raw SQL query with interpolation',
    description: 'Raw SQL queries with interpolated values are vulnerable to injection.',
    recommendation: 'Even with raw queries, use parameter binding for user-supplied values.',
    fixType: 'sql-injection-template',
  },
];

export const securityScanner: Scanner = {
  name: 'Security Scanner',
  category: 'access-control', // Using access-control category for now

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];
    const config = options.config ?? DEFAULT_CONFIG;
    const contextSize = config.contextLines ?? 2;
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php', '.env', '.sql'];
    const codeFiles = files.filter(f => codeExtensions.some(ext => f.endsWith(ext)));

    for (const filePath of codeFiles) {
      // Skip test files for some patterns to reduce noise
      const isTestFile = filePath.includes('test') || filePath.includes('spec') || filePath.includes('mock');

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];

          for (const pattern of SECURITY_PATTERNS) {
            if (pattern.regex.test(line)) {
              // Skip some false positives in test files
              if (isTestFile && ['hardcoded-password', 'hardcoded-secret'].includes(pattern.id)) {
                continue;
              }

              findings.push({
                id: `security-${pattern.id}-${lineNum}`,
                category: 'access-control',
                severity: pattern.severity,
                title: pattern.title,
                description: pattern.description,
                file: filePath,
                line: lineNum + 1,
                recommendation: pattern.recommendation,
                hipaaReference: '§164.312(a)(1), §164.312(d)',
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
