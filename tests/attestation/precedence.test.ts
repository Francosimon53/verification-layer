/**
 * The disposition precedence ladder must be ONE deterministic rule.
 * These tests walk it end to end with a finding that satisfies every condition
 * at once, removing one condition at a time.
 */
import { describe, it, expect } from 'vitest';
import { adjudicate } from '../../src/attestation/evaluate.js';
import type { Finding } from '../../src/types.js';

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

function finding(over: Partial<Finding> = {}): Finding {
  return {
    id: 'phi-phi-console-log-4',
    canonicalRuleId: 'phi-console-log',
    category: 'phi-exposure',
    severity: 'critical',
    title: 'PHI in console output',
    description: 'desc',
    file: '/repo/src/a.ts',
    line: 4,
    recommendation: 'rec',
    ...over,
  };
}

/** Every condition true at once. */
function allConditions(): Finding {
  return finding({
    suppressed: true,
    suppression: { reason: 'reviewed', comment: '// vlayer-ignore phi-console-log -- reviewed' },
    acknowledged: true,
    acknowledgment: {
      reason: 'accepted',
      acknowledgedBy: 'security@example.com',
      acknowledgedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: FUTURE,
      expired: false,
    },
    isBaseline: true,
    belowMinConfidence: true,
    minConfidenceThreshold: 'high',
  });
}

describe('precedence ladder', () => {
  it('1. false_positive wins over everything, including a suppression', () => {
    const r = adjudicate(allConditions(), true);
    expect(r.disposition).toBe('false_positive');
    expect(r.dispositionReason).toBe('ai-triage-false-positive');
  });

  it('2. suppressed wins once false_positive is removed', () => {
    expect(adjudicate(allConditions(), false).disposition).toBe('suppressed');
  });

  it('3. exception wins once suppression is removed', () => {
    const f = allConditions();
    delete f.suppressed;
    delete f.suppression;
    const r = adjudicate(f, false);
    expect(r.disposition).toBe('exception');
    expect(r.adjudication).toMatchObject({ kind: 'exception', expiresAt: FUTURE });
  });

  it('4. acknowledged wins once the expiry is removed (open-ended)', () => {
    const f = allConditions();
    delete f.suppressed;
    delete f.suppression;
    delete f.acknowledgment!.expiresAt;
    const r = adjudicate(f, false);
    expect(r.disposition).toBe('acknowledged');
    expect(r.adjudication).toMatchObject({ kind: 'acknowledged' });
  });

  it('5. baseline wins once the acknowledgment is removed', () => {
    const f = allConditions();
    delete f.suppressed;
    delete f.suppression;
    delete f.acknowledged;
    delete f.acknowledgment;
    delete f.belowMinConfidence;
    expect(adjudicate(f, false).disposition).toBe('baseline');
  });

  it('6. low_confidence wins once baseline provenance is removed', () => {
    const f = allConditions();
    delete f.suppressed;
    delete f.suppression;
    delete f.acknowledged;
    delete f.acknowledgment;
    const r = adjudicate(f, false);
    expect(r.disposition).toBe('low_confidence');
    expect(r.dispositionReason).toBe('below-min-confidence-threshold');
  });

  it('7. active is the default once every condition is removed', () => {
    const r = adjudicate(finding(), false);
    expect(r.disposition).toBe('active');
    expect(r.dispositionReason).toBe('no-adjudication');
  });
});

describe('low_confidence is NOT baseline', () => {
  it('distinguishes a baseline match from a below-threshold finding', () => {
    const baseline = adjudicate(finding({ isBaseline: true }), false);
    const lowConf = adjudicate(
      finding({ isBaseline: true, belowMinConfidence: true, minConfidenceThreshold: 'high' }),
      false,
    );
    expect(baseline.disposition).toBe('baseline');
    expect(lowConf.disposition).toBe('low_confidence');
    expect(baseline.disposition).not.toBe(lowConf.disposition);
  });

  it('never reports low_confidence as a baseline sub-kind', () => {
    const r = adjudicate(finding({ isBaseline: true, belowMinConfidence: true }), false);
    expect(r.dispositionReason).not.toContain('baseline');
  });
});

describe('expired acknowledgments are a lapse, not a disposition', () => {
  const expiredAck = {
    reason: 'temporarily accepted',
    acknowledgedBy: 'security@example.com',
    acknowledgedAt: '2019-01-01T00:00:00.000Z',
    expiresAt: PAST,
    expired: true,
  };

  it('re-arms the finding as active and blocking', () => {
    const r = adjudicate(finding({ acknowledged: true, acknowledgment: expiredAck }), false);
    expect(r.disposition).toBe('active');
    expect(r.dispositionReason).toBe('acknowledgment-expired');
  });

  it('records WHY it re-armed', () => {
    const r = adjudicate(finding({ acknowledged: true, acknowledgment: expiredAck }), false);
    expect(r.lapsed).toMatchObject({ kind: 'acknowledgment', expiredAt: PAST });
    expect(r.lapsed!.byDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not confer exception or acknowledged', () => {
    const r = adjudicate(finding({ acknowledged: true, acknowledgment: expiredAck }), false);
    expect(r.disposition).not.toBe('exception');
    expect(r.disposition).not.toBe('acknowledged');
    expect(r.adjudication).toBeUndefined();
  });

  it('still falls through to baseline when one applies, carrying the lapse', () => {
    const r = adjudicate(
      finding({ acknowledged: true, acknowledgment: expiredAck, isBaseline: true }),
      false,
    );
    expect(r.disposition).toBe('baseline');
    expect(r.lapsed).toBeDefined();
  });

  it('is still outranked by an inline suppression', () => {
    const r = adjudicate(
      finding({
        acknowledged: true,
        acknowledgment: expiredAck,
        suppressed: true,
        suppression: { reason: 'r', comment: 'c' },
      }),
      false,
    );
    expect(r.disposition).toBe('suppressed');
  });
});

describe('free text never leaves the adjudication as prose', () => {
  it('digests suppression reasons', () => {
    const r = adjudicate(
      finding({
        suppressed: true,
        suppression: { reason: 'patient MRN 4451237 is synthetic', comment: 'c' },
      }),
      false,
    );
    expect(JSON.stringify(r)).not.toContain('4451237');
    expect(r.adjudication).toMatchObject({ kind: 'suppressed' });
    expect((r.adjudication as { reasonDigest: string }).reasonDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('digests acknowledgment reasons and acknowledger identity', () => {
    const r = adjudicate(
      finding({
        acknowledged: true,
        acknowledgment: {
          reason: 'SSN 123-45-6789 is test data',
          acknowledgedBy: 'alice@oncology.internal',
          acknowledgedAt: '2026-01-01T00:00:00.000Z',
          expired: false,
        },
      }),
      false,
    );
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain('123-45-6789');
    expect(serialized).not.toContain('alice@oncology.internal');
  });
});
