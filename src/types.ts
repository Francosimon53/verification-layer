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

/**
 * WHY a finding was, or was not, verified by AI triage.
 *
 * This is the MACHINE-READABLE state. `aiReasoning` alongside it is user-facing
 * prose and must never be parsed: deriving `aiFindingsCapped` / `aiFindingsFailed`
 * by string-matching that copy coupled published evidence to wording, so a
 * copy edit could silently change reported numbers.
 *
 * A boolean is deliberately insufficient — `cap_reached`, `error` and
 * `ai_verified` must be independently distinguishable, because the attestation
 * reports capped and failed counts separately.
 */
export type TriageOutcome =
  /** A model call was made and returned a verdict. */
  | 'ai_verified'
  /** Beyond AI_CONFIG.triage.maxFindings — regex-flagged only, NOT AI-verified. */
  | 'cap_reached'
  /** The file's content was unavailable, so no call could be made. */
  | 'no_content'
  /** A model call was attempted and failed (timeout, bad JSON, API error). */
  | 'error'
  /** AI triage was unavailable entirely (no API key). */
  | 'unavailable';

export interface Finding {
  id: string;
  /**
   * Canonical rule identity, DECLARED by the emitting scanner at the moment it
   * creates the finding — the scanner already holds the pattern/rule object and
   * therefore knows this for a fact.
   *
   * `id` is a DISPLAY identity and is not reliable for rule lookup: several
   * scanners interpolate a prefix and the line number into it (`phi-<pattern>-42`,
   * `access-<issue>-17`, `custom-<rule>-<file>-3`), so it does not match
   * `RULE_CATALOG`. Deriving a canonical id by stripping those affixes would be a
   * heuristic and a second source of truth; declaring it here makes it factual.
   *
   * Built-in rules carry their RULE_CATALOG id verbatim. Custom rules use the
   * `custom:<id>` namespace (`:` cannot occur in a built-in id, so the two can
   * never collide). Absent means identity is UNKNOWN — consumers must never
   * infer one, and the attestation records `ruleKnown: false`.
   */
  canonicalRuleId?: string;
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
    /**
     * The configured expiry, when the acknowledgment is time-bounded.
     *
     * Previously only the derived `expired` boolean was propagated, which made a
     * time-bounded acknowledgment indistinguishable from an open-ended one
     * (`expired` is `false` in both cases). The evidence model needs that
     * distinction: an acknowledgment WITH an expiry is a time-bounded exception
     * that must resurface, an open-ended one is not. Additive and optional.
     */
    expiresAt?: string;
    ticketUrl?: string;
    expired?: boolean;
  };
  suppressed?: boolean;
  suppression?: {
    reason: string;
    comment: string;
  };
  isBaseline?: boolean;
  /**
   * Why this finding was, or was not, AI-verified. Present only once triage has
   * run. The SINGLE SOURCE OF TRUTH for triage metrics — never parse
   * `aiReasoning`, which is display copy.
   */
  triageOutcome?: TriageOutcome;
  /**
   * Set when `--min-confidence` excluded this finding from blocking.
   *
   * The legacy pipeline signals this by ALSO setting `isBaseline: true`, which
   * conflates two different things: a baseline is accepted historical debt that
   * a human recorded and removes by editing the baseline file, whereas a
   * below-threshold finding is a detector-confidence judgement that flips the
   * moment the threshold changes. `isBaseline` keeps its legacy meaning for
   * backwards compatibility; this flag lets the evidence model tell them apart.
   */
  belowMinConfidence?: boolean;
  /** The `--min-confidence` threshold in force when this finding was evaluated. */
  minConfidenceThreshold?: Confidence;
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
  examples: Occurrence[];       // Top 3-5 occurrences for immediate context
  occurrences: Occurrence[];    // Full list (used internally / in details)
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

/** Why a finding was removed from `ScanResult.findings`. */
export type FilterReason = 'ai-false-positive';

/**
 * A finding that was detected and then removed from the active `findings`
 * collection. NOTHING DETECTED MAY SILENTLY DISAPPEAR: the legacy pipeline
 * deletes AI-classified false positives outright, so this parallel record is
 * what lets the evidence model preserve them with an explicit disposition
 * instead of losing them. `findings` is unchanged — nothing moves back in.
 */
export interface FilteredFinding {
  finding: Finding;
  reason: FilterReason;
}

/**
 * AI triage provenance for a scan.
 *
 * AI triage is NOT deterministic: sampling, model updates, timeouts and the
 * per-scan cap all mean a re-run can classify differently. Recording what
 * actually happened is what lets an attestation distinguish deterministic
 * detection evidence from AI-assisted adjudication.
 */
