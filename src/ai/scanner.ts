/**
 * AI-Powered Scanner - Main entry point for AI scanning
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { isAIAvailable } from './client.js';
import { AI_CONFIG } from './config.js';
import { CostTracker } from './cost-tracker.js';
import { AICache } from './cache.js';
import { RateLimiter } from './rate-limiter.js';
import { RuleRunner, AI_RULES } from './rules/index.js';
import { triageFindings } from './rules/triage.js';
import type { AIFinding, TriagedFinding } from './rules/types.js';
import type { Finding } from '../types.js';

export interface AIScanOptions {
  enableTriage?: boolean;
  enableLLMRules?: boolean;
  budgetCents?: number;
  targetFiles?: string[];
}

export interface AIScanResult {
  aiFindings: AIFinding[];
  triagedFindings: TriagedFinding[];
  stats: {
    filesScanned: number;
    aiCallsMade: number;
    costCents: number;
    cacheHits: number;
    phiPatternsScubbed: number;
  };
}

/**
 * Run AI-powered HIPAA scanning on target files
 */
export async function runAIScan(
  targetDir: string,
  options: AIScanOptions = {}
): Promise<AIScanResult> {
  const {
    enableTriage = true,
    enableLLMRules = true,
    budgetCents = AI_CONFIG.budget.defaultMaxCentsPerScan,
    targetFiles = [],
  } = options;

  if (!isAIAvailable()) {
    console.warn(
      '⚠️  AI scanning disabled: ANTHROPIC_API_KEY or VLAYER_AI_KEY not found'
    );
    return {
      aiFindings: [],
      triagedFindings: [],
      stats: {
        filesScanned: 0,
        aiCallsMade: 0,
        costCents: 0,
        cacheHits: 0,
        phiPatternsScubbed: 0,
      },
    };
  }

  console.log('🤖 Starting AI-powered HIPAA scan...');

  const costTracker = new CostTracker(budgetCents);
  const cache = new AICache();
  const rateLimiter = new RateLimiter();
  const ruleRunner = new RuleRunner(costTracker, cache, rateLimiter);

  const aiFindings: AIFinding[] = [];
  let filesScanned = 0;

  // Run LLM rules
  if (enableLLMRules) {
    console.log(`📋 Running ${AI_RULES.length} LLM-powered rules...`);

    for (const filePath of targetFiles) {
      try {
        const fullPath = path.join(targetDir, filePath);
        const fileContent = await fs.readFile(fullPath, 'utf-8');

        const findings = await ruleRunner.runRulesOnFile(
          AI_RULES,
          fileContent,
          filePath
        );

        aiFindings.push(...findings);
        filesScanned++;

        if (costTracker.isOverBudget()) {
          console.warn('⚠️  AI budget exceeded, stopping LLM scan');
          break;
        }
      } catch (error) {
        console.error(`Error scanning ${filePath}:`, error);
      }
    }
  }

  const stats = ruleRunner.getStats();
  console.log(
    `✅ AI scan complete: ${filesScanned} files, ${aiFindings.length} findings, ${stats.cost.estimatedCost}¢`
  );

  return {
    aiFindings,
    triagedFindings: [],
    stats: {
      filesScanned,
      aiCallsMade: stats.rateLimit.totalCalls,
      costCents: stats.cost.estimatedCost,
      cacheHits: 0, // TODO: Track cache hits
      phiPatternsScubbed: 0, // TODO: Track across all files
    },
  };
}

/**
 * Triage existing findings to reduce false positives
 */
export async function triageExistingFindings(
  findings: Finding[],
  fileContents: Map<string, string>
): Promise<TriagedFinding[]> {
  if (!isAIAvailable()) {
    console.warn('⚠️  AI triage disabled: API key not found');
    return findings.map((f) => ({
      ...f,
      aiClassification: 'likely' as const,
      aiConfidence: 0.5,
      aiReasoning: 'AI not available',
      source: 'static' as const,
    }));
  }

  console.log(`🔍 Triaging ${findings.length} findings...`);
  const triaged = await triageFindings(findings, fileContents);

  const falsePositives = triaged.filter(
    (f) => f.aiClassification === 'false_positive'
  ).length;

  console.log(
    `✅ Triage complete: ${falsePositives} false positives filtered`
  );

  return triaged;
}
