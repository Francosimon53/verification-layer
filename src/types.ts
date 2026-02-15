export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ComplianceCategory =
  | 'phi-exposure'
  | 'encryption'
  | 'audit-logging'
  | 'access-control'
  | 'data-retention';

export interface ContextLine {
  lineNumber: number;
  content: string;
  isMatch: boolean;
}

export type FixType =
  | 'sql-injection-template'
  | 'sql-injection-concat'
  | 'hardcoded-password'
  | 'hardcoded-secret'
  | 'api-key-exposed'
  | 'phi-console-log'
  | 'http-url'
  | 'innerhtml-unsanitized'
  | 'phi-localstorage'
  | 'phi-url-param'
  | 'phi-log-unredacted'
  | 'cookie-insecure'
  | 'backup-unencrypted';

export type Confidence = 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  category: ComplianceCategory;
  severity: Severity;
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  recommendation: string;
  hipaaReference?: string;
  context?: ContextLine[];
  fixType?: FixType;
  confidence?: Confidence;
  adjustConfidenceByContext?: boolean;
  acknowledged?: boolean;
  acknowledgment?: {
    reason: string;
    acknowledgedBy: string;
    acknowledgedAt: string;
    ticketUrl?: string;
    expired?: boolean;
  };
  suppressed?: boolean;
  suppression?: {
    reason: string;
    comment: string;
  };
  isBaseline?: boolean;
}

export interface Occurrence {
  file: string;
  line?: number;
}

export interface GroupedFinding {
  id: string;
  category: ComplianceCategory;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  hipaaReference?: string;
  confidence?: Confidence;
  occurrenceCount: number;
  fileCount: number;
  occurrences: Occurrence[];
}

export interface StackInfo {
  framework: string;
  database: string;
  auth: string;
  frameworkDisplay: string;
  databaseDisplay: string;
  authDisplay: string;
  recommendations: string[];
}

export interface ComplianceScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  breakdown: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    acknowledged: number;
  };
  penalties: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  recommendations: string[];
}

export interface ScanResult {
  findings: Finding[];
  groupedFindings: GroupedFinding[];
  rawFindingsCount: number;
  scannedFiles: number;
  scanDuration: number;
  stack?: StackInfo;
  complianceScore?: ComplianceScore;
}

export interface ScanOptions {
  path: string;
  categories?: ComplianceCategory[];
  exclude?: string[];
  configFile?: string;
  config?: VlayerConfig;
  fix?: boolean;
  baselineFile?: string;
  minConfidence?: Confidence;
}

export interface Scanner {
  name: string;
  category: ComplianceCategory;
  scan(files: string[], options: ScanOptions): Promise<Finding[]>;
}

export interface Report {
  timestamp: string;
  targetPath: string;
  summary: {
    total: number;
    uniqueFindings: number;
    acknowledged: number;
    suppressed: number;
    baseline: number;
    unacknowledged: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    vulnerabilities?: {
      total: number;
      critical: number;
      high: number;
      moderate: number;
      low: number;
    };
  };
  findings: Finding[];
  groupedFindings: GroupedFinding[];
  rawFindingsCount: number;
  scannedFiles: number;
  scanDuration: number;
  stack?: StackInfo;
  vulnerabilities?: DependencyVulnerability[];
}

export interface ReportOptions {
  format: 'json' | 'html' | 'markdown';
  outputPath?: string;
  vulnerabilities?: DependencyVulnerability[];
  scanComparison?: ScanComparison | null;
}

export interface ScanComparison {
  previousScan?: {
    timestamp: string;
    date: string;
    complianceScore: number;
    severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    failedRuleIds: string[];
    totalFilesScanned: number;
  };
  scoreChange: number;
  severityChanges: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  newIssues: string[];
  resolvedIssues: string[];
}

export interface DependencyVulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  via: string;
  range: string;
  fixAvailable: boolean | { name: string; version: string };
  url?: string;
}

export interface AcknowledgedFinding {
  pattern: string;
  id?: string;
  category?: ComplianceCategory;
  severity?: Severity;
  reason: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
  expiresAt?: string;
  ticketUrl?: string;
}

export interface VlayerConfig {
  exclude?: string[];
  ignorePaths?: string[];
  safeHttpDomains?: string[];
  contextLines?: number;
  categories?: ComplianceCategory[];
  customRulesPath?: string;
  disableBuiltinRules?: string[];
  acknowledgedFindings?: AcknowledgedFinding[];
  ai?: {
    enabled?: boolean;
    enableTriage?: boolean;
    enableLLMRules?: boolean;
    filterFalsePositives?: boolean;
    budgetCents?: number;
  };
}

export interface FixResult {
  finding: Finding;
  fixed: boolean;
  originalLine: string;
  fixedLine: string;
  fixType: FixType;
}

export interface FixReport {
  totalFindings: number;
  fixedCount: number;
  skippedCount: number;
  fixes: FixResult[];
}

// === Audit Trail Types ===

export interface CodeSnapshot {
  content: string;
  context: ContextLine[];
  lineNumber: number;
}

export interface AuditEvidence {
  id: string;
  findingId: string;
  timestamp: string;
  filePath: string;
  before: CodeSnapshot;
  after: CodeSnapshot;
  fileHashBefore: string;
  fileHashAfter: string;
  hipaaReference: string;
  fixType: FixType;
  description: string;
}

export type ManualReviewStatus =
  | 'pending_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'accepted_risk';

export interface ManualReviewItem {
  id: string;
  findingId: string;
  finding: Finding;
  status: ManualReviewStatus;
  assignedTo?: string;
  suggestedDeadline: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  resolution?: string;
}

export interface AuditTrail {
  id: string;
  createdAt: string;
  projectPath: string;
  projectName: string;
  scanDuration: number;
  scannedFiles: number;
  totalFindings: number;
  autoFixedCount: number;
  manualReviewCount: number;
  evidence: AuditEvidence[];
  manualReviews: ManualReviewItem[];
  reportHash?: string;
}

export interface AuditReportOptions {
  outputPath: string;
  includeEvidence?: boolean;
  includeManualReviews?: boolean;
  organizationName?: string;
  auditorName?: string;
}

// === Custom Rules Types ===

export interface CustomRuleFix {
  type: 'replace' | 'remove' | 'wrap';
  replacement?: string;
  wrapper?: {
    before: string;
    after: string;
  };
}

export interface CompiledCustomRule {
  id: string;
  name: string;
  description: string;
  category: ComplianceCategory;
  severity: Severity;
  pattern: string;
  flags?: string;
  include?: string[];
  exclude?: string[];
  recommendation: string;
  hipaaReference?: string;
  mustNotContain?: string;
  fix?: CustomRuleFix;
  compiledPattern: RegExp;
  compiledMustNotContain?: RegExp;
  // Semantic awareness fields
  confidence?: Confidence;
  contexts?: Array<'code' | 'string' | 'comment' | 'template'>;
  adjustConfidenceByContext?: boolean;
}
