import type { Finding, Severity } from '../types.js';
import type { BaselineEntry } from '../baseline.js';

export interface GitContext {
  available: boolean;
  root: string;
  branch?: string;
  headSha?: string;
  baseSha?: string;
  author?: string;
  changedFiles: string[];
  repository?: string;
  commitUrl?: string;
}

export interface FindingDelta {
  newFindings: Finding[];
  newFindingsInChangedFiles: Finding[];
  baselineFindings: Finding[];
  resolvedFindings: BaselineEntry[];
  changedFiles: string[];
}

export interface SeverityBudget {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  info?: number;
}

export interface DeliveryPolicy {
  /** Severities that always block when a new active finding is considered. */
  blockOn?: Severity[];
  /** Maximum number of new findings allowed by severity. */
  maxNew?: SeverityBudget;
  /** Evaluate only findings in files changed by the git comparison. Default true when git is available. */
  changedFilesOnly?: boolean;
  /** Optional minimum overall compliance score. */
  minimumScore?: number;
  /** Require a baseline file before the gate can pass. */
  requireBaseline?: boolean;
  /** Expired acknowledgments are governance failures even when the underlying finding is low severity. */
  failOnExpiredAcknowledgments?: boolean;
}

export interface PolicyReason {
  code:
    | 'BLOCKING_SEVERITY'
    | 'SEVERITY_BUDGET_EXCEEDED'
    | 'MINIMUM_SCORE'
    | 'BASELINE_REQUIRED'
    | 'EXPIRED_ACKNOWLEDGMENT';
  message: string;
  severity?: Severity;
  count?: number;
  limit?: number;
}

export interface PolicyDecision {
  status: 'pass' | 'fail';
  deployAllowed: boolean;
  evaluatedAt: string;
  consideredScope: 'changed-files' | 'all-files';
  counts: Record<Severity, number>;
  totalConsidered: number;
  reasons: PolicyReason[];
  policy: Required<Pick<DeliveryPolicy, 'changedFilesOnly' | 'minimumScore' | 'requireBaseline' | 'failOnExpiredAcknowledgments'>> & {
    blockOn: Severity[];
    maxNew: SeverityBudget;
  };
}

export type ComplianceGraphNodeType =
  | 'code'
  | 'finding'
  | 'control'
  | 'policy'
  | 'owner'
  | 'evidence';

export interface ComplianceGraphNode {
  id: string;
  type: ComplianceGraphNodeType;
  label: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ComplianceGraphEdge {
  from: string;
  to: string;
  relation: 'contains' | 'violates' | 'governed-by' | 'owned-by' | 'supports';
}

export interface ComplianceGraph {
  schemaVersion: '1.0';
  generatedAt: string;
  nodes: ComplianceGraphNode[];
  edges: ComplianceGraphEdge[];
}

export interface EvidenceFinding {
  fingerprint: string;
  ruleId: string;
  id: string;
  severity: Severity;
  category: string;
  title: string;
  file: string;
  line?: number;
  hipaaReference?: string;
  recommendation: string;
  acknowledged: boolean;
  acknowledgment?: {
    reason: string;
    acknowledgedBy: string;
    acknowledgedAt: string;
    ticketUrl?: string;
    expired?: boolean;
  };
  baseline: boolean;
  suppressed: boolean;
}

export interface EvidencePackage {
  schemaVersion: '1.0';
  generatedAt: string;
  project: {
    name: string;
  };
  source: {
    repository?: string;
    branch?: string;
    headSha?: string;
    baseSha?: string;
    author?: string;
    commitUrl?: string;
    changedFiles: string[];
  };
  decision: PolicyDecision;
  summary: {
    scannedFiles: number;
    totalFindings: number;
    newFindings: number;
    resolvedFindings: number;
    acknowledged: number;
    suppressed: number;
    complianceScore?: number;
  };
  controls: string[];
  findings: EvidenceFinding[];
  graph: ComplianceGraph;
  packageHash: string;
}

export interface RemediationItem {
  fingerprint: string;
  severity: Severity;
  title: string;
  file: string;
  line?: number;
  recommendation: string;
  autoFixAvailable: boolean;
  command?: string;
}

export interface RemediationPlan {
  deployAllowed: boolean;
  blockingCount: number;
  items: RemediationItem[];
}

export interface GuardResult {
  git: GitContext;
  delta: FindingDelta;
  decision: PolicyDecision;
  findings: Finding[];
  scannedFiles: number;
  complianceScore?: number;
  baselineLoaded: boolean;
}
