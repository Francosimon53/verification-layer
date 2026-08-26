/**
 * The VLayer default technical policy.
 *
 * A policy PASS means exactly one thing:
 *   "The evaluated release satisfies the configured VLayer technical policy
 *    within the evidence scope evaluated."
 * It does NOT mean the organization is HIPAA compliant, that a control is
 * satisfied, or that anything has been certified.
 *
 * NO EVIDENCE IS NOT A PASS. A control whose rules did not execute forces
 * `review_required`, so a repository vlayer could barely inspect can never
 * produce a clean conclusion by default.
 *
 * COMPATIBILITY NOTE. This deliberately disagrees with `vlayer scan`'s exit
 * code, which returns 1 whenever any critical GROUP exists — including one that
 * is fully acknowledged, suppressed or baselined. The policy operates on ACTIVE
 * findings only. Both gates are kept: `scan` is unchanged for backwards
 * compatibility, and the divergence is documented in docs/ATTESTATIONS.md.
 *
 * M1 ships this single fixed policy. A policy DSL is deliberately out of scope.
 */

import { createHash } from 'crypto';
import { canonicalize } from './canonical.js';
import type {
  ControlEvaluation,
  FindingEvaluation,
  PolicyConclusion,
  PolicyResult,
} from './types.js';

export const DEFAULT_POLICY_ID = 'vlayer-default-technical-v1';

/**
 * The policy AS DATA, so its digest is a genuine commitment to the rules that
 * were applied rather than to a version string someone could forget to bump.
 */
export const DEFAULT_POLICY_DEFINITION = {
  id: DEFAULT_POLICY_ID,
  version: 1,
  description:
    'VLayer default technical-control policy. Evaluates ACTIVE findings and control evaluation evidence only.',
  rules: [
    { when: 'finding-policy-effect', effect: 'blocking', conclusion: 'fail' },
    { when: 'finding-policy-effect', effect: 'review_required', conclusion: 'review_required' },
    { when: 'lapsed-adjudication', conclusion: 'review_required' },
    { when: 'open-exception', conclusion: 'review_required' },
    { when: 'control-not-evaluated', conclusion: 'review_required' },
    { when: 'unknown-rule-identity', conclusion: 'review_required' },
    { when: 'otherwise', conclusion: 'pass' },
  ],
  policyEffect: {
    description:
      'Severity states how serious an issue is; policy effect states what it does to a release. They are separate.',
    derivation: [
      { when: 'disposition is not active', effect: 'none' },
      { when: 'evidenceScope is repository', effect: 'review_required' },
      { when: 'evidenceScope is code and severity is critical or high', effect: 'blocking' },
      { when: 'evidenceScope is code and severity is medium', effect: 'review_required' },
      { when: 'evidenceScope is code and severity is low or info', effect: 'none' },
    ],
  },
  notes: [
    'Active low and info code findings do not block.',
    'Repository/process observations require review and never auto-fail a release; they remain reported at their real severity.',
    'A policy pass is not a statement of HIPAA compliance.',
    'Absence of evidence is never treated as a pass.',
  ],
} as const;

/** SHA-256 over the canonicalized policy definition. */
export function policyDigest(): string {
  return createHash('sha256')
    .update(canonicalize(DEFAULT_POLICY_DEFINITION as never), 'utf-8')
    .digest('hex');
}

const RANK: Record<PolicyConclusion, number> = { pass: 0, review_required: 1, fail: 2 };

function worst(a: PolicyConclusion, b: PolicyConclusion): PolicyConclusion {
  return RANK[b] > RANK[a] ? b : a;
}

export interface PolicyInput {
  findings: FindingEvaluation[];
  controls: ControlEvaluation[];
}

/**
 * Evaluate the default policy.
 *
 * `reasons` uses a closed vocabulary in deterministic order — never user free
 * text, which could carry code or patient context into the attestation.
 */
export function evaluatePolicy(input: PolicyInput): PolicyResult {
  const { findings, controls } = input;
  const reasons = new Set<string>();
  let conclusion: PolicyConclusion = 'pass';

  // Read the finding's POLICY EFFECT, never its severity. Severity is preserved
  // and reported for actionability, but it does not by itself decide whether a
  // release is blocked — see `derivePolicyEffect` in evaluate.ts.
  const blocking = findings.filter((f) => f.policyEffect === 'blocking');
  const needsReview = findings.filter((f) => f.policyEffect === 'review_required');

  for (const severity of ['critical', 'high', 'medium', 'low', 'info'] as const) {
    if (blocking.some((f) => f.severity === severity)) {
      conclusion = worst(conclusion, 'fail');
      reasons.add(`blocking-${severity}`);
    }
  }

  if (needsReview.some((f) => f.evidenceScope === 'repository')) {
    conclusion = worst(conclusion, 'review_required');
    reasons.add('review-required-repository-scope');
  }
  if (needsReview.some((f) => f.evidenceScope === 'code')) {
    conclusion = worst(conclusion, 'review_required');
    reasons.add('review-required-code');
  }

  if (findings.some((f) => f.lapsed !== undefined)) {
    conclusion = worst(conclusion, 'review_required');
    reasons.add('lapsed-adjudication');
  }
  if (findings.some((f) => f.disposition === 'exception')) {
    conclusion = worst(conclusion, 'review_required');
    reasons.add('open-exception');
  }
  if (controls.some((c) => c.state === 'not_evaluated')) {
    conclusion = worst(conclusion, 'review_required');
    reasons.add('control-not-evaluated');
  }
  if (findings.some((f) => !f.ruleKnown)) {
    conclusion = worst(conclusion, 'review_required');
    reasons.add('unknown-rule-identity');
  }

  if (reasons.size === 0) reasons.add('no-blocking-or-review-conditions');

  return {
    id: DEFAULT_POLICY_ID,
    digest: policyDigest(),
    conclusion,
    reasons: [...reasons].sort(),
  };
}
