import { createHash, randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import type { AuditEvidence, CodeSnapshot, ContextLine, Finding, FixType } from '../types.js';

/**
 * Generate SHA256 hash of file content
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Extract code snapshot with context lines
 */
export function extractCodeSnapshot(
  lines: string[],
  lineNumber: number,
  contextSize: number = 3
): CodeSnapshot {
  const context: ContextLine[] = [];
  const start = Math.max(0, lineNumber - contextSize);
  const end = Math.min(lines.length - 1, lineNumber + contextSize);

  for (let i = start; i <= end; i++) {
    context.push({
      lineNumber: i + 1,
      content: lines[i] || '',
      isMatch: i === lineNumber,
    });
  }

  return {
    content: lines[lineNumber] || '',
    context,
    lineNumber: lineNumber + 1,
  };
}

/**
 * Create audit evidence for a fix
 */
export async function createEvidence(
  finding: Finding,
  filePath: string,
  contentBefore: string,
  contentAfter: string,
  lineNumber: number,
  fixType: FixType
): Promise<AuditEvidence> {
  const linesBefore = contentBefore.split('\n');
  const linesAfter = contentAfter.split('\n');

  const before = extractCodeSnapshot(linesBefore, lineNumber);
  const after = extractCodeSnapshot(linesAfter, lineNumber);

  return {
    id: randomUUID(),
    findingId: finding.id,
    timestamp: new Date().toISOString(),
    filePath,
    before,
    after,
    fileHashBefore: hashContent(contentBefore),
    fileHashAfter: hashContent(contentAfter),
    hipaaReference: finding.hipaaReference || 'General HIPAA Security Rule',
    fixType,
    description: `Auto-fixed: ${finding.title}`,
  };
}

/**
 * Generate a hash for the entire audit trail (for verification)
 */
export function generateAuditTrailHash(evidence: AuditEvidence[]): string {
  const evidenceStr = evidence
    .map(e => `${e.id}|${e.fileHashBefore}|${e.fileHashAfter}|${e.timestamp}`)
    .join('\n');
  return hashContent(evidenceStr);
}

/**
 * Read file and compute hash
 */
export async function getFileWithHash(filePath: string): Promise<{ content: string; hash: string }> {
  const content = await readFile(filePath, 'utf-8');
  return {
    content,
    hash: hashContent(content),
  };
}
