/**
 * The severity-vs-policy-effect classification, tested at its source.
 *
 * The distinction must be a GENERAL rule derived from the finding's own shape,
 * not a list of rule ids hidden somewhere. These tests pin both the derivation
 * and the fact that it is general.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { classifyEvidenceScope, derivePolicyEffect } from '../../src/attestation/evaluate.js';
import type { FindingLocation } from '../../src/attestation/types.js';

const codeLoc: FindingLocation = { path: 'src/a.ts', line: 12, kind: 'file' };
const projectLoc: FindingLocation = { path: null, line: null, kind: 'project' };
const manifestLoc: FindingLocation = { path: 'package.json', line: null, kind: 'file' };

describe('classifyEvidenceScope', () => {
  it('classifies a line-anchored finding as code evidence', () => {
    expect(classifyEvidenceScope(codeLoc)).toBe('code');
  });

  it('classifies a project-level finding as repository evidence', () => {
    expect(classifyEvidenceScope(projectLoc)).toBe('repository');
  });

  it('classifies a manifest finding with no line as repository evidence', () => {
    // e.g. "no audit logging framework detected" — anchored to package.json but
    // pointing at no line, because it is an absence, not a defect.
    expect(classifyEvidenceScope(manifestLoc)).toBe('repository');
  });

  it('is derived from shape alone — a code path with a line is always code', () => {
    expect(classifyEvidenceScope({ path: 'package.json', line: 3, kind: 'file' })).toBe('code');
  });
});

describe('derivePolicyEffect', () => {
  it('gives every adjudicated disposition no release effect', () => {
    for (const d of ['false_positive', 'suppressed', 'exception', 'acknowledged', 'baseline', 'low_confidence'] as const) {
      expect(derivePolicyEffect(d, 'code', 'critical')).toBe('none');
      expect(derivePolicyEffect(d, 'repository', 'critical')).toBe('none');
    }
  });

  it('blocks on active critical and high CODE findings', () => {
    expect(derivePolicyEffect('active', 'code', 'critical')).toBe('blocking');
    expect(derivePolicyEffect('active', 'code', 'high')).toBe('blocking');
  });

  it('requires review for an active medium code finding', () => {
    expect(derivePolicyEffect('active', 'code', 'medium')).toBe('review_required');
  });

  it('gives active low/info code findings no release effect', () => {
    expect(derivePolicyEffect('active', 'code', 'low')).toBe('none');
    expect(derivePolicyEffect('active', 'code', 'info')).toBe('none');
  });

  // --- the core requirement ---

  it('NEVER blocks on a repository/process finding, at ANY severity', () => {
    for (const severity of ['critical', 'high', 'medium', 'low', 'info'] as const) {
      expect(derivePolicyEffect('active', 'repository', severity)).not.toBe('blocking');
    }
  });

  it('still requires review for a high repository finding — it stays visible', () => {
    expect(derivePolicyEffect('active', 'repository', 'high')).toBe('review_required');
  });

  it('separates severity from effect: same severity, different effect by scope', () => {
    expect(derivePolicyEffect('active', 'code', 'high')).toBe('blocking');
    expect(derivePolicyEffect('active', 'repository', 'high')).toBe('review_required');
  });
});

describe('the classification is general, not a rule-id allowlist', () => {
  const read = (f: string) => readFileSync(resolve(__dirname, '../../src', f), 'utf-8');

  it('policy.ts names no specific rule', () => {
    const src = read('attestation/policy.ts');
    for (const id of ['HIPAA-PENTEST-001', 'audit-no-framework', 'HIPAA-ASSET-001', 'HIPAA-FLOW-001']) {
      expect(src).not.toContain(id);
    }
  });

  it('the derivation names no specific rule', () => {
    const src = read('attestation/evaluate.ts');
    const fn = src.slice(src.indexOf('export function derivePolicyEffect'));
    for (const id of ['HIPAA-PENTEST-001', 'audit-no-framework', 'HIPAA-ASSET-001', 'HIPAA-FLOW-001']) {
      expect(fn).not.toContain(id);
    }
  });

  it('severity remains untouched — no rule was downgraded to achieve this', () => {
    // HIPAA-PENTEST-001 must still be declared high severity at its source.
    const patterns = readFileSync(
      resolve(__dirname, '../../src/scanners/hipaa2026/patterns.ts'),
      'utf-8',
    );
    const idx = patterns.indexOf('HIPAA-PENTEST-001');
    expect(idx).toBeGreaterThan(-1);
    expect(patterns.slice(idx, idx + 400)).toMatch(/severity:\s*'high'/);
  });
});
