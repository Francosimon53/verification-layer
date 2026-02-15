import { glob } from 'glob';
import type { ScanOptions, ScanResult, Finding, ComplianceCategory, Scanner, StackInfo } from './types.js';
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
import { isAIAvailable } from './ai/client.js';
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
  ];

  const excludePatterns = [
    ...defaultExclude,
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

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = batchIdx * BATCH_SIZE;
    const batchFiles = normalFiles.slice(batchStart, batchStart + BATCH_SIZE);

    if (totalBatches > 1) {
      console.error(`[vlayer] Processing batch ${batchIdx + 1}/${totalBatches} (${batchFiles.length} files)...`);
    }

    for (const category of categories) {
      const scanner = scanners[category];
      if (scanner) {
        const categoryFindings = await scanner.scan(batchFiles, optionsWithConfig);
        findings.push(...categoryFindings);
      }

      const additional = additionalScanners[category];
      if (additional) {
        for (const extraScanner of additional) {
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

  // Apply AI triage if enabled and available
  if (config.ai?.enableTriage !== false && isAIAvailable()) {
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

      // Filter out false positives (optional, based on config)
      if (config.ai?.filterFalsePositives !== false) {
        processedFindings = triagedFindings.filter(
          f => f.aiClassification !== 'false_positive'
        );
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
      // If finding doesn't meet min confidence, mark it as baseline (don't fail on it)
      if (fLevel < minLevel) {
        return { ...f, isBaseline: true };
      }
      return f;
    });
  }

  // Calculate compliance score
  const result = {
    findings: processedFindings,
    scannedFiles: normalFiles.length,
    scanDuration: Date.now() - startTime,
    stack,
  };

  const complianceScore = calculateComplianceScore(result);

  return {
    ...result,
    complianceScore,
  };
}
