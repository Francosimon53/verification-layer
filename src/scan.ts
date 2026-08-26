import { glob } from 'glob';
import type { ScanOptions, ScanResult, Finding, ComplianceCategory, Scanner, StackInfo, GroupedFinding, FilteredFinding, ScanExecution, InformationalArtifact } from './types.js';
import { loadConfig, isPathIgnored } from './config.js';
import { phiScanner } from './scanners/phi/index.js';
import { encryptionScanner } from './scanners/encryption/index.js';
import { auditScanner } from './scanners/audit/index.js';
import { accessScanner } from './scanners/access/index.js';
import { retentionScanner } from './scanners/retention/index.js';
import { securityScanner } from './scanners/security/index.js';
import { skillsScanner } from './scanners/skills/index.js';
import { hipaa2026Scanner } from './scanners/hipaa2026/index.js';
import { authenticationScanner } from './scanners/authentication/index.js';
import { rbacScanner } from './scanners/rbac/index.js';
import { credentialsScanner } from './scanners/credentials/index.js';
import { errorsScanner } from './scanners/errors/index.js';
import { sanitizationScanner } from './scanners/sanitization/index.js';
import { revocationScanner } from './scanners/revocation/index.js';
import { configurationScanner } from './scanners/configuration/index.js';
import { apiSecurityScanner } from './scanners/api-security/index.js';
import { operationalScanner } from './scanners/operational/index.js';
import { detectStack, getStackDisplayName } from './stack-detector/index.js';
import { getStackSummary } from './stack-detector/stack-guides.js';
import { loadCustomRules, scanWithCustomRules } from './rules/index.js';
import { applyAcknowledgments } from './acknowledgments.js';
import { applyInlineSuppressions } from './suppression.js';
import { loadBaseline, applyBaseline } from './baseline.js';
import { batchAnalyzeSemanticContext } from './semantic-analysis.js';
import { calculateComplianceScore } from './compliance-score.js';
import { triageExistingFindings } from './ai/scanner.js';
import { summarizeTriage } from './ai/rules/triage.js';
import { isAIAvailable } from './ai/client.js';
import { DEFAULT_VLAYER_OUTPUT_EXCLUDES } from './exclusions.js';
import { isInformationalArtifactRule } from './informational-artifacts.js';
import * as fs from 'fs/promises';

const ALL_CATEGORIES: ComplianceCategory[] = [
  'phi-exposure',
  'encryption',
  'audit-logging',
  'access-control',
  'data-retention',
];

const scanners: Record<ComplianceCategory, Scanner> = {
  'phi-exposure': phiScanner,
  'encryption': encryptionScanner,
  'audit-logging': auditScanner,
  'access-control': accessScanner,
  'data-retention': retentionScanner,
};

/**
 * Maps each Scanner instance to its key in `RULE_CATALOG.scanner`.
 *
 * This is what lets execution evidence be joined to the rule catalog: knowing
 * that the `phi` scanner ran on N eligible files is what proves the 29 catalog
 * rules owned by `phi` actually executed. Keys MUST match `CatalogRule.scanner`
 * exactly; `tests/attestation/control-coverage.test.ts` asserts that they do.
 */
const SCANNER_KEYS = new Map<Scanner, string>([
  [phiScanner, 'phi'],
  [encryptionScanner, 'encryption'],
  [auditScanner, 'audit'],
  [accessScanner, 'access'],
  [retentionScanner, 'retention'],
  [securityScanner, 'security'],
  [skillsScanner, 'skills'],
  [hipaa2026Scanner, 'hipaa2026'],
  [authenticationScanner, 'authentication'],
  [rbacScanner, 'rbac'],
  [credentialsScanner, 'credentials'],
  [errorsScanner, 'errors'],
  [sanitizationScanner, 'sanitization'],
  [revocationScanner, 'revocation'],
  [configurationScanner, 'configuration'],
  [apiSecurityScanner, 'api-security'],
  [operationalScanner, 'operational'],
]);

/** The catalog scanner keys vlayer can execute. Exported for coverage tests. */
export const KNOWN_SCANNER_KEYS: readonly string[] = [...SCANNER_KEYS.values()];

