/**
 * Zod schema for the VLayer Attestation V1 statement.
 *
 * Two jobs:
 *  1. Validate a statement before it is written, and again when it is verified.
 *  2. ENFORCE THE PRIVACY BOUNDARY STRUCTURALLY. Every object is `.strict()`,
 *     so a field that could carry source code, PHI, a secret, an absolute path
 *     or raw model reasoning cannot be added by an accidental object spread —
 *     it fails validation before anything is written. The privacy model is
 *     therefore a property of the type system, not of a filter someone could
 *     forget to call.
 *
 * Every numeric field is `.int()`. Canonical JSON (RFC 8785) has subtle
 * float-serialization rules; forbidding non-integers removes that entire class
 * of determinism bug rather than trusting a serializer to implement it
 * correctly. Fractions are carried as scaled integers (e.g. `confidencePermille`).
 */

import { z } from 'zod';
import { CategoryEnum } from '../rules/schema.js';
import {
  IN_TOTO_STATEMENT_TYPE,
  VLAYER_PREDICATE_SCHEMA_VERSION,
  VLAYER_PREDICATE_TYPE,
} from './types.js';

const SEVERITY = z.enum(['critical', 'high', 'medium', 'low', 'info']);
const CONFIDENCE = z.enum(['high', 'medium', 'low']);

/** Lowercase hex SHA-256. */
const SHA256_HEX = z.string().regex(/^[0-9a-f]{64}$/, 'expected a lowercase hex SHA-256 digest');
/** Lowercase hex SHA-1 (git object ids). */
const SHA1_HEX = z.string().regex(/^[0-9a-f]{40}$/, 'expected a lowercase hex SHA-1 object id');
const ISO_DATETIME = z.string().datetime({ offset: true });

const NON_NEG_INT = z.int().min(0);

/**
 * Attribution for an adjudication, published VERBATIM.
 *
 * Digesting this protected nothing — unsalted SHA-256 over a handful of
 * guessable team names is reversible by anyone who cares — while answering no
 * question an auditor asks. Attribution is the point of recording an exception,
 * so it is published in clear.
 *
 * Email addresses are REJECTED rather than warned about. `vlayer attest` runs in
 * CI, where a warning lands in logs nobody reads and the address publishes
 * anyway; a warning is not a control. Attestations are shareable by design, so a
 * personal contact detail in one travels further than the config file it came
 * from. Rejecting costs nothing today because `attest` is unreleased, so no
 * existing configuration can break — this is the moment to close it.
 *
 * Use a name or a team ("Security Team", "Simon Franco (triage 2026-08-26)").
 */
const ATTRIBUTION = z
  .string()
  .min(1)
  .refine((v) => !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(v), {
    message:
      'contains an email address. `acknowledgedBy` is published VERBATIM in the ' +
      'attestation, which is meant to be shared, so personal contact details must not ' +
      'go in it. Edit the matching `acknowledgedFindings[].acknowledgedBy` entry in ' +
      '.vlayerrc.json to a name or team, e.g. "Security Team".',
  });

export const DispositionSchema = z.enum([
  'active',
  'false_positive',
  'suppressed',
  'exception',
  'acknowledged',
  'baseline',
  'low_confidence',
  'informational',
  'remediated',
]);

export const ControlStateSchema = z.enum([
  'not_evaluated',
  'blocking_findings',
  'review_required',
  'exception_present',
  'no_blocking_findings',
]);

export const PolicyConclusionSchema = z.enum(['pass', 'fail', 'review_required']);

export const ControlRefSchema = z
  .object({
    framework: z.literal('hipaa'),
    controlId: z.string().min(1),
    rawReference: z.string(),
    proposed: z.boolean(),
  })
  .strict();

const DetectionQualitySchema = z
  .object({
    semanticConfidence: CONFIDENCE.nullable(),
    minConfidenceThreshold: CONFIDENCE.nullable(),
    belowThreshold: z.boolean(),
    deterministic: z.boolean(),
  })
  .strict();

