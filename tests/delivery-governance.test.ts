import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getAcknowledgmentLifecycle,
  loadDeliveryPolicy,
  parseDeliveryPolicy,
} from '../src/delivery/governance.js';

describe('delivery policy loading', () => {
  it('parses only supported policy values', () => {
    expect(parseDeliveryPolicy({
      blockOn: ['critical', 'nonsense'],
      maxNew: { medium: 2, low: -1 },
      changedFilesOnly: false,
      minimumScore: 88,
      requireBaseline: true,
      failOnExpiredAcknowledgments: false,
    })).toEqual({
      blockOn: ['critical'],
      maxNew: { medium: 2 },
      changedFilesOnly: false,
      minimumScore: 88,
      requireBaseline: true,
      failOnExpiredAcknowledgments: false,
    });
  });

  it('prefers a conventional vlayer.policy.json file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vlayer-policy-'));
    await writeFile(join(root, 'vlayer.policy.json'), JSON.stringify({
      blockOn: ['critical'],
      minimumScore: 75,
    }));

    const loaded = await loadDeliveryPolicy(root);
    expect(loaded.policy.blockOn).toEqual(['critical']);
    expect(loaded.policy.minimumScore).toBe(75);
    expect(loaded.source).toBe(join(root, 'vlayer.policy.json'));
  });
});

describe('acknowledgment lifecycle', () => {
  it('classifies expired and soon-to-expire exceptions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vlayer-acks-'));
    await writeFile(join(root, '.vlayerrc.json'), JSON.stringify({
      acknowledgedFindings: [
        {
          pattern: '**/old.ts',
          id: '^OLD$',
          reason: 'legacy exception',
          acknowledgedBy: 'Security',
          acknowledgedAt: '2026-01-01T00:00:00Z',
          expiresAt: '2026-08-01T00:00:00Z',
        },
        {
          pattern: '**/soon.ts',
          id: '^SOON$',
          reason: 'temporary exception',
          acknowledgedBy: 'Security',
          acknowledgedAt: '2026-08-01T00:00:00Z',
          expiresAt: '2026-09-20T00:00:00Z',
        },
        {
          pattern: '**/active.ts',
          id: '^ACTIVE$',
          reason: 'reviewed exception',
          acknowledgedBy: 'Security',
          acknowledgedAt: '2026-08-01T00:00:00Z',
          expiresAt: '2027-01-01T00:00:00Z',
        },
      ],
    }));

    const lifecycle = await getAcknowledgmentLifecycle(
      root,
      undefined,
      new Date('2026-09-07T00:00:00Z'),
    );

    expect(lifecycle.total).toBe(3);
    expect(lifecycle.expired).toHaveLength(1);
    expect(lifecycle.expiringSoon).toHaveLength(1);
    expect(lifecycle.active).toHaveLength(2);
  });
});
