/**
 * VLayer Attestation V1 — type model.
 *
 * TWO LAYERS, kept strictly separate:
 *
 *   A. VLayer semantic attestation — the in-toto Statement v1 JSON written to
 *      `.vlayer/attestation.json`. This is the evidence object. It is complete
 *      and meaningful with no signature at all.
 *
 *   B. Sigstore cryptographic proof — a bundle in
 *      `.vlayer/attestation.sigstore.json` that signs the EXACT canonical bytes
 *      of (A). There is no second semantic envelope; DSSE is not used.
 *
 * WHAT THIS MODEL GUARANTEES
 *   - Nothing detected is ever discarded. A finding the AI classified as a
 *     false positive is still present, with `disposition: 'false_positive'`.
 *   - Rule identity is DECLARED by the emitting scanner, never inferred from a
 *     display id. Unknown stays unknown.
 *   - A control is only reported as `no_blocking_findings` when execution
 *     evidence proves its rules actually ran. Absence of findings is never
 *     evidence of coverage.
 *   - No source code, PHI, secret, credential, absolute path, git credential,
 *     or raw model reasoning can appear: the shareable types declare no field
 *     capable of carrying them.
 */

import type { ComplianceCategory, Confidence, Severity } from '../types.js';

// ---------------------------------------------------------------------------
// Adjudication
// ---------------------------------------------------------------------------

/**
 * What was decided about a finding. Exactly one value per finding, resolved by
 * the deterministic precedence ladder in `evaluate.ts`.
 *
 * `low_confidence` is deliberately DISTINCT from `baseline`:
 *   baseline        = accepted historical debt; a human put it in the baseline
 *                     file and removes it by editing that file.
 *   low_confidence  = the detector is not confident enough to assert this at
 *                     the configured --min-confidence threshold; it flips the
 *                     moment the threshold changes.
 * Collapsing the two (as the legacy scan pipeline does, by setting
 * `isBaseline: true` for both) destroys that distinction. The evidence model
 * must not repeat it.
 *
 * `remediated` is RESERVED for M2 cross-release diffing and is never emitted
 * in M1 — M1 evaluates a single release and cannot prove remediation.
 */
export type FindingDisposition =
  | 'active'
  | 'false_positive'
  | 'suppressed'
  | 'exception'
  | 'acknowledged'
  | 'baseline'
  | 'low_confidence'
  | 'remediated';

/** Where a canonical rule id came from, or why there isn't one. */
export type RuleSource = 'builtin' | 'custom' | 'unresolved' | 'unknown';

/** How a finding was produced. */
export type DetectorSource = 'pattern' | 'ai' | 'custom';

/** AI triage verdict, mirrored from `src/ai/rules/types.ts`. */
export type TriageClassification = 'confirmed' | 'likely' | 'possible' | 'false_positive';

/**
 * Detection quality — a property of the DETECTOR, orthogonal to adjudication.
 * Travels with every evaluation regardless of disposition, so a blocking
 * finding still publishes its confidence.
 */
export interface DetectionQuality {
  /** Confidence assigned by semantic analysis, if any. */
  semanticConfidence: Confidence | null;
  /** The configured --min-confidence gate for this scan, if any. */
  minConfidenceThreshold: Confidence | null;
  /** True when this finding sits below the configured threshold. */
  belowThreshold: boolean;
  /**
   * False when AI influenced this evaluation (an AI triage classification was
   * applied). A deterministic evaluation is reproducible from the commit alone.
   */
  deterministic: boolean;
}

/** AI triage provenance. The reasoning PROSE is never stored — only its digest. */
export interface AiTriageRecord {
  classification: TriageClassification;
  /** Confidence as an INTEGER per mille (0–1000). Canonical JSON forbids floats. */
  confidencePermille: number;
  /** SHA-256 of the model's reasoning text. The text itself may quote source. */
  reasoningDigest: string;
  model: string;
}

/**
 * A human adjudication. Free-text fields written by users (`reason`,
 * suppression `comment`) can quote code or patient context, so only their
 * digests are recorded.
 */