const AiTriageRecordSchema = z
  .object({
    classification: z.enum(['confirmed', 'likely', 'possible', 'false_positive']),
    confidencePermille: z.int().min(0).max(1000),
    reasoningDigest: SHA256_HEX,
    model: z.string().min(1),
  })
  .strict();

const AdjudicationRecordSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('suppressed'), reasonDigest: SHA256_HEX }).strict(),
  z
    .object({
      kind: z.literal('exception'),
      by: ATTRIBUTION,
      at: z.string().min(1),
      expiresAt: z.string().min(1),
      ticketUrl: z.string().optional(),
      reasonDigest: SHA256_HEX,
    })
    .strict(),
  z
    .object({
      kind: z.literal('acknowledged'),
      by: ATTRIBUTION,
      at: z.string().min(1),
      ticketUrl: z.string().optional(),
      reasonDigest: SHA256_HEX,
    })
    .strict(),
]);

const LapsedRecordSchema = z
  .object({
    kind: z.literal('acknowledgment'),
    expiredAt: z.string().min(1),
    by: ATTRIBUTION,
    ticketUrl: z.string().optional(),
  })
  .strict();

const FindingLocationSchema = z
  .object({
    // Repository-relative POSIX path. A leading '/' or a drive letter would be
    // an absolute path leak, and a '..' segment would escape the repo root.
    path: z
      .string()
      .min(1)
      .refine((p) => !p.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(p), {
        message: 'path must be repository-relative, not absolute',
      })
      .refine((p) => !p.split('/').includes('..'), {
        message: 'path must not contain ".." segments',
      })
      .refine((p) => !p.includes('\\'), {
        message: 'path must use POSIX separators',
      })
      .nullable(),
    line: z.int().min(1).nullable(),
    kind: z.enum(['file', 'project']),
  })
  .strict();

export const FindingEvaluationSchema = z
  .object({
    fingerprint: SHA256_HEX,
    locationId: SHA256_HEX,
    baselineHashRelative: z.string().regex(/^[0-9a-f]{16}$/),
    ruleId: z.string().min(1).nullable(),
    ruleKnown: z.boolean(),
    ruleSource: z.enum(['builtin', 'custom', 'unresolved', 'unknown']),
    emittedId: z.string().min(1),
    location: FindingLocationSchema,
    severity: SEVERITY,
    category: CategoryEnum,
    controls: z.array(ControlRefSchema),
    detector: z
      .object({
        scanner: z.string().min(1),
        source: z.enum(['pattern', 'ai', 'custom']),
      })
      .strict(),
    detection: DetectionQualitySchema,
    aiTriage: AiTriageRecordSchema.optional(),
    adjudication: AdjudicationRecordSchema.optional(),
    lapsed: LapsedRecordSchema.optional(),
    disposition: DispositionSchema,
    dispositionReason: z.string().min(1),
    evidenceScope: z.enum(['code', 'repository']),
    policyEffect: z.enum(['blocking', 'review_required', 'none']),
    blocking: z.boolean(),
  })
  .strict()
  // `blocking` is a mirror of policyEffect, so the two can never disagree.
  .refine((f) => f.blocking === (f.policyEffect === 'blocking'), {
    message: 'blocking must equal (policyEffect === "blocking")',
  })
  // A repository/process observation must never block a release. It stays
  // visible at its real severity and requires review instead.
  .refine((f) => !(f.evidenceScope === 'repository' && f.policyEffect === 'blocking'), {
    message: 'a repository-scope finding can never have policyEffect "blocking"',
  })
  // Anything adjudicated has no release effect.
  .refine((f) => !(f.disposition !== 'active' && f.policyEffect !== 'none'), {
    message: 'a finding that is not "active" must have policyEffect "none"',
  })
  // A code finding with no line is a contradiction: it would have been
  // classified repository-scope.
  .refine((f) => !(f.evidenceScope === 'code' && f.location.line === null), {
    message: 'a code-scope finding must carry a line number',
  })
  // Informational artifacts are generated documentation. They are inert by
  // construction and must never carry a release effect or a code scope.
  .refine((f) => !(f.disposition === 'informational' && f.policyEffect !== 'none'), {
    message: 'an informational finding must have policyEffect "none"',
  })
  .refine((f) => !(f.disposition === 'informational' && f.evidenceScope !== 'repository'), {
    message: 'an informational finding must have evidenceScope "repository"',
  });

