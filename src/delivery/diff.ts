import type { Finding } from '../types.js';
import type { Baseline } from '../baseline.js';
import {
  generateFindingHash,
  normalizeFindingFile,
} from '../baseline.js';
import type { FindingDelta } from './types.js';

const VIRTUAL_FILES = new Set(['project-level', 'ASSET-INVENTORY', 'PHI-FLOW-MAP']);

function isActive(finding: Finding): boolean {
  return !finding.suppressed && !finding.acknowledged;
}

function isChangedFile(finding: Finding, projectRoot: string, changed: Set<string>): boolean {
  const file = normalizeFindingFile(finding, projectRoot);
  if (VIRTUAL_FILES.has(file)) return true;
  return changed.has(file);
}

/**
 * Build the change-oriented view used by CI policy evaluation. Findings already
 * marked by `scan(..., baselineFile)` are treated as existing debt; active
 * findings outside the baseline are new risk.
 */
export function buildFindingDelta(
  findings: Finding[],
  projectRoot: string,
  changedFiles: string[],
  baseline: Baseline | null,
): FindingDelta {
  const changed = new Set(changedFiles.map(file => file.replace(/\\/g, '/')));
  const active = findings.filter(isActive);
  const baselineFindings = active.filter(finding => finding.isBaseline === true);
  const newFindings = active.filter(finding => finding.isBaseline !== true);
  const newFindingsInChangedFiles = changed.size === 0
    ? newFindings
    : newFindings.filter(finding => isChangedFile(finding, projectRoot, changed));

  let resolvedFindings = baseline?.findings.filter(() => false) ?? [];
  if (baseline?.version.startsWith('2')) {
    const currentFingerprints = new Set(
      findings.map(finding => generateFindingHash(finding, projectRoot)),
    );
    resolvedFindings = baseline.findings.filter(entry => {
      const fingerprint = entry.fingerprint ?? entry.hash;
      return !currentFingerprints.has(fingerprint);
    });
  }

  return {
    newFindings,
    newFindingsInChangedFiles,
    baselineFindings,
    resolvedFindings,
    changedFiles: [...changed],
  };
}
