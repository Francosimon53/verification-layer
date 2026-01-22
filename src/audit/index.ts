import { randomUUID } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename, join } from 'path';
import type {
  AuditTrail,
  AuditEvidence,
  ManualReviewItem,
  Finding,
  ManualReviewStatus,
} from '../types.js';
import { generateAuditTrailHash } from './evidence.js';

const AUDIT_DIR = '.vlayer';
const AUDIT_FILE = 'audit-trail.json';

/**
 * Create a new audit trail
 */
export function createAuditTrail(projectPath: string): AuditTrail {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    projectPath,
    projectName: basename(projectPath),
    scanDuration: 0,
    scannedFiles: 0,
    totalFindings: 0,
    autoFixedCount: 0,
    manualReviewCount: 0,
    evidence: [],
    manualReviews: [],
  };
}

/**
 * Add evidence to audit trail
 */
export function addEvidence(trail: AuditTrail, evidence: AuditEvidence): void {
  trail.evidence.push(evidence);
  trail.autoFixedCount = trail.evidence.length;
}

/**
 * Create a manual review item for findings that cannot be auto-fixed
 */
export function createManualReview(finding: Finding): ManualReviewItem {
  const now = new Date();
  const suggestedDeadline = new Date(now);

  // Set deadline based on severity
  switch (finding.severity) {
    case 'critical':
      suggestedDeadline.setDate(now.getDate() + 7); // 1 week
      break;
    case 'high':
      suggestedDeadline.setDate(now.getDate() + 14); // 2 weeks
      break;
    case 'medium':
      suggestedDeadline.setDate(now.getDate() + 30); // 1 month
      break;
    default:
      suggestedDeadline.setDate(now.getDate() + 60); // 2 months
  }

  return {
    id: randomUUID(),
    findingId: finding.id,
    finding,
    status: 'pending_review' as ManualReviewStatus,
    suggestedDeadline: suggestedDeadline.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * Add manual review items for non-fixable findings
 */
export function addManualReviews(trail: AuditTrail, findings: Finding[]): void {
  const nonFixableFindings = findings.filter(f => !f.fixType);
  for (const finding of nonFixableFindings) {
    const review = createManualReview(finding);
    trail.manualReviews.push(review);
  }
  trail.manualReviewCount = trail.manualReviews.length;
}

/**
 * Update scan statistics
 */
export function updateScanStats(
  trail: AuditTrail,
  totalFindings: number,
  scannedFiles: number,
  scanDuration: number
): void {
  trail.totalFindings = totalFindings;
  trail.scannedFiles = scannedFiles;
  trail.scanDuration = scanDuration;
}

/**
 * Finalize audit trail with hash
 */
export function finalizeAuditTrail(trail: AuditTrail): void {
  trail.reportHash = generateAuditTrailHash(trail.evidence);
}

/**
 * Save audit trail to file
 */
export async function saveAuditTrail(trail: AuditTrail, projectPath: string): Promise<string> {
  const auditDir = join(projectPath, AUDIT_DIR);
  const auditPath = join(auditDir, AUDIT_FILE);

  try {
    await mkdir(auditDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  await writeFile(auditPath, JSON.stringify(trail, null, 2), 'utf-8');
  return auditPath;
}

/**
 * Load existing audit trail
 */
export async function loadAuditTrail(projectPath: string): Promise<AuditTrail | null> {
  const auditPath = join(projectPath, AUDIT_DIR, AUDIT_FILE);

  try {
    const content = await readFile(auditPath, 'utf-8');
    return JSON.parse(content) as AuditTrail;
  } catch {
    return null;
  }
}

/**
 * Get audit trail file path
 */
export function getAuditTrailPath(projectPath: string): string {
  return join(projectPath, AUDIT_DIR, AUDIT_FILE);
}

/**
 * Update manual review status
 */
export function updateManualReviewStatus(
  trail: AuditTrail,
  reviewId: string,
  status: ManualReviewStatus,
  assignedTo?: string,
  notes?: string
): boolean {
  const review = trail.manualReviews.find(r => r.id === reviewId);
  if (!review) return false;

  review.status = status;
  review.updatedAt = new Date().toISOString();
  if (assignedTo) review.assignedTo = assignedTo;
  if (notes) review.notes = notes;

  return true;
}

/**
 * Get summary statistics from audit trail
 */
export function getAuditSummary(trail: AuditTrail) {
  const reviewsByStatus = trail.manualReviews.reduce((acc, review) => {
    acc[review.status] = (acc[review.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reviewsBySeverity = trail.manualReviews.reduce((acc, review) => {
    acc[review.finding.severity] = (acc[review.finding.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const overdueReviews = trail.manualReviews.filter(
    r => new Date(r.suggestedDeadline) < new Date() && r.status === 'pending_review'
  );

  return {
    totalFindings: trail.totalFindings,
    autoFixed: trail.autoFixedCount,
    pendingManualReview: trail.manualReviewCount,
    reviewsByStatus,
    reviewsBySeverity,
    overdueCount: overdueReviews.length,
    reportHash: trail.reportHash,
  };
}
