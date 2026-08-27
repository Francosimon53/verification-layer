export { scan, groupFindings } from './scan.js';
export { generateReport } from './reporters/index.js';
export { loadCustomRules, validateRulesFile, scanWithCustomRules } from './rules/index.js';
export {
  RULE_CATALOG,
  getAllRules,
  getRulesByCategory,
  getCategoryCounts,
} from './rules/catalog.js';
export type { CatalogRule, CatalogSeverity, Category } from './rules/catalog.js';

// === Attestation / Evidence / Adjudication (M1) ===
// Attestation is a core architectural primitive, not a report format: the
// evidence model is the system of record and reports are views over it.
export * from './attestation/index.js';
export { loadBaseline, saveBaseline, applyBaseline, generateFindingHash } from './baseline.js';
export { checkInlineSuppression, applyInlineSuppressions } from './suppression.js';
export { checkAcknowledgment, applyAcknowledgments } from './acknowledgments.js';
export { calculateComplianceScore, formatScore, getScoreColor, getScoreSummary } from './compliance-score.js';
export type {
  Finding,
  ScanResult,
  ScanOptions,
  Report,
  ReportOptions,
  Scanner,
  Severity,
  ComplianceCategory,
  Confidence,
  TriageOutcome,
  VlayerConfig,
  AcknowledgedFinding,
  ContextLine,
  CompiledCustomRule,
  CustomRuleFix,
  ComplianceScore,
  GroupedFinding,
  Occurrence,
} from './types.js';
export type { LoadRulesResult, RuleLoadError, CustomRuleDefinition, RulesFile } from './rules/index.js';
export type { Baseline, BaselineEntry } from './baseline.js';
