import { describe, expect, it } from 'vitest';
import type { Finding } from '../src/types.js';
import type { GuardResult } from '../src/delivery/types.js';
import { buildComplianceGraph } from '../src/delivery/graph.js';
import { buildEvidencePackage, verifyEvidencePackage } from '../src/delivery/evidence.js';

function sampleFinding(): Finding {
  return {
    id: 'audit-unlogged-read-42',
    category: 'audit-logging',
    severity: 'high',
    title: 'PHI read operation may lack audit logging',
    description: 'test',
    file: '/repo/src/patient.ts',
    line: 43,
    recommendation: 'Log actor, action, patient id, and timestamp.',
    hipaaReference: '§164.312(b)',
    context: [{ lineNumber: 43, content: 'await patientRepo.find(id)', isMatch: true }],
  };
}

function guard(): GuardResult {
  const finding = sampleFinding();
  return {
    git: {
      available: true,
      root: '/repo',
      branch: 'feature/patient',
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      author: 'Developer <dev@example.com>',
      changedFiles: ['src/patient.ts'],
      repository: 'acme/health-app',
      commitUrl: `https://github.com/acme/health-app/commit/${'a'.repeat(40)}`,
    },
    delta: {
      newFindings: [finding],
      newFindingsInChangedFiles: [finding],
      baselineFindings: [],
      resolvedFindings: [],
      changedFiles: ['src/patient.ts'],
    },
    decision: {
      status: 'fail',
      deployAllowed: false,
      evaluatedAt: '2026-09-07T00:00:00.000Z',
      consideredScope: 'changed-files',
      counts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
      totalConsidered: 1,
      reasons: [{
        code: 'BLOCKING_SEVERITY',
        severity: 'high',
        count: 1,
        message: '1 new high finding in the evaluated change',
      }],
      policy: {
        blockOn: ['critical', 'high'],
        maxNew: {},
        changedFilesOnly: true,
        minimumScore: 0,
        requireBaseline: false,
        failOnExpiredAcknowledgments: true,
      },
    },
    findings: [finding],
    scannedFiles: 12,
    complianceScore: 84,
    baselineLoaded: true,
  };
}

describe('compliance graph', () => {
  it('links code to finding, control, policy, evidence, and owner', () => {
    const input = guard();
    const graph = buildComplianceGraph(input.findings, '/repo', input.decision, input.git);

    expect(graph.nodes.some(node => node.type === 'code' && node.label === 'src/patient.ts')).toBe(true);
    expect(graph.nodes.some(node => node.type === 'control' && node.label === '§164.312(b)')).toBe(true);
    expect(graph.nodes.some(node => node.type === 'owner')).toBe(true);
    expect(graph.edges.some(edge => edge.relation === 'violates')).toBe(true);
    expect(graph.edges.some(edge => edge.relation === 'governed-by')).toBe(true);
    expect(graph.edges.some(edge => edge.relation === 'supports')).toBe(true);
  });
});

describe('evidence package', () => {
  it('is tamper-evident and excludes source context payloads', () => {
    const evidence = buildEvidencePackage('/repo', guard());

    expect(evidence.summary.scannedFiles).toBe(12);
    expect(evidence.findings[0]?.file).toBe('src/patient.ts');
    expect(evidence.findings[0]).not.toHaveProperty('context');
    expect(verifyEvidencePackage(evidence)).toBe(true);

    const tampered = structuredClone(evidence);
    tampered.decision.deployAllowed = true;
    expect(verifyEvidencePackage(tampered)).toBe(false);
  });
});
