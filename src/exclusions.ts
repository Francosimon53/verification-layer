/**
 * Default exclusion globs for vlayer's OWN artifacts: generated outputs and
 * the shipped rule catalog.
 *
 * Without these, a second scan re-reads the report/baseline files vlayer wrote
 * on a previous run and flags their text as if it were source code (e.g. the
 * literal "Weak cryptography: DES encryption" inside a JSON report). On the demo
 * this produced 62/95 false positives. The rule catalog has the same problem:
 * its titles, descriptions, and example snippets name the very patterns the
 * rules detect. These globs are added to the file-discovery ignore list by
 * default and can be disabled with `--include-own-artifacts`.
 *
 * Patterns are prefixed with a globstar so they match at any depth in the tree.
 */
export const DEFAULT_VLAYER_OUTPUT_EXCLUDES: readonly string[] = [
  // Standard report outputs (`vlayer scan/report -o`)
  '**/vlayer-report.json',
  '**/vlayer-report.html',
  '**/vlayer-report.md',
  '**/vlayer-report.pdf',
  // Auditor report outputs (`vlayer report` / `vlayer audit --generate-report`)
  '**/vlayer-audit-report.html',
  '**/vlayer-audit-report.pdf',
  // Baseline + metadata vlayer writes into the project
  '**/.vlayer-baseline.json',
  '**/.vlayer/**',
  // Curated sample reports directory (publishable report artifacts)
  '**/samples/**',
  // Shipped rule catalog — rule metadata quotes the patterns it detects
  '**/rule-catalog.json',
];
