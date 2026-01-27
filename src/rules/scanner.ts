import { readFile } from 'fs/promises';
import { minimatch } from 'minimatch';
import path from 'path';
import type { Finding, ScanOptions, CompiledCustomRule } from '../types.js';
import { getContextLines } from '../utils/context.js';
import { DEFAULT_CONFIG } from '../config.js';

function matchesFileFilters(
  filePath: string,
  rule: CompiledCustomRule,
  basePath: string
): boolean {
  const relativePath = path.relative(basePath, filePath);

  // If include patterns are specified, file must match at least one
  if (rule.include && rule.include.length > 0) {
    const matchesInclude = rule.include.some(pattern =>
      minimatch(relativePath, pattern, { dot: true })
    );
    if (!matchesInclude) {
      return false;
    }
  }

  // If exclude patterns are specified, file must not match any
  if (rule.exclude && rule.exclude.length > 0) {
    const matchesExclude = rule.exclude.some(pattern =>
      minimatch(relativePath, pattern, { dot: true })
    );
    if (matchesExclude) {
      return false;
    }
  }

  return true;
}

export async function scanWithCustomRules(
  files: string[],
  options: ScanOptions,
  rules: CompiledCustomRule[]
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const config = options.config ?? DEFAULT_CONFIG;
  const contextSize = config.contextLines ?? 2;
  const basePath = options.path;

  for (const filePath of files) {
    // Filter rules applicable to this file
    const applicableRules = rules.filter(rule =>
      matchesFileFilters(filePath, rule, basePath)
    );

    if (applicableRules.length === 0) {
      continue;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        for (const rule of applicableRules) {
          // Reset regex lastIndex for global patterns
          rule.compiledPattern.lastIndex = 0;

          if (rule.compiledPattern.test(line)) {
            // Reset again for potential reuse
            rule.compiledPattern.lastIndex = 0;

            // If mustNotContain is specified, check if the required pattern is present
            // If it IS present, we skip this finding (the line is OK)
            if (rule.compiledMustNotContain) {
              rule.compiledMustNotContain.lastIndex = 0;
              if (rule.compiledMustNotContain.test(line)) {
                // Required pattern is present, skip this finding
                continue;
              }
            }

            findings.push({
              id: `custom-${rule.id}-${filePath}-${lineNum}`,
              category: rule.category,
              severity: rule.severity,
              title: rule.name,
              description: rule.description,
              file: filePath,
              line: lineNum + 1,
              recommendation: rule.recommendation,
              hipaaReference: rule.hipaaReference,
              context: getContextLines(lines, lineNum, contextSize),
              fixType: rule.fix ? (`custom-${rule.id}` as any) : undefined,
            });
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return findings;
}
