/**
 * Types for AI-powered rules
 */

import type { Finding, Confidence } from '../../types.js';

export type TriageClassification =
  | 'confirmed'
  | 'likely'
  | 'possible'
  | 'false_positive';

export interface AIFinding extends Finding {
  source: 'ai' | 'static' | 'ast';
  confidence: Confidence;
}

export interface TriagedFinding extends Finding {
  aiClassification: TriageClassification;
  aiConfidence: number;
  aiReasoning: string;
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
