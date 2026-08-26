/**
 * Adjudication: turn a ScanResult into FindingEvaluation[].
 *
 * THE CENTRAL INVARIANT: nothing detected disappears. The legacy pipeline
 * DELETES findings the AI classified as false positives. Here they are present
 * with `disposition: 'false_positive'` and `blocking: false` — excluded from the
 * blocking set, preserved in the evaluation history.
 *
 * RULE IDENTITY IS DECLARED, NEVER INFERRED. `Finding.canonicalRuleId` is set by
 * the emitting scanner, which holds the pattern object and therefore knows it as
 * fact. There is deliberately NO fallback that derives an id from `Finding.id`
 * by stripping prefixes and line suffixes: that would be a heuristic and a
 * second source of truth. An absent or unresolvable id yields
 * `ruleKnown: false`, which maps to no control and can never produce a pass.
 */

import { relative, isAbsolute, sep } from 'path';
import { createHash } from 'crypto';
import type { Confidence, FilterReason, Finding, ScanResult } from '../types.js';
import { RULE_CATALOG } from '../rules/catalog.js';
import { computeFindingIdentity, baselineHashRelative } from './fingerprint.js';
import type {
  AdjudicationRecord,
  ControlRef,
  DetectionQuality,
  EvidenceScope,
  FindingDisposition,
  FindingEvaluation,
  FindingLocation,
  LapsedRecord,
  PolicyEffect,
  RuleSource,
  TriageClassification,
} from './types.js';

/** Virtual "files" that stand for a repository-wide finding, not a real path. */
const AGGREGATE_FILES = new Set(['project-level', 'ASSET-INVENTORY', 'PHI-FLOW-MAP']);

const CATALOG_BY_ID = new Map(RULE_CATALOG.map((r) => [r.id, r]));

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/** Digest a user-authored free-text field. The text itself can quote source. */
function digestText(text: string | undefined | null): string {
  return sha256(text ?? '');
}

/**
 * Convert an absolute scanner path to a repository-relative POSIX path.
 * Returns null for aggregate/virtual findings and for anything that escapes the
 * repository root (which must never be published).
 */
export function toRepoRelativePath(file: string, repoRoot: string): string | null {
  if (!file || AGGREGATE_FILES.has(file)) return null;
  const rel = isAbsolute(file) ? relative(repoRoot, file) : file;
  if (!rel || rel.startsWith('..')) return null;
  const posix = rel.split(sep).join('/');
  if (posix.startsWith('/') || /^[a-zA-Z]:/.test(posix)) return null;
  return posix;
}

interface ResolvedRule {
  ruleId: string | null;
  ruleKnown: boolean;
  ruleSource: RuleSource;
  scanner: string;
  detectorSource: 'pattern' | 'ai' | 'custom';
}

/** Resolve canonical rule identity. Unknown stays unknown — never guessed. */
export function resolveRuleIdentity(finding: Finding): ResolvedRule {
  const declared = finding.canonicalRuleId;

  if (!declared) {
    return {
      ruleId: null,
      ruleKnown: false,
      ruleSource: 'unknown',
      scanner: 'unknown',
      detectorSource: 'pattern',
    };
  }

  if (declared.startsWith('custom:')) {
    return {
      ruleId: declared,
      ruleKnown: true,
      ruleSource: 'custom',
      scanner: 'custom-rules',
      detectorSource: 'custom',
    };
  }

  const catalogRule = CATALOG_BY_ID.get(declared);
  if (!catalogRule) {
    // Declared, but not in this build's catalog. Honest state: we know what the
    // scanner called it and nothing more.
    return {
      ruleId: declared,
      ruleKnown: false,
      ruleSource: 'unresolved',
      scanner: 'unknown',
      detectorSource: 'pattern',
    };
  }

  return {
    ruleId: declared,
    ruleKnown: true,
    ruleSource: 'builtin',
    scanner: catalogRule.scanner,
    detectorSource: catalogRule.source === 'ai' ? 'ai' : 'pattern',
  };
}

interface AiFields {
  aiClassification?: TriageClassification;
  aiConfidence?: number;
  aiReasoning?: string;
}

/** Adjudication outcome for a single finding. */
interface Adjudicated {
  disposition: FindingDisposition;
  dispositionReason: string;
  adjudication?: AdjudicationRecord;
  lapsed?: LapsedRecord;
}

