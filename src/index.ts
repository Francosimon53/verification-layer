export { scan } from './scan.js';
export { generateReport } from './reporters/index.js';
export { loadCustomRules, validateRulesFile, scanWithCustomRules } from './rules/index.js';
export type {
  Finding,
  ScanResult,
  ScanOptions,
  Report,
  ReportOptions,
  Scanner,
  Severity,
  ComplianceCategory,
  VlayerConfig,
  ContextLine,
  CompiledCustomRule,
  CustomRuleFix,
} from './types.js';
export type { LoadRulesResult, RuleLoadError, CustomRuleDefinition, RulesFile } from './rules/index.js';
