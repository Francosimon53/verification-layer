/**
 * Audit the PUBLISHED npm artifact against the repository.
 *
 * WHY THIS EXISTS
 *
 * False authorship metadata — ten marketplace rule packs naming HHS OCR, the
 * agency that enforces HIPAA, as their author, several marked verified — shipped
 * in 21 published versions across six and a half months before anyone noticed.
 * Nothing was watching what actually went to the registry.
 *
 * A synced version field would not have caught it. semantic-release computes the
 * release from the git tag, so package.json's version never affected what
 * published; keeping it in sync was cosmetic. What was missing was somebody
 * reading the tarball.
 *
 * This does that, on a schedule. It downloads the published package and checks
 * three things.
 *
 * WHAT IT COMPARES, AND WHY NOT THE OBVIOUS THING
 *
 * The tempting comparison is "published artifact vs the current repository".
 * That is wrong: the repository legitimately moves ahead of the registry between
 * releases, so it would fail on every commit and every release. A check that
 * fires when everything is healthy trains people to ignore it — the same
 * failure mode as a warning nobody reads.
 *
 * So each published artifact is compared against THE GIT TAG IT CLAIMS TO COME
 * FROM. That is an exact invariant: it holds whenever the pipeline is healthy,
 * and breaks only when something is genuinely wrong.
 *
 *   A. npm's latest version has a matching git tag, and vice versa.
 *      Both are created by the same semantic-release run. Divergence means the
 *      pipeline half-completed — published without tagging, or tagged without
 *      publishing.
 *
 *   B. The published README and package.json description match that tag.
 *      A mismatch means the artifact on the registry does not correspond to any
 *      reviewed commit.
 *
 *   C. The published tarball is free of retracted claims and false attribution.
 *      This is the check that would have caught both real incidents.
 *
 * package.json's version field is reported for context but is NOT a failure
 * condition. Without @semantic-release/git it is frozen by design and drifts
 * after every release; failing on it would mean failing on every healthy
 * release.
 *
 * Usage: node scripts/audit-published.mjs [--json]
 * Exit 0 = clean, 1 = findings.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');
const pkgName = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8')).name;

const findings = [];
const context = [];
const fail = (title, detail) => findings.push({ title, detail });
const note = (line) => context.push(line);

function sh(cmd, args, opts = {}) {
  // stderr piped: `npm pack` prints its whole file listing to stderr.
  return execFileSync(cmd, args, {
    encoding: 'utf-8', cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], ...opts,
  }).trim();
}

/** Retracted claims. Kept in step with scripts/check-claims.mjs. */
const RETRACTED = [
  { re: /15\s*\/\s*15|15%2F15/i, label: 'coverage claim ("15" of "15")',
    why: 'three of those areas have zero mapped rules; no source establishes the count' },
  { re: /HIPAA\s*2026\s*ready/i, label: 'readiness claim',
    why: 'asserts readiness for a rule that is still a proposal' },
];

/** Organisations that must never appear as the AUTHOR of a rule pack. */
const NOT_OUR_AUTHORS = [
  'HHS Office for Civil Rights', 'Department of Health and Human Services',
  'Centers for Medicare', 'Blue Cross Blue Shield', 'HL7 International',
  'New York Department of Health', 'California Department of Public Health',
];

