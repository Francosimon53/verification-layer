import { readFile } from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { DEFAULT_CONFIG } from '../../config.js';
import { getContextLines } from '../../utils/context.js';
import { PHI_PATTERNS } from './patterns.js';

export const phiScanner: Scanner = {
  name: 'PHI Exposure Scanner',
  category: 'phi-exposure',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];
    const config = options.config ?? DEFAULT_CONFIG;
    const contextSize = config.contextLines ?? 2;

    // Filter to code files
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php'];
    const codeFiles = files.filter(f => codeExtensions.some(ext => f.endsWith(ext)));

    for (const filePath of codeFiles) {
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
