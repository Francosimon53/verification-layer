/**
 * Triage metrics must depend on EXPLICIT STATE, not on user-facing prose.
 *
 * The capped-finding count was previously derived by string-matching the cap
 * message in two separate places. Those numbers are published in the attestation
 * as evidence, so rewording the message would have silently changed reported
 * evidence. These tests pin the new contract.
 */
import { describe, it, expect } from 'vitest';
import {
  summarizeTriage,
  triageFailureReason,
  TRIAGE_REASONS,
} from '../../src/ai/rules/triage.js';
import type { TriagedFinding } from '../../src/ai/rules/types.js';
import type { TriageOutcome } from '../../src/types.js';
import type { Finding } from '../../src/types.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function triaged(outcome: TriageOutcome, aiReasoning: string): TriagedFinding {
  return {
    id: `f-${outcome}`,
    canonicalRuleId: 'phi-console-log',
    category: 'phi-exposure',
    severity: 'high',
    title: 'T',
    description: 'D',
    file: '/repo/src/a.ts',
    line: 1,
    recommendation: 'R',
    aiClassification: 'likely',
    aiConfidence: 0.5,
    aiReasoning,
    triageOutcome: outcome,
    source: 'static',
  };
}

describe('canonical triage reason constants', () => {
  it('defines the cap message exactly once in the source tree', () => {
    const repoRoot = resolve(__dirname, '../..');
    const files = [
      'src/scan.ts',
      'src/ai/scanner.ts',
      'src/ai/rules/triage.ts',
    ];
    const occurrences = files.flatMap((f) => {
      const text = readFileSync(resolve(repoRoot, f), 'utf-8');
      return text.includes(TRIAGE_REASONS.cap_reached) ? [f] : [];
    });
    expect(occurrences).toEqual(['src/ai/rules/triage.ts']);
  });

  it('exposes a canonical failure-reason builder', () => {
    expect(triageFailureReason(new Error('boom'))).toBe('Triage failed: boom');
    expect(triageFailureReason('x')).toBe('Triage failed: Unknown error');
  });
});

describe('the explicit state lives on Finding', () => {
  it('a plain Finding can carry triageOutcome', () => {
    // ScanResult.filtered holds `Finding` objects that have been through triage,
    // so the field must be declared on Finding, not only on TriagedFinding.
    const f: Finding = {
      id: 'x', category: 'phi-exposure', severity: 'high', title: 'T',
      description: 'D', file: '/repo/a.ts', line: 1, recommendation: 'R',
      triageOutcome: 'cap_reached',
    };
    expect(f.triageOutcome).toBe('cap_reached');
  });
});

describe('summarizeTriage counts from explicit state', () => {
  it('counts capped, failed, verified and no-content findings', () => {
    const stats = summarizeTriage([
      triaged('ai_verified', 'looks real'),
      triaged('ai_verified', 'looks real'),
      triaged('cap_reached', TRIAGE_REASONS.cap_reached),
      triaged('cap_reached', TRIAGE_REASONS.cap_reached),
      triaged('cap_reached', TRIAGE_REASONS.cap_reached),
      triaged('error', triageFailureReason(new Error('timeout'))),
      triaged('no_content', TRIAGE_REASONS.no_content),
    ]);
    expect(stats).toEqual({ submitted: 7, capped: 3, failed: 1, verified: 2, noContent: 1 });
  });

  it('returns zeroes for an empty batch', () => {
    expect(summarizeTriage([])).toEqual({
      submitted: 0, capped: 0, failed: 0, verified: 0, noContent: 0,
    });
  });

  // --- the regression this whole change exists to prevent ---

  it('capped count is UNCHANGED when the user-facing copy is rewritten', () => {
    const withCanonicalCopy = summarizeTriage([
      triaged('cap_reached', TRIAGE_REASONS.cap_reached),
      triaged('cap_reached', TRIAGE_REASONS.cap_reached),
    ]);
    const withRewordedCopy = summarizeTriage([
      triaged('cap_reached', 'Skipped: per-scan AI budget exhausted. Pattern match only.'),
      triaged('cap_reached', '⚠️ not sent to the model'),
    ]);
    expect(withRewordedCopy.capped).toBe(withCanonicalCopy.capped);
    expect(withRewordedCopy.capped).toBe(2);
  });

  it('a finding whose PROSE looks capped but whose STATE is verified is not counted', () => {
    // The old string-matching implementation would have miscounted this.
    const stats = summarizeTriage([triaged('ai_verified', TRIAGE_REASONS.cap_reached)]);
    expect(stats.capped).toBe(0);
    expect(stats.verified).toBe(1);
  });

  it('a capped finding whose prose was localized is still counted', () => {
    const stats = summarizeTriage([triaged('cap_reached', 'No verificado por IA (límite alcanzado)')]);
    expect(stats.capped).toBe(1);
  });

  it('failure count does not depend on the "Triage failed:" prefix', () => {
    const stats = summarizeTriage([
      triaged('error', 'the model returned malformed JSON'),
      triaged('ai_verified', 'Triage failed: this is a model quote, not a failure'),
    ]);
    expect(stats.failed).toBe(1);
    expect(stats.verified).toBe(1);
  });

  it('BOTH metrics survive a full rewrite of the user-facing copy', () => {
    // The regression this change exists to prevent: editing display copy must
    // not move either published number. Same states, completely different prose.
    const canonical = summarizeTriage([
      triaged('cap_reached', TRIAGE_REASONS.cap_reached),
      triaged('cap_reached', TRIAGE_REASONS.cap_reached),
      triaged('error', triageFailureReason(new Error('timeout'))),
      triaged('ai_verified', 'confirmed real'),
    ]);
    const rewritten = summarizeTriage([
      triaged('cap_reached', 'AI budget spent — pattern match only'),
      triaged('cap_reached', ''),
      triaged('error', 'the model was unreachable'),
      triaged('ai_verified', 'Not AI-verified (triage cap reached) — regex-flagged only'),
    ]);
    expect(rewritten.capped).toBe(canonical.capped);
    expect(rewritten.failed).toBe(canonical.failed);
    expect(rewritten.verified).toBe(canonical.verified);
    expect(rewritten).toEqual(canonical);
  });

  it('neither metric can be reached by prose alone', () => {
    // Every finding carries copy that the OLD implementation would have matched,
    // yet none of them is in the corresponding state.
    const stats = summarizeTriage([
      triaged('ai_verified', TRIAGE_REASONS.cap_reached),
      triaged('ai_verified', 'Triage failed: quoted by the model'),
      triaged('no_content', TRIAGE_REASONS.cap_reached),
    ]);
    expect(stats.capped).toBe(0);
    expect(stats.failed).toBe(0);
  });

  it('capped findings are never dropped — they remain in the batch', () => {
    const batch = [triaged('ai_verified', 'ok'), triaged('cap_reached', TRIAGE_REASONS.cap_reached)];
    expect(summarizeTriage(batch).submitted).toBe(batch.length);
  });
});
