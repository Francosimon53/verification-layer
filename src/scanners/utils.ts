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
