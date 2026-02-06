import { readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import type { Finding } from './types.js';

export interface BaselineEntry {
  hash: string;
  id: string;
  file: string;
  line?: number;
  title: string;
  severity: string;
  category: string;
}

export interface Baseline {
  version: string;
  createdAt: string;
  findings: BaselineEntry[];
}

/**
 * Generate a stable hash for a finding
 */
export function generateFindingHash(finding: Finding): string {
  // Use file path, line number, finding ID, and title to create a stable hash
  // This allows the same issue at the same location to be matched
  const key = `${finding.file}:${finding.line || 0}:${finding.id}:${finding.title}`;
  return createHash('sha256').update(key).digest('hex').substring(0, 16);
}

/**
 * Create a baseline entry from a finding
 */
export function createBaselineEntry(finding: Finding): BaselineEntry {
  return {
    hash: generateFindingHash(finding),
    id: finding.id,
    file: finding.file,
    line: finding.line,
    title: finding.title,
    severity: finding.severity,
    category: finding.category,
  };
}

/**
 * Load baseline from file
 */
export async function loadBaseline(path: string): Promise<Baseline | null> {
  try {
    const content = await readFile(path, 'utf-8');
    const baseline = JSON.parse(content) as Baseline;
    return baseline;
  } catch (error) {
    return null;
  }
}

/**
 * Save baseline to file
 */
export async function saveBaseline(path: string, findings: Finding[]): Promise<void> {
  const baseline: Baseline = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    findings: findings.map(createBaselineEntry),
  };

  await writeFile(path, JSON.stringify(baseline, null, 2), 'utf-8');
}

/**
 * Check if a finding exists in the baseline
 */
export function isInBaseline(finding: Finding, baseline: Baseline): boolean {
  const hash = generateFindingHash(finding);
  return baseline.findings.some(entry => entry.hash === hash);
}

/**
 * Apply baseline to findings
 */
export function applyBaseline(findings: Finding[], baseline: Baseline | null): Finding[] {
  if (!baseline) {
    return findings;
  }

  return findings.map(finding => {
    if (isInBaseline(finding, baseline)) {
      return {
        ...finding,
        isBaseline: true,
      };
    }
    return finding;
  });
}

/**
 * Get statistics about baseline application
 */
export function getBaselineStats(findings: Finding[]): {
  total: number;
  baseline: number;
  new: number;
} {
  const baseline = findings.filter(f => f.isBaseline).length;
  const total = findings.length;

  return {
    total,
    baseline,
    new: total - baseline,
  };
}
