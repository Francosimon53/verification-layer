/**
 * AI-Powered HIPAA Scanning
 * Export all AI functionality
 */

export { getAIClient, isAIAvailable } from './client.js';
export { AI_CONFIG } from './config.js';
export { sanitizeCodeForLLM } from './sanitizer.js';
export type { SanitizationResult } from './sanitizer.js';
export { CostTracker } from './cost-tracker.js';
export { AICache } from './cache.js';
export { RateLimiter } from './rate-limiter.js';
export {
  RuleRunner,
  triageFinding,
  triageFindings,
  AI_RULES,
} from './rules/index.js';
export type {
  LLMRule,
  AIFinding,
  TriagedFinding,
  TriageClassification,
  LLMRuleResponse,
  TriageResponse,
} from './rules/index.js';
export { runAIScan, triageExistingFindings } from './scanner.js';
export type { AIScanOptions, AIScanResult } from './scanner.js';
