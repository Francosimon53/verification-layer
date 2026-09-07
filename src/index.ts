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
export {
  BASELINE_VERSION,
  applyBaseline,
  canonicalRuleId,
  createBaselineEntry,
  generateFindingHash,
  getFindingAnchor,
  inferProjectRoot,
  loadBaseline,
  normalizeFindingFile,
  saveBaseline,
} from './baseline.js';
export { checkInlineSuppression, applyInlineSuppressions } from './suppression.js';
export { checkAcknowledgment, applyAcknowledgments } from './acknowledgments.js';
export { calculateComplianceScore, formatScore, getScoreColor, getScoreSummary } from './compliance-score.js';
export * from './delivery/index.js';
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
