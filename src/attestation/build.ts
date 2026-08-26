/**
 * Assemble a VLayer Attestation V1 statement.
 *
 * Pipeline: git target → scan → evaluate → controls → policy → statement,
 * validated against the Zod schema BEFORE it is serialized. The schema is
 * `.strict()` throughout, so a field capable of carrying source code, PHI, a
 * secret or an absolute path cannot reach the output even by accident.
 *
 * DETERMINISM: for the same commit, the same catalog digest, the same config and
 * `--no-ai`, every field is byte-identical except `generatedAt` — which is why
 * the clock is injected rather than read from `Date` directly.
 */

import { realpath } from 'fs/promises';
import { canonicalize } from './canonical.js';
import { scan } from '../scan.js';
import { getVersion } from '../version.js';
import { loadCustomRules } from '../rules/index.js';
import { loadConfig } from '../config.js';
import { AI_CONFIG } from '../ai/config.js';
import { RULE_CATALOG } from '../rules/catalog.js';
import { getGitTarget, buildSubjectName, type GitTargetOptions } from './git.js';
import { ruleCatalogDigest, customRulesDigest } from './catalog-digest.js';
import { evaluateFindings } from './evaluate.js';
import {
  buildRuleControlIndex,
  controlsForRule,
  evaluateControls,
  computeExecutedRuleIds,
} from './control-mapping.js';
import { evaluatePolicy } from './policy.js';
import { VlayerStatementV1Schema, formatSchemaErrors } from './schema.js';
import {
  IN_TOTO_STATEMENT_TYPE,
  VLAYER_PREDICATE_SCHEMA_VERSION,
  VLAYER_PREDICATE_TYPE,
  type AttestationSummary,
  type ComplianceCategoryList,
  type VlayerStatementV1,
} from './types.js';
import type { ComplianceCategory, Confidence } from '../types.js';

export class AttestationValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`[vlayer] Attestation failed schema validation:\n  ${errors.join('\n  ')}`);
    this.name = 'AttestationValidationError';
  }
}

/**
 * What this attestation explicitly does NOT cover. Published in the document
 * itself so a reviewer never has to infer scope from silence.
 */
const LIMITATIONS: readonly string[] = [
  'VLayer evaluates technical software controls only. It does not certify HIPAA compliance, make an organization HIPAA compliant, or replace a formal HIPAA audit.',
  'Administrative and physical safeguards are not evaluated.',
  'Evidence is limited to static analysis of the repository at the stated commit. Runtime, cloud, identity and database configuration are not evaluated.',
  'A control state of "no_blocking_findings" means the mapped rules executed and produced no blocking finding within the evaluated scope. It is not a statement that the control is satisfied.',
  'Controls with no executed rules are reported as "not_evaluated" and are never treated as passing.',
  'Rules that carry no parseable control reference are reported under the UNMAPPED pseudo-control.',
];

export interface BuildAttestationOptions extends GitTargetOptions {
  /** Directory to attest. Must be inside a Git repository. */
  path: string;
  categories?: ComplianceCategory[];
  exclude?: string[];
  configFile?: string;
  baselineFile?: string;
  minConfidence?: Confidence;
  /** False disables AI triage — the strongest reproducibility mode. */
  enableAI?: boolean;
}

export interface BuildAttestationDeps {
  /** Injected clock, so deterministic content is testable. */
  now?: () => Date;
}

export interface BuildAttestationResult {
  statement: VlayerStatementV1;
  /** Canonical bytes — exactly what is written to disk and signed. */
  bytes: Buffer;
}

