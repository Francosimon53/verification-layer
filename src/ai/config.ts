/**
 * AI Configuration
 */

export const AI_CONFIG = {
  model: 'claude-sonnet-4-20250514' as const,
  maxTokens: 2048,
  temperature: 0.1, // Deterministic for security
  maxFileSizeBytes: 50_000, // Don't send files > 50KB
  maxConcurrentCalls: 3,
  rateLimit: {
    maxCallsPerMinute: 20,
    maxCallsPerScan: 50,
  },
  budget: {
    defaultMaxCentsPerScan: 50, // $0.50 default
    estimatedCostPerCall: 1.5, // ~$0.015 per call with Sonnet
  },
  cache: {
    enabled: true,
    directory: '.vlayer/ai-cache',
    ttlHours: 24,
  },
  pricing: {
    // Claude Sonnet 4 pricing (per million tokens)
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
} as const;

export type AIModel = typeof AI_CONFIG.model;
