/**
 * VLayer Attestation V1 — public surface.
 *
 * A VLayer attestation is an in-toto Statement v1 document that records, for one
 * exact commit: which technical controls were evaluated, what evidence was
 * considered, what was detected, what happened to each finding, which exceptions
 * remain, and what technical policy conclusion follows.
 *
 * It does NOT certify HIPAA compliance and does not replace a HIPAA audit.
 */

export { buildAttestation, AttestationValidationError } from './build.js';
export type {
  BuildAttestationOptions,
  BuildAttestationDeps,
  BuildAttestationResult,
} from './build.js';

export { verifyAttestation, verifyExitCode } from './verify.js';
export type { VerifyOptions, VerifyOutcome } from './verify.js';

export { signAttestation, SigningUnavailableError, DirtySigningError } from './sign.js';

export {
  getGitTarget,
  sanitizeRepositoryUrl,
  NotAGitRepositoryError,
  DirtyWorkingTreeError,
} from './git.js';

export { ruleCatalogDigest, ruleCatalogRuleCount, customRulesDigest } from './catalog-digest.js';
export { evaluateFindings, adjudicate, resolveRuleIdentity } from './evaluate.js';
export { evaluatePolicy, policyDigest, DEFAULT_POLICY_ID } from './policy.js';
export {
  parseControlRefs,
  buildRuleControlIndex,
  evaluateControls,
  computeExecutedRuleIds,
} from './control-mapping.js';
export { computeFindingIdentity } from './fingerprint.js';
export { canonicalize, canonicalBytes } from './canonical.js';

export { VlayerStatementV1Schema, VlayerPredicateV1Schema, formatSchemaErrors } from './schema.js';

export {
  VLAYER_PREDICATE_TYPE,
  VLAYER_PREDICATE_SCHEMA_VERSION,
  IN_TOTO_STATEMENT_TYPE,
} from './types.js';
export type {
  VlayerStatementV1,
  VlayerPredicateV1,
  FindingEvaluation,
  FindingDisposition,
  ControlEvaluation,
  ControlState,
  ControlRef,
  PolicyConclusion,
  PolicyResult,
  AttestationTarget,
  AttestationScope,
  AttestationSummary,
  AttestationVerifier,
  VerificationResult,
} from './types.js';
