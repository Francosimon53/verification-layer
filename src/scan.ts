import { glob } from 'glob';
import type { ScanOptions, ScanResult, Finding, ComplianceCategory } from './types.js';
import { loadConfig, isPathIgnored } from './config.js';
import { phiScanner } from './scanners/phi/index.js';
import { encryptionScanner } from './scanners/encryption/index.js';
import { auditScanner } from './scanners/audit/index.js';
import { accessScanner } from './scanners/access/index.js';
import { retentionScanner } from './scanners/retention/index.js';

const ALL_CATEGORIES: ComplianceCategory[] = [
  'phi-exposure',
  'encryption',
  'audit-logging',
  'access-control',
  'data-retention',
];

const scanners = {
  'phi-exposure': phiScanner,
  'encryption': encryptionScanner,
  'audit-logging': auditScanner,
  'access-control': accessScanner,
  'data-retention': retentionScanner,
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
  }

  // Sort findings by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    findings,
    scannedFiles: filteredFiles.length,
    scanDuration: Date.now() - startTime,
  };
}
