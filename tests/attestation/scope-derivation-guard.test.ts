/**
 * GUARD for the inferential evidence-scope derivation.
 *
 * `classifyEvidenceScope` infers scope from whether a finding can point at a
 * line of source. That inference is load-bearing for the release gate, and it
 * can break silently in BOTH directions:
 *
 *   1. A process-level rule that starts emitting a real path AND a real line
 *      would be reclassified as a code defect and begin failing releases on a
 *      standing process gap.
 *
 *   2. A code-level rule that LOSES its location would be reclassified as a
 *      repository observation and stop blocking releases. This is the dangerous
 *      direction, and it has already happened once: git reports the physical
 *      repository path while the scanner reported a symlinked one, so every
 *      finding relativized to a '..' path and lost its line.
 *
 * Neither failure produces an error. Both produce a quietly wrong policy
 * conclusion. These tests fail loudly instead.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname, resolve } from 'path';
import { scan } from '../../src/scan.js';
import { buildAttestation } from '../../src/attestation/build.js';
import { createTempRepo, type TempRepo } from './git-fixture.js';
import type { Finding } from '../../src/types.js';

/**
 * Rules whose evidence is the ABSENCE of a repository or process control.
 * They have no line to fix, so they must never carry one.
 *
 * This list is a TEST FIXTURE, not policy: `policy.ts` and the derivation
 * contain no rule ids. It exists so that a change to how these rules emit is
 * caught here rather than in production.
 */
const PROCESS_LEVEL_RULE_IDS = [
  'HIPAA-PENTEST-001',
  'audit-no-framework',
  'HIPAA-ASSET-001',
  'HIPAA-FLOW-001',
] as const;

const dir = mkdtempSync(join(tmpdir(), 'vlayer-scopeguard-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function write(relative: string, content: string) {
  const target = resolve(dir, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf-8');
}

describe('process-level rules must never carry a code location', () => {
  let findings: Finding[];

  beforeAll(async () => {
    // A repository engineered to trigger the process-level rules: no logging
    // framework, no vulnerability-scanning config, plus PHI handling so the
    // asset-inventory / flow-map rules also fire.
    write('package.json', JSON.stringify({ name: 'svc', version: '1.0.0', dependencies: { express: '^4' } }, null, 2));
    write(
      'src/patient.ts',
      [
        "import { db } from './db';",
        'export async function get(id: string) {',
        '  const patient = await db.query("SELECT * FROM patients WHERE id=" + id);',
        "  console.log('patient ssn', patient.ssn);",
        '  return patient;',
        '}',
      ].join('\n') + '\n',
    );
    const result = await scan({ path: realpathSync(dir), enableAI: false });
    findings = result.findings;
  }, 120_000);

  it('emits at least one of the known process-level rules', () => {
    const emitted = findings.filter((f) => PROCESS_LEVEL_RULE_IDS.includes(f.canonicalRuleId as never));
    expect(
      emitted.length,
      'fixture no longer triggers any process-level rule — the guard would be vacuous',
    ).toBeGreaterThan(0);
  });

  it('NONE of them carries both a real file path and a real line number', () => {
    const offenders = findings
      .filter((f) => PROCESS_LEVEL_RULE_IDS.includes(f.canonicalRuleId as never))
      .filter((f) => {
        const isVirtualFile = ['project-level', 'ASSET-INVENTORY', 'PHI-FLOW-MAP'].includes(f.file);
        const hasRealLine = typeof f.line === 'number' && f.line > 0;
        return !isVirtualFile && hasRealLine;
      })
      .map((f) => `${f.canonicalRuleId} at ${f.file}:${f.line}`);

    expect(
      offenders,
      'A process-level rule gained a code location. It will now be classified as a ' +
        'code defect and will begin FAILING releases on a standing process gap. ' +
        'Either restore the emit (omit `line`, or use a virtual file), or move the ' +
        'classification into the rule catalog as a declared field.',
    ).toEqual([]);
  });
});

describe('code-level findings must never lose their location', () => {
  let repo: TempRepo;
  let symlinkedPath: string;

  beforeAll(() => {
    repo = createTempRepo('vlayer-symlink-');
    repo.write('package.json', JSON.stringify({ name: 'svc', version: '1.0.0', dependencies: { pino: '^9' } }, null, 2));
    repo.write(
      'src/patient.ts',
      [
        'export async function get(id: string) {',
        '  const patient = await repo.findById(id);',
        "  console.log('patient ssn', patient.ssn);",
        '  return patient;',
        '}',
      ].join('\n') + '\n',
    );
    repo.commit('fixture');

    // Reach the SAME repository through a symlink, the configuration that
    // previously made every code finding non-blocking.
    const linkDir = mkdtempSync(join(tmpdir(), 'vlayer-symlink-link-'));
    symlinkedPath = join(linkDir, 'repo');
    symlinkSync(realpathSync(repo.dir), symlinkedPath, 'dir');
  });

  afterAll(() => repo.cleanup());

  it('a PHI leak reached through a symlinked path still blocks the release', async () => {
    const { statement } = await buildAttestation(
      { path: symlinkedPath, enableAI: false },
      { now: () => new Date('2026-08-26T12:00:00.000Z') },
    );

    const code = statement.predicate.findings.filter((f) => f.evidenceScope === 'code');
    expect(
      code.length,
      'Every finding lost its location when the repository was reached through a ' +
        'symlink, so real code violations were reclassified as repository ' +
        'observations and STOPPED BLOCKING THE RELEASE.',
    ).toBeGreaterThan(0);

    expect(statement.predicate.summary.blocking).toBeGreaterThan(0);
    expect(statement.predicate.policy.conclusion).toBe('fail');
  }, 120_000);

  it('produces the same evaluation through the symlink as through the real path', async () => {
    const clock = { now: () => new Date('2026-08-26T12:00:00.000Z') };
    const viaLink = await buildAttestation({ path: symlinkedPath, enableAI: false }, clock);
    const viaReal = await buildAttestation({ path: realpathSync(repo.dir), enableAI: false }, clock);
    // Identical bytes: the path used to reach a repository must not change what
    // is attested about it.
    expect(viaLink.bytes.equals(viaReal.bytes)).toBe(true);
  }, 180_000);

  it('no finding anywhere reports a path that escapes the repository', async () => {
    const { statement } = await buildAttestation(
      { path: symlinkedPath, enableAI: false },
      { now: () => new Date('2026-08-26T12:00:00.000Z') },
    );
    for (const f of statement.predicate.findings) {
      if (f.location.path !== null) {
        expect(f.location.path.startsWith('..')).toBe(false);
        expect(f.location.path.startsWith('/')).toBe(false);
      }
    }
  }, 120_000);
});