/**
 * THE PRECEDENCE LADDER — one deterministic rule, evaluated in order, first
 * match wins. A finding can satisfy several conditions at once; exactly one
 * disposition is reported, and everything observed is still recorded in the
 * evaluation's provenance fields.
 *
 *   1. false_positive — the AI rejected the DETECTION itself. If the detection
 *      is wrong there is nothing left to adjudicate, so this precedes every
 *      human decision.
 *   2. suppressed     — an inline `// vlayer-ignore` is the narrowest, most
 *      specific, code-local human statement; config globs are broad.
 *   3. exception      — an acknowledgment WITH an expiry. Strictly more
 *      informative than an open-ended one, and it must resurface, so if both
 *      match we report the one that expires.
 *   4. acknowledged   — an open-ended acknowledgment.
 *   5. baseline       — accepted historical debt, an explicit human act.
 *   6. low_confidence — the configured --min-confidence threshold. A config
 *      knob, so it ranks below every human decision.
 *   7. active         — default.
 *
 * EXPIRED ACKNOWLEDGMENTS ARE NOT A DISPOSITION. They are a lapse: rules 3 and 4
 * are not satisfied, the finding falls through (typically to `active`, blocking
 * again), and `lapsed` records why it re-armed. This deliberately diverges from
 * `buildReport()`, whose `newFindings` filter tests `!f.acknowledged` without
 * consulting `acknowledgment.expired` and so lets an expired acknowledgment
 * suppress a finding forever. That legacy behavior is preserved for backwards
 * compatibility and is not reproduced here.
 */
export function adjudicate(
  finding: Finding,
  filterReason: FilterReason | null,
): Adjudicated {
  const ai = finding as Finding & AiFields;

  // 0 — informational artifact. Generated documentation, not a detection at
  // all, so there is nothing to adjudicate and nothing it can affect. Ranked
  // above false_positive because it is a statement about what the finding IS,
  // not a verdict on whether a real detection was correct.
  if (filterReason === 'informational-artifact') {
    return { disposition: 'informational', dispositionReason: 'informational-artifact' };
  }

  // 1 — false positive
  if (filterReason === 'ai-false-positive' || ai.aiClassification === 'false_positive') {
    return { disposition: 'false_positive', dispositionReason: 'ai-triage-false-positive' };
  }

  // 2 — inline suppression
  if (finding.suppressed && finding.suppression) {
    return {
      disposition: 'suppressed',
      dispositionReason: 'inline-suppression',
      adjudication: { kind: 'suppressed', reasonDigest: digestText(finding.suppression.reason) },
    };
  }

  const ack = finding.acknowledgment;
  const ackExpired = ack?.expired === true;

  // A lapsed acknowledgment is recorded regardless of where the finding lands.
  const lapsed: LapsedRecord | undefined =
    ack && ackExpired
      ? {
          kind: 'acknowledgment',
          expiredAt: ack.expiresAt ?? ack.acknowledgedAt,
          byDigest: digestText(ack.acknowledgedBy),
          ...(ack.ticketUrl ? { ticketUrl: ack.ticketUrl } : {}),
        }
      : undefined;

  if (finding.acknowledged && ack && !ackExpired) {
    // 3 — time-bounded exception
    if (isExpiringAcknowledgment(ack)) {
      return {
        disposition: 'exception',
        dispositionReason: 'acknowledgment-with-expiry',
        adjudication: {
          kind: 'exception',
          byDigest: digestText(ack.acknowledgedBy),
          at: ack.acknowledgedAt,
          expiresAt: expiryOf(ack)!,
          ...(ack.ticketUrl ? { ticketUrl: ack.ticketUrl } : {}),
          reasonDigest: digestText(ack.reason),
        },
      };
    }
    // 4 — open-ended acknowledgment
    return {
      disposition: 'acknowledged',
      dispositionReason: 'acknowledgment-open-ended',
      adjudication: {
        kind: 'acknowledged',
        byDigest: digestText(ack.acknowledgedBy),
        at: ack.acknowledgedAt,
        ...(ack.ticketUrl ? { ticketUrl: ack.ticketUrl } : {}),
        reasonDigest: digestText(ack.reason),
      },
    };
  }

  // 5 — baseline. `isBaseline` is also set by the min-confidence pass, so the
  // dedicated `belowMinConfidence` marker is what separates the two.
  if (finding.isBaseline && !finding.belowMinConfidence) {
    return {
      disposition: 'baseline',
      dispositionReason: 'baseline-file-match',
      ...(lapsed ? { lapsed } : {}),
    };
  }

  // 6 — below the configured confidence threshold
  if (finding.belowMinConfidence) {
    return {
      disposition: 'low_confidence',
      dispositionReason: 'below-min-confidence-threshold',
      ...(lapsed ? { lapsed } : {}),
    };
  }

  // 7 — active
  return {
    disposition: 'active',
    dispositionReason: lapsed ? 'acknowledgment-expired' : 'no-adjudication',
    ...(lapsed ? { lapsed } : {}),
  };
}