export type AdjudicationRecord =
  | { kind: 'suppressed'; reasonDigest: string }
  | {
      kind: 'exception';
      byDigest: string;
      at: string;
      expiresAt: string;
      ticketUrl?: string;
      reasonDigest: string;
    }
  | {
      kind: 'acknowledged';
      byDigest: string;
      at: string;
      ticketUrl?: string;
      reasonDigest: string;
    };

/**
 * A lapsed adjudication. An EXPIRED acknowledgment is not a disposition — it is
 * a lapse. It does not confer `acknowledged` or `exception`; the finding falls
 * through the ladder (typically to `active`), and this record explains why it
 * re-armed.
 *
 * This is a deliberate divergence from `buildReport()`, whose `newFindings`
 * filter tests `!f.acknowledged` without consulting `acknowledgment.expired`
 * and therefore lets an expired acknowledgment suppress a finding forever.
 * That legacy behavior is preserved for backwards compatibility; the
 * attestation does not reproduce it.
 */
export interface LapsedRecord {
  kind: 'acknowledgment';
  expiredAt: string;
  byDigest: string;
  ticketUrl?: string;
}

/**
 * What KIND of evidence a finding rests on.
 *
 *   code       — a specific defect at a specific line of source.
 *   repository — an absence observed about the repository or its process
 *                (no vulnerability-scanning config, no logging framework in the
 *                manifest, no asset inventory). There is no line to fix.
 *
 * Derived generally from whether the finding can point at a code location, NOT
 * from a list of rule ids. A finding that cannot name a line is not a code
 * defect.
 */
export type EvidenceScope = 'code' | 'repository';

/**
 * What a finding does to a RELEASE decision.
 *
 * SEVERITY IS NOT POLICY EFFECT. Severity states how serious the underlying
 * issue is; policy effect states what should happen to this release. A missing
 * vulnerability-scanning process is genuinely high severity and must stay
 * visible at that severity — but it is a standing process gap, not a defect
 * introduced by this commit, so automatically failing every release on it would
 * make the gate meaningless and train people to ignore it.
 *
 *   blocking        — fails the release.
 *   review_required — must be looked at; does not auto-fail a release.
 *   none            — adjudicated, or below the reporting threshold.
 */
export type PolicyEffect = 'blocking' | 'review_required' | 'none';

/** Where a finding sits. `project` findings are repository-wide, not file-anchored. */
export interface FindingLocation {
  /** Repository-relative POSIX path. Null for project-level findings. */
  path: string | null;
  line: number | null;
  kind: 'file' | 'project';
}

/** A normalized technical-control reference. */
export interface ControlRef {
  framework: 'hipaa';
  /** Normalized identifier, e.g. "164.312(b)". */
  controlId: string;
  /** The raw reference text as the rule declared it, preserved as provenance. */
  rawReference: string;
  /** True when the reference cites a proposed rule (NPRM) rather than current law. */
  proposed: boolean;
}

/**
 * One evaluated finding. Contains NO title, description, recommendation,
 * context, or snippet — the shareable attestation declares no field capable of
 * carrying source code. This is structural, not a filter that could be
 * bypassed.
 */