const work = mkdtempSync(join(tmpdir(), 'vlayer-audit-'));
try {
  // ---- A. registry vs tags ------------------------------------------------
  const latest = sh('npm', ['view', pkgName, 'version']);
  const tags = sh('git', ['tag', '-l', 'v*']).split('\n').filter(Boolean);
  // Copy before sort/pop: `.pop()` mutates, which would remove the newest tag
  // from `tags` and make the `includes()` checks below fail against it.
  const latestTag = [...tags].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
  note(`npm latest: ${latest}`);
  note(`latest git tag: ${latestTag ?? '(none)'}`);

  if (!tags.includes(`v${latest}`)) {
    fail('Published version has no git tag',
      `npm serves \`${latest}\` but there is no \`v${latest}\` tag. The registry has a ` +
      `release the repository cannot account for.`);
  }
  if (latestTag && latestTag !== `v${latest}`) {
    fail('Latest tag and latest published version disagree',
      `Latest tag is \`${latestTag}\`, npm latest is \`${latest}\`. A release tagged but ` +
      `not published, or published then superseded, leaves these out of step.`);
  }

  // package.json version: context only, never a failure.
  const repoVersion = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8')).version;
  note(`package.json version: ${repoVersion}` +
    (repoVersion === latest ? '' : ` (drifted from npm — expected; not a failure)`));

  // ---- download the published artifact ------------------------------------
  sh('npm', ['pack', `${pkgName}@${latest}`], { cwd: work });
  const tgz = sh('ls', [work]).split('\n').find((f) => f.endsWith('.tgz'));
  sh('tar', ['xzf', join(work, tgz)], { cwd: work });
  const pub = join(work, 'package');

  // ---- B. published content vs the tag it claims to come from --------------
  const tagRef = `v${latest}`;
  const canCompare = tags.includes(tagRef);
  if (canCompare) {
    for (const file of ['README.md']) {
      let atTag;
      try { atTag = sh('git', ['show', `${tagRef}:${file}`]); } catch { atTag = null; }
      const published = existsSync(join(pub, file)) ? readFileSync(join(pub, file), 'utf-8').trim() : null;
      if (atTag !== null && published !== null && atTag !== published) {
        fail(`Published ${file} differs from ${tagRef}`,
          `The ${file} on npm does not match the one at the tag it was released from. ` +
          `The published artifact does not correspond to a reviewed commit.`);
      }
    }
    let descAtTag = null;
    try { descAtTag = JSON.parse(sh('git', ['show', `${tagRef}:package.json`])).description; } catch { /* ignore */ }
    const descPub = JSON.parse(readFileSync(join(pub, 'package.json'), 'utf-8')).description;
    if (descAtTag && descPub !== descAtTag) {
      fail('Published package description differs from its tag',
        `npm: "${descPub}"\nat ${tagRef}: "${descAtTag}"`);
    }
  } else {
    note(`skipped content comparison: no ${tagRef} tag to compare against`);
  }

  // ---- C. retracted claims and false attribution IN THE PUBLISHED ARTIFACT --
  const files = sh('find', [pub, '-type', 'f']).split('\n').filter(Boolean);
  for (const f of files) {
    let text;
    try { text = readFileSync(f, 'utf-8'); } catch { continue; }
    const rel = f.slice(pub.length + 1);
    for (const { re, label, why } of RETRACTED) {
      if (re.test(text)) {
        fail(`Retracted ${label} is live on npm`,
          `Found in \`${rel}\` of the published \`${latest}\`. It was withdrawn because ${why}.`);
      }
    }
    for (const org of NOT_OUR_AUTHORS) {
      // Only an AUTHOR attribution is a finding. The same names legitimately
      // appear as regulator contact details in reports and templates.
      const authorBlocks = text.match(/author:\s*\{[^}]*\}/g) ?? [];
      if (authorBlocks.some((b) => b.includes(org))) {
        fail('External organisation listed as a rule author on npm',
          `\`${rel}\` in the published \`${latest}\` attributes rules to **${org}**, ` +
          `which did not author them.`);
      }
    }
  }
} catch (error) {
  fail('Audit could not complete', `\`${error.message.split('\n')[0]}\``);
} finally {
  rmSync(work, { recursive: true, force: true });
}

const unique = [...new Map(findings.map((f) => [f.title + f.detail, f])).values()];

if (JSON_OUT) {
  console.log(JSON.stringify({ ok: unique.length === 0, findings: unique, context }, null, 2));
} else {
  for (const l of context) console.log(`  ${l}`);
  if (unique.length === 0) console.log('\n[audit-published] clean — the registry matches the repository.');
  else {
    console.error(`\n[audit-published] ${unique.length} finding(s):\n`);
    for (const f of unique) console.error(`  ${f.title}\n    ${f.detail.replace(/\n/g, '\n    ')}\n`);
  }
}
process.exit(unique.length === 0 ? 0 : 1);
