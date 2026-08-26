/**
 * Shared fixture builders for attestation tests. Deliberately hand-written
 * (not produced by build.ts) so schema tests fail loudly if build.ts and the
 * schema drift apart.
 */
import type {
  ControlEvaluation,
  FindingEvaluation,
  VlayerPredicateV1,
  VlayerStatementV1,
} from '../../src/attestation/types.js';

export const SHA256_A = 'a'.repeat(64);
export const SHA256_B = 'b'.repeat(64);
export const SHA1_COMMIT = '9'.repeat(40);
export const SHA1_TREE = '8'.repeat(40);

export function makeFinding(over: Partial<FindingEvaluation> = {}): FindingEvaluation {
  return {
    fingerprint: SHA256_A,
    locationId: SHA256_B,
    baselineHashRelative: '0123456789abcdef',
    ruleId: 'phi-console-log',
    ruleKnown: true,
    ruleSource: 'builtin',
    emittedId: 'phi-phi-console-log-42',
    location: { path: 'src/service.ts', line: 42, kind: 'file' },
    severity: 'high',
    category: 'phi-exposure',
    controls: [
      { framework: 'hipaa', controlId: '164.502', rawReference: '§164.502, §164.514', proposed: false },
    ],
    detector: { scanner: 'phi', source: 'pattern' },
    detection: {
      semanticConfidence: 'high',
      minConfidenceThreshold: null,
      belowThreshold: false,
      deterministic: true,
    },
    disposition: 'active',
    dispositionReason: 'no-adjudication',
    evidenceScope: 'code',
    policyEffect: 'blocking',
    blocking: true,
    ...over,
  };
}

/**
 * A finding whose `blocking` mirror is derived from `policyEffect`, so tests
 * cannot accidentally construct an internally inconsistent evaluation.
 */
export function makeConsistentFinding(over: Partial<FindingEvaluation> = {}): FindingEvaluation {
  const base = makeFinding(over);
  return { ...base, blocking: base.policyEffect === 'blocking' };
}

/** A repository/process observation: high severity, but never release-blocking. */
export function makeRepositoryFinding(over: Partial<FindingEvaluation> = {}): FindingEvaluation {
  return makeFinding({
    ruleId: 'HIPAA-PENTEST-001',
    emittedId: 'HIPAA-PENTEST-001',
    severity: 'high',
    category: 'audit-logging',
    location: { path: null, line: null, kind: 'project' },
    detector: { scanner: 'hipaa2026', source: 'pattern' },
    controls: [
      { framework: 'hipaa', controlId: '164.308(a)(8)', rawReference: '45 CFR §164.308(a)(8)', proposed: false },
    ],
    evidenceScope: 'repository',
    policyEffect: 'review_required',
    blocking: false,
    ...over,
  });
}

export function makeControl(over: Partial<ControlEvaluation> = {}): ControlEvaluation {
  return {
    control: { framework: 'hipaa', controlId: '164.502', rawReference: '§164.502', proposed: false },
    state: 'blocking_findings',
    evidence: {
      rulesInUniverse: 3,
      rulesExecuted: 3,
      executedRuleIds: ['phi-console-log'],
      sources: [{ kind: 'static-analysis', assurance: 'AUTOMATED_VERIFIED' }],
    },
    findings: { total: 1, active: 1, blocking: 1, reviewRequired: 0, exceptions: 0, lowConfidence: 0, lapsed: 0 },
    fingerprints: [SHA256_A],
    ...over,
  };
}

export function makePredicate(over: Partial<VlayerPredicateV1> = {}): VlayerPredicateV1 {
  return {
    schemaVersion: '1.0.0',
    generatedAt: '2026-08-26T00:00:00.000Z',
    target: {
      repository: 'github.com/acme/healthapp',
      repositoryHostClass: 'public-forge',
      repositoryDigest: SHA256_A,
      commit: SHA1_COMMIT,
      tree: SHA1_TREE,
      branch: 'main',
      dirty: false,
      sourceDigest: SHA1_TREE,
      sourceDigestMethod: 'git-tree-sha1',
    },
    verifier: {
      name: 'vlayer',
      version: '0.24.5',
      ruleCatalogDigest: SHA256_B,
      ruleCatalogRuleCount: 143,
      aiTriage: {
        enabled: false,
        applied: false,
        model: null,
        findingsSubmitted: 0,
        findingsCapped: 0,
        findingsFailed: 0,
        reproducible: true,
      },
    },
    scope: {
      framework: 'hipaa',
      technicalOnly: true,
      categories: ['phi-exposure'],
      filesScanned: 10,
      evidenceClass: 'AUTOMATED_VERIFIED',
      reproducibility: 'deterministic',
      limitations: ['Technical software controls only.'],
      coverage: {
        scanners: [{ key: 'phi', category: 'phi-exposure', invoked: true, filesConsidered: 10 }],
        rulesInCatalog: 143,
        rulesExecuted: 29,
        rulesWithoutControlMapping: 81,
        controlsEvaluated: 1,
        controlsNotEvaluated: [],
        customRulesExecuted: 0,
      },
    },
    policy: {
      id: 'vlayer-default-technical-v1',
      digest: SHA256_A,
      conclusion: 'fail',
      reasons: ['active-blocking-high'],
    },
    summary: {
      filesScanned: 10,
      detected: 1,
      active: 1,
      falsePositives: 0,
      acknowledged: 0,
      suppressed: 0,
      baseline: 0,
      lowConfidence: 0,
      exceptions: 0,
      lapsed: 0,
      blocking: 1,
      reviewRequired: 0,
      unknownRules: 0,
      unmappedControls: 0,
      controlsNotEvaluated: 0,
    },
    controls: [makeControl()],
    findings: [makeFinding()],
    ...over,
  };
}

export function makeStatement(over: Partial<VlayerStatementV1> = {}): VlayerStatementV1 {
  return {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [
      {
        name: `git+github.com/acme/healthapp@${SHA1_COMMIT}`,
        digest: { gitCommit: SHA1_COMMIT, gitTree: SHA1_TREE },
      },
    ],
    predicateType: 'https://vlayer.app/attestation/technical-compliance/v1',
    predicate: makePredicate(),
    ...over,
  };
}
