import { describe, expect, it } from 'vitest';
import type { Finding } from '../src/types.js';
import type { FindingDelta } from '../src/delivery/types.js';
import { evaluateDeliveryPolicy } from '../src/delivery/policy.js';

function finding(severity: Finding['severity'], file = '/repo/src/api.ts'): Finding {
  return {
    id: `rule-${severity}`,
    category: 'access-control',
    severity,
    title: `${severity} finding`,
    description: 'test',
    file,
    line: 10,
    recommendation: 'fix it',
  };
}

function delta(overrides: Partial<FindingDelta> = {}): FindingDelta {
  return {
    newFindings: [],
    newFindingsInChangedFiles: [],
    baselineFindings: [],
    resolvedFindings: [],
    changedFiles: [],
    ...overrides,
  };
}

describe('delivery policy', () => {
  it('blocks new critical/high findings in changed files by default', () => {
    const high = finding('high');
    const decision = evaluateDeliveryPolicy(
      delta({ newFindings: [high], newFindingsInChangedFiles: [high] }),
      [high],
      88,
      true,
      true,
    );

    expect(decision.deployAllowed).toBe(false);
    expect(decision.consideredScope).toBe('changed-files');
    expect(decision.reasons[0]?.code).toBe('BLOCKING_SEVERITY');
  });

  it('does not block historical baseline debt', () => {
    const critical = { ...finding('critical'), isBaseline: true };
    const decision = evaluateDeliveryPolicy(
      delta({ baselineFindings: [critical] }),
      [critical],
      70,
      true,
      true,
    );

    expect(decision.deployAllowed).toBe(true);
    expect(decision.totalConsidered).toBe(0);
  });

  it('ignores new findings outside changed files when git scope is active', () => {
    const high = finding('high', '/repo/legacy.ts');
    const decision = evaluateDeliveryPolicy(
      delta({ newFindings: [high], newFindingsInChangedFiles: [] }),
      [high],
      80,
      true,
      true,
    );

    expect(decision.deployAllowed).toBe(true);
  });

  it('enforces configured medium budgets', () => {
    const medium = finding('medium');
    const decision = evaluateDeliveryPolicy(
      delta({ newFindings: [medium], newFindingsInChangedFiles: [medium] }),
      [medium],
      90,
      true,
      true,
      { blockOn: [], maxNew: { medium: 0 } },
    );

    expect(decision.deployAllowed).toBe(false);
    expect(decision.reasons.some(reason => reason.code === 'SEVERITY_BUDGET_EXCEEDED')).toBe(true);
  });

  it('can require a minimum score and a baseline', () => {
    const decision = evaluateDeliveryPolicy(
      delta(),
      [],
      79,
      false,
      true,
      { minimumScore: 90, requireBaseline: true },
    );

    expect(decision.deployAllowed).toBe(false);
    expect(decision.reasons.map(reason => reason.code)).toEqual(
      expect.arrayContaining(['MINIMUM_SCORE', 'BASELINE_REQUIRED']),
    );
  });

  it('fails when governance reports expired acknowledgments', () => {
    const decision = evaluateDeliveryPolicy(
      delta(),
      [],
      100,
      true,
      true,
      {},
      2,
    );

    expect(decision.deployAllowed).toBe(false);
    expect(decision.reasons).toContainEqual(expect.objectContaining({
      code: 'EXPIRED_ACKNOWLEDGMENT',
      count: 2,
    }));
  });

  it('falls back to all-files scope when git metadata is unavailable', () => {
    const high = finding('high');
    const decision = evaluateDeliveryPolicy(
      delta({ newFindings: [high], newFindingsInChangedFiles: [] }),
      [high],
      80,
      true,
      false,
    );

    expect(decision.consideredScope).toBe('all-files');
    expect(decision.deployAllowed).toBe(false);
  });
});
