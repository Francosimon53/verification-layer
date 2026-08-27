/**
 * Fail the build if a retracted marketing claim reappears in tracked source.
 *
 * "HIPAA 2026 ready - 15/15 requirements covered" was removed from the README
 * in a release (PR #84) after an audit found three of the fifteen had ZERO
 * mapped rules and two more were supported only by rules this project
 * classifies as informational. §164.308(a)(1)(ii)(A) Risk Analysis reports
 * `not_evaluated` in every attestation the product generates, while the README
 * counted it as covered.
 *
 * Removing it from the README was not sufficient. The lead sentence is a
 * GENERATED block, and scripts/sync-rule-counts.mjs still carried the old copy
 * on a long-lived branch — so merging that branch would have silently rewritten
 * the claim back into the README on the next build, with no diff a reviewer
 * would notice.
 *
 * A retracted claim needs a guard, not just a deletion. This runs in CI.
 *
 * Usage: node scripts/check-claims.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Retracted claims. Each needs `why` so a future reader learns the reason
 * rather than just hitting a wall.
 */
const FORBIDDEN = [
  {
    pattern: /15\s*\/\s*15|15%2F15/i,
    label: '"15/15"',
    why: 'Three of the fifteen areas have zero mapped rules (Patch Management, ' +
         'Security Training, Third-Party Risk) and two more are informational only. ' +
         'No source establishes a count of fifteen.',
  },
  {
    pattern: /HIPAA\s*2026\s*ready/i,
    label: '"HIPAA 2026 ready"',
    why: 'Asserts readiness for a rule that is still a proposal. Describe what ' +
         'vlayer detects instead of claiming readiness.',
  },
];

/** Tracked, reviewable source. Excludes build output and vendored files. */
function trackedFiles() {
  const out = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf-8' });
  // Dedupe: during an unresolved merge `git ls-files` emits a conflicted path
  // once per stage, which would report the same violation three times.
  return [...new Set(out.split('\n').filter(Boolean))].filter((f) =>
    !f.startsWith('dist/') &&
    !f.startsWith('samples/') &&
    f !== 'package-lock.json' &&
    f !== 'rule-catalog.json' &&
    // this file necessarily contains the strings it forbids
    f !== 'scripts/check-claims.mjs' &&
    // so does the published-artifact auditor: it carries the same RETRACTED
    // list to check the tarball on the registry. It arrived on main in PR #85,
    // after this exclusion list was written, so the two guards flagged
    // each other on the first merge.
    f !== 'scripts/audit-published.mjs' &&
    // the test that proves the guard works must be able to name them too
    f !== 'tests/claims.test.ts'
  );
}

const violations = [];
for (const file of trackedFiles()) {
  let text;
  try {
    text = readFileSync(resolve(repoRoot, file), 'utf-8');
  } catch {
    continue; // binary or unreadable
  }
  const lines = text.split('\n');
  for (const { pattern, label, why } of FORBIDDEN) {
    lines.forEach((line, i) => {
      if (pattern.test(line)) {
        violations.push({ file, line: i + 1, label, why, text: line.trim().slice(0, 120) });
      }
    });
  }
}

if (violations.length > 0) {
  console.error('\n[check-claims] RETRACTED CLAIM REINTRODUCED:\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.label}`);
    console.error(`    ${v.text}`);
    console.error(`    why it was retracted: ${v.why}\n`);
  }
  console.error(
    'These claims were removed deliberately after an audit. If a generator ' +
    'produces one,\nfix the generator body — rewriting the output file is not ' +
    'enough, it regenerates.\n',
  );
  process.exit(1);
}

console.log(`[check-claims] clean — no retracted claim in ${trackedFiles().length} tracked files.`);
