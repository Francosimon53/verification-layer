import { readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
import type { Finding } from './types.js';

export const BASELINE_VERSION = '2.0';

const VIRTUAL_FILES = new Set([
  'project-level',
  'ASSET-INVENTORY',
  'PHI-FLOW-MAP',
]);

export interface BaselineEntry {
  /** Stable v2 fingerprint. `hash` is retained for backwards compatibility. */
  hash: string;
  fingerprint?: string;
  /** Canonical rule family without scanner-generated line suffixes. */
  ruleId?: string;
  id: string;
  /** Portable path relative to the scanned project root for v2 baselines. */
  file: string;
  /** Informational only in v2; line number is not part of the fingerprint. */
  line?: number;
  title: string;
  severity: string;
  category: string;
  /** Normalized matched code used to distinguish repeated rule families. */
  anchor?: string;
}

export interface Baseline {
  version: string;
  createdAt: string;
  findings: BaselineEntry[];
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Scanner rules historically embedded source line numbers in some finding IDs
 * (for example `enc-des-81`). Those suffixes are location metadata, not rule
 * identity, and therefore must not invalidate a baseline after a refactor.
 * Upper-case catalog IDs such as `CRED-001` and `HIPAA-2026-001` are preserved.
 */
export function canonicalRuleId(id: string): string {
  if (/^[a-z][a-z0-9-]*-\d+$/.test(id)) {
    return id.replace(/-\d+$/, '');
  }
  return id;
}

/**
 * Build a stable semantic anchor from the matched source line. Context lines
 * are intentionally whitespace-normalized so formatting-only edits do not
 * create a new baseline finding.
 */
export function getFindingAnchor(finding: Finding): string {
  if (!finding.context || finding.context.length === 0) return '';

  const matched = finding.context.filter(line => line.isMatch);
  const source = matched.length > 0 ? matched : finding.context;

  return source
    .map(line => line.content.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000);
}

function isVirtualFile(file: string): boolean {
  return VIRTUAL_FILES.has(file);
}

function isInside(root: string, file: string): boolean {
  const rel = relative(root, file);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

/**
 * Infer the checkout root from all real finding paths. This keeps the existing
 * `saveBaseline(path, findings)` API portable without requiring callers to pass
 * the scan root. When a caller knows the root, passing it explicitly is still
 * preferred.
 */
export function inferProjectRoot(findings: Finding[]): string {
  const files = findings
    .map(f => f.file)
    .filter(file => isAbsolute(file) && !isVirtualFile(file))
    .map(file => resolve(file));

  if (files.length === 0) return process.cwd();

  let root = dirname(files[0]);
  for (const file of files.slice(1)) {
    while (!isInside(root, file)) {
      const parent = dirname(root);
      if (parent === root) break;
      root = parent;
    }
  }

  return root;
}

/**
 * Convert a finding path to a portable project-relative path. Virtual project
 * findings retain their stable symbolic names.
 */
export function normalizeFindingFile(finding: Finding, projectRoot?: string): string {
  if (isVirtualFile(finding.file)) return finding.file;

  if (projectRoot && isAbsolute(finding.file)) {
    const root = resolve(projectRoot);
    const file = resolve(finding.file);
    if (isInside(root, file)) {
      return normalizeSlashes(relative(root, file));
    }
  }

  return normalizeSlashes(finding.file);
}

/**
 * Generate the v2 finding fingerprint. Source line number is deliberately not
 * included. The fingerprint is based on portable file path, canonical rule
 * family, stable title, and matched-code anchor.
 */
export function generateFindingHash(finding: Finding, projectRoot?: string): string {
  const key = [
    'v2',
    normalizeFindingFile(finding, projectRoot),
    canonicalRuleId(finding.id),
    finding.title.trim().toLowerCase(),
    getFindingAnchor(finding),
  ].join('|');

  return createHash('sha256').update(key).digest('hex').substring(0, 16);
}

/**
 * Legacy v1 hash used only to keep exact same-checkout baselines readable.
 */
function generateLegacyFindingHash(finding: Finding): string {
  const key = `${finding.file}:${finding.line || 0}:${finding.id}:${finding.title}`;
  return createHash('sha256').update(key).digest('hex').substring(0, 16);
}

/**
 * Create a baseline entry from a finding.
 */
export function createBaselineEntry(finding: Finding, projectRoot?: string): BaselineEntry {
  const fingerprint = generateFindingHash(finding, projectRoot);
  return {
    hash: fingerprint,
    fingerprint,
    ruleId: canonicalRuleId(finding.id),
    id: finding.id,
    file: normalizeFindingFile(finding, projectRoot),
    line: finding.line,
    title: finding.title,
    severity: finding.severity,
    category: finding.category,
    anchor: getFindingAnchor(finding) || undefined,
  };
}

/**
 * Load baseline from file.
 */
export async function loadBaseline(path: string): Promise<Baseline | null> {
  try {
    const content = await readFile(path, 'utf-8');
    const baseline = JSON.parse(content) as Baseline;
    if (!baseline || !Array.isArray(baseline.findings) || typeof baseline.version !== 'string') {
      return null;
    }
    return baseline;
  } catch {
    return null;
  }
}

/**
 * Save a portable v2 baseline. `projectRoot` is optional for API compatibility;
 * when omitted it is inferred from the absolute finding paths.
 */
export async function saveBaseline(
  path: string,
  findings: Finding[],
  projectRoot?: string
): Promise<void> {
  const root = projectRoot ? resolve(projectRoot) : inferProjectRoot(findings);
  const baseline: Baseline = {
    version: BASELINE_VERSION,
    createdAt: new Date().toISOString(),
    findings: findings.map(finding => createBaselineEntry(finding, root)),
  };

  await writeFile(path, JSON.stringify(baseline, null, 2), 'utf-8');
}

function pathMatches(entryFile: string, findingFile: string): boolean {
  const expected = normalizeSlashes(entryFile);
  const actual = normalizeSlashes(findingFile);

  if (VIRTUAL_FILES.has(expected) || VIRTUAL_FILES.has(actual)) {
    return expected === actual;
  }

  return actual === expected || actual.endsWith(`/${expected}`);
}

function semanticEntryMatches(finding: Finding, entry: BaselineEntry): boolean {
  if (!pathMatches(entry.file, finding.file)) return false;
  if ((entry.ruleId ?? canonicalRuleId(entry.id)) !== canonicalRuleId(finding.id)) return false;
  if (entry.title.trim().toLowerCase() !== finding.title.trim().toLowerCase()) return false;

  const anchor = getFindingAnchor(finding);
  if (entry.anchor && anchor) return entry.anchor === anchor;

  return true;
}

/**
 * Check if a finding exists in a baseline.
 */
export function isInBaseline(
  finding: Finding,
  baseline: Baseline,
  projectRoot?: string
): boolean {
  if (baseline.version.startsWith('2')) {
    if (projectRoot) {
      const fingerprint = generateFindingHash(finding, projectRoot);
      if (baseline.findings.some(entry => (entry.fingerprint ?? entry.hash) === fingerprint)) {
        return true;
      }
    }

    // Portable fallback: useful when callers do not know the checkout root.
    return baseline.findings.some(entry => semanticEntryMatches(finding, entry));
  }

  // v1 files remain readable on the checkout where they were generated.
  const legacyHash = generateLegacyFindingHash(finding);
  if (baseline.findings.some(entry => entry.hash === legacyHash)) return true;

  // Best-effort portability for legacy files while users regenerate to v2.
  return baseline.findings.some(entry => semanticEntryMatches(finding, entry));
}

/**
 * Apply baseline to findings. The root is inferred once for stable v2 hashing,
 * making a committed baseline portable between developer machines and CI.
 */
export function applyBaseline(
  findings: Finding[],
  baseline: Baseline | null,
  projectRoot?: string
): Finding[] {
  if (!baseline) return findings;

  const root = projectRoot ?? inferProjectRoot(findings);
  return findings.map(finding => {
    if (isInBaseline(finding, baseline, root)) {
      return {
        ...finding,
        isBaseline: true,
      };
    }
    return finding;
  });
}

/**
 * Get statistics about baseline application.
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
