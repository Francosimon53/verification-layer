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
  'access-control': [securityScanner, skillsScanner, hipaa2026Scanner, authenticationScanner, rbacScanner], // Security, Skills, HIPAA 2026, Authentication, and RBAC scanners run with access-control
  'encryption': [credentialsScanner], // Credentials scanner runs with encryption
  'audit-logging': [errorsScanner], // Errors scanner runs with audit-logging
  'phi-exposure': [errorsScanner], // Errors scanner also runs with phi-exposure
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

  // Run scanners for selected categories
  const findings: Finding[] = [];

  for (const category of categories) {
    const scanner = scanners[category];
    if (scanner) {
      const categoryFindings = await scanner.scan(filteredFiles, optionsWithConfig);
      findings.push(...categoryFindings);
    }

    // Run additional scanners for this category
    const additional = additionalScanners[category];
    if (additional) {
      for (const extraScanner of additional) {
        const extraFindings = await extraScanner.scan(filteredFiles, optionsWithConfig);
        findings.push(...extraFindings);
      }
    }
  }

  // Load and apply custom rules
  const { rules: customRules, errors: ruleErrors } = await loadCustomRules(
    options.path,
    config.customRulesPath
  );

  if (ruleErrors.length > 0) {
    // Log errors but continue scanning
    for (const error of ruleErrors) {
      console.warn(`[vlayer] Warning: ${error.error} (${error.file})`);
      if (error.details) {
        console.warn(`         ${error.details}`);
      }
    }
  }

  if (customRules.length > 0) {
    const customFindings = await scanWithCustomRules(filteredFiles, optionsWithConfig, customRules);
    findings.push(...customFindings);
  }

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
      // Load file contents for triage
      const fileContents = new Map<string, string>();
      const uniqueFiles = [...new Set(processedFindings.map(f => f.file))];

      for (const file of uniqueFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          fileContents.set(file, content);
        } catch (error) {
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
    scannedFiles: filteredFiles.length,
    scanDuration: Date.now() - startTime,
    stack,
  };

  const complianceScore = calculateComplianceScore(result);

  return {
    ...result,
    complianceScore,
  };
}
