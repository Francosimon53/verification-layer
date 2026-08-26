/**
 * PERMANENT regression tests pinning verified policy behaviour.
 *
 * Deliberately independent of the STATE A / STATE B acceptance fixture: that
 * fixture exists to demonstrate a transition and will be rewritten as the demo
 * evolves. These tests pin the behaviour itself, so a future policy or
 * classification change cannot silently reintroduce the bug they describe.
 *
 * Each builds a real attestation from a real Git repository — no hand-made
 * evaluation objects — so the whole pipeline is exercised end to end.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildAttestation } from '../../src/attestation/build.js';
import type { VlayerStatementV1 } from '../../src/attestation/types.js';
import { createTempRepo, type TempRepo } from './git-fixture.js';

const clock = { now: () => new Date('2026-08-26T12:00:00.000Z') };
const repos: TempRepo[] = [];

afterAll(() => {
  for (const r of repos) r.cleanup();
});

/** A committed repository, attested with AI triage off. */
async function attest(
  build: (r: TempRepo) => void,
  prefix: string,
): Promise<VlayerStatementV1> {
  const repo = createTempRepo(prefix);
  repos.push(repo);
  build(repo);
  repo.commit('fixture');
  const { statement } = await buildAttestation(
    { path: repo.dir, enableAI: false },
    clock,
  );
  return statement;
}

// ---------------------------------------------------------------------------
// (a) process-level findings alone must never fail a release
// ---------------------------------------------------------------------------

describe('a repository with only process-level findings', () => {
  let statement: VlayerStatementV1;

  beforeAll(async () => {
    // A minimal, genuinely clean service: a logging framework IS declared (so
    // audit-no-framework does not fire) and there is no PHI handling at all.
    // What remains is repository/process-level only.
    statement = await attest((r) => {
      r.write(
        'package.json',
        JSON.stringify({ name: 'svc', version: '1.0.0', dependencies: { pino: '^9.0.0' } }, null, 2),
      );
      r.write(
        'src/math.ts',
        ['export function add(a: number, b: number): number {', '  return a + b;', '}'].join('\n') + '\n',
      );
    }, 'vlayer-pol-process-');
  }, 120_000);

  it('resolves to REVIEW_REQUIRED, never FAIL', () => {
    expect(statement.predicate.policy.conclusion).toBe('review_required');
    expect(statement.predicate.policy.conclusion).not.toBe('fail');
  });

  it('has zero release-blocking findings', () => {
    expect(statement.predicate.summary.blocking).toBe(0);
    for (const f of statement.predicate.findings) {
      expect(f.policyEffect).not.toBe('blocking');
    }
  });

  it('achieves this by CLASSIFICATION, not by suppression or false positives', () => {
    // If the outcome were reached by suppressing findings, the classification
    // would be proving nothing. Pin that it is not.
    expect(statement.predicate.summary.suppressed).toBe(0);
    expect(statement.predicate.summary.falsePositives).toBe(0);
    expect(statement.predicate.summary.acknowledged).toBe(0);
    expect(statement.predicate.summary.baseline).toBe(0);
  });

  it('still reports its findings — nothing was hidden to reach review_required', () => {
    // Every remaining active finding must be repository-scope, which is the
    // whole point: visible, at real severity, but not release-blocking.
    const active = statement.predicate.findings.filter((f) => f.disposition === 'active');
    for (const f of active) {
      expect(f.evidenceScope).toBe('repository');
    }
  });
});

// ---------------------------------------------------------------------------
// (b) a deterministic code-level violation must fail the release
// ---------------------------------------------------------------------------

describe('a repository with a deterministic code-level violation', () => {
  let statement: VlayerStatementV1;

  beforeAll(async () => {
    statement = await attest((r) => {
      r.write(
        'package.json',
        JSON.stringify({ name: 'svc', version: '1.0.0', dependencies: { pino: '^9.0.0' } }, null, 2),
      );
      r.write(
        'src/patient.ts',
        [
          'export async function get(id: string) {',
          '  const patient = await repo.findById(id);',
          "  console.log('patient ssn', patient.ssn, patient.dateOfBirth);",
          '  return patient;',
          '}',
        ].join('\n') + '\n',
      );
    }, 'vlayer-pol-code-');
  }, 120_000);

  it('resolves to FAIL', () => {
    expect(statement.predicate.policy.conclusion).toBe('fail');
  });

  it('reports a blocking reason', () => {
    const blockingReasons = statement.predicate.policy.reasons.filter((r) => r.startsWith('blocking-'));
    expect(blockingReasons.length).toBeGreaterThan(0);
  });

  it('the blocking findings are code-scope critical/high', () => {
    const blocking = statement.predicate.findings.filter((f) => f.policyEffect === 'blocking');
    expect(blocking.length).toBeGreaterThan(0);
    for (const f of blocking) {
      expect(f.evidenceScope).toBe('code');
      expect(['critical', 'high']).toContain(f.severity);
      expect(f.location.line).toBeGreaterThan(0);
    }
  });

  it('a process-level finding present in the same repo does NOT block', () => {
    const process = statement.predicate.findings.filter((f) => f.evidenceScope === 'repository');
    for (const f of process) expect(f.policyEffect).not.toBe('blocking');
  });
});

// ---------------------------------------------------------------------------
// (c) the two known process-level rules classify correctly
// ---------------------------------------------------------------------------

describe('known process-level rules classify as repository / review_required', () => {
  let statement: VlayerStatementV1;

  beforeAll(async () => {
    // No logging framework declared, so audit-no-framework fires; no
    // vulnerability-scanning config, so HIPAA-PENTEST-001 fires.
    statement = await attest((r) => {
      r.write('package.json', JSON.stringify({ name: 'svc', version: '1.0.0' }, null, 2));
      r.write('src/app.ts', 'export const ok = true;\n');
    }, 'vlayer-pol-known-');
  }, 120_000);

  for (const ruleId of ['HIPAA-PENTEST-001', 'audit-no-framework']) {
    it(`${ruleId} is repository scope with review_required effect`, () => {
      const f = statement.predicate.findings.find((x) => x.ruleId === ruleId);
      expect(f, `${ruleId} was not emitted by the fixture`).toBeDefined();
      expect(f!.evidenceScope).toBe('repository');
      expect(f!.policyEffect).toBe('review_required');
      expect(f!.blocking).toBe(false);
    });

    it(`${ruleId} keeps its real severity — it was not downgraded`, () => {
      const f = statement.predicate.findings.find((x) => x.ruleId === ruleId)!;
      expect(f.severity).toBe('high');
    });

    it(`${ruleId} remains active and visible — it was not suppressed`, () => {
      const f = statement.predicate.findings.find((x) => x.ruleId === ruleId)!;
      expect(f.disposition).toBe('active');
    });
  }

  it('neither of them alone causes FAIL', () => {
    expect(statement.predicate.policy.conclusion).not.toBe('fail');
    expect(statement.predicate.summary.blocking).toBe(0);
  });
});
