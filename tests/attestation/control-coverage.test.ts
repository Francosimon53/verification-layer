import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname, resolve } from 'path';
import {
  parseControlRefs,
  buildRuleControlIndex,
  controlsForRule,
  evaluateControls,
  computeExecutedRuleIds,
} from '../../src/attestation/control-mapping.js';
import { scan, KNOWN_SCANNER_KEYS } from '../../src/scan.js';
import { RULE_CATALOG } from '../../src/rules/catalog.js';
import { makeConsistentFinding as makeFinding } from './fixtures.js';

describe('control reference normalization', () => {
  it('normalizes every reference shape present in the catalog', () => {
    expect(parseControlRefs('45 CFR §164.312(b) - Audit Controls')[0].controlId).toBe('164.312(b)');
    expect(parseControlRefs('§164.312(b)')[0].controlId).toBe('164.312(b)');
    expect(parseControlRefs('§164.312(a)(2)(iv)')[0].controlId).toBe('164.312(a)(2)(iv)');
    expect(parseControlRefs('45 CFR §164.308(a)(1)(ii)(A) - Risk Analysis (Required)')[0].controlId)
      .toBe('164.308(a)(1)(ii)(A)');
  });

  it('extracts multiple references from one string', () => {
    const refs = parseControlRefs('§164.312(a)(2)(iv), §164.312(e)(2)(ii)');
    expect(refs.map((r) => r.controlId)).toEqual(['164.312(a)(2)(iv)', '164.312(e)(2)(ii)']);
  });

  it('preserves the raw reference as provenance', () => {
    const raw = '45 CFR §164.312(b) - Audit Controls';
    expect(parseControlRefs(raw)[0].rawReference).toBe(raw);
  });

  it('flags NPRM citations as proposed rather than current law', () => {
    const refs = parseControlRefs('NPRM §164.308(a)(3)(ii)(C) - Access Revocation');
    expect(refs[0].controlId).toBe('164.308(a)(3)(ii)(C)');
    expect(refs[0].proposed).toBe(true);
    expect(parseControlRefs('§164.312(b)')[0].proposed).toBe(false);
  });

  it('leaves an unparseable reference UNMAPPED rather than inventing one', () => {
    expect(parseControlRefs('NPRM Anti-malware')).toEqual([]);
    expect(parseControlRefs('NPRM Configuration Management')).toEqual([]);
    expect(parseControlRefs(undefined)).toEqual([]);
    expect(parseControlRefs('')).toEqual([]);
  });

  it('never fabricates a mapping for an unknown rule', () => {
    const index = buildRuleControlIndex();
    expect(controlsForRule(index, null)).toEqual([]);
    expect(controlsForRule(index, 'no-such-rule-id')).toEqual([]);
  });

  it('publishes the real number of catalog rules with no control mapping', () => {
    const index = buildRuleControlIndex();
    const manual = RULE_CATALOG.filter((r) => parseControlRefs(r.hipaaReference).length === 0).length;
    expect(index.rulesWithoutMapping).toBe(manual);
    // This is a real coverage hole; the point is that it is measured, not hidden.
    expect(index.rulesWithoutMapping).toBeGreaterThan(0);
  });
});

describe('scanner keys match the rule catalog', () => {
  it('every executable scanner key exists in RULE_CATALOG.scanner', () => {
    const catalogScanners = new Set(RULE_CATALOG.map((r) => r.scanner));
    const unknown = KNOWN_SCANNER_KEYS.filter((k) => !catalogScanners.has(k));
    expect(unknown, `scanner keys absent from the catalog: ${unknown.join(', ')}`).toEqual([]);
  });
});

