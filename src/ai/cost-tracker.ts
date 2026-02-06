/**
 * Cost Tracker - Track AI API usage and costs
 */

import { AI_CONFIG } from './config.js';

export class CostTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCalls = 0;
  private budgetCents: number;

  constructor(budgetCents: number = AI_CONFIG.budget.defaultMaxCentsPerScan) {
    this.budgetCents = budgetCents;
  }

  trackUsage(inputTokens: number, outputTokens: number): void {
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.totalCalls++;
  }

  getEstimatedCostCents(): number {
    // Sonnet pricing: $3/M input, $15/M output
    const inputCost =
      (this.totalInputTokens * AI_CONFIG.pricing.inputCostPerMillion) /
      1_000_000;
    const outputCost =
      (this.totalOutputTokens * AI_CONFIG.pricing.outputCostPerMillion) /
      1_000_000;
    return (inputCost + outputCost) * 100; // Convert to cents
  }

  isOverBudget(): boolean {
    return this.getEstimatedCostCents() >= this.budgetCents;
  }

  getSummary(): string {
    const cost = this.getEstimatedCostCents() / 100;
    return (
      `AI scan: ${this.totalCalls} calls, ` +
      `${this.totalInputTokens} input tokens, ` +
      `${this.totalOutputTokens} output tokens, ` +
      `~$${cost.toFixed(3)}`
    );
  }

  getEstimate(): string {
    const estimatedCalls = this.totalCalls || 1;
    const estimatedCost =
      (estimatedCalls * AI_CONFIG.budget.estimatedCostPerCall) / 100;
    return `Estimated cost: ~$${estimatedCost.toFixed(3)} (${estimatedCalls} calls)`;
  }

  getStats() {
    return {
      totalCalls: this.totalCalls,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      estimatedCost: this.getEstimatedCostCents(),
    };
  }

  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCalls = 0;
  }
}