/**
 * An acknowledgment is a time-bounded EXCEPTION exactly when it carries an
 * expiry date. Note this cannot be inferred from `expired`, which
 * `applyAcknowledgments` sets to `false` for open-ended acknowledgments too —
 * that is why `expiresAt` is propagated onto the finding.
 */
function isExpiringAcknowledgment(ack: NonNullable<Finding['acknowledgment']>): boolean {
  return typeof ack.expiresAt === 'string' && ack.expiresAt.length > 0;
}

function expiryOf(ack: NonNullable<Finding['acknowledgment']>): string | null {
  return isExpiringAcknowledgment(ack) ? ack.expiresAt! : null;
}

/**
 * Classify the KIND of evidence a finding rests on.
 *
 * A finding that cannot point at a line of source is not a code defect — it is
 * an observation about the repository or its process (no vulnerability-scanning
 * configuration, no logging framework in the manifest, no asset inventory).
 *
 * This is derived generally from the finding's own shape. It is deliberately NOT
 * a list of rule ids: special-casing ids inside the policy layer would be a
 * hidden exception list that silently rots as rules are added.
 *
 * ── LOAD-BEARING CONSTRAINT ────────────────────────────────────────────────
 * This derivation is INFERENTIAL, and the inference runs in the dangerous
 * direction: anything that loses its location silently becomes repository-scope
 * and therefore STOPS BLOCKING THE RELEASE. Two ways that can happen:
 *
 *   1. A process-level rule starts emitting a real file path AND a real line.
 *      It would then be classified as a code defect and begin failing releases
 *      on a standing process gap. Guarded by
 *      `tests/attestation/scope-derivation-guard.test.ts`.
 *
 *   2. A code-level rule loses its location. This already happened once: git
 *      reports the physical repository path while the scanner reported a
 *      symlinked one, so every finding relativized to a '..' path, was refused
 *      as escaping the repo, and lost its line — turning real PHI leaks into
 *      non-blocking observations. `buildAttestation` now resolves the target to
 *      its physical path so both agree. Guarded by the same test file.
 *
 * Until the classification is DECLARED per rule in the catalog rather than
 * inferred here, those guards are what keeps the release gate honest.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function classifyEvidenceScope(location: FindingLocation): EvidenceScope {
  if (location.kind === 'project') return 'repository';
  if (location.line === null) return 'repository';
  return 'code';
}

/**
 * Decide what a finding does to the RELEASE decision.
 *
 * SEVERITY IS NOT POLICY EFFECT. A missing vulnerability-scanning process is
 * genuinely high severity and stays reported at high severity — but it is a
 * standing process gap rather than a defect this commit introduced, so it
 * requires review instead of failing every release. A high-severity PHI leak at
 * a specific line is a defect in this code and blocks.
 *
 *   adjudicated (not active)  → none
 *   repository/process scope  → review_required   (visible, never auto-fails)
 *   code + critical|high      → blocking
 *   code + medium             → review_required
 *   code + low|info           → none
 */
export function derivePolicyEffect(
  disposition: FindingDisposition,
  scope: EvidenceScope,
  severity: Finding['severity'],
): PolicyEffect {
  // Anything adjudicated (informational, false positive, suppressed,
  // acknowledged, exception, baseline, below threshold) has no release effect.
  // `exception` still drives review through its own policy rule, not this one.
  if (disposition !== 'active') return 'none';

  if (scope === 'repository') return 'review_required';

  switch (severity) {
    case 'critical':
    case 'high':
      return 'blocking';
    case 'medium':
      return 'review_required';
    default:
      return 'none';
  }
}

function buildDetection(
  finding: Finding,
  aiApplied: boolean,
  hasAiVerdict: boolean,
): DetectionQuality {
  return {
    semanticConfidence: (finding.confidence as Confidence | undefined) ?? null,
    minConfidenceThreshold: finding.minConfidenceThreshold ?? null,
    belowThreshold: finding.belowMinConfidence === true,
    // Deterministic unless AI actually influenced THIS evaluation. An AI-assisted
    // run still contains mostly deterministic evaluations, and a reviewer must be
    // able to partition them rather than discount the whole attestation.
    deterministic: !(aiApplied && hasAiVerdict),
  };
}

