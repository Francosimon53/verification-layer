import { describe, it, expect } from 'vitest';
import { evaluatePolicy, policyDigest, DEFAULT_POLICY_ID } from '../../src/attestation/policy.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { makeConsistentFinding as makeFinding, makeControl, makeRepositoryFinding } from './fixtures.js';

const okControl = makeControl({ state: 'no_blocking_findings' });

describe('policy digest', () => {
  it('is a stable sha-256 over the policy definition', () => {
    expect(policyDigest()).toMatch(/^[0-9a-f]{64}$/);
    expect(policyDigest()).toBe(policyDigest());
  });
});

describe('policy FAIL', () => {
  it('fails on an active blocking critical', () => {
    const r = evaluatePolicy({
      findings: [makeFinding({ severity: 'critical', disposition: 'active', policyEffect: 'blocking' })],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('fail');
    expect(r.reasons).toContain('blocking-critical');
  });

  it('fails on an active blocking high', () => {
    const r = evaluatePolicy({
      findings: [makeFinding({ severity: 'high', disposition: 'active', policyEffect: 'blocking' })],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('fail');
    expect(r.reasons).toContain('blocking-high');
  });

  it('does NOT fail on a critical that was adjudicated', () => {
    for (const disposition of ['false_positive', 'suppressed', 'acknowledged', 'baseline'] as const) {
      const r = evaluatePolicy({
        findings: [makeFinding({ severity: 'critical', disposition, policyEffect: 'none' })],
        controls: [okControl],
      });
      expect(r.conclusion).not.toBe('fail');
    }
  });
});

describe('policy REVIEW_REQUIRED', () => {
  it('requires review for an active medium code finding', () => {
    const r = evaluatePolicy({
      findings: [
        makeFinding({ severity: 'medium', disposition: 'active', policyEffect: 'review_required' }),
      ],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('review_required');
    expect(r.reasons).toContain('review-required-code');
  });

  it('requires review when an open exception exists, with zero other findings', () => {
    const r = evaluatePolicy({
      findings: [makeFinding({ disposition: 'exception', policyEffect: 'none' })],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('review_required');
    expect(r.reasons).toContain('open-exception');
  });

  it('requires review for a lapsed adjudication', () => {
    const r = evaluatePolicy({
      findings: [
        makeFinding({
          disposition: 'baseline',
          policyEffect: 'none',
          lapsed: { kind: 'acknowledgment', expiredAt: '2020-01-01', byDigest: 'a'.repeat(64) },
        }),
      ],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('review_required');
    expect(r.reasons).toContain('lapsed-adjudication');
  });

  it('requires review when ANY control was not evaluated — no evidence is not a pass', () => {
    const r = evaluatePolicy({
      findings: [],
      controls: [okControl, makeControl({ state: 'not_evaluated' })],
    });
    expect(r.conclusion).toBe('review_required');
    expect(r.reasons).toContain('control-not-evaluated');
  });

  it('requires review when a rule identity is unknown', () => {
    const r = evaluatePolicy({
      findings: [makeFinding({ ruleKnown: false, ruleId: null, ruleSource: 'unknown', disposition: 'baseline', policyEffect: 'none' })],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('review_required');
    expect(r.reasons).toContain('unknown-rule-identity');
  });
});

describe('policy PASS', () => {
  it('passes with no findings and every control evaluated', () => {
    const r = evaluatePolicy({ findings: [], controls: [okControl] });
    expect(r.conclusion).toBe('pass');
    expect(r.reasons).toEqual(['no-blocking-or-review-conditions']);
  });

  it('passes when only low/info code findings are active', () => {
    const r = evaluatePolicy({
      findings: [
        makeFinding({ severity: 'low', disposition: 'active', policyEffect: 'none' }),
        makeFinding({ severity: 'info', disposition: 'active', policyEffect: 'none' }),
      ],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('pass');
  });

  it('passes when every finding is adjudicated non-blocking', () => {
    const r = evaluatePolicy({
      findings: [
        makeFinding({ severity: 'critical', disposition: 'false_positive', policyEffect: 'none' }),
        makeFinding({ severity: 'high', disposition: 'suppressed', policyEffect: 'none' }),
        makeFinding({ severity: 'high', disposition: 'baseline', policyEffect: 'none' }),
      ],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('pass');
  });
});

describe('policy determinism and vocabulary', () => {
  it('takes the worst conclusion across all rules', () => {
    const r = evaluatePolicy({
      findings: [
        makeFinding({ severity: 'medium', disposition: 'active', policyEffect: 'review_required' }),
        makeFinding({ severity: 'critical', disposition: 'active', policyEffect: 'blocking' }),
      ],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('fail');
  });

  it('records severity in the reason even though severity did not decide the effect', () => {
    const r = evaluatePolicy({
      findings: [makeFinding({ severity: 'critical', disposition: 'active', policyEffect: 'blocking' })],
      controls: [okControl],
    });
    expect(r.reasons).toContain('blocking-critical');
  });

  it('returns sorted, closed-vocabulary reasons', () => {
    const r = evaluatePolicy({
      findings: [
        makeFinding({ severity: 'critical', disposition: 'active', policyEffect: 'blocking' }),
        makeFinding({ disposition: 'exception', policyEffect: 'none' }),
      ],
      controls: [okControl, makeControl({ state: 'not_evaluated' })],
    });
    expect(r.reasons).toEqual([...r.reasons].sort());
    for (const reason of r.reasons) expect(reason).toMatch(/^[a-z-]+$/);
  });

  it('reports the policy id and digest', () => {
    const r = evaluatePolicy({ findings: [], controls: [okControl] });
    expect(r.id).toBe(DEFAULT_POLICY_ID);
    expect(r.digest).toBe(policyDigest());
  });
});

describe('severity is NOT policy effect', () => {
  it('a HIGH repository/process finding requires review, it does not fail the release', () => {
    const r = evaluatePolicy({
      findings: [makeRepositoryFinding({ severity: 'high', disposition: 'active' })],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('review_required');
    expect(r.conclusion).not.toBe('fail');
    expect(r.reasons).toContain('review-required-repository-scope');
  });

  it('a HIGH code finding at the same severity DOES fail the release', () => {
    const r = evaluatePolicy({
      findings: [
        makeFinding({ severity: 'high', disposition: 'active', policyEffect: 'blocking' }),
      ],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('fail');
  });

  it('the two differ ONLY by evidence scope, never by severity', () => {
    const repo = evaluatePolicy({
      findings: [makeRepositoryFinding({ severity: 'critical', disposition: 'active' })],
      controls: [okControl],
    });
    const code = evaluatePolicy({
      findings: [
        makeFinding({ severity: 'critical', disposition: 'active', policyEffect: 'blocking' }),
      ],
      controls: [okControl],
    });
    expect(repo.conclusion).toBe('review_required');
    expect(code.conclusion).toBe('fail');
  });

  it('a repository finding does not mask a real code failure', () => {
    const r = evaluatePolicy({
      findings: [
        makeRepositoryFinding({ severity: 'high', disposition: 'active' }),
        makeFinding({ severity: 'critical', disposition: 'active', policyEffect: 'blocking' }),
      ],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('fail');
    expect(r.reasons).toEqual(expect.arrayContaining(['blocking-critical', 'review-required-repository-scope']));
  });

  it('an adjudicated repository finding has no effect at all', () => {
    const r = evaluatePolicy({
      findings: [
        makeRepositoryFinding({ severity: 'high', disposition: 'acknowledged', policyEffect: 'none' }),
      ],
      controls: [okControl],
    });
    expect(r.conclusion).toBe('pass');
  });

  it('policy.ts contains no rule-id special cases', () => {
    // The distinction must be a general classification, not a hidden allowlist.
    const src = readFileSync(resolve(__dirname, '../../src/attestation/policy.ts'), 'utf-8');
    expect(src).not.toContain('HIPAA-PENTEST');
    expect(src).not.toContain('audit-no-framework');
    expect(src).not.toMatch(/ruleId\s*===/);
  });
});
