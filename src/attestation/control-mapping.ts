/**
 * Rule → technical control mapping, and evidence-based control state.
 *
 * TWO RULES THIS MODULE EXISTS TO ENFORCE:
 *
 *  1. NEVER FABRICATE A MAPPING. `hipaaReference` is free text in at least five
 *     incompatible shapes. What can be parsed is normalized and the raw text is
 *     preserved as provenance; what cannot is left UNMAPPED. An unmapped rule
 *     never silently becomes a pass.
 *
 *  2. NEVER INFER COVERAGE FROM ABSENCE OF FINDINGS. `no_blocking_findings`
 *     requires proof that the rules mapping to a control ACTUALLY EXECUTED
 *     within the evaluated scope. A scanner filters by extension, so a repo with
 *     no matching files means its rules did not run — and a control whose rules
 *     did not run is `not_evaluated`, no matter how few findings there are.
 *
 * The rule→control INDEX is built from `RULE_CATALOG.hipaaReference` only.
 * Building it from the references on findings that happened to fire would be
 * circular ("this control was evaluated because it produced a finding") and
 * would make coverage unfalsifiable. The consequence — 81 of 143 catalog rules
 * currently carry no reference — is published in `scope.coverage`, not hidden.
 */

import { RULE_CATALOG } from '../rules/catalog.js';
import type { ControlEvaluation, ControlRef, ControlState, FindingEvaluation } from './types.js';

/**
 * Extract normalized control ids from a raw `hipaaReference` string.
 *
 * Handles every shape observed in the catalog and the scanners:
 *   "45 CFR §164.312(b) - Audit Controls"            → 164.312(b)
 *   "§164.312(b)"                                     → 164.312(b)
 *   "NPRM §164.308(a)(3)(ii)(C) - Access Revocation"  → 164.308(a)(3)(ii)(C) (proposed)
 *   "§164.312(a)(2)(iv), §164.312(e)(2)(ii)"          → two refs
 *   "NPRM Anti-malware"                               → [] (unparseable, stays unmapped)
 */
export function parseControlRefs(rawReference: string | undefined | null): ControlRef[] {
  if (!rawReference) return [];
  const raw = rawReference.trim();
  if (raw.length === 0) return [];

  // A citation of a proposed rule is marked, never presented as current law.
  const proposed = /\bNPRM\b/i.test(raw);

  // Section number followed by any run of parenthesised subdivisions.
  const pattern = /\b(\d{3}\.\d{3})((?:\([a-zA-Z0-9]+\))*)/g;
  const refs: ControlRef[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    const controlId = `${match[1]}${match[2] ?? ''}`;
    if (seen.has(controlId)) continue;
    seen.add(controlId);
    refs.push({ framework: 'hipaa', controlId, rawReference: raw, proposed });
  }

  return refs;
}

export interface RuleControlIndex {
  /** Canonical rule id → the controls it targets. */
  byRule: Map<string, ControlRef[]>;
  /** Control id → the catalog rule ids that target it. */
  ruleUniverse: Map<string, Set<string>>;
  /** Catalog rules carrying no parseable control reference. */
  rulesWithoutMapping: number;
}

/** Build the rule→control index from the built-in catalog. */
export function buildRuleControlIndex(): RuleControlIndex {
  const byRule = new Map<string, ControlRef[]>();
  const ruleUniverse = new Map<string, Set<string>>();
  let rulesWithoutMapping = 0;

  for (const rule of RULE_CATALOG) {
    const refs = parseControlRefs(rule.hipaaReference);
    byRule.set(rule.id, refs);
    if (refs.length === 0) {
      rulesWithoutMapping += 1;
      continue;
    }
    for (const ref of refs) {
      if (!ruleUniverse.has(ref.controlId)) ruleUniverse.set(ref.controlId, new Set());
      ruleUniverse.get(ref.controlId)!.add(rule.id);
    }
  }

  return { byRule, ruleUniverse, rulesWithoutMapping };
}

