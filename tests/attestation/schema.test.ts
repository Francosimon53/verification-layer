import { describe, it, expect } from 'vitest';
import { VlayerStatementV1Schema, formatSchemaErrors } from '../../src/attestation/schema.js';
import { makeStatement, makePredicate, makeControl, makeFinding, makeRepositoryFinding } from './fixtures.js';

function expectInvalid(statement: unknown): string[] {
  const parsed = VlayerStatementV1Schema.safeParse(statement);
  expect(parsed.success).toBe(false);
  return parsed.success ? [] : formatSchemaErrors(parsed.error);
}

describe('VLayer Attestation V1 schema', () => {
  it('accepts a well-formed statement', () => {
    const parsed = VlayerStatementV1Schema.safeParse(makeStatement());
    if (!parsed.success) console.error(formatSchemaErrors(parsed.error));
    expect(parsed.success).toBe(true);
  });

  it('rejects a missing schemaVersion', () => {
    const s = makeStatement();
    delete (s.predicate as Record<string, unknown>).schemaVersion;
    expect(expectInvalid(s).join('\n')).toMatch(/schemaVersion/);
  });

  it('rejects a wrong predicateType', () => {
    const s = makeStatement({ predicateType: 'https://example.com/other/v1' as never });
    expect(expectInvalid(s).join('\n')).toMatch(/predicateType/);
  });

  it('rejects a wrong statement _type', () => {
    const s = makeStatement({ _type: 'https://in-toto.io/Statement/v0.1' as never });
    expect(expectInvalid(s).join('\n')).toMatch(/_type/);
  });

  it('rejects an unknown extra key (.strict) — the privacy boundary', () => {
    const s = makeStatement();
    (s.predicate.findings[0] as Record<string, unknown>).description =
      "console.log('patient ssn', p.ssn)";
    const errors = expectInvalid(s).join('\n');
    expect(errors).toMatch(/findings/);
  });

  it('rejects source-carrying fields anywhere in a finding', () => {
    for (const key of ['title', 'description', 'recommendation', 'context', 'snippet', 'code']) {
      const s = makeStatement();
      (s.predicate.findings[0] as Record<string, unknown>)[key] = 'const ssn = "123-45-6789"';
      expect(VlayerStatementV1Schema.safeParse(s).success).toBe(false);
    }
  });

  it('rejects a non-integer number', () => {
    const s = makeStatement();
    s.predicate.findings[0].aiTriage = {
      classification: 'likely',
      // Non-integer must be rejected: canonical JSON permits integers only.
      confidencePermille: 0.87 as never,
      reasoningDigest: 'c'.repeat(64),
      model: 'claude-haiku-4-5-20251001',
    };
    expect(expectInvalid(s).join('\n')).toMatch(/confidencePermille/);
  });

  it('rejects an invalid disposition', () => {
    const s = makeStatement();
    s.predicate.findings[0].disposition = 'ignored' as never;
    expect(expectInvalid(s).join('\n')).toMatch(/disposition/);
  });

  it('rejects an absolute path in a finding location', () => {
    const s = makeStatement();
    s.predicate.findings[0].location.path = '/Users/simon/project/src/a.ts';
    expect(expectInvalid(s).join('\n')).toMatch(/repository-relative/);
  });

  it('rejects a Windows absolute path and backslash separators', () => {
    const s1 = makeStatement();
    s1.predicate.findings[0].location.path = 'C:\\project\\a.ts';
    expect(VlayerStatementV1Schema.safeParse(s1).success).toBe(false);

    const s2 = makeStatement();
    s2.predicate.findings[0].location.path = 'src\\a.ts';
    expect(VlayerStatementV1Schema.safeParse(s2).success).toBe(false);
  });

  it('rejects a path escaping the repository root', () => {
    const s = makeStatement();
    s.predicate.findings[0].location.path = '../secrets/a.ts';
    expect(expectInvalid(s).join('\n')).toMatch(/\.\./);
  });

  it('rejects a repository string carrying credentials, query or fragment', () => {
    for (const repo of [
      'user:token@ghe.internal/team/repo',
      'github.com/acme/repo?token=x',
      'github.com/acme/repo#frag',
      'https://github.com/acme/repo',
    ]) {
      const s = makeStatement();
      s.predicate.target.repository = repo;
      expect(VlayerStatementV1Schema.safeParse(s).success).toBe(false);
    }
  });

  it('rejects no_blocking_findings when zero rules executed', () => {
    const s = makeStatement({
      predicate: makePredicate({
        controls: [
          makeControl({
            state: 'no_blocking_findings',
            evidence: {
              rulesInUniverse: 3,
              rulesExecuted: 0,
              executedRuleIds: [],
              informationalOnlyRuleIds: [],
              sources: [],
            },
            findings: { total: 0, active: 0, blocking: 0, reviewRequired: 0, exceptions: 0, lowConfidence: 0, lapsed: 0, informational: 0 },
            fingerprints: [],
          }),
        ],
      }),
    });
    expect(expectInvalid(s).join('\n')).toMatch(/zero executed rules/);
  });

  it('rejects no_blocking_findings on the UNMAPPED pseudo-control', () => {
    const s = makeStatement({
      predicate: makePredicate({
        controls: [
          makeControl({
            control: { framework: 'hipaa', controlId: 'UNMAPPED', rawReference: '', proposed: false },
            state: 'no_blocking_findings',
            evidence: {
              rulesInUniverse: 2,
              rulesExecuted: 2,
              executedRuleIds: ['x'],
              informationalOnlyRuleIds: [],
              sources: [{ kind: 'static-analysis', assurance: 'AUTOMATED_VERIFIED' }],
            },
            findings: { total: 0, active: 0, blocking: 0, reviewRequired: 0, exceptions: 0, lowConfidence: 0, lapsed: 0, informational: 0 },
            fingerprints: [],
          }),
        ],
      }),
    });
    expect(expectInvalid(s).join('\n')).toMatch(/UNMAPPED/);
  });

  it('rejects aiTriage.reproducible === true when AI triage was applied', () => {
    const s = makeStatement();
    s.predicate.verifier.aiTriage = {
      enabled: true,
      applied: true,
      model: 'claude-haiku-4-5-20251001',
      findingsSubmitted: 5,
      findingsCapped: 0,
      findingsFailed: 0,
      reproducible: true,
    };
    expect(expectInvalid(s).join('\n')).toMatch(/reproducible/);
  });

  it('accepts an unmapped finding with an empty controls array', () => {
    const s = makeStatement({
      predicate: makePredicate({
        findings: [makeFinding({ controls: [], ruleKnown: false, ruleId: null, ruleSource: 'unknown' })],
      }),
    });
    expect(VlayerStatementV1Schema.safeParse(s).success).toBe(true);
  });

  it('accepts a project-level (repository-scope) finding with a null path and line', () => {
    const s = makeStatement({
      predicate: makePredicate({ findings: [makeRepositoryFinding()] }),
    });
    expect(VlayerStatementV1Schema.safeParse(s).success).toBe(true);
  });
});