export const ControlEvaluationSchema = z
  .object({
    control: z.union([
      ControlRefSchema,
      z
        .object({
          framework: z.literal('hipaa'),
          controlId: z.literal('UNMAPPED'),
          rawReference: z.literal(''),
          proposed: z.literal(false),
        })
        .strict(),
    ]),
    state: ControlStateSchema,
    evidence: z
      .object({
        rulesInUniverse: NON_NEG_INT,
        rulesExecuted: NON_NEG_INT,
        executedRuleIds: z.array(z.string().min(1)),
        informationalOnlyRuleIds: z.array(z.string().min(1)),
        sources: z.array(
          z
            .object({
              kind: z.literal('static-analysis'),
              assurance: z.literal('AUTOMATED_VERIFIED'),
            })
            .strict(),
        ),
      })
      .strict(),
    findings: z
      .object({
        total: NON_NEG_INT,
        active: NON_NEG_INT,
        blocking: NON_NEG_INT,
        reviewRequired: NON_NEG_INT,
        exceptions: NON_NEG_INT,
        lowConfidence: NON_NEG_INT,
        lapsed: NON_NEG_INT,
        informational: NON_NEG_INT,
      })
      .strict(),
    fingerprints: z.array(SHA256_HEX),
  })
  .strict()
  // The no-evidence-is-not-a-pass invariant, enforced by the schema itself so
  // it cannot be lost in a refactor of the decision table.
  .refine((c) => !(c.evidence.rulesExecuted === 0 && c.state === 'no_blocking_findings'), {
    message: 'a control with zero executed rules can never be "no_blocking_findings"',
  })
  .refine(
    (c) => !(c.control.controlId === 'UNMAPPED' && c.state === 'no_blocking_findings'),
    { message: 'the UNMAPPED pseudo-control can never be "no_blocking_findings"' },
  )
  // Generating documentation is not evaluating a control. A control whose only
  // executed rules were informational must report `not_evaluated`, never
  // "evaluated and clean" — otherwise §164.308(a)(1)(ii)(A), whose entire rule
  // universe is HIPAA-ASSET-001 and HIPAA-FLOW-001, would claim Risk Analysis
  // came back clean on the strength of an inventory having been printed.
  .refine(
    (c) =>
      !(
        c.evidence.rulesExecuted === 0 &&
        c.evidence.informationalOnlyRuleIds.length > 0 &&
        c.state !== 'not_evaluated'
      ),
    {
      message:
        'a control whose only executed rules are informational must be "not_evaluated"',
    },
  );

const TargetSchema = z
  .object({
    repository: z.string().min(1).nullable(),
    repositoryHostClass: z.enum(['public-forge', 'private', 'unknown']),
    repositoryDigest: SHA256_HEX.nullable(),
    commit: SHA1_HEX,
    tree: SHA1_HEX,
    branch: z.string().min(1).nullable(),
    dirty: z.boolean(),
    sourceDigest: z.string().min(1),
    sourceDigestMethod: z.enum(['git-tree-sha1', 'vlayer-worktree-sha256-v1']),
  })
  .strict()
  // A repository string must never carry credentials, a query string or a
  // fragment. Belt-and-braces alongside the sanitizer in git.ts.
  .refine((t) => t.repository === null || !/[@?#]/.test(t.repository), {
    message: 'repository must not contain userinfo, query string or fragment',
  })
  .refine((t) => t.repository === null || !t.repository.includes('://'), {
    message: 'repository must be scheme-less <host>/<path>',
  });

