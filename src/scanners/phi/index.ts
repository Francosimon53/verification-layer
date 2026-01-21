import { readFile } from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { PHI_PATTERNS } from './patterns.js';

async function scanFile(filePath: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const pattern of PHI_PATTERNS) {
        if (pattern.regex.test(line)) {
          findings.push({
            id: `phi-${pattern.id}-${lineNum}`,
            category: 'phi-exposure',
            severity: pattern.severity,
            title: pattern.title,
            description: pattern.description,
            file: filePath,
            line: lineNum + 1,
            recommendation: pattern.recommendation,
            hipaaReference: '§164.502, §164.514',
          });
        }
      }
    }
  } catch {
    // Skip files that can't be read
  }

  return findings;
}

export const phiScanner: Scanner = {
  name: 'PHI Exposure Scanner',
  category: 'phi-exposure',

  async scan(files: string[], _options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Filter to code files
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php'];
    const codeFiles = files.filter(f => codeExtensions.some(ext => f.endsWith(ext)));

    for (const file of codeFiles) {
      const fileFindings = await scanFile(file);
      findings.push(...fileFindings);
    }

    return findings;
  },
};
