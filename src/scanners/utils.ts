/**
 * Shared helpers for scanner pattern matching.
 */

/**
 * Whether a line is a module import / require statement (ES `import`,
 * re-export `export … from`, or CommonJS `require(...)`).
 *
 * Rules that infer "library X is used" by matching its name should not anchor
 * a finding to the `import` line — flagging an import statement reads as a false
 * positive to reviewers. Use this to skip import lines when choosing the line a
 * finding points at (and to suppress findings whose only evidence is an import).
 */
export function isImportLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    // ES module import: `import x from '…'`, `import { x } from '…'`, `import '…'`, `import(`
    /^import\b/.test(trimmed) ||
    // Continuation / close of a multi-line import: `} from '…'`
    /^\}\s*from\s+['"]/.test(trimmed) ||
    // Re-export from a module: `export { x } from '…'`, `export * from '…'`
    /^export\b[^=]*\bfrom\s+['"]/.test(trimmed) ||
    // CommonJS require assignment: `const x = require('…')`
    /^(?:const|let|var)\s+[^=]+=\s*require\s*\(/.test(trimmed) ||
    // Bare require call: `require('…')`
    /^require\s*\(/.test(trimmed)
  );
}

/** A violation located at a 0-based line index, plus the anchor line's code. */
export interface WindowedViolation {
  lineIndex: number;
  code: string;
}

export interface WindowedMatchOptions {
  /** Lines of look-around for multi-line matching and the compliance window. */
  windowLines?: number;
  /** Skip lines that are pure comments (`//`, `#`, `*`, `/*`). */
  skipCommentLines?: boolean;
  /** Don't anchor a violation on an `import`/`require` line (see isImportLine). */
  skipImportLines?: boolean;
}

/** Add the dotAll (`s`) flag so `.` spans newlines, enabling multi-line matches. */
function withDotAll(re: RegExp): RegExp {
  return re.flags.includes('s') ? re : new RegExp(re.source, re.flags + 's');
}

/**
 * Match violation patterns against code with two properties the old per-line +
 * forward-only-window approach lacked:
 *
 *  (a) MULTI-LINE positives — a pattern's `.*?` may span several lines, so a
 *      violation expressed across a block (e.g. `catch (error) {` on one line
 *      and the security keyword on the next) is detected. Each match is anchored
 *      to the line where it STARTS, so a single multi-line span is reported once.
 *
 *  (b) BIDIRECTIONAL compliance — negative (compliance) patterns are evaluated
 *      in a window that looks both ABOVE and below the match, so a mitigation
 *      declared earlier in the block (a CORS whitelist, an MFA check, a session
 *      timeout) correctly suppresses the finding.
 *
 * Returns the anchor lines (0-based) that should produce a finding.
 */
export function findWindowedViolations(
  lines: string[],
  positivePatterns: RegExp[],
  negativePatterns: RegExp[] | undefined,
  options: WindowedMatchOptions = {},
): WindowedViolation[] {
  const window = options.windowLines ?? 6;
  const positives = positivePatterns.map(withDotAll);
  const results: WindowedViolation[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (options.skipCommentLines && /^\s*(?:\/\/|#|\*|\/\*)/.test(lines[i])) continue;
    if (options.skipImportLines && isImportLine(lines[i])) continue;

    // Positive: test a forward window so `.*?` can cross lines, but only accept
    // matches that BEGIN on line i (no newline before the match start), so the
    // same multi-line span isn't re-reported on every line it covers.
    const forward = lines.slice(i, i + window).join('\n');
    const anchored = positives.some((re) => {
      re.lastIndex = 0;
      const m = re.exec(forward);
      return m !== null && !forward.slice(0, m.index).includes('\n');
    });
    if (!anchored) continue;

    // Compliance: look both directions for a mitigation signal.
    if (negativePatterns && negativePatterns.length > 0) {
      const around = lines.slice(Math.max(0, i - window), i + window).join('\n');
      if (negativePatterns.some((p) => p.test(around))) continue;
    }

    results.push({ lineIndex: i, code: lines[i].trim() });
  }

  return results;
}