describe('severity is not policy effect — schema invariants', () => {
  it('rejects a repository-scope finding marked as blocking', () => {
    const s = makeStatement({
      predicate: makePredicate({
        findings: [makeRepositoryFinding({ policyEffect: 'blocking', blocking: true })],
      }),
    });
    expect(expectInvalid(s).join('\n')).toMatch(/repository-scope finding can never/);
  });

  it('rejects blocking disagreeing with policyEffect', () => {
    const s = makeStatement({
      predicate: makePredicate({
        findings: [makeFinding({ policyEffect: 'review_required', blocking: true })],
      }),
    });
    expect(expectInvalid(s).join('\n')).toMatch(/blocking must equal/);
  });

  it('rejects an adjudicated finding that still has a release effect', () => {
    const s = makeStatement({
      predicate: makePredicate({
        findings: [
          makeFinding({ disposition: 'suppressed', policyEffect: 'blocking', blocking: true }),
        ],
      }),
    });
    expect(expectInvalid(s).join('\n')).toMatch(/must have policyEffect "none"/);
  });

  it('rejects a code-scope finding with no line number', () => {
    const s = makeStatement({
      predicate: makePredicate({
        findings: [
          makeFinding({
            evidenceScope: 'code',
            location: { path: 'src/a.ts', line: null, kind: 'file' },
          }),
        ],
      }),
    });
    expect(expectInvalid(s).join('\n')).toMatch(/code-scope finding must carry a line/);
  });

  it('accepts a high-severity repository finding that only requires review', () => {
    const s = makeStatement({
      predicate: makePredicate({ findings: [makeRepositoryFinding({ severity: 'high' })] }),
    });
    const parsed = VlayerStatementV1Schema.safeParse(s);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Severity is preserved; only the release effect differs.
      expect(parsed.data.predicate.findings[0].severity).toBe('high');
      expect(parsed.data.predicate.findings[0].policyEffect).toBe('review_required');
    }
  });

  it('formatSchemaErrors returns stable sorted strings', () => {
    const parsed = VlayerStatementV1Schema.safeParse({ _type: 'x' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const a = formatSchemaErrors(parsed.error);
      const b = formatSchemaErrors(parsed.error);
      expect(a).toEqual(b);
      expect(a).toEqual([...a].sort());
    }
  });
});
