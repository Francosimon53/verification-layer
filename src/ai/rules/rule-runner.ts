/**
 * Rule Runner - Orchestrates LLM-powered HIPAA rule execution
 */

import { getAIClient, isAIAvailable } from '../client.js';
import { AI_CONFIG } from '../config.js';
import { sanitizeCodeForLLM } from '../sanitizer.js';
import { CostTracker } from '../cost-tracker.js';
import { AICache } from '../cache.js';
import { RateLimiter } from '../rate-limiter.js';
import type { AIFinding, LLMRuleResponse } from './types.js';
import type { Finding } from '../../types.js';

export interface LLMRule {
  id: string;
  name: string;
  category: string;
  systemPrompt: string;
  userPromptTemplate: (sanitizedCode: string, filePath: string) => string;
}

export class RuleRunner {
  private cache: AICache;
  private rateLimiter: RateLimiter;
  private costTracker: CostTracker;

  constructor(
    costTracker: CostTracker,
    cache?: AICache,
    rateLimiter?: RateLimiter
  ) {
    this.costTracker = costTracker;
    this.cache = cache || new AICache();
    this.rateLimiter = rateLimiter || new RateLimiter();
  }

  async runRule(
    rule: LLMRule,
    fileContent: string,
    filePath: string
  ): Promise<AIFinding[]> {
    if (!isAIAvailable()) {
      return [];
    }

    // Check cache first
    const cached = await this.cache.get(fileContent, rule.id);
    if (cached) {
      return this.convertToAIFindings(cached, filePath, rule);
    }

    // Check rate limit
    await this.rateLimiter.waitIfNeeded();

    // Check budget
    if (this.costTracker.isOverBudget()) {
      console.warn(
        `⚠️  AI budget exceeded (${this.costTracker.getEstimatedCostCents()}¢). Skipping rule: ${rule.name}`
      );
      return [];
    }

    // Sanitize code before sending to LLM
    const { sanitizedCode, warnings, phiFound } = sanitizeCodeForLLM(
      fileContent,
      filePath
    );

    if (phiFound > 0) {
      console.log(`🔒 Scrubbed ${phiFound} PHI patterns from ${filePath}`);
    }

    if (warnings.length > 0) {
      warnings.forEach((w) => console.warn(`⚠️  ${w}`));
    }

    try {
      const client = getAIClient();
      const userPrompt = rule.userPromptTemplate(sanitizedCode, filePath);

      this.rateLimiter.recordCall();

      const response = await client.messages.create({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
        system: rule.systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      // Track cost
      this.costTracker.trackUsage(
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const result: LLMRuleResponse = JSON.parse(content.text);

      // Cache the result
      await this.cache.set(fileContent, rule.id, result);

      return this.convertToAIFindings(result, filePath, rule);
    } catch (error) {
      console.error(
        `Error running LLM rule ${rule.name}:`,
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  private convertToAIFindings(
    result: LLMRuleResponse,
    filePath: string,
    rule: LLMRule
  ): AIFinding[] {
    return result.findings.map((f, index) => {
      // Convert numeric confidence to Confidence type
      let confidence: 'high' | 'medium' | 'low' = 'medium';
      if (f.confidence >= 0.8) {
        confidence = 'high';
      } else if (f.confidence >= 0.5) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      return {
        id: `${rule.id}-${filePath}-${f.line}-${index}`,
        file: filePath,
        line: f.line,
        category: rule.category as any,
        severity: f.severity,
        title: `${rule.name}: ${f.message}`,
        description: f.message,
        recommendation: f.suggestion,
        hipaaReference: f.hipaaReference,
        source: 'ai' as const,
        confidence,
      };
    });
  }

  async runRulesOnFile(
    rules: LLMRule[],
    fileContent: string,
    filePath: string
  ): Promise<AIFinding[]> {
    const allFindings: AIFinding[] = [];

    for (const rule of rules) {
      const findings = await this.runRule(rule, fileContent, filePath);
      allFindings.push(...findings);

      // Stop if over budget
      if (this.costTracker.isOverBudget()) {
        console.warn(
          `⚠️  AI budget exceeded. Processed ${allFindings.length} findings so far.`
        );
        break;
      }
    }

    return allFindings;
  }

  getStats() {
    return {
      cost: this.costTracker.getStats(),
      rateLimit: this.rateLimiter.getStats(),
    };
  }
}
