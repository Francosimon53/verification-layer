import { describe, it, expect } from 'vitest';
import {
  computeFindingIdentity,
  structuralSignature,
  baselineHashRelative,
} from '../../src/attestation/fingerprint.js';

const base = { ruleId: 'phi-console-log', path: 'src/service.ts', kind: 'file' as const };

describe('structural signature — privacy', () => {
  it('destroys string literal content, including PHI', () => {
    const sig = structuralSignature(`const ssn = "123-45-6789";`)!;
    expect(sig).not.toContain('123-45-6789');
    expect(sig).not.toContain('ssn');
    expect(sig).toContain('S');
  });

  it('destroys template literal content', () => {
    const sig = structuralSignature('const q = `SELECT * FROM patients WHERE id=${pid}`;')!;
    expect(sig).not.toContain('patients');
    expect(sig).not.toContain('pid');
    expect(sig).toContain('T');
  });

  it('destroys numeric literals', () => {
    const sig = structuralSignature('const mrn = 987654321;')!;
    expect(sig).not.toContain('987654321');
    expect(sig).toContain('N');
  });

  it('destroys long opaque secrets', () => {
    const sig = structuralSignature('const k = ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6;')!;
    expect(sig).not.toContain('ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6');
  });

  it('erases identifiers that are not on the allowlist', () => {
    const sig = structuralSignature('patientRecord.socialSecurityNumber = oncologyPatientId;')!;
    for (const secret of ['patientRecord', 'socialSecurityNumber', 'oncologyPatientId']) {
      expect(sig).not.toContain(secret);
    }
  });

  it('keeps allowlisted API names that vlayer patterns already match on', () => {
    const sig = structuralSignature("console.log('patient ssn', user.ssn);")!;
    expect(sig).toContain('console');
    expect(sig).toContain('log');
    expect(sig).not.toContain('ssn');
    expect(sig).not.toContain('patient');
  });

  it('strips comments so a comment cannot leak into the pre-image', () => {
    const sig = structuralSignature('const x = 1; // patient MRN is 4451237');
    expect(sig ?? '').not.toContain('MRN');
    expect(sig ?? '').not.toContain('4451237');
  });

  it('returns null for a line with no structure', () => {
    expect(structuralSignature('   ')).toBeNull();
    expect(structuralSignature('// only a comment')).toBeNull();
  });

  it('bounds the pre-image length', () => {
    expect(structuralSignature('a.'.repeat(500))!.length).toBeLessThanOrEqual(120);
  });
});

describe('fingerprint — determinism and stability', () => {
  it('is deterministic for identical input', () => {
    const a = computeFindingIdentity({ ...base, anchorLine: 'console.log(p.ssn)' }, 10);
    const b = computeFindingIdentity({ ...base, anchorLine: 'console.log(p.ssn)' }, 10);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.locationId).toBe(b.locationId);
  });

  it('produces lowercase hex sha-256 values', () => {
    const id = computeFindingIdentity({ ...base, anchorLine: 'console.log(x)' }, 1);
    expect(id.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(id.locationId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is INVARIANT to line shift — the continuity property', () => {
    const a = computeFindingIdentity({ ...base, anchorLine: 'console.log(p.ssn)' }, 10);
    const b = computeFindingIdentity({ ...base, anchorLine: 'console.log(p.ssn)' }, 250);
    expect(a.fingerprint).toBe(b.fingerprint);
    // locationId is the exact-site identity, so it MUST differ.
    expect(a.locationId).not.toBe(b.locationId);
  });

  it('is invariant to renaming a variable (structural identity)', () => {
    const a = computeFindingIdentity({ ...base, anchorLine: 'console.log(patient.ssn)' }, 1);
    const b = computeFindingIdentity({ ...base, anchorLine: 'console.log(subject.taxId)' }, 1);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('is invariant to a changed literal value', () => {
    const a = computeFindingIdentity({ ...base, anchorLine: 'const k = "aaa";' }, 1);
    const b = computeFindingIdentity({ ...base, anchorLine: 'const k = "bbb";' }, 1);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('is invariant to reformatting whitespace', () => {
    const a = computeFindingIdentity({ ...base, anchorLine: 'console.log( x , y )' }, 1);
    const b = computeFindingIdentity({ ...base, anchorLine: 'console.log(x,y)' }, 1);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('differs by rule', () => {
    const a = computeFindingIdentity({ ...base, anchorLine: 'console.log(x)' }, 1);
    const b = computeFindingIdentity({ ...base, ruleId: 'enc-md5', anchorLine: 'console.log(x)' }, 1);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('differs by path', () => {
    const a = computeFindingIdentity({ ...base, anchorLine: 'console.log(x)' }, 1);
    const b = computeFindingIdentity({ ...base, path: 'src/other.ts', anchorLine: 'console.log(x)' }, 1);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('differs by structural shape', () => {
    const a = computeFindingIdentity({ ...base, anchorLine: 'console.log(x)' }, 1);
    const b = computeFindingIdentity({ ...base, anchorLine: 'console.error(x, y, z)' }, 1);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('degrades explicitly when no structure is available', () => {
    const id = computeFindingIdentity({ ...base, anchorLine: null }, 1);
    expect(id.structureAvailable).toBe(false);
    expect(id.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives project-level findings a location-free identity', () => {
    const a = computeFindingIdentity(
      { ruleId: 'HIPAA-ASSET-001', path: null, kind: 'project' },
      null,
    );
    const b = computeFindingIdentity(
      { ruleId: 'HIPAA-ASSET-001', path: null, kind: 'project' },
      null,
    );
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.structureAvailable).toBe(false);
  });

  it('handles an unknown rule id without throwing', () => {
    const id = computeFindingIdentity({ ...base, ruleId: null, anchorLine: 'x()' }, 3);
    expect(id.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never embeds raw source in either identity', () => {
    const id = computeFindingIdentity(
      { ...base, anchorLine: 'console.log("SENTINEL_PHI_TOKEN_7f3a", patientRecord)' },
      5,
    );
    const serialized = JSON.stringify(id);
    expect(serialized).not.toContain('SENTINEL_PHI_TOKEN_7f3a');
    expect(serialized).not.toContain('patientRecord');
  });
});

describe('baselineHashRelative', () => {
  it('is 16 hex chars, matching the legacy width', () => {
    expect(baselineHashRelative('src/a.ts', 4, 'phi-x-4', 'Title')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic and path-relative (no absolute path in the key)', () => {
    const a = baselineHashRelative('src/a.ts', 4, 'phi-x-4', 'Title');
    const b = baselineHashRelative('src/a.ts', 4, 'phi-x-4', 'Title');
    expect(a).toBe(b);
    expect(a).not.toBe(baselineHashRelative('/Users/x/src/a.ts', 4, 'phi-x-4', 'Title'));
  });
});
