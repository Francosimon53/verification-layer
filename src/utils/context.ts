import type { ContextLine } from '../types.js';

export function getContextLines(
  lines: string[],
  matchLine: number,
  contextSize: number = 2
): ContextLine[] {
  const result: ContextLine[] = [];
  const start = Math.max(0, matchLine - contextSize);
  const end = Math.min(lines.length - 1, matchLine + contextSize);

  for (let i = start; i <= end; i++) {
    result.push({
      lineNumber: i + 1, // 1-indexed
      content: lines[i],
      isMatch: i === matchLine,
    });
  }

  return result;
}