const VerifierSchema = z
  .object({
    name: z.literal('vlayer'),
    version: z.string().min(1),
    ruleCatalogDigest: SHA256_HEX,
    ruleCatalogRuleCount: NON_NEG_INT,
    customRulesDigest: SHA256_HEX.optional(),
    aiTriage: z
      .object({
        enabled: z.boolean(),
        applied: z.boolean(),
        model: z.string().min(1).nullable(),
        findingsSubmitted: NON_NEG_INT,
        findingsCapped: NON_NEG_INT,
        findingsFailed: NON_NEG_INT,
        reproducible: z.boolean(),
      })
      .strict()
      // AI triage is never reproducible. If it ran, say so.
      .refine((a) => !(a.applied && a.reproducible), {
        message: 'aiTriage.reproducible must be false when AI triage was applied',
      }),
  })
  .strict();

const ScopeSchema = z
  .object({
    framework: z.literal('hipaa'),
    technicalOnly: z.literal(true),
    categories: z.array(CategoryEnum),
    filesScanned: NON_NEG_INT,
    evidenceClass: z.literal('AUTOMATED_VERIFIED'),
    reproducibility: z.enum(['deterministic', 'ai-assisted']),
    limitations: z.array(z.string().min(1)),
    coverage: z
      .object({
        scanners: z.array(
          z
            .object({
              key: z.string().min(1),
              category: CategoryEnum,
              invoked: z.boolean(),
              filesConsidered: NON_NEG_INT.nullable(),
            })
            .strict(),
        ),
        rulesInCatalog: NON_NEG_INT,
        rulesExecuted: NON_NEG_INT,
        rulesWithoutControlMapping: NON_NEG_INT,
        controlsEvaluated: NON_NEG_INT,
        controlsNotEvaluated: z.array(z.string().min(1)),
        customRulesExecuted: NON_NEG_INT,
      })
      .strict(),
  })
  .strict();

const PolicySchema = z
  .object({
    id: z.string().min(1),
    digest: SHA256_HEX,
    conclusion: PolicyConclusionSchema,
    reasons: z.array(z.string().min(1)),
  })
  .strict();

const SummarySchema = z
  .object({
    filesScanned: NON_NEG_INT,
    detected: NON_NEG_INT,
    active: NON_NEG_INT,
    falsePositives: NON_NEG_INT,
    acknowledged: NON_NEG_INT,
    suppressed: NON_NEG_INT,
    baseline: NON_NEG_INT,
    lowConfidence: NON_NEG_INT,
    exceptions: NON_NEG_INT,
    lapsed: NON_NEG_INT,
    informational: NON_NEG_INT,
    blocking: NON_NEG_INT,
    reviewRequired: NON_NEG_INT,
    unknownRules: NON_NEG_INT,
    unmappedControls: NON_NEG_INT,
    controlsNotEvaluated: NON_NEG_INT,
  })
  .strict();

export const VlayerPredicateV1Schema = z
  .object({
    schemaVersion: z.literal(VLAYER_PREDICATE_SCHEMA_VERSION),
    generatedAt: ISO_DATETIME,
    target: TargetSchema,
    verifier: VerifierSchema,
    scope: ScopeSchema,
    policy: PolicySchema,
    summary: SummarySchema,
    controls: z.array(ControlEvaluationSchema),
    findings: z.array(FindingEvaluationSchema),
  })
  .strict();

export const StatementSubjectSchema = z
  .object({
    name: z.string().min(1),
    digest: z.record(z.string().min(1), z.string().min(1)),
  })
  .strict();

export const VlayerStatementV1Schema = z
  .object({
    _type: z.literal(IN_TOTO_STATEMENT_TYPE),
    subject: z.array(StatementSubjectSchema).min(1),
    predicateType: z.literal(VLAYER_PREDICATE_TYPE),
    predicate: VlayerPredicateV1Schema,
  })
  .strict();

/** Flatten a ZodError into stable, human-readable strings. */
export function formatSchemaErrors(error: z.ZodError): string[] {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      return `${path}: ${issue.message}`;
    })
    .sort();
}

export type ParsedStatement = z.infer<typeof VlayerStatementV1Schema>;
