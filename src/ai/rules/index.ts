/**
 * AI-Powered HIPAA Rules
 * Export all LLM-based detection rules
 */

import type { LLMRule } from './rule-runner.js';
import {
  MINIMUM_ACCESS_SYSTEM_PROMPT,
  MINIMUM_ACCESS_USER_PROMPT,
} from './prompts/minimum-access.js';
import {
  PHI_ENCRYPTION_SYSTEM_PROMPT,
  PHI_ENCRYPTION_USER_PROMPT,
} from './prompts/phi-encryption.js';
import {
  RBAC_CHECK_SYSTEM_PROMPT,
  RBAC_CHECK_USER_PROMPT,
} from './prompts/rbac-check.js';
import {
  AUDIT_LOGGING_SYSTEM_PROMPT,
  AUDIT_LOGGING_USER_PROMPT,
} from './prompts/audit-logging.js';
import {
  DATA_RETENTION_SYSTEM_PROMPT,
  DATA_RETENTION_USER_PROMPT,
} from './prompts/data-retention.js';
import {
  SESSION_MANAGEMENT_SYSTEM_PROMPT,
  SESSION_MANAGEMENT_USER_PROMPT,
} from './prompts/session-management.js';

export const AI_RULES: LLMRule[] = [
  {
    id: 'HIPAA-PHI-003',
    name: 'Minimum Necessary Access',
    category: 'phi',
    systemPrompt: MINIMUM_ACCESS_SYSTEM_PROMPT,
    userPromptTemplate: MINIMUM_ACCESS_USER_PROMPT,
  },
  {
    id: 'HIPAA-SEC-001',
    name: 'PHI Encryption',
    category: 'encryption',
    systemPrompt: PHI_ENCRYPTION_SYSTEM_PROMPT,
    userPromptTemplate: PHI_ENCRYPTION_USER_PROMPT,
  },
  {
    id: 'HIPAA-ACCESS-001',
    name: 'Role-Based Access Control',
    category: 'access',
    systemPrompt: RBAC_CHECK_SYSTEM_PROMPT,
    userPromptTemplate: RBAC_CHECK_USER_PROMPT,
  },
  {
    id: 'HIPAA-AUDIT-001',
    name: 'Audit Logging',
    category: 'audit',
    systemPrompt: AUDIT_LOGGING_SYSTEM_PROMPT,
    userPromptTemplate: AUDIT_LOGGING_USER_PROMPT,
  },
  {
    id: 'HIPAA-RETENTION-001',
    name: 'Data Retention',
    category: 'retention',
    systemPrompt: DATA_RETENTION_SYSTEM_PROMPT,
    userPromptTemplate: DATA_RETENTION_USER_PROMPT,
  },
  {
    id: 'HIPAA-AUTH-001',
    name: 'Session Management',
    category: 'access',
    systemPrompt: SESSION_MANAGEMENT_SYSTEM_PROMPT,
    userPromptTemplate: SESSION_MANAGEMENT_USER_PROMPT,
  },
];

export { RuleRunner } from './rule-runner.js';
export { triageFinding, triageFindings } from './triage.js';
export type { LLMRule } from './rule-runner.js';
export type {
  AIFinding,
  TriagedFinding,
  TriageClassification,
  LLMRuleResponse,
  TriageResponse,
} from './types.js';
