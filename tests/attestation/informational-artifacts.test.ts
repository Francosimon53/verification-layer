/**
 * Informational artifacts in the evidence model.
 *
 * `scan()` lifts HIPAA-ASSET-001 and HIPAA-FLOW-001 out of `findings` because
 * they are generated documentation, not violations, and must never count toward
 * stats or the unacknowledged total (PR #64). M1's first invariant is that
 * nothing detected disappears, so they are also recorded in `ScanResult.filtered`
 * and enter the attestation with disposition 'informational'.
 *
 * They are inert by construction. Critically, they must NOT be mistakable for
 * control coverage: HIPAA-ASSET-001 and HIPAA-FLOW-001 are the ONLY two catalog
 * rules mapping to 45 CFR §164.308(a)(1)(ii)(A) (Risk Analysis), so if they
 * counted as evaluation evidence that control would report "evaluated, nothing
 * blocking" purely because an inventory was generated.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildAttestation } from '../../src/attestation/build.js';
import { scan } from '../../src/scan.js';
import { adjudicate } from '../../src/attestation/evaluate.js';
import { RULE_CATALOG } from '../../src/rules/catalog.js';
import { parseControlRefs } from '../../src/attestation/control-mapping.js';
import { VlayerStatementV1Schema } from '../../src/attestation/schema.js';
import { createTempRepo, type TempRepo } from './git-fixture.js';
import type { VlayerStatementV1 } from '../../src/attestation/types.js';
import { makeStatement, makePredicate, makeControl, makeFinding } from './fixtures.js';

const RISK_ANALYSIS = '164.308(a)(1)(ii)(A)';
const clock = { now: () => new Date('2026-08-26T12:00:00.000Z') };

let repo: TempRepo;
let statement: VlayerStatementV1;

beforeAll(async () => {
  repo = createTempRepo('vlayer-informational-');
  repo.write('package.json', JSON.stringify({ name: 'clinic', version: '1.0.0', dependencies: { pino: '^9' } }, null, 2));
  // PHI handling, so the asset inventory and PHI flow map are both generated.
  // The asset inventory needs a recognised data/API asset in a file that
  // mentions PHI; the flow map needs PHI moving through the code.
  repo.write(
    'src/patient.ts',
    [
      "import mongoose from 'mongoose';",
      "import axios from 'axios';",
      '',
      "mongoose.connect(process.env.DB_URL);",
      "const Patient = mongoose.model('Patient', schema);",
      '',
      'export async function getPatient(req, res) {',
      '  const patient = await Patient.findById(req.params.id);',
      "  await axios.post('https://billing.example.org/claims', { mrn: patient.mrn });",
      '  res.json(patient);',
      '}',
    ].join('\n') + '\n',
  );
  repo.commit('fixture');
  statement = (await buildAttestation({ path: repo.dir, enableAI: false }, clock)).statement;
}, 120_000);

afterAll(() => repo.cleanup());

describe('the premise: these two rules own §164.308(a)(1)(ii)(A) outright', () => {
  it('exactly HIPAA-ASSET-001 and HIPAA-FLOW-001 map to Risk Analysis', () => {
    const mapped = RULE_CATALOG
      .filter((r) => parseControlRefs(r.hipaaReference).some((c) => c.controlId === RISK_ANALYSIS))
      .map((r) => r.id)
      .sort();
    expect(mapped).toEqual(['HIPAA-ASSET-001', 'HIPAA-FLOW-001']);
  });
});

describe('#64 behaviour is preserved', () => {
  it('the artifacts stay out of ScanResult.findings', async () => {
    const result = await scan({ path: repo.dir, enableAI: false });
    const ids = result.findings.map((f) => f.canonicalRuleId);
    expect(ids).not.toContain('HIPAA-ASSET-001');
    expect(ids).not.toContain('HIPAA-FLOW-001');
  }, 120_000);

  it('they are still reported as informationalArtifacts for the JSON report', async () => {
    const result = await scan({ path: repo.dir, enableAI: false });
    const ids = (result.informationalArtifacts ?? []).map((a) => a.id).sort();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(['HIPAA-ASSET-001', 'HIPAA-FLOW-001']).toContain(id);
  }, 120_000);

  it('they are recorded in filtered so nothing detected disappears', async () => {
    const result = await scan({ path: repo.dir, enableAI: false });
    const lifted = (result.filtered ?? []).filter((e) => e.reason === 'informational-artifact');
    expect(lifted.length).toBeGreaterThan(0);
    for (const e of lifted) {
      expect(['HIPAA-ASSET-001', 'HIPAA-FLOW-001']).toContain(e.finding.canonicalRuleId);
    }
  }, 120_000);
});

describe('they enter the attestation as informational', () => {
  it('both appear with disposition "informational"', () => {
    for (const ruleId of ['HIPAA-ASSET-001', 'HIPAA-FLOW-001']) {
      const f = statement.predicate.findings.find((x) => x.ruleId === ruleId);
      expect(f, `${ruleId} missing from the attestation`).toBeDefined();
      expect(f!.disposition).toBe('informational');
    }
  });

  it('they are inert: policyEffect none, not blocking, repository scope', () => {
    const informational = statement.predicate.findings.filter((f) => f.disposition === 'informational');
    expect(informational.length).toBeGreaterThan(0);
    for (const f of informational) {
      expect(f.policyEffect).toBe('none');
      expect(f.blocking).toBe(false);
      expect(f.evidenceScope).toBe('repository');
    }
  });

  it('the summary counts them separately, and they never count as blocking', () => {
    const informational = statement.predicate.findings.filter((f) => f.disposition === 'informational');
    expect(statement.predicate.summary.informational).toBe(informational.length);
    expect(statement.predicate.summary.informational).toBeGreaterThan(0);
    // The fixture also contains real code violations, so `blocking` is non-zero.
    // What matters is that no informational finding is among them.
    const blocking = statement.predicate.findings.filter((f) => f.policyEffect === 'blocking');
    for (const f of blocking) expect(f.disposition).not.toBe('informational');
  });

  it('they carry no source code or absolute paths', () => {
    const serialized = JSON.stringify(statement.predicate.findings.filter((f) => f.disposition === 'informational'));
    expect(serialized).not.toContain('SELECT * FROM');
    expect(serialized).not.toContain('/Users/');
    expect(serialized).not.toContain('/private/var');
  });
});

// --- THE LOAD-BEARING ASSERTION ---------------------------------------------

describe('§164.308(a)(1)(ii)(A) Risk Analysis is NOT evaluated by documentation', () => {
  it('resolves to not_evaluated when its only evidence is informational', () => {
    const control = statement.predicate.controls.find((c) => c.control.controlId === RISK_ANALYSIS);
    expect(control, 'Risk Analysis control missing from the attestation').toBeDefined();
    expect(control!.state).toBe('not_evaluated');
  });

  it('never reports no_blocking_findings for that control', () => {
    const control = statement.predicate.controls.find((c) => c.control.controlId === RISK_ANALYSIS)!;
    expect(control.state).not.toBe('no_blocking_findings');
  });

  it('reports zero adjudicable executed rules, listing the informational ones separately', () => {
    const control = statement.predicate.controls.find((c) => c.control.controlId === RISK_ANALYSIS)!;
    expect(control.evidence.rulesExecuted).toBe(0);
    expect(control.evidence.informationalOnlyRuleIds.sort()).toEqual([
      'HIPAA-ASSET-001',
      'HIPAA-FLOW-001',
    ]);
    // It DID have a rule universe — this is not a mapping gap, it is a coverage gap.
    expect(control.evidence.rulesInUniverse).toBe(2);
  });

  it('is listed among controlsNotEvaluated', () => {
    expect(statement.predicate.scope.coverage.controlsNotEvaluated).toContain(RISK_ANALYSIS);
  });

  it('therefore keeps the policy at review_required, not pass', () => {
    expect(statement.predicate.policy.reasons).toContain('control-not-evaluated');
    expect(statement.predicate.policy.conclusion).not.toBe('pass');
  });
});

describe('schema enforces the invariants independently of the builder', () => {
  it('rejects an informational finding with a release effect', () => {
    const s = makeStatement({
      predicate: makePredicate({
        findings: [makeFinding({ disposition: 'informational', policyEffect: 'blocking', blocking: true })],
      }),
    });
    const parsed = VlayerStatementV1Schema.safeParse(s);
    expect(parsed.success).toBe(false);
  });

  it('rejects an informational finding with code scope', () => {
    const s = makeStatement({
      predicate: makePredicate({
        findings: [
          makeFinding({ disposition: 'informational', policyEffect: 'none', blocking: false, evidenceScope: 'code' }),
        ],
      }),
    });
    expect(VlayerStatementV1Schema.safeParse(s).success).toBe(false);
  });

  it('rejects a control whose only executed rules are informational but is not not_evaluated', () => {
    const s = makeStatement({
      predicate: makePredicate({
        findings: [],
        controls: [
          makeControl({
            state: 'no_blocking_findings',
            evidence: {
              rulesInUniverse: 2,
              rulesExecuted: 0,
              executedRuleIds: [],
              informationalOnlyRuleIds: ['HIPAA-ASSET-001', 'HIPAA-FLOW-001'],
              sources: [],
            },
            findings: { total: 0, active: 0, blocking: 0, reviewRequired: 0, exceptions: 0, lowConfidence: 0, lapsed: 0, informational: 2 },
            fingerprints: [],
          }),
        ],
      }),
    });
    const parsed = VlayerStatementV1Schema.safeParse(s);
    expect(parsed.success).toBe(false);
  });
});

describe('precedence: informational is terminal', () => {
  const base = {
    id: 'HIPAA-ASSET-001',
    canonicalRuleId: 'HIPAA-ASSET-001',
    category: 'access-control' as const,
    severity: 'info' as const,
    title: 'T',
    description: 'D',
    file: 'ASSET-INVENTORY',
    recommendation: 'R',
  };

  it('outranks every other adjudication', () => {
    const r = adjudicate(
      {
        ...base,
        suppressed: true,
        suppression: { reason: 'r', comment: 'c' },
        isBaseline: true,
        belowMinConfidence: true,
      },
      'informational-artifact',
    );
    expect(r.disposition).toBe('informational');
    expect(r.dispositionReason).toBe('informational-artifact');
  });

  it('does not shadow an AI false positive on a different finding', () => {
    expect(adjudicate({ ...base }, 'ai-false-positive').disposition).toBe('false_positive');
  });

  it('an unfiltered finding is unaffected', () => {
    expect(adjudicate({ ...base }, null).disposition).toBe('active');
  });
});
