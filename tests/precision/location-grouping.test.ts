import { describe, it, expect } from 'vitest';
import {
  groupFindingsByLocation,
  countGroupsBySeverity,
  formatHipaaRef,
  isProposedFinding,
} from '../../src/reporters/finding-presentation.js';
import type { Finding } from '../../src/types.js';

function finding(over: Partial<Finding>): Finding {
  return {
    id: 'RULE-001',
    category: 'phi-exposure',
    severity: 'high',
    title: 'A finding',
    description: 'x',
    file: 'src/a.ts',
    line: 10,
    recommendation: 'x',
    ...over,
  };
}

describe('groupFindingsByLocation', () => {
  it('preserves the underlying finding count: sum of group members == input length', () => {
    const findings = [
      finding({ id: 'R1', file: 'src/a.ts', line: 36, severity: 'critical', title: 'PHI in error log' }),
      finding({ id: 'R2', file: 'src/a.ts', line: 36, severity: 'high', title: 'PHI in console' }),
      finding({ id: 'R3', file: 'src/a.ts', line: 36, severity: 'high', title: 'PHI in template log' }),
      finding({ id: 'R4', file: 'src/b.ts', line: 25, severity: 'critical', title: 'localStorage PHI' }),
      finding({ id: 'R5', file: 'src/b.ts', line: 99, severity: 'medium', title: 'Solo finding' }),
    ];
    const groups = groupFindingsByLocation(findings);
    const totalMembers = groups.reduce((n, g) => n + g.members.length, 0);
    expect(totalMembers).toBe(findings.length);
  });

  it('renders single-finding locations as one-member groups', () => {
    const groups = groupFindingsByLocation([finding({ file: 'src/x.ts', line: 5 })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(1);
  });

  it('collapses multiple rules of the same category on the same file:line into one group', () => {
    const groups = groupFindingsByLocation([
      finding({ id: 'R1', file: 'src/a.ts', line: 36, category: 'phi-exposure', severity: 'high' }),
      finding({ id: 'R2', file: 'src/a.ts', line: 36, category: 'phi-exposure', severity: 'critical' }),
      finding({ id: 'R3', file: 'src/a.ts', line: 36, category: 'phi-exposure', severity: 'high' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
  });

  it('does NOT group unrelated rule categories that share a file:line', () => {
    // route.ts:10 — MFA (access-control) + backup (data-retention) are different
    // problems; they must render as separate rows, not one confusing group.
    const groups = groupFindingsByLocation([
      finding({ id: 'MFA-001', file: 'src/r.ts', line: 10, category: 'access-control', severity: 'critical' }),
      finding({ id: 'BACKUP-001', file: 'src/r.ts', line: 10, category: 'data-retention', severity: 'medium' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.members.length === 1)).toBe(true);
  });

  it('excludes proposed (NPRM) findings from the headline severity', () => {
    // A proposed critical must not make the group look critical; the current
    // (vigente) medium drives the header. The NPRM finding is still listed.
    const groups = groupFindingsByLocation([
      finding({ id: 'MFA-001', file: 'src/r.ts', line: 10, category: 'access-control', severity: 'critical', hipaaReference: 'NPRM §164.312(d) - Person or Entity Authentication' }),
      finding({ id: 'X', file: 'src/r.ts', line: 10, category: 'access-control', severity: 'medium', hipaaReference: '45 CFR §164.308(a)(7)(ii)(A) - Data Backup Plan' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].severity).toBe('medium');
    expect(groups[0].members).toHaveLength(2);
  });

  it('falls back to the highest proposed severity when every member is proposed', () => {
    const groups = groupFindingsByLocation([
      finding({ id: 'A', file: 'src/r.ts', line: 5, category: 'access-control', severity: 'high', hipaaReference: 'NPRM §164.312(d) - x' }),
      finding({ id: 'B', file: 'src/r.ts', line: 5, category: 'access-control', severity: 'critical', hipaaReference: 'NPRM §164.312(d) - y' }),
    ]);
    expect(groups[0].severity).toBe('critical');
  });

  it('sets group severity to the highest among members', () => {
    const groups = groupFindingsByLocation([
      finding({ id: 'R1', file: 'src/a.ts', line: 36, severity: 'medium' }),
      finding({ id: 'R2', file: 'src/a.ts', line: 36, severity: 'critical' }),
    ]);
    expect(groups[0].severity).toBe('critical');
    // highest-severity member sorts first
    expect(groups[0].members[0].severity).toBe('critical');
  });

  it('orders groups by severity (critical first), then file, then line', () => {
    const groups = groupFindingsByLocation([
      finding({ id: 'R1', file: 'src/z.ts', line: 1, severity: 'medium' }),
      finding({ id: 'R2', file: 'src/a.ts', line: 50, severity: 'critical' }),
      finding({ id: 'R3', file: 'src/a.ts', line: 10, severity: 'critical' }),
    ]);
    expect(groups.map(g => `${g.file}:${g.line}`)).toEqual([
      'src/a.ts:10',
      'src/a.ts:50',
      'src/z.ts:1',
    ]);
  });

  it('treats different lines in the same file as distinct locations', () => {
    const groups = groupFindingsByLocation([
      finding({ file: 'src/a.ts', line: 27 }),
      finding({ file: 'src/a.ts', line: 31 }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('countGroupsBySeverity counts locations, not findings', () => {
    const groups = groupFindingsByLocation([
      finding({ id: 'R1', file: 'src/a.ts', line: 36, severity: 'critical' }),
      finding({ id: 'R2', file: 'src/a.ts', line: 36, severity: 'high' }), // same location
      finding({ id: 'R3', file: 'src/b.ts', line: 5, severity: 'high' }),
    ]);
    const counts = countGroupsBySeverity(groups);
    expect(counts.critical).toBe(1); // 1 location, even though it holds 2 findings
    expect(counts.high).toBe(1);
  });
});

describe('formatHipaaRef — unify to one canonical style', () => {
  it('converts the hyphen separator in already-full refs to an em dash', () => {
    expect(formatHipaaRef('45 CFR §164.312(c) - Integrity Controls')).toBe(
      '45 CFR §164.312(c) — Integrity Controls',
    );
  });

  it('expands a bare single section with the official control name', () => {
    expect(formatHipaaRef('§164.530(j)')).toBe('45 CFR §164.530(j) — Documentation');
    expect(formatHipaaRef('§164.312(e)(1)')).toBe('45 CFR §164.312(e)(1) — Transmission Security');
  });

  it('expands a bare multi-section ref into each canonical citation', () => {
    expect(formatHipaaRef('§164.502, §164.514')).toBe(
      '45 CFR §164.502 — Uses and Disclosures of PHI: General Rules; 45 CFR §164.514 — De-identification and Minimum Necessary',
    );
  });

  it('preserves the NPRM (proposed rule) distinction with a consistent format', () => {
    expect(formatHipaaRef('NPRM §164.312(d) - Person or Entity Authentication')).toBe(
      '45 CFR §164.312(d) — Person or Entity Authentication (NPRM — proposed rule)',
    );
  });

  it('keeps a control name that itself contains a comma intact', () => {
    expect(formatHipaaRef('45 CFR §164.312(a)(1) - Access Control, Authentication')).toBe(
      '45 CFR §164.312(a)(1) — Access Control, Authentication',
    );
  });

  it('returns an em dash placeholder for empty refs', () => {
    expect(formatHipaaRef(undefined)).toBe('—');
    expect(formatHipaaRef('')).toBe('—');
  });
});

describe('isProposedFinding', () => {
  it('flags findings whose ref cites the NPRM', () => {
    expect(isProposedFinding(finding({ hipaaReference: 'NPRM §164.312(d) - Person or Entity Authentication' }))).toBe(true);
  });

  it('does not flag codified 45 CFR refs', () => {
    expect(isProposedFinding(finding({ hipaaReference: '45 CFR §164.312(c) - Integrity Controls' }))).toBe(false);
    expect(isProposedFinding(finding({ hipaaReference: undefined }))).toBe(false);
  });
});