describe('control state decision table', () => {
  const index = buildRuleControlIndex();

  function evaluate(
    findings: ReturnType<typeof makeFinding>[],
    executed: Set<string>,
  ) {
    return evaluateControls({ index, evaluations: findings, executedRuleIds: executed });
  }

  it('reports not_evaluated when zero rules executed, even with zero findings', () => {
    const results = evaluate([], new Set());
    const evaluated = results.filter((c) => c.state !== 'not_evaluated');
    expect(evaluated).toEqual([]);
    expect(results.length).toBeGreaterThan(0);
    for (const c of results) expect(c.evidence.rulesExecuted).toBe(0);
  });

  it('NEVER reports no_blocking_findings for a control whose rules did not run', () => {
    const results = evaluate([], new Set());
    expect(results.some((c) => c.state === 'no_blocking_findings')).toBe(false);
  });

  it('reports no_blocking_findings only when rules executed and nothing blocks', () => {
    const executed = computeExecutedRuleIds(
      [{ key: 'audit', invoked: true, filesConsidered: 5 }],
      [],
    );
    const results = evaluate([], executed);
    const auditControl = results.find((c) => c.control.controlId === '164.312(b)');
    expect(auditControl?.state).toBe('no_blocking_findings');
    expect(auditControl!.evidence.rulesExecuted).toBeGreaterThan(0);
    expect(auditControl!.evidence.sources).toEqual([
      { kind: 'static-analysis', assurance: 'AUTOMATED_VERIFIED' },
    ]);
  });

  it('reports blocking_findings when an active blocking finding exists', () => {
    const executed = computeExecutedRuleIds([{ key: 'audit', invoked: true, filesConsidered: 5 }], []);
    const f = makeFinding({
      controls: [{ framework: 'hipaa', controlId: '164.312(b)', rawReference: '§164.312(b)', proposed: false }],
      disposition: 'active',
      policyEffect: 'blocking',
    });
    const c = evaluate([f], executed).find((x) => x.control.controlId === '164.312(b)')!;
    expect(c.state).toBe('blocking_findings');
  });

  it('reports review_required for a lapsed adjudication', () => {
    const executed = computeExecutedRuleIds([{ key: 'audit', invoked: true, filesConsidered: 5 }], []);
    const f = makeFinding({
      controls: [{ framework: 'hipaa', controlId: '164.312(b)', rawReference: '§164.312(b)', proposed: false }],
      disposition: 'baseline',
      policyEffect: 'none',
      lapsed: { kind: 'acknowledgment', expiredAt: '2020-01-01', by: 'Security Team' },
    });
    const c = evaluate([f], executed).find((x) => x.control.controlId === '164.312(b)')!;
    expect(c.state).toBe('review_required');
  });

  it('reports review_required for a low_confidence finding', () => {
    const executed = computeExecutedRuleIds([{ key: 'audit', invoked: true, filesConsidered: 5 }], []);
    const f = makeFinding({
      controls: [{ framework: 'hipaa', controlId: '164.312(b)', rawReference: '§164.312(b)', proposed: false }],
      disposition: 'low_confidence',
      policyEffect: 'none',
    });
    const c = evaluate([f], executed).find((x) => x.control.controlId === '164.312(b)')!;
    expect(c.state).toBe('review_required');
  });

  it('reports exception_present for an unexpired exception', () => {
    const executed = computeExecutedRuleIds([{ key: 'audit', invoked: true, filesConsidered: 5 }], []);
    const f = makeFinding({
      controls: [{ framework: 'hipaa', controlId: '164.312(b)', rawReference: '§164.312(b)', proposed: false }],
      disposition: 'exception',
      policyEffect: 'none',
    });
    const c = evaluate([f], executed).find((x) => x.control.controlId === '164.312(b)')!;
    expect(c.state).toBe('exception_present');
  });

  it('collects unmapped findings under UNMAPPED, never as a pass', () => {
    const executed = computeExecutedRuleIds([{ key: 'phi', invoked: true, filesConsidered: 3 }], []);
    const f = makeFinding({ controls: [], ruleKnown: false, ruleId: null, ruleSource: 'unknown', policyEffect: 'none', disposition: 'baseline' });
    const unmapped = evaluate([f], executed).find((c) => c.control.controlId === 'UNMAPPED')!;
    expect(unmapped).toBeDefined();
    expect(unmapped.state).not.toBe('no_blocking_findings');
    expect(unmapped.state).toBe('review_required');
  });
});

describe('execution evidence — computeExecutedRuleIds', () => {
  it('proves rules executed only when a scanner saw eligible files', () => {
    const none = computeExecutedRuleIds([{ key: 'phi', invoked: true, filesConsidered: 0 }], []);
    expect(none.size).toBe(0);
    const some = computeExecutedRuleIds([{ key: 'phi', invoked: true, filesConsidered: 4 }], []);
    expect(some.size).toBe(RULE_CATALOG.filter((r) => r.scanner === 'phi').length);
  });

  it('treats a scanner that cannot report file counts as UNPROVEN', () => {
    expect(computeExecutedRuleIds([{ key: 'phi', invoked: true, filesConsidered: null }], []).size).toBe(0);
  });

  it('treats a scanner that was never invoked as unproven', () => {
    expect(computeExecutedRuleIds([{ key: 'phi', invoked: false, filesConsidered: 10 }], []).size).toBe(0);
  });

  it('namespaces custom rules', () => {
    expect([...computeExecutedRuleIds([], ['my-rule'])]).toEqual(['custom:my-rule']);
  });
});

// --- The load-bearing integration test: coverage must follow real files ---

const dir = mkdtempSync(join(tmpdir(), 'vlayer-coverage-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function write(rel: string, content: string) {
  const target = resolve(dir, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf-8');
}

describe('coverage is evidence-based, not inferred from absence of findings', () => {
  it('a repo with no code files leaves PHI controls not_evaluated', async () => {
    // Only a .txt file: the PHI scanner accepts none of it.
    write('notes.txt', 'no code here at all\n');
    const result = await scan({ path: dir, enableAI: false });
    const phi = result.execution!.scanners.find((s) => s.key === 'phi')!;
    expect(phi.invoked).toBe(true);
    expect(phi.filesConsidered).toBe(0);

    const executed = computeExecutedRuleIds(result.execution!.scanners, []);
    const phiRules = RULE_CATALOG.filter((r) => r.scanner === 'phi').map((r) => r.id);
    for (const id of phiRules) expect(executed.has(id)).toBe(false);
  }, 60_000);

  it('adding an eligible file makes the same scanner report real coverage', async () => {
    write('src/app.ts', 'export const ok = true;\n');
    const result = await scan({ path: dir, enableAI: false });
    const phi = result.execution!.scanners.find((s) => s.key === 'phi')!;
    expect(phi.filesConsidered).toBeGreaterThan(0);

    const executed = computeExecutedRuleIds(result.execution!.scanners, []);
    expect(executed.size).toBeGreaterThan(0);
  }, 60_000);
});