export interface ScanAiTriage {
  /** The flags/config permitted triage to run. */
  enabled: boolean;
  /** It actually executed (an API key was present and calls were made). */
  applied: boolean;
  submitted: number;
  /** Beyond the per-scan cap: returned regex-flagged only, NOT AI-verified. */
  capped: number;
  failed: number;
}

/**
 * Evidence that detection ACTUALLY RAN. Absence of findings is never evidence
 * that a control was evaluated: a scanner filters by extension, so a repository
 * with no matching files gives it nothing to inspect. Without this record, a
 * control with zero findings could not be distinguished from a control whose
 * rules never executed.
 */
export interface ScanExecution {
  categoriesRequested: ComplianceCategory[];
  scanners: Array<{
    key: string;
    category: ComplianceCategory;
    invoked: boolean;
    /** Null when the scanner does not implement `selectFiles` — forces `not_evaluated`. */
    filesConsidered: number | null;
  }>;
  customRuleIds: string[];
  filesScanned: number;
}

export interface ScanResult {
  findings: Finding[];
  groupedFindings: GroupedFinding[];
  rawFindingsCount: number;
  scannedFiles: number;
  scanDuration: number;
  stack?: StackInfo;
  complianceScore?: ComplianceScore;
  /** Detected-then-removed findings, preserved for the evidence model. */
  filtered?: FilteredFinding[];
  /** Execution evidence for control-coverage adjudication. */
  execution?: ScanExecution;
  /** Whether AI triage was permitted, whether it ran, and what it left unverified. */
  aiTriage?: ScanAiTriage;
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
  /** Enable AI-powered triage. The CLI --no-ai flag sets this false. Default: true. */
  enableAI?: boolean;
  /**
   * Scan vlayer's own generated output artifacts (reports, baseline, samples/).
   * Default false — these are excluded so the scanner never flags its own output.
   */
  includeOwnArtifacts?: boolean;
}

export interface Scanner {
  name: string;
  category: ComplianceCategory;
  scan(files: string[], options: ScanOptions): Promise<Finding[]>;
  /**
   * The subset of `files` this scanner is eligible to inspect.
   *
   * EXECUTION EVIDENCE. Scanners filter by extension, so "the scanner was
   * invoked" does not mean "its rules ran": a repository of pure YAML gives the
   * PHI scanner nothing to read, and reporting its controls as
   * `no_blocking_findings` would fabricate coverage. Attestation needs to know
   * how many files each scanner actually considered.
   *
   * OPTIONAL, so every existing (and third-party) Scanner implementation stays
   * valid. A scanner that omits it reports `filesConsidered: null`, which forces
   * dependent controls to `not_evaluated` — the safe direction.
   *
   * Implementations MUST return exactly the set `scan()` iterates over; each
   * built-in scanner calls this same function internally so the two cannot drift.
   */
  selectFiles?(files: string[]): string[];
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
  format: 'json' | 'html' | 'markdown' | 'pdf';
  outputPath?: string;
  vulnerabilities?: DependencyVulnerability[];
  scanComparison?: ScanComparison | null;
  branding?: ResolvedBranding;
}

/**
 * White-label branding for reports, as provided by the user via CLI flags
 * (`--brand-name`, `--brand-logo`) or the `branding` block in config.
 */
export interface Branding {
  /** Name shown as the report author ("Prepared by ..."). */
  name?: string;
  /** Path to a logo image (png/jpg/svg) used on the cover and footer. */
  logo?: string;
}

/**
 * Branding after validation: a usable logo (existing file, supported format)
 * or none, plus any warnings to surface to the user. Reporters consume this.
 */
export interface ResolvedBranding {
  /** Sanitized brand name, or undefined to fall back to default VLayer branding. */
  name?: string;
  /** Absolute path to a validated logo file, or undefined if none/invalid. */
  logoPath?: string;
  /** Logo format, derived from the file extension. */
  logoFormat?: 'png' | 'jpg' | 'svg';
  /** Non-fatal warnings (e.g. missing or unsupported logo) to print to the user. */
  warnings: string[];
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
  /** White-label branding applied to HTML and PDF reports. */
  branding?: Branding;
  /**
   * Scan vlayer's own generated output artifacts (reports, baseline, samples/).
   * Default false. The CLI flag `--include-own-artifacts` sets this to true.
   */
  includeOwnArtifacts?: boolean;
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
