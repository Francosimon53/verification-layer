import { readFile } from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { DEFAULT_CONFIG } from '../../config.js';
import { getContextLines } from '../../utils/context.js';

const ACCESS_CONTROL_ISSUES = [
  {
    regex: /\*\s*FROM\s+(patient|user|health|medical)/i,
    id: 'select-star',
    severity: 'medium' as const,
    title: 'SELECT * on sensitive table',
    description: 'Using SELECT * may retrieve more PHI than necessary.',
    recommendation: 'Select only required columns to minimize PHI exposure (minimum necessary).',
  },
  {
    regex: /role\s*[:=]\s*['"`](admin|root|superuser)['"`]/i,
    id: 'hardcoded-admin',
    severity: 'high' as const,
    title: 'Hardcoded admin role',
    description: 'Hardcoded administrative role assignment detected.',
    recommendation: 'Use role-based access control (RBAC) with proper authentication.',
  },
  {
    regex: /bypass.*auth|auth.*bypass|skip.*auth/i,
    id: 'auth-bypass',
    severity: 'critical' as const,
    title: 'Potential authentication bypass',
    description: 'Code pattern suggests authentication may be bypassed.',
    recommendation: 'Remove any authentication bypass mechanisms in production code.',
  },
  {
    regex: /isAdmin\s*[:=]\s*true|admin\s*[:=]\s*true/i,
    id: 'admin-flag',
    severity: 'medium' as const,
    title: 'Hardcoded admin flag',
    description: 'Admin privileges set via hardcoded flag.',
    recommendation: 'Determine admin status through secure authentication flow.',
  },
  {
    regex: /public\s+(static\s+)?.*password|password.*public/i,
    id: 'public-password',
    severity: 'critical' as const,
    title: 'Password field with public visibility',
    description: 'Password field may have public accessibility.',
    recommendation: 'Password fields should be private and never exposed.',
  },
  {
    regex: /allow.*origin.*\*/i,
    id: 'cors-wildcard',
    severity: 'high' as const,
    title: 'CORS wildcard origin',
    description: 'CORS configured to allow all origins.',
    recommendation: 'Restrict CORS to specific trusted domains for PHI-handling endpoints.',
  },
  {
    regex: /session.*expires?\s*[:=]\s*0|maxAge\s*:\s*0/i,
    id: 'no-session-expiry',
    severity: 'high' as const,
    title: 'Session without expiration',
    description: 'Session configured without expiration.',
    recommendation: 'Implement automatic session timeout for PHI access (HIPAA recommends 15 min idle).',
  },
];

export const accessScanner: Scanner = {
  name: 'Access Control Scanner',
  category: 'access-control',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];
    const config = options.config ?? DEFAULT_CONFIG;
    const contextSize = config.contextLines ?? 2;
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php', '.sql'];
    const codeFiles = files.filter(f => codeExtensions.some(ext => f.endsWith(ext)));

    for (const filePath of codeFiles) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];

          for (const issue of ACCESS_CONTROL_ISSUES) {
            if (issue.regex.test(line)) {
              findings.push({
                id: `access-${issue.id}-${lineNum}`,
                category: 'access-control',
                severity: issue.severity,
                title: issue.title,
                description: issue.description,
                file: filePath,
                line: lineNum + 1,
                recommendation: issue.recommendation,
                hipaaReference: '§164.312(a)(1), §164.312(d)',
                context: getContextLines(lines, lineNum, contextSize),
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
