import { createHash } from 'crypto';
import { writeFile } from 'fs/promises';
import { basename, resolve } from 'path';
import {
  canonicalRuleId,
  generateFindingHash,
  normalizeFindingFile,
} from '../baseline.js';
import { buildComplianceGraph, controlForFinding } from './graph.js';
import type { EvidenceFinding, EvidencePackage, GuardResult } from './types.js';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map(key => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

export function hashEvidencePayload(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  return createHash('sha256').update(serialized).digest('hex');
}

/**
 * Create a machine-readable evidence package without embedding source context
 * lines. This intentionally minimizes the risk of copying PHI or secrets into
 * compliance artifacts while preserving rule, file, decision, and provenance.
 */
export function buildEvidencePackage(
  projectPath: string,
  guard: GuardResult,
): EvidencePackage {
  const root = resolve(projectPath);
  const evidenceFindings: EvidenceFinding[] = guard.findings.map(finding => ({
    fingerprint: generateFindingHash(finding, root),
    ruleId: canonicalRuleId(finding.id),
    id: finding.id,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    file: normalizeFindingFile(finding, root),
    line: finding.line,
    hipaaReference: finding.hipaaReference,
    recommendation: finding.recommendation,
    acknowledged: finding.acknowledged === true,
    acknowledgment: finding.acknowledgment,
    baseline: finding.isBaseline === true,
    suppressed: finding.suppressed === true,
  }));

  const controls = [...new Set(guard.findings.map(controlForFinding))].sort();
  const graph = buildComplianceGraph(guard.findings, root, guard.decision, guard.git);
  const body = {
    schemaVersion: '1.0' as const,
    generatedAt: new Date().toISOString(),
    project: {
      name: basename(root),
    },
    source: {
      repository: guard.git.repository,
      branch: guard.git.branch,
      headSha: guard.git.headSha,
      baseSha: guard.git.baseSha,
      author: guard.git.author,
      commitUrl: guard.git.commitUrl,
      changedFiles: guard.git.changedFiles,
    },
    decision: guard.decision,
    summary: {
      scannedFiles: guard.scannedFiles,
      totalFindings: guard.findings.length,
      newFindings: guard.delta.newFindings.length,
      resolvedFindings: guard.delta.resolvedFindings.length,
      acknowledged: guard.findings.filter(finding => finding.acknowledged === true).length,
      suppressed: guard.findings.filter(finding => finding.suppressed === true).length,
      complianceScore: guard.complianceScore,
    },
    controls,
    findings: evidenceFindings,
    graph,
  };

  return {
    ...body,
    packageHash: hashEvidencePayload(body),
  };
}

export async function saveEvidencePackage(path: string, evidence: EvidencePackage): Promise<void> {
  await writeFile(path, JSON.stringify(evidence, null, 2), 'utf-8');
}

export function verifyEvidencePackage(evidence: EvidencePackage): boolean {
  const { packageHash, ...body } = evidence;
  return hashEvidencePayload(body) === packageHash;
}
