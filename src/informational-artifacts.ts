/**
 * Rules whose output is generated DOCUMENTATION rather than a compliance
 * violation: the ePHI asset inventory and the PHI data-flow map.
 *
 * `scan()` lifts their findings out of `findings[]` so they never count toward
 * stats or the unacknowledged total, and records them in `ScanResult.filtered`
 * so the evidence model can still account for them.
 *
 * This list is a property of the RULES, not of any particular scan. That
 * distinction is load-bearing for control coverage: a rule that is
 * informational by nature contributes no evaluation evidence even when it
 * emits nothing at all. Deriving the set from "which rules happened to produce
 * an informational finding" would let a rule that stayed silent count as real
 * coverage — and HIPAA-ASSET-001 and HIPAA-FLOW-001 are the ONLY two catalog
 * rules mapping to 45 CFR §164.308(a)(1)(ii)(A) (Risk Analysis), so that would
 * make Risk Analysis report "evaluated, nothing blocking" on the strength of an
 * inventory that was never even generated.
 *
 * Ids are CANONICAL rule ids (`Finding.canonicalRuleId`), never display ids.
 */
export const INFORMATIONAL_ARTIFACT_RULE_IDS: ReadonlySet<string> = new Set([
  'HIPAA-ASSET-001',
  'HIPAA-FLOW-001',
]);

/** Whether a canonical rule id produces documentation rather than findings. */
export function isInformationalArtifactRule(canonicalRuleId: string | null | undefined): boolean {
  return canonicalRuleId !== null && canonicalRuleId !== undefined
    && INFORMATIONAL_ARTIFACT_RULE_IDS.has(canonicalRuleId);
}
