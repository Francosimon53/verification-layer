/**
 * AI Configuration
 */

export const AI_CONFIG = {
  model: 'claude-sonnet-4-6' as const,
  maxTokens: 2048,
  temperature: 0.1, // Deterministic for security
  maxFileSizeBytes: 50_000, // Don't send files > 50KB
  maxConcurrentCalls: 3,
  rateLimit: {
    maxCallsPerMinute: 20,
    maxCallsPerScan: 50,
  },
  triage: {
    model: 'claude-haiku-4-5-20251001', // Haiku for triage (pattern-level, ~3x cheaper than Sonnet)
    concurrency: 10,     // parallel triage calls (Haiku has the rate headroom)
    timeoutMs: 30_000,   // abort a single triage call that hangs
    maxRetries: 1,       // keep total time bounded
    maxFindings: 50,     // hard cap; findings beyond this are returned regex-only, not AI-verified
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
