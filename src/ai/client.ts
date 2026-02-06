/**
 * Anthropic AI Client (singleton)
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAIClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VLAYER_AI_KEY;
    if (!apiKey) {
      throw new Error(
        'AI features require an Anthropic API key.\n' +
          'Set ANTHROPIC_API_KEY or VLAYER_AI_KEY environment variable.\n' +
          'Get your key at: https://console.anthropic.com/settings/keys'
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function isAIAvailable(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.VLAYER_AI_KEY);
}

/**
 * Reset client (useful for testing)
 */
export function resetAIClient(): void {
  client = null;
}
