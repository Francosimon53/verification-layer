import { readFile } from 'fs/promises';
import type { Finding } from './types.js';

const SUPPRESSION_PATTERN = /\/\/\s*vlayer-ignore\s+([a-zA-Z0-9\-*]+)\s+--\s+(.+)/;
const SUPPRESSION_PATTERN_NO_REASON = /\/\/\s*vlayer-ignore\s+([a-zA-Z0-9\-*]+)\s*$/;

interface SuppressionComment {
  line: number;
  rulePattern: string;
  reason: string;
}

/**
 * Extract suppression comments from file content
 */
function extractSuppressions(content: string): SuppressionComment[] {
  const lines = content.split('\n');
  const suppressions: SuppressionComment[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(SUPPRESSION_PATTERN);

    if (match) {
      suppressions.push({
        line: i + 1,
        rulePattern: match[1],
        reason: match[2].trim(),
      });
    } else {
      // Check for suppression without reason (will be flagged as error)
      const noReasonMatch = line.match(SUPPRESSION_PATTERN_NO_REASON);
      if (noReasonMatch) {
        suppressions.push({
          line: i + 1,
          rulePattern: noReasonMatch[1],
          reason: '', // Empty reason - invalid
        });
      }
    }
  }

  return suppressions;
}

/**
 * Check if a finding matches a suppression pattern
 */
function matchesSuppressionPattern(findingId: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === findingId) return true;

  // Support wildcard patterns like "phi-*" or "*-injection"
  const regexPattern = pattern.replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(findingId);
}

/**
 * Check if a finding is suppressed by inline comments
 */
export async function checkInlineSuppression(
  finding: Finding
): Promise<{ suppressed: boolean; reason?: string; comment?: string }> {
  if (!finding.file || !finding.line) {
    return { suppressed: false };
  }

  try {
    const content = await readFile(finding.file, 'utf-8');
    const suppressions = extractSuppressions(content);
    const findingLine = finding.line!; // We checked it's defined above

    // Check the line before the finding (most common case)
    const prevLineSuppression = suppressions.find(
      s => s.line === findingLine - 1 && matchesSuppressionPattern(finding.id, s.rulePattern)
    );

    if (prevLineSuppression) {
      if (!prevLineSuppression.reason) {
        // Suppression without reason - treat as not suppressed
        return { suppressed: false };
      }

      return {
        suppressed: true,
        reason: prevLineSuppression.reason,
        comment: `// vlayer-ignore ${prevLineSuppression.rulePattern} -- ${prevLineSuppression.reason}`,
      };
    }

    // Check same line (for inline suppressions)
    const sameLineSuppression = suppressions.find(
      s => s.line === findingLine && matchesSuppressionPattern(finding.id, s.rulePattern)
    );

    if (sameLineSuppression) {
      if (!sameLineSuppression.reason) {
        return { suppressed: false };
      }

      return {
        suppressed: true,
        reason: sameLineSuppression.reason,
        comment: `// vlayer-ignore ${sameLineSuppression.rulePattern} -- ${sameLineSuppression.reason}`,
      };
    }

    return { suppressed: false };
  } catch {
    // If we can't read the file, don't suppress
    return { suppressed: false };
  }
}

/**
 * Apply inline suppressions to all findings
 */
export async function applyInlineSuppressions(findings: Finding[]): Promise<Finding[]> {
  const results = await Promise.all(
    findings.map(async finding => {
      const suppression = await checkInlineSuppression(finding);

      if (suppression.suppressed) {
        return {
          ...finding,
          suppressed: true,
          suppression: {
            reason: suppression.reason!,
            comment: suppression.comment!,
          },
        };
      }

      return finding;
    })
  );

  return results;
}