// Additional scanners that run with specific categories
const additionalScanners: Partial<Record<ComplianceCategory, Scanner[]>> = {
  'access-control': [securityScanner, skillsScanner, hipaa2026Scanner, authenticationScanner, rbacScanner, sanitizationScanner, revocationScanner, apiSecurityScanner], // Security, Skills, HIPAA 2026, Authentication, RBAC, Sanitization, Revocation, and API Security scanners run with access-control
  'encryption': [credentialsScanner], // Credentials scanner runs with encryption
  'audit-logging': [errorsScanner, configurationScanner], // Errors and Configuration scanners run with audit-logging
  'phi-exposure': [errorsScanner], // Errors scanner also runs with phi-exposure
  'data-retention': [operationalScanner], // Operational scanner runs with data-retention
};

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();

  // Load configuration
  const config = await loadConfig(options.path, options.configFile);
  const optionsWithConfig = { ...options, config };

  const categories = options.categories ?? config.categories ?? ALL_CATEGORIES;

  // Get all files to scan
  const defaultExclude = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    // Dependency lockfiles: machine-generated, not code — integrity hashes
    // routinely contain substrings that trip content-pattern rules
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
    '**/yarn.lock',
    '**/bun.lock',
    '**/bun.lockb',
  ];

  // Exclude vlayer's own generated outputs by default so the scanner never
  // re-reads (and re-flags) its own reports/baseline. Opt out via
  // `--include-own-artifacts` (CLI) or `includeOwnArtifacts: true` (config).
  const includeOwnArtifacts = options.includeOwnArtifacts ?? config.includeOwnArtifacts ?? false;
  const ownArtifactExcludes = includeOwnArtifacts ? [] : [...DEFAULT_VLAYER_OUTPUT_EXCLUDES];

  const excludePatterns = [
    ...defaultExclude,
    ...ownArtifactExcludes,
    ...(options.exclude ?? []),
    ...(config.exclude ?? []),
  ];

  const files = await glob('**/*', {
    cwd: options.path,
    nodir: true,
    ignore: excludePatterns,
    absolute: true,
  });

  // Filter out ignored paths from config
  const filteredFiles = files.filter(f => !isPathIgnored(f, config));

  // Pre-filter large files (>1MB) to prevent OOM on large repos
  const BATCH_SIZE = 50;
  const MAX_FILE_SIZE = 1_000_000; // 1MB

  const fileStats = await Promise.all(
    filteredFiles.map(async (f) => {
      try {
        const stat = await fs.stat(f);
        return { file: f, size: stat.size };
      } catch {
        return { file: f, size: 0 };
      }
    })
  );

  const normalFiles = fileStats.filter(f => f.size <= MAX_FILE_SIZE).map(f => f.file);
  const skippedCount = fileStats.length - normalFiles.length;
  if (skippedCount > 0) {
    console.error(`[vlayer] Skipping ${skippedCount} file(s) larger than 1MB`);
  }

  // Load custom rules once before batch loop
  const { rules: customRules, errors: ruleErrors } = await loadCustomRules(
    options.path,
    config.customRulesPath
  );

  if (ruleErrors.length > 0) {
    for (const error of ruleErrors) {
      console.warn(`[vlayer] Warning: ${error.error} (${error.file})`);
      if (error.details) {
        console.warn(`         ${error.details}`);
      }
    }
  }

  // Process files in batches to limit memory usage
  const findings: Finding[] = [];
  const totalBatches = Math.ceil(normalFiles.length / BATCH_SIZE) || 1;

  // EXECUTION EVIDENCE. Records, per scanner, whether it was dispatched and how
  // many files it was actually eligible to inspect. A scanner can be invoked and
  // still evaluate nothing (it filters by extension), so "invoked" alone cannot
  // justify reporting a control as `no_blocking_findings`. `selectFiles` is the
  // same predicate the scanner uses internally, so the two cannot drift.
  const executionByScanner = new Map<string, { key: string; category: ComplianceCategory; invoked: boolean; filesConsidered: number | null }>();

  const recordExecution = (key: string, scanner: Scanner, batchFiles: string[]): void => {
    const existing = executionByScanner.get(key);
    const considered = scanner.selectFiles ? scanner.selectFiles(batchFiles).length : null;
    if (!existing) {
      executionByScanner.set(key, {
        key,
        category: scanner.category,
        invoked: true,
        filesConsidered: considered,
      });
      return;
    }
    existing.invoked = true;
    // A scanner without selectFiles reports null forever — never silently 0.
    if (considered !== null) {
      existing.filesConsidered = (existing.filesConsidered ?? 0) + considered;
    }
  };

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = batchIdx * BATCH_SIZE;
    const batchFiles = normalFiles.slice(batchStart, batchStart + BATCH_SIZE);

    if (totalBatches > 1) {
      console.error(`[vlayer] Processing batch ${batchIdx + 1}/${totalBatches} (${batchFiles.length} files)...`);
    }

    for (const category of categories) {
      const scanner = scanners[category];
      if (scanner) {
        recordExecution(SCANNER_KEYS.get(scanner) ?? category, scanner, batchFiles);
        const categoryFindings = await scanner.scan(batchFiles, optionsWithConfig);
        findings.push(...categoryFindings);
      }

      const additional = additionalScanners[category];
      if (additional) {
        for (const extraScanner of additional) {
          // A scanner registered under two categories is recorded ONCE, keyed by
          // its catalog key, so file counts are not double-attributed.
          recordExecution(SCANNER_KEYS.get(extraScanner) ?? extraScanner.name, extraScanner, batchFiles);
          const extraFindings = await extraScanner.scan(batchFiles, optionsWithConfig);
          findings.push(...extraFindings);
        }
      }
    }

    if (customRules.length > 0) {
      const customFindings = await scanWithCustomRules(batchFiles, optionsWithConfig, customRules);
      findings.push(...customFindings);
    }

    // Hint GC between batches
    if (globalThis.gc) {
      globalThis.gc();
    }
  }

  // Deduplicate project-level / aggregate findings that appear once per batch
  const aggregateFiles = new Set(['project-level', 'ASSET-INVENTORY', 'PHI-FLOW-MAP']);
  const seenAggregateIds = new Set<string>();
  const deduplicatedFindings: Finding[] = [];

  for (const f of findings) {
    if (aggregateFiles.has(f.file)) {
      if (seenAggregateIds.has(f.id)) continue;
      seenAggregateIds.add(f.id);
    }
    deduplicatedFindings.push(f);
  }

  // Replace findings with deduplicated version
  findings.length = 0;
  findings.push(...deduplicatedFindings);

  // Findings detected and then removed from the active collection. Never lost:
  // every removal is recorded here so the evidence model can account for it.
  const filtered: FilteredFinding[] = [];

  // Informational artifacts (asset inventory, PHI flow map) are generated
  // documentation, not violations — lift them out of the findings list into
  // report metadata so they never count toward stats or the unacknowledged
  // total.
  //
  // Matched on `canonicalRuleId`, NOT on `id`. Several scanners interpolate the
  // line number into `id` (`phi-<pattern>-42`), so it is a display value: these
  // two rules happen to emit static ids today, but a future change to how
  // hipaa2026 builds ids would silently stop this filter matching and let the
  // artifacts flow back into findings with no error. `canonicalRuleId` is
  // declared at the emission point and its coverage is enforced by
  // tests/attestation/rule-identity-coverage.test.ts.
  const isInformationalArtifact = (f: Finding): boolean =>
    isInformationalArtifactRule(f.canonicalRuleId);

  const informationalArtifacts: InformationalArtifact[] = findings
    .filter(isInformationalArtifact)
    .map(f => ({
      id: f.id,
      title: f.title,
      description: f.description,
      content: f.recommendation,
      hipaaReference: f.hipaaReference,
    }));

  // The artifacts leave `findings` exactly as before — stats and the
  // unacknowledged total are unchanged — but each lifted finding is ALSO
  // recorded in `filtered`, so the attestation can represent it with an
  // explicit `informational` disposition instead of losing it entirely.
  for (const f of findings.filter(isInformationalArtifact)) {
    filtered.push({ finding: f, reason: 'informational-artifact' });
  }

  const nonArtifactFindings = findings.filter(f => !isInformationalArtifact(f));
  findings.length = 0;
  findings.push(...nonArtifactFindings);

  // Sort findings by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Detect project stack
  const detectedStack = await detectStack(options.path);
  const stackDisplayNames = getStackDisplayName(detectedStack);
  const stackRecommendations = getStackSummary(detectedStack);

  const stack: StackInfo = {
    framework: detectedStack.framework,
    database: detectedStack.database,
    auth: detectedStack.auth,
    frameworkDisplay: stackDisplayNames.framework,
    databaseDisplay: stackDisplayNames.database,
    authDisplay: stackDisplayNames.auth,
    recommendations: stackRecommendations,
  };

  // Apply acknowledgments from configuration
  let processedFindings = applyAcknowledgments(findings, config);

  // Apply inline suppressions
  processedFindings = await applyInlineSuppressions(processedFindings);

  // Apply semantic analysis to determine confidence levels
  const semanticContexts = await batchAnalyzeSemanticContext(
    processedFindings.map(f => ({ file: f.file, line: f.line, pattern: f.id }))
  );

  processedFindings = processedFindings.map((finding, index) => {
    const context = semanticContexts[index];

    // Check if we should adjust confidence based on context
    const shouldAdjust = finding.adjustConfidenceByContext !== false; // Default to true

    // Set confidence if not already set, or if adjustConfidenceByContext is true
    if (!finding.confidence || shouldAdjust) {
      return {
        ...finding,
        confidence: context.confidence,
      };
    }
    return finding;
  });

  // AI triage provenance. AI triage is NOT reproducible, so an attestation must
  // record whether it actually ran, on how many findings, and how many were left
  // un-verified by the per-scan cap or by a call failure.
  const aiEnabled = options.enableAI !== false && config.ai?.enableTriage !== false;
  let aiTriageApplied = false;
  let aiFindingsSubmitted = 0;
  let aiFindingsCapped = 0;
  let aiFindingsFailed = 0;

  // Apply AI triage if enabled and available
  if (aiEnabled && isAIAvailable()) {
    try {
      // Load file contents for triage (skip special/virtual files)
      const fileContents = new Map<string, string>();
      const uniqueFiles = [...new Set(processedFindings.map(f => f.file))]
        .filter(f => !aggregateFiles.has(f));

      for (const file of uniqueFiles) {
        try {
          const stat = await fs.stat(file);
          if (stat.size > MAX_FILE_SIZE) continue; // Skip large files
          const content = await fs.readFile(file, 'utf-8');
          fileContents.set(file, content);
        } catch {
          // Skip files that can't be read
        }
      }

      const triagedFindings = await triageExistingFindings(processedFindings, fileContents);
      aiTriageApplied = true;

      // Counted from EXPLICIT triage state, never from `aiReasoning` prose:
      // these numbers are published in the attestation as evidence, and matching
      // on a user-facing string would let a copy edit silently change them.
      const triageStats = summarizeTriage(triagedFindings);
      aiFindingsSubmitted = triageStats.submitted;
      aiFindingsCapped = triageStats.capped;
      aiFindingsFailed = triageStats.failed;

      // Filter out false positives (optional, based on config)
      if (config.ai?.filterFalsePositives !== false) {
        // NOTHING DETECTED MAY SILENTLY DISAPPEAR. `findings` keeps its legacy
        // behavior — false positives are still absent from it, so every existing
        // report and consumer is unaffected — but each removed finding is
        // recorded in `filtered` so the evidence model can preserve it with an
        // explicit `false_positive` disposition instead of losing it.
        processedFindings = triagedFindings.filter(f => {
          if (f.aiClassification === 'false_positive') {
            filtered.push({ finding: f, reason: 'ai-false-positive' });
            return false;
          }
          return true;
        });
      } else {
        // Keep all but add AI metadata
        processedFindings = triagedFindings;
      }
    } catch (error) {
      // AI triage failed, continue with original findings
      console.warn('AI triage failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Apply baseline if provided
  if (options.baselineFile) {
    const baseline = await loadBaseline(options.baselineFile);
    if (baseline) {
      processedFindings = applyBaseline(processedFindings, baseline);
    }
  }

  // Filter by minimum confidence if specified
  if (options.minConfidence) {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const minLevel = confidenceOrder[options.minConfidence];
    processedFindings = processedFindings.map(f => {
      const fLevel = confidenceOrder[f.confidence || 'high'];
      // If finding doesn't meet min confidence, mark it as baseline (don't fail on it).
      // `isBaseline` is kept for backwards compatibility — reporters and the
      // compliance score rely on it — but it OVERLOADS two different meanings.
      // `belowMinConfidence` records the real reason so the evidence model can
      // distinguish accepted historical debt from a confidence threshold.
      if (fLevel < minLevel) {
        return {
          ...f,
          isBaseline: true,
          belowMinConfidence: true,
          minConfidenceThreshold: options.minConfidence,
        };
      }
      return f;
    });
  }

  // Collapse exact-duplicate findings (e.g. a scanner registered under two
  // categories firing twice on the same line) BEFORE grouping, so every output
  // format — terminal, JSON, HTML, PDF — sees one entry per real finding.
  const rawFindingCount = processedFindings.length;
  processedFindings = dedupeFindings(processedFindings);

  // Group findings by rule ID + severity
  const groupedFindings = groupFindings(processedFindings);

  // Deduplicate the preserved false positives on the SAME key as active
  // findings, so counts in the two collections are comparable.
  const dedupedFiltered: FilteredFinding[] = [];
  const filteredSeen = new Set<string>();
  for (const entry of filtered) {
    const key = `${entry.finding.id}||${entry.finding.file}||${entry.finding.line ?? ''}`;
    if (filteredSeen.has(key)) continue;
    filteredSeen.add(key);
    dedupedFiltered.push(entry);
  }

  const execution: ScanExecution = {
    categoriesRequested: [...categories],
    scanners: [...executionByScanner.values()].sort((a, b) => a.key.localeCompare(b.key)),
    customRuleIds: customRules.map(r => r.id).sort(),
    filesScanned: normalFiles.length,
  };

  // Calculate compliance score
  const result = {
    findings: processedFindings,
    groupedFindings,
    rawFindingsCount: rawFindingCount,
    scannedFiles: normalFiles.length,
    scanDuration: Date.now() - startTime,
    stack,
    filtered: dedupedFiltered,
    execution,
    aiTriage: {
      enabled: aiEnabled,
      applied: aiTriageApplied,
      submitted: aiFindingsSubmitted,
      capped: aiFindingsCapped,
      failed: aiFindingsFailed,
    },
    informationalArtifacts,
  };

  const complianceScore = calculateComplianceScore(result);

  return {
    ...result,
    complianceScore,
  };
}

/**
 * Normalize a finding's code snippet for dedupe comparison: take the matched
 * context line(s) (or fall back to none), lowercase, trim, collapse whitespace.
 */
function normalizeSnippet(finding: Finding): string {
  if (!finding.context || finding.context.length === 0) return '';
  return finding.context
    .map(c => c.content.trim().toLowerCase().replace(/\s+/g, ' '))
    .join('\n');
}

/**
 * Remove exact-duplicate findings, keyed by ruleId + file + line + normalized
 * snippet. Two findings that share all four are the same real issue surfaced
 * twice (e.g. a scanner that runs under more than one category). The first
 * occurrence is kept; order is preserved.
 *
 * Runs in the results pipeline BEFORE grouping so it applies uniformly to every
 * output format. Aggregate/virtual findings (project-level, ASSET-INVENTORY,
 * PHI-FLOW-MAP) are already deduped upstream and pass through unchanged here.
 */
export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const result: Finding[] = [];

  for (const f of findings) {
    const key = `${f.id}||${f.file}||${f.line ?? ''}||${normalizeSnippet(f)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(f);
  }

  return result;
}

/**
 * Group findings by severity + normalized title into deduplicated entries with occurrence lists.
 * This collapses all occurrences of the same violation type into one row.
 */
export function groupFindings(findings: Finding[]): GroupedFinding[] {
  const groups = new Map<string, GroupedFinding>();
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

  for (const f of findings) {
    // Normalize title: lowercase, trim, collapse whitespace
    const normalizedTitle = f.title.toLowerCase().trim().replace(/\s+/g, ' ');
    const key = `${f.severity}::${normalizedTitle}`;

    if (!groups.has(key)) {
      // Strip line number suffix only from dynamic IDs (lowercase prefix like "phi-ssn-hardcoded-42")
      // Keep static rule IDs intact (uppercase prefix like "ERROR-002", "HIPAA-PENTEST-001")
      const cleanId = /^[a-z]/.test(f.id) ? f.id.replace(/-\d+$/, '') : f.id;
      groups.set(key, {
        id: cleanId,
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        hipaaReference: f.hipaaReference,
        confidence: f.confidence,
        occurrenceCount: 0,
        fileCount: 0,
        examples: [],
        occurrences: [],
      });
    }

    const group = groups.get(key)!;
    group.occurrenceCount++;
    group.occurrences.push({ file: f.file, line: f.line });
  }

  for (const group of groups.values()) {
    group.fileCount = new Set(group.occurrences.map(o => o.file)).size;
    // Pick up to 5 examples from distinct files for immediate context
    const seenFiles = new Set<string>();
    for (const occ of group.occurrences) {
      if (seenFiles.has(occ.file)) continue;
      seenFiles.add(occ.file);
      group.examples.push(occ);
      if (group.examples.length >= 5) break;
    }
  }

  return [...groups.values()].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );
}
