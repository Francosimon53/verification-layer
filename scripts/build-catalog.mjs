/**
 * Generate the built-in rule catalog artifact from the compiled library.
 *
 * Run as part of `npm run build` (after `tsc`). Emits:
 *   - dist/rule-catalog.json   (shipped with the package; `files` includes dist)
 *   - rule-catalog.json        (committed at the repo root for easy diffing)
 *
 * The catalog is DERIVED from the scanners at module load, so this script does
 * no transformation of its own — it serializes RULE_CATALOG verbatim and prints
 * the per-category reconciliation.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const { RULE_CATALOG, getCategoryCounts } = await import(
  resolve(repoRoot, 'dist', 'index.js')
);

const pkg = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf-8'));
const counts = getCategoryCounts();

const payload = {
  package: pkg.name,
  version: pkg.version,
  total: RULE_CATALOG.length,
  counts,
  rules: RULE_CATALOG,
};

const json = JSON.stringify(payload, null, 2) + '\n';
await writeFile(resolve(repoRoot, 'dist', 'rule-catalog.json'), json);
await writeFile(resolve(repoRoot, 'rule-catalog.json'), json);

const patternCount = RULE_CATALOG.filter((r) => r.source === 'pattern').length;
const aiCount = RULE_CATALOG.filter((r) => r.source === 'ai').length;

console.log('\nBuilt-in rule catalog generated (dist/rule-catalog.json, rule-catalog.json):');
for (const [category, n] of Object.entries(counts)) {
  console.log(`  ${category.padEnd(16)} ${n}`);
}
console.log('  ' + '-'.repeat(20));
console.log(`  ${'TOTAL'.padEnd(16)} ${RULE_CATALOG.length}  (${patternCount} pattern + ${aiCount} AI)\n`);
