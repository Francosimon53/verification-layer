/**
 * `acknowledgedBy` is published VERBATIM, and email addresses are rejected.
 *
 * The field used to be digested into `byDigest`. That protected nothing — an
 * unsalted SHA-256 over a handful of guessable team names ("Security Team",
 * "Development Team") is reversible by anyone who cares — while answering no
 * question an auditor asks, since the point of recording an adjudication is
 * knowing WHO accepted the risk. docs/ATTESTATIONS.md also listed it under the
 * privacy model, so the document asserted a protection it did not provide.
 *
 * The replacement publishes attribution in clear and refuses the one thing that
 * genuinely must not be published: a personal contact detail.
 */
import { describe, it, expect } from 'vitest';
import { adjudicate } from '../../src/attestation/evaluate.js';
import { VlayerStatementV1Schema } from '../../src/attestation/schema.js';
import { makeStatement, makePredicate, makeFinding } from './fixtures.js';
import type { Finding } from '../../src/types.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FUTURE = '2099-01-01T00:00:00.000Z';

function finding(ackBy: string, over: Partial<Finding> = {}): Finding {
  return {
    id: 'phi-phi-console-log-4',
    canonicalRuleId: 'phi-console-log',
    category: 'phi-exposure',
    severity: 'high',
    title: 'T',
    description: 'D',
    file: '/repo/src/a.ts',
    line: 4,
    recommendation: 'R',
    acknowledged: true,
    acknowledgment: {
      reason: 'accepted',
      acknowledgedBy: ackBy,
      acknowledgedAt: '2026-01-01T00:00:00.000Z',
      expired: false,
    },
    ...over,
  };
}

describe('attribution is published verbatim', () => {
  it('an open-ended acknowledgment records who accepted it, in clear', () => {
    const r = adjudicate(finding('Security Team'), null);
    expect(r.disposition).toBe('acknowledged');
    expect(r.adjudication).toMatchObject({ kind: 'acknowledged', by: 'Security Team' });
  });

  it('a time-bounded exception records who accepted it, in clear', () => {
    const f = finding('Simon Franco (triage 2026-08-26)');
    f.acknowledgment!.expiresAt = FUTURE;
    const r = adjudicate(f, null);
    expect(r.disposition).toBe('exception');
    expect(r.adjudication).toMatchObject({ kind: 'exception', by: 'Simon Franco (triage 2026-08-26)' });
  });

  it('a lapsed acknowledgment records who had accepted it, in clear', () => {
    const f = finding('Development Team');
    f.acknowledgment!.expiresAt = '2020-01-01T00:00:00.000Z';
    f.acknowledgment!.expired = true;
    const r = adjudicate(f, null);
    expect(r.lapsed).toMatchObject({ kind: 'acknowledgment', by: 'Development Team' });
  });

  it('no digest of the identity survives anywhere', () => {
    const serialized = JSON.stringify(adjudicate(finding('Security Team'), null));
    expect(serialized).not.toContain('byDigest');
    // "Security Team" hashes to this; it must not appear.
    expect(serialized).not.toMatch(/[0-9a-f]{64}.*[0-9a-f]{64}/);
    expect(serialized).toContain('Security Team');
  });

  it('the reason is STILL digested — prose is a different tradeoff', () => {
    const f = finding('Security Team');
    f.acknowledgment!.reason = 'patient MRN 4451237 is synthetic test data';
    const r = adjudicate(f, null);
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain('4451237');
    expect((r.adjudication as { reasonDigest: string }).reasonDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('email addresses are rejected by the schema', () => {
  function withBy(by: string) {
    return makeStatement({
      predicate: makePredicate({
        findings: [
          makeFinding({
            disposition: 'acknowledged',
            policyEffect: 'none',
            blocking: false,
            adjudication: {
              kind: 'acknowledged',
              by,
              at: '2026-01-01T00:00:00.000Z',
              reasonDigest: 'a'.repeat(64),
            },
          }),
        ],
      }),
    });
  }

  it('accepts names and team names', () => {
    for (const by of ['Security Team', 'Simon Franco (triage 2026-08-26)', 'Development Team', 'compliance-wg']) {
      expect(VlayerStatementV1Schema.safeParse(withBy(by)).success, by).toBe(true);
    }
  });

  it('rejects a bare email address', () => {
    expect(VlayerStatementV1Schema.safeParse(withBy('alice@hospital.example.org')).success).toBe(false);
  });

  it('rejects the git author form "Name <email>"', () => {
    expect(VlayerStatementV1Schema.safeParse(withBy('Alice Smith <alice@hospital.example.org>')).success).toBe(false);
  });

  it('rejects an email embedded mid-string', () => {
    expect(
      VlayerStatementV1Schema.safeParse(withBy('approved by bob@clinic.internal on 2026-01-01')).success,
    ).toBe(false);
  });

  it('the rejection message names the config field and what to do', () => {
    const parsed = VlayerStatementV1Schema.safeParse(withBy('alice@hospital.example.org'));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(' ');
      expect(msg).toContain('acknowledgedBy');
      expect(msg).toContain('.vlayerrc.json');
      expect(msg).toContain('Security Team');
    }
  });

  it('rejects an empty attribution', () => {
    expect(VlayerStatementV1Schema.safeParse(withBy('')).success).toBe(false);
  });
});

describe('the documentation no longer claims a protection it does not provide', () => {
  const docs = readFileSync(resolve(__dirname, '../../docs/ATTESTATIONS.md'), 'utf-8');

  it('does not list byDigest under the privacy model', () => {
    expect(docs).not.toContain('byDigest');
  });

  it('states plainly that acknowledgedBy is published verbatim', () => {
    expect(docs).toMatch(/`acknowledgedBy` is published verbatim/i);
  });

  it('warns users not to put PHI or contact details in the field', () => {
    expect(docs).toMatch(/Do not put PHI, patient identifiers, or personal contact details/i);
  });
});
