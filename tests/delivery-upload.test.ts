import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EvidencePackage } from '../src/delivery/types.js';
import { hashEvidencePayload } from '../src/delivery/evidence.js';
import { uploadEvidencePackage } from '../src/delivery/upload.js';

function evidence(): EvidencePackage {
  const body = {
    schemaVersion: '1.0' as const,
    generatedAt: '2026-09-07T00:00:00.000Z',
    project: { name: 'health-app' },
    source: { changedFiles: ['src/a.ts'] },
    decision: {
      status: 'pass' as const,
      deployAllowed: true,
      evaluatedAt: '2026-09-07T00:00:00.000Z',
      consideredScope: 'changed-files' as const,
      counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      totalConsidered: 0,
      reasons: [],
      policy: {
        blockOn: ['critical' as const, 'high' as const],
        maxNew: {},
        changedFilesOnly: true,
        minimumScore: 0,
        requireBaseline: false,
        failOnExpiredAcknowledgments: true,
      },
    },
    summary: {
      scannedFiles: 3,
      totalFindings: 0,
      newFindings: 0,
      resolvedFindings: 0,
      acknowledged: 0,
      suppressed: 0,
      complianceScore: 100,
    },
    controls: [],
    findings: [],
    graph: {
      schemaVersion: '1.0' as const,
      generatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [],
      edges: [],
    },
  };
  return { ...body, packageHash: hashEvidencePayload(body) };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.VLAYER_TOKEN;
  delete process.env.VLAYER_INGEST_URL;
});

describe('evidence upload', () => {
  it('verifies integrity and sends token only in Authorization header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      scanId: 'scan-1',
      projectId: 'project-1',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));

    const result = await uploadEvidencePackage(evidence(), {
      url: 'https://vlayer.app/api/ingest',
      token: 'vl_test_secret',
    });

    expect(result.scanId).toBe('scan-1');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://vlayer.app/api/ingest');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer vl_test_secret');
    expect(String(init?.body)).not.toContain('vl_test_secret');
  });

  it('refuses tampered evidence before making a network request', async () => {
    const value = evidence();
    value.summary.totalFindings = 99;
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(uploadEvidencePackage(value, {
      url: 'https://vlayer.app/api/ingest',
      token: 'vl_test_secret',
    })).rejects.toThrow(/integrity/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects cleartext remote ingest URLs', async () => {
    await expect(uploadEvidencePackage(evidence(), {
      url: 'http://example.com/api/ingest',
      token: 'vl_test_secret',
    })).rejects.toThrow(/HTTPS/);
  });
});
