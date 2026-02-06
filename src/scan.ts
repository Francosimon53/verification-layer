import { glob } from 'glob';
import type { ScanOptions, ScanResult, Finding, ComplianceCategory, Scanner, StackInfo } from './types.js';
import { loadConfig, isPathIgnored } from './config.js';
import { phiScanner } from './scanners/phi/index.js';
import { encryptionScanner } from './scanners/encryption/index.js';
import { auditScanner } from './scanners/audit/index.js';
import { accessScanner } from './scanners/access/index.js';
import { retentionScanner } from './scanners/retention/index.js';
import { securityScanner } from './scanners/security/index.js';
import { detectStack, getStackDisplayName } from './stack-detector/index.js';
import { getStackSummary } from './stack-detector/stack-guides.js';
import { loadCustomRules, scanWithCustomRules } from './rules/index.js';
import { applyAcknowledgments } from './acknowledgments.js';

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
  'access-control': [securityScanner], // Security scanner runs with access-control
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
  const acknowledgedFindings = applyAcknowledgments(findings, config);

  return {
    findings: acknowledgedFindings,
    scannedFiles: filteredFiles.length,
    scanDuration: Date.now() - startTime,
    stack,
  };
}
