import { describe, it, expect } from 'vitest';
import { checkAcknowledgment, applyAcknowledgments } from '../src/acknowledgments.js';
import type { Finding, VlayerConfig, AcknowledgedFinding } from '../src/types.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'enc-des-6',
    category: 'encryption',
    severity: 'critical',
    title: 'Weak cryptography finding',
    description: 'test finding',
    file: '/Users/dev/project/src/exclusions.ts',
    line: 7,
    recommendation: 'use modern crypto',
    ...overrides,
  } as Finding;
}

function makeAck(overrides: Partial<AcknowledgedFinding> = {}): AcknowledgedFinding {
  return {
    pattern: '**/src/exclusions.ts',
    reason: 'documented false positive',
    acknowledgedBy: 'Security Team',
    acknowledgedAt: '2026-07-20T00:00:00Z',
    ...overrides,
  };
}

function makeConfig(acks: AcknowledgedFinding[]): VlayerConfig {
  return { acknowledgedFindings: acks };
}

describe('checkAcknowledgment', () => {
  describe('paths with dot-directory segments', () => {
    it('matches ** patterns across a .claude/worktrees segment', () => {
      const finding = makeFinding({
        file: '/Users/dev/project/.claude/worktrees/fix+ack-dot-paths/src/exclusions.ts',
      });
      const result = checkAcknowledgment(finding, makeConfig([makeAck()]));
      expect(result.acknowledged).toBe(true);
    });

    it('matches ** patterns across an arbitrary hidden directory', () => {
      const finding = makeFinding({
        file: '/home/ci/.cache/checkout/src/exclusions.ts',
      });
      const result = checkAcknowledgment(finding, makeConfig([makeAck()]));
      expect(result.acknowledged).toBe(true);
    });

    it('matches when the file itself is inside a dot-directory named by the pattern', () => {
      const finding = makeFinding({
        file: '/repo/.claude/worktrees/branch/dashboard/lib/github/auth.ts',
      });
      const config = makeConfig([
        makeAck({ pattern: '**/dashboard/lib/github/auth.ts' }),
      ]);
      expect(checkAcknowledgment(finding, config).acknowledged).toBe(true);
    });
  });

  describe('existing pattern behavior is preserved', () => {
    it('matches plain absolute paths without dot segments', () => {
      const finding = makeFinding({ file: '/Users/dev/project/src/exclusions.ts' });
      expect(checkAcknowledgment(finding, makeConfig([makeAck()])).acknowledged).toBe(true);
    });

    it('matches directory-wide globs like **/src/scanners/**/*.ts', () => {
      const finding = makeFinding({
        file: '/Users/dev/project/src/scanners/encryption/index.ts',
      });
      const config = makeConfig([makeAck({ pattern: '**/src/scanners/**/*.ts' })]);
      expect(checkAcknowledgment(finding, config).acknowledged).toBe(true);
    });

    it('does not match a different file', () => {
      const finding = makeFinding({ file: '/Users/dev/project/src/scan.ts' });
      expect(checkAcknowledgment(finding, makeConfig([makeAck()])).acknowledged).toBe(false);
    });

    it('respects the id filter, including wildcard prefixes', () => {
      const config = makeConfig([makeAck({ id: 'enc-des' })]);
      expect(checkAcknowledgment(makeFinding({ id: 'enc-des-6' }), config).acknowledged).toBe(true);
      expect(checkAcknowledgment(makeFinding({ id: 'enc-rc4-3' }), config).acknowledged).toBe(false);
    });

    it('respects category and severity filters', () => {
      const byCategory = makeConfig([makeAck({ category: 'phi-exposure' })]);
      expect(checkAcknowledgment(makeFinding(), byCategory).acknowledged).toBe(false);

      const bySeverity = makeConfig([makeAck({ severity: 'low' })]);
      expect(checkAcknowledgment(makeFinding(), bySeverity).acknowledged).toBe(false);
    });

    it('flags expired acknowledgments', () => {
      const config = makeConfig([makeAck({ expiresAt: '2020-01-01T00:00:00Z' })]);
      const result = checkAcknowledgment(makeFinding(), config);
      expect(result.acknowledged).toBe(true);
      expect(result.expired).toBe(true);
    });

    it('returns unacknowledged when config has no acknowledgments', () => {
      expect(checkAcknowledgment(makeFinding(), {}).acknowledged).toBe(false);
    });
  });
});

describe('applyAcknowledgments', () => {
  it('acknowledges findings under dot-directory checkouts and leaves others untouched', () => {
    const inWorktree = makeFinding({
      file: '/repo/.claude/worktrees/branch/src/exclusions.ts',
    });
    const unrelated = makeFinding({
      id: 'other-1',
      file: '/repo/.claude/worktrees/branch/src/other.ts',
    });

    const [acked, untouched] = applyAcknowledgments(
      [inWorktree, unrelated],
      makeConfig([makeAck()])
    );

    expect(acked.acknowledged).toBe(true);
    expect(acked.acknowledgment?.reason).toBe('documented false positive');
    expect(untouched.acknowledged).toBeUndefined();
  });
});