/**
 * Controls for a finding's rule.
 *
 * Only the CATALOG mapping is authoritative. A finding's own `hipaaReference` is
 * used solely to preserve raw provenance when the rule is known but the catalog
 * carries no reference for it — and even then it yields controls only if it
 * parses. An unknown rule always yields [].
 */
export function controlsForRule(
  index: RuleControlIndex,
  ruleId: string | null,
  rawReferenceFromFinding?: string,
): ControlRef[] {
  if (!ruleId) return [];
  const fromCatalog = index.byRule.get(ruleId);
  if (fromCatalog && fromCatalog.length > 0) return fromCatalog;
  // The catalog has no reference for this rule. Fall back to the reference the
  // scanner emitted, which is real provenance from the same rule definition —
  // but this NEVER contributes to a control's rule universe, so it can only add
  // findings to a control, never manufacture coverage for one.
  return parseControlRefs(rawReferenceFromFinding);
}

export const UNMAPPED_CONTROL = {
  framework: 'hipaa' as const,
  controlId: 'UNMAPPED' as const,
  rawReference: '' as const,
  proposed: false as const,
};

export interface ControlEvaluationInput {
  index: RuleControlIndex;
  evaluations: FindingEvaluation[];
  /** Canonical rule ids proven to have executed in this scan. */
  executedRuleIds: Set<string>;
}

/**
 * THE DECISION TABLE. Evaluated in order; the first matching row wins.
 *
 *   1. zero executed rules            → not_evaluated       (checked FIRST)
 *   2. any active + blocking finding  → blocking_findings
 *   3. any lapse / active non-blocking / low-confidence finding → review_required
 *   4. any unexpired exception        → exception_present
 *   5. otherwise (executed, nothing above) → no_blocking_findings
 *
 * Row 1 is unconditional and first: the no-evidence-is-not-a-pass invariant is
 * structural, not a downstream filter. The schema enforces it a second time.
 */
function decideState(
  rulesExecuted: number,
  counts: {
    blocking: number;
    reviewRequired: number;
    lapsed: number;
    lowConfidence: number;
    exceptions: number;
  },
): ControlState {
  if (rulesExecuted === 0) return 'not_evaluated';
  // Driven by policy EFFECT, not by severity or by "is it active": a
  // repository/process observation is active and high severity yet must not put
  // a control into `blocking_findings`.
  if (counts.blocking > 0) return 'blocking_findings';
  if (counts.reviewRequired > 0 || counts.lapsed > 0 || counts.lowConfidence > 0) {
    return 'review_required';
  }
  if (counts.exceptions > 0) return 'exception_present';
  return 'no_blocking_findings';
}

/**
 * Evaluate every control the catalog knows about, plus the UNMAPPED
 * pseudo-control. Sorted by control id for byte-stable output.
 */
