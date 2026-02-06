export { scan } from './scan.js';
export { generateReport } from './reporters/index.js';
export { loadCustomRules, validateRulesFile, scanWithCustomRules } from './rules/index.js';
export { loadBaseline, saveBaseline, applyBaseline, generateFindingHash } from './baseline.js';
export { checkInlineSuppression, applyInlineSuppressions } from './suppression.js';
export { checkAcknowledgment, applyAcknowledgments } from './acknowledgments.js';
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
} from './types.js';
export type { LoadRulesResult, RuleLoadError, CustomRuleDefinition, RulesFile } from './rules/index.js';
export type { Baseline, BaselineEntry } from './baseline.js';
