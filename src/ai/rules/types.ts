/**
 * Types for AI-powered rules
 */

import type { Finding, Confidence, TriageOutcome } from '../../types.js';

export type TriageClassification =
  | 'confirmed'
  | 'likely'
  | 'possible'
  | 'false_positive';

export interface AIFinding extends Finding {
  source: 'ai' | 'static' | 'ast';
  confidence: Confidence;
}

/**
 * Re-exported for consumers of the AI module. The canonical declaration lives in
 * `src/types.ts` so that a plain `Finding` can carry triage state too — the
 * attestation's `filtered` collection holds `Finding`s that were triaged.
 */
export type { TriageOutcome };

export interface TriagedFinding extends Finding {
  aiClassification: TriageClassification;
  aiConfidence: number;
  /** Human-readable explanation. NEVER parse this — switch on `triageOutcome`. */
  aiReasoning: string;
  /**
   * Explicit triage state, REQUIRED here (narrowed from the optional field on
   * `Finding`): anything that has been through triage always has an outcome.
   */
  triageOutcome: TriageOutcome;
  source: 'static' | 'ast';
}

export interface LLMRuleResponse {
  findings: Array<{
    line: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    suggestion: string;
    hipaaReference: string;
    confidence: number;
  }>;
  summary: string;
}

export interface TriageResponse {
  classification: TriageClassification;
  confidence: number;
  reasoning: string;
  suggestedAction?: string;
}