export function evaluateControls(input: ControlEvaluationInput): ControlEvaluation[] {
  const { index, evaluations, executedRuleIds } = input;

  // Findings grouped by the controls they touch.
  const byControl = new Map<string, FindingEvaluation[]>();
  const refByControl = new Map<string, ControlRef>();
  const unmapped: FindingEvaluation[] = [];

  for (const evaluation of evaluations) {
    if (evaluation.controls.length === 0) {
      unmapped.push(evaluation);
      continue;
    }
    for (const ref of evaluation.controls) {
      if (!byControl.has(ref.controlId)) byControl.set(ref.controlId, []);
      byControl.get(ref.controlId)!.push(evaluation);
      if (!refByControl.has(ref.controlId)) refByControl.set(ref.controlId, ref);
    }
  }

  // The universe of controls: every control the catalog targets, plus any
  // control a finding referenced. A catalog control with no findings still
  // appears — that is exactly how `not_evaluated` becomes visible.
  const controlIds = new Set<string>([...index.ruleUniverse.keys(), ...byControl.keys()]);

  const results: ControlEvaluation[] = [];

  for (const controlId of [...controlIds].sort()) {
    const universe = index.ruleUniverse.get(controlId) ?? new Set<string>();
    const executed = [...universe].filter((id) => executedRuleIds.has(id)).sort();
    const findings = byControl.get(controlId) ?? [];

    const counts = {
      total: findings.length,
      active: findings.filter((f) => f.disposition === 'active').length,
      blocking: findings.filter((f) => f.policyEffect === 'blocking').length,
      reviewRequired: findings.filter((f) => f.policyEffect === 'review_required').length,
      exceptions: findings.filter((f) => f.disposition === 'exception').length,
      lowConfidence: findings.filter((f) => f.disposition === 'low_confidence').length,
      lapsed: findings.filter((f) => f.lapsed !== undefined).length,
    };

    const ref = refByControl.get(controlId) ?? {
      framework: 'hipaa' as const,
      controlId,
      rawReference: '',
      proposed: false,
    };

    results.push({
      control: ref,
      state: decideState(executed.length, counts),
      evidence: {
        rulesInUniverse: universe.size,
        rulesExecuted: executed.length,
        executedRuleIds: executed,
        // M1 evidence is automated static analysis of a repository. Cloud,
        // identity and runtime collectors attach additional sources here in M4+.
        sources: executed.length > 0
          ? [{ kind: 'static-analysis' as const, assurance: 'AUTOMATED_VERIFIED' as const }]
          : [],
      },
      findings: counts,
      fingerprints: findings.map((f) => f.fingerprint).sort(),
    });
  }

  // The UNMAPPED pseudo-control. It is emitted only when something landed in it,
  // and it can NEVER be `no_blocking_findings` — an unknown mapping is not a pass.
  if (unmapped.length > 0) {
    const counts = {
      total: unmapped.length,
      active: unmapped.filter((f) => f.disposition === 'active').length,
      blocking: unmapped.filter((f) => f.policyEffect === 'blocking').length,
      reviewRequired: unmapped.filter((f) => f.policyEffect === 'review_required').length,
      exceptions: unmapped.filter((f) => f.disposition === 'exception').length,
      lowConfidence: unmapped.filter((f) => f.disposition === 'low_confidence').length,
      lapsed: unmapped.filter((f) => f.lapsed !== undefined).length,
    };
    const state: ControlState =
      counts.blocking > 0
        ? 'blocking_findings'
        : counts.exceptions > 0 &&
            counts.reviewRequired === 0 &&
            counts.lapsed === 0 &&
            counts.lowConfidence === 0
          ? 'exception_present'
          : 'review_required';

    results.push({
      control: UNMAPPED_CONTROL,
      state,
      evidence: {
        rulesInUniverse: 0,
        rulesExecuted: 0,
        executedRuleIds: [],
        sources: [],
      },
      findings: counts,
      fingerprints: unmapped.map((f) => f.fingerprint).sort(),
    });
  }

  return results;
}

/**
 * Canonical rule ids proven to have executed.
 *
 * A scanner evaluates ALL of its patterns against EVERY file it accepts, so
 * "the scanner ran on at least one eligible file" entails "its catalog rules
 * executed". A scanner that reports `filesConsidered: null` (no `selectFiles`)
 * is treated as NOT proven — the safe direction.
 */
export function computeExecutedRuleIds(
  scanners: Array<{ key: string; invoked: boolean; filesConsidered: number | null }>,
  customRuleIds: string[],
): Set<string> {
  const executedScanners = new Set(
    scanners
      .filter((s) => s.invoked && s.filesConsidered !== null && s.filesConsidered > 0)
      .map((s) => s.key),
  );

  const executed = new Set<string>();
  for (const rule of RULE_CATALOG) {
    if (executedScanners.has(rule.scanner)) executed.add(rule.id);
  }
  for (const id of customRuleIds) executed.add(`custom:${id}`);
  return executed;
}