export async function buildAttestation(
  options: BuildAttestationOptions,
  deps: BuildAttestationDeps = {},
): Promise<BuildAttestationResult> {
  const now = deps.now ?? (() => new Date());

  // 0. Resolve the target path to its PHYSICAL location before anything else.
  //
  // `git rev-parse --show-toplevel` always reports the physical path, while the
  // scanner reports whatever path it was handed. If the two disagree — which
  // happens whenever the repository is reached through a symlink, including
  // macOS's /tmp and any symlinked home or volume — then relativizing a finding's
  // absolute path against the git root produces a '..'-prefixed path, which is
  // correctly refused as escaping the repository. The finding then loses its
  // location, is classified as repository-scope, and STOPS BLOCKING THE RELEASE.
  //
  // That is a silent policy weakening, so both consumers are given the same
  // physical path here rather than being left to agree by luck.
  const physicalPath = await realpath(options.path);

  // 1. Git identity. Throws for a non-repo, and for a dirty tree without --allow-dirty.
  const { target, root } = await getGitTarget(physicalPath, {
    allowDirty: options.allowDirty,
    repositoryOverride: options.repositoryOverride,
    omitRepository: options.omitRepository,
  });

  // 2. Detection.
  const result = await scan({
    path: physicalPath,
    categories: options.categories,
    exclude: options.exclude,
    configFile: options.configFile,
    baselineFile: options.baselineFile,
    minConfidence: options.minConfidence,
    enableAI: options.enableAI,
  });

  // 3. Custom rules digest (the definitions that were actually active).
  const config = await loadConfig(physicalPath, options.configFile);
  const { rules: customRules } = await loadCustomRules(physicalPath, config.customRulesPath);

  // 4. Adjudication — nothing detected is dropped.
  const index = buildRuleControlIndex();
  const aiApplied = result.aiTriage?.applied === true;
  const evaluations = evaluateFindings(result, {
    repoRoot: root,
    controlsForRule: (ruleId, rawReference) => controlsForRule(index, ruleId, rawReference),
    aiApplied,
    aiModel: aiApplied ? AI_CONFIG.triage.model : null,
  });

  // 5. Control states, gated on proof of execution.
  const scanners = result.execution?.scanners ?? [];
  const customRuleIds = result.execution?.customRuleIds ?? [];
  const executedRuleIds = computeExecutedRuleIds(scanners, customRuleIds);
  const controls = evaluateControls({ index, evaluations, executedRuleIds });

  // 6. Policy.
  const policy = evaluatePolicy({ findings: evaluations, controls });

  // 7. Summary — counted from the evaluations, never re-derived from findings.
  const count = (predicate: (e: (typeof evaluations)[number]) => boolean): number =>
    evaluations.filter(predicate).length;

  const controlsNotEvaluated = controls
    .filter((c) => c.state === 'not_evaluated')
    .map((c) => c.control.controlId)
    .sort();

  const summary: AttestationSummary = {
    filesScanned: result.scannedFiles,
    detected: evaluations.length,
    active: count((e) => e.disposition === 'active'),
    falsePositives: count((e) => e.disposition === 'false_positive'),
    acknowledged: count((e) => e.disposition === 'acknowledged'),
    suppressed: count((e) => e.disposition === 'suppressed'),
    baseline: count((e) => e.disposition === 'baseline'),
    lowConfidence: count((e) => e.disposition === 'low_confidence'),
    exceptions: count((e) => e.disposition === 'exception'),
    lapsed: count((e) => e.lapsed !== undefined),
    blocking: count((e) => e.policyEffect === 'blocking'),
    reviewRequired: count((e) => e.policyEffect === 'review_required'),
    unknownRules: count((e) => !e.ruleKnown),
    unmappedControls: count((e) => e.controls.length === 0),
    controlsNotEvaluated: controlsNotEvaluated.length,
  };

  const categories: ComplianceCategoryList =
    result.execution?.categoriesRequested ?? options.categories ?? [];

  const statement: VlayerStatementV1 = {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject: [
      {
        name: buildSubjectName(target),
        digest: target.dirty
          ? { sha256: target.sourceDigest }
          : { gitCommit: target.commit, gitTree: target.tree },
      },
    ],
    predicateType: VLAYER_PREDICATE_TYPE,
    predicate: {
      schemaVersion: VLAYER_PREDICATE_SCHEMA_VERSION,
      generatedAt: now().toISOString(),
      target,
      verifier: {
        name: 'vlayer',
        version: getVersion(),
        ruleCatalogDigest: ruleCatalogDigest(),
        ruleCatalogRuleCount: RULE_CATALOG.length,
        ...(customRulesDigest(customRules) ? { customRulesDigest: customRulesDigest(customRules)! } : {}),
        aiTriage: {
          enabled: result.aiTriage?.enabled ?? false,
          applied: aiApplied,
          model: aiApplied ? AI_CONFIG.triage.model : null,
          findingsSubmitted: result.aiTriage?.submitted ?? 0,
          findingsCapped: result.aiTriage?.capped ?? 0,
          findingsFailed: result.aiTriage?.failed ?? 0,
          // AI triage is never reproducible. If it ran, say so plainly.
          reproducible: !aiApplied,
        },
      },
      scope: {
        framework: 'hipaa',
        technicalOnly: true,
        categories: [...categories].sort(),
        filesScanned: result.scannedFiles,
        evidenceClass: 'AUTOMATED_VERIFIED',
        reproducibility: aiApplied ? 'ai-assisted' : 'deterministic',
        limitations: [...LIMITATIONS],
        coverage: {
          scanners: scanners.map((s) => ({
            key: s.key,
            category: s.category,
            invoked: s.invoked,
            filesConsidered: s.filesConsidered,
          })),
          rulesInCatalog: RULE_CATALOG.length,
          rulesExecuted: executedRuleIds.size,
          rulesWithoutControlMapping: index.rulesWithoutMapping,
          controlsEvaluated: controls.filter((c) => c.state !== 'not_evaluated').length,
          controlsNotEvaluated,
          customRulesExecuted: customRuleIds.length,
        },
      },
      policy,
      summary,
      controls,
      findings: evaluations,
    },
  };

  // 8. Validate BEFORE serializing. The privacy boundary is enforced here.
  const parsed = VlayerStatementV1Schema.safeParse(statement);
  if (!parsed.success) {
    throw new AttestationValidationError(formatSchemaErrors(parsed.error));
  }

  return { statement, bytes: Buffer.from(canonicalize(statement as never), 'utf-8') };
}