export interface FindingEvaluation {
  /** Structural, line-independent identity. The cross-release continuity key. */
  fingerprint: string;
  /** Exact-site identity (rule + path + line). */
  locationId: string;
  /** Legacy baseline hash recomputed over the RELATIVE path. */
  baselineHashRelative: string;
  /** Canonical rule id as DECLARED by the scanner. Null means unknown. */
  ruleId: string | null;
  ruleKnown: boolean;
  ruleSource: RuleSource;
  /** The raw Finding.id, for cross-referencing a scan report. */
  emittedId: string;
  location: FindingLocation;
  severity: Severity;
  category: ComplianceCategory;
  /** Empty array means UNMAPPED — never silently a pass. */
  controls: ControlRef[];
  detector: { scanner: string; source: DetectorSource };
  detection: DetectionQuality;
  aiTriage?: AiTriageRecord;
  adjudication?: AdjudicationRecord;
  lapsed?: LapsedRecord;
  disposition: FindingDisposition;
  /** Closed token set explaining the disposition. Never user free text. */
  dispositionReason: string;
  /** Whether this rests on code evidence or on a repository/process observation. */
  evidenceScope: EvidenceScope;
  /** What this finding does to the release decision. Distinct from `severity`. */
  policyEffect: PolicyEffect;
  /** Convenience mirror of `policyEffect === 'blocking'`. */
  blocking: boolean;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/**
 * What VLayer actually knows about a control. Deliberately avoids "compliant".
 *
 * `no_blocking_findings` means: the rules mapping to this control executed
 * within the evaluated scope and produced no blocking finding. It does NOT
 * mean the control is satisfied.
 */
export type ControlState =
  | 'not_evaluated'
  | 'blocking_findings'
  | 'review_required'
  | 'exception_present'
  | 'no_blocking_findings';

/** The evidence that a control was actually evaluated. */
export interface ControlEvidence {
  /** Catalog rules that map to this control. */
  rulesInUniverse: number;
  /** Of those, how many actually executed. ZERO forces `not_evaluated`. */
  rulesExecuted: number;
  executedRuleIds: string[];
  /**
   * Evidence classes contributing to this control. M1 is code/repository
   * evidence only; cloud/identity/runtime collectors attach here in M4+.
   */
  sources: Array<{ kind: 'static-analysis'; assurance: 'AUTOMATED_VERIFIED' }>;
}

export interface ControlEvaluation {
  control: ControlRef | { framework: 'hipaa'; controlId: 'UNMAPPED'; rawReference: ''; proposed: false };
  state: ControlState;
  evidence: ControlEvidence;
  findings: {
    total: number;
    active: number;
    blocking: number;
    reviewRequired: number;
    exceptions: number;
    lowConfidence: number;
    lapsed: number;
  };
  fingerprints: string[];
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export type PolicyConclusion = 'pass' | 'fail' | 'review_required';

export interface PolicyResult {
  id: string;
  digest: string;
  conclusion: PolicyConclusion;
  /** Closed-vocabulary reasons, in deterministic order. */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Target / verifier / scope
// ---------------------------------------------------------------------------

/** How the immutable source snapshot was digested. */
export type SourceDigestMethod = 'git-tree-sha1' | 'vlayer-worktree-sha256-v1';

/** Whether a git host is a public forge or private infrastructure. */
export type RepositoryHostClass = 'public-forge' | 'private' | 'unknown';

export interface AttestationTarget {
  /**
   * Sanitized `<host>/<path>` for allowlisted public forges, else null.
   * NEVER a raw remote URL: credentials, tokens, query strings, fragments and
   * private hostnames are dropped at parse time, and a non-allowlisted host is
   * redacted entirely.
   */
  repository: string | null;
  repositoryHostClass: RepositoryHostClass;
  /**
   * SHA-256 over the canonical repository form. Lets an external reviewer
   * correlate releases of the same repository over time without learning its
   * identity. Present even when `repository` is null.
   */
  repositoryDigest: string | null;
  commit: string;
  tree: string;
  branch: string | null;
  dirty: boolean;
  sourceDigest: string;
  sourceDigestMethod: SourceDigestMethod;
}

/**
 * AI triage provenance for the whole run.
 *
 * AI triage is NOT reproducible: sampling, model updates, timeouts and the
 * per-scan cap all mean a re-run may classify differently. An attestation with
 * AI applied must not imply every adjudication can be independently
 * reproduced, so `reproducible` is literally false whenever `applied` is true.
 */
export interface AiTriageProvenance {
  enabled: boolean;
  applied: boolean;
  model: string | null;
  findingsSubmitted: number;
  /** Beyond the per-scan cap: regex-flagged only, NOT AI-verified. */
  findingsCapped: number;
  findingsFailed: number;
  reproducible: boolean;
}

export interface AttestationVerifier {
  name: 'vlayer';
  /** From package.json — the single source of version truth. */
  version: string;
  ruleCatalogDigest: string;
  ruleCatalogRuleCount: number;
  /** Present only when custom rules were loaded. */
  customRulesDigest?: string;
  aiTriage: AiTriageProvenance;
}

/** Per-scanner execution evidence. */
export interface ScannerExecution {
  key: string;
  category: ComplianceCategory;
  invoked: boolean;
  /**
   * Files this scanner was eligible to inspect. Null when the scanner cannot
   * report it — which forces dependent controls to `not_evaluated`, the safe
   * direction.
   */
  filesConsidered: number | null;
}

/** Published coverage, including the gaps. */
export interface AttestationCoverage {
  scanners: ScannerExecution[];
  rulesInCatalog: number;
  rulesExecuted: number;
  /** Catalog rules carrying no parseable control reference. Published, not hidden. */
  rulesWithoutControlMapping: number;
  controlsEvaluated: number;
  controlsNotEvaluated: string[];
  customRulesExecuted: number;
}

export interface AttestationScope {
  framework: 'hipaa';
  /** Always true in M1: the evidence is technical/software only. */
  technicalOnly: true;
  categories: ComplianceCategory[];
  filesScanned: number;
  /** M1 evidence is automated static analysis of a repository. */
  evidenceClass: 'AUTOMATED_VERIFIED';
  /**
   * 'deterministic' when AI triage was not applied — the strongest
   * reproducibility mode. 'ai-assisted' otherwise.
   */
  reproducibility: 'deterministic' | 'ai-assisted';
  /** Explicit statements of what this attestation does not cover. */
  limitations: string[];
  /** Execution evidence and the published coverage gaps. */
  coverage: AttestationCoverage;
}

/** The categories a scan requested. */
export type ComplianceCategoryList = ComplianceCategory[];

export interface AttestationSummary {
  filesScanned: number;
  detected: number;
  active: number;
  falsePositives: number;
  acknowledged: number;
  suppressed: number;
  baseline: number;
  lowConfidence: number;
  exceptions: number;
  lapsed: number;
  blocking: number;
  reviewRequired: number;
  unknownRules: number;
  unmappedControls: number;
  controlsNotEvaluated: number;
}

// ---------------------------------------------------------------------------
// Predicate + Statement
// ---------------------------------------------------------------------------

export const VLAYER_PREDICATE_TYPE =
  'https://vlayer.app/attestation/technical-compliance/v1' as const;

export const IN_TOTO_STATEMENT_TYPE = 'https://in-toto.io/Statement/v1' as const;

export const VLAYER_PREDICATE_SCHEMA_VERSION = '1.0.0' as const;

export interface VlayerPredicateV1 {
  schemaVersion: typeof VLAYER_PREDICATE_SCHEMA_VERSION;
  generatedAt: string;
  target: AttestationTarget;
  verifier: AttestationVerifier;
  scope: AttestationScope;
  policy: PolicyResult;
  summary: AttestationSummary;
  controls: ControlEvaluation[];
  findings: FindingEvaluation[];
}

/** in-toto Statement v1 subject. */
export interface StatementSubject {
  name: string;
  digest: Record<string, string>;
}

export interface VlayerStatementV1 {
  _type: typeof IN_TOTO_STATEMENT_TYPE;
  subject: StatementSubject[];
  predicateType: typeof VLAYER_PREDICATE_TYPE;
  predicate: VlayerPredicateV1;
}

// ---------------------------------------------------------------------------
// Verification result
// ---------------------------------------------------------------------------

export type SchemaVerdict = 'valid' | 'invalid';
export type SubjectVerdict = 'valid' | 'mismatch' | 'not_checked';
export type SignatureVerdict =
  | 'not_provided'
  | 'valid'
  | 'invalid'
  | 'not_verifiable';

export interface VerificationResult {
  schema: SchemaVerdict;
  schemaErrors: string[];
  subject: SubjectVerdict;
  subjectDetail: string | null;
  signature: SignatureVerdict;
  signatureDetail: string | null;
  /** Identity bound by the signature, only when signature === 'valid'. */
  signerIdentity: string | null;
  policy: PolicyConclusion | null;
  policyReasons: string[];
}