export interface EvaluateOptions {
  repoRoot: string;
  /** Control references, keyed by canonical rule id. */
  controlsForRule: (ruleId: string | null, rawReference?: string) => ControlRef[];
  aiApplied: boolean;
  aiModel: string | null;
}

/**
 * Evaluate every finding a scan produced — both the active collection and the
 * findings that were filtered out of it.
 *
 * Output is sorted by fingerprint so the attestation is byte-stable regardless
 * of scanner execution order.
 */
export function evaluateFindings(result: ScanResult, options: EvaluateOptions): FindingEvaluation[] {
  const evaluations: FindingEvaluation[] = [];

  const consider = (finding: Finding, filterReason: FilterReason | null): void => {
    const ai = finding as Finding & AiFields;
    const rule = resolveRuleIdentity(finding);
    const isAggregate = AGGREGATE_FILES.has(finding.file);
    const path = toRepoRelativePath(finding.file, options.repoRoot);
    const kind: 'file' | 'project' = isAggregate || path === null ? 'project' : 'file';
    const line = kind === 'project' ? null : finding.line ?? null;

    // The anchor line, and ONLY the anchor line — never the surrounding
    // context — feeds the structural signature, and it is redacted before it is
    // hashed (see fingerprint.ts).
    const anchorLine =
      finding.context?.find((c) => c.isMatch)?.content ?? null;

    const identity = computeFindingIdentity(
      { ruleId: rule.ruleId, path, kind, anchorLine },
      line,
    );

    const adjudicated = adjudicate(finding, filterReason);
    const hasAiVerdict = typeof ai.aiClassification === 'string';

    const location: FindingLocation = { path, line, kind };

    const evidenceScope =
      adjudicated.disposition === 'informational'
        ? 'repository'
        : classifyEvidenceScope(location);
    const policyEffect = derivePolicyEffect(
      adjudicated.disposition,
      evidenceScope,
      finding.severity,
    );

    const evaluation: FindingEvaluation = {
      fingerprint: identity.fingerprint,
      locationId: identity.locationId,
      baselineHashRelative: baselineHashRelative(path, line, finding.id, finding.title),
      ruleId: rule.ruleId,
      ruleKnown: rule.ruleKnown,
      ruleSource: rule.ruleSource,
      emittedId: finding.id,
      location,
      severity: finding.severity,
      category: finding.category,
      controls: options.controlsForRule(rule.ruleId, finding.hipaaReference),
      detector: { scanner: rule.scanner, source: rule.detectorSource },
      detection: buildDetection(finding, options.aiApplied, hasAiVerdict),
      disposition: adjudicated.disposition,
      dispositionReason: adjudicated.dispositionReason,
      evidenceScope,
      policyEffect,
      blocking: policyEffect === 'blocking',
    };

    if (hasAiVerdict && options.aiModel) {
      evaluation.aiTriage = {
        classification: ai.aiClassification!,
        // Fractions are carried as scaled integers: canonical JSON is
        // integer-only, which removes float-serialization non-determinism.
        confidencePermille: Math.round(Math.min(1, Math.max(0, ai.aiConfidence ?? 0)) * 1000),
        // The reasoning PROSE can quote source or patient context. Only a
        // digest is published, so provenance survives without leakage.
        reasoningDigest: digestText(ai.aiReasoning),
        model: options.aiModel,
      };
    }
    if (adjudicated.adjudication) evaluation.adjudication = adjudicated.adjudication;
    if (adjudicated.lapsed) evaluation.lapsed = adjudicated.lapsed;

    evaluations.push(evaluation);
  };

  for (const finding of result.findings) consider(finding, null);
  for (const entry of result.filtered ?? []) consider(entry.finding, entry.reason);

  // Deterministic order, independent of scanner execution order.
  evaluations.sort((a, b) => {
    if (a.fingerprint !== b.fingerprint) return a.fingerprint < b.fingerprint ? -1 : 1;
    if (a.locationId !== b.locationId) return a.locationId < b.locationId ? -1 : 1;
    return a.emittedId < b.emittedId ? -1 : a.emittedId > b.emittedId ? 1 : 0;
  });

  return evaluations;
}
