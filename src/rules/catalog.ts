/**
 * Built-in rule catalog — the single source of truth for every detection rule
 * shipped in vlayer. It is DERIVED from the scanners (and the AI rules), never a
 * hand-maintained parallel list: each entry traces back to a real rule
 * definition in `src/scanners/*` or `src/ai/rules`.
 *
 * Three forms of built-in rules are folded in here:
 *   1. Exported pattern arrays (e.g. PHI_PATTERNS, ALL_*_PATTERNS).
 *   2. Inline rule arrays that live in a scanner's index.ts (ACCESS_CONTROL_ISSUES,
 *      RETENTION_ISSUES, SECURITY_PATTERNS).
 *   3. Scanners that build findings inline with dynamic per-finding ids
 *      (audit, encryption). These expose an explicit metadata array of their
 *      STABLE rule families (AUDIT_RULES, ENCRYPTION_RULES) — fixed ids only.
 *
 * The category of a rule is ALWAYS the owning scanner's canonical `.category`
 * (the AI rules are normalized from their short tokens). A module-load
 * validation gate asserts every category is one of the five canonical tokens
 * from `schema.ts`, permanently preventing category drift.
 */

import { CategoryEnum, type Category } from './schema.js';
import { AI_RULES } from '../ai/rules/index.js';

// Form 1 — exported pattern arrays
import { PHI_PATTERNS } from '../scanners/phi/patterns.js';
import { ALL_SKILL_PATTERNS } from '../scanners/skills/patterns.js';
import { ALL_HIPAA_2026_PATTERNS } from '../scanners/hipaa2026/patterns.js';
import { ALL_API_SECURITY_PATTERNS } from '../scanners/api-security/patterns.js';
import { ALL_CONFIGURATION_PATTERNS } from '../scanners/configuration/patterns.js';
import { ALL_MFA_PATTERNS } from '../scanners/authentication/patterns.js';
import { ALL_ERROR_PATTERNS } from '../scanners/errors/patterns.js';
import { ALL_OPERATIONAL_PATTERNS } from '../scanners/operational/patterns.js';
import { ALL_CREDENTIAL_PATTERNS } from '../scanners/credentials/patterns.js';
import { ALL_RBAC_PATTERNS } from '../scanners/rbac/patterns.js';
import { ALL_SANITIZATION_PATTERNS } from '../scanners/sanitization/patterns.js';
import { ALL_REVOCATION_PATTERNS } from '../scanners/revocation/patterns.js';

// Form 2 — inline rule arrays exported from a scanner's index.ts
import { ACCESS_CONTROL_ISSUES } from '../scanners/access/index.js';
import { RETENTION_ISSUES } from '../scanners/retention/index.js';
import { SECURITY_PATTERNS } from '../scanners/security/index.js';

// Form 3 — stable families for scanners that emit dynamic per-finding ids
import { AUDIT_RULES } from '../scanners/audit/index.js';
import { ENCRYPTION_RULES } from '../scanners/encryption/index.js';

export { type Category };

export type CatalogSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CatalogRule {
  id: string;
  category: Category;
  severity: CatalogSeverity;
  title: string;
  description: string;
  recommendation?: string;
  hipaaReference?: string;
  source: 'pattern' | 'ai';
  scanner: string;
}

/**
 * The shared, structurally-compatible shape across all scanner rule arrays.
 * Different scanners name the human title `title` (phi, access, retention,
 * security) or `name` (the `*Pattern` interfaces); both are accepted here.
 */
interface RawScannerRule {
  id: string;
  severity: string;
  title?: string;
  name?: string;
  description: string;
  recommendation?: string;
  hipaaReference?: string;
}

const SEVERITIES: readonly CatalogSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

function normalizeSeverity(severity: string): CatalogSeverity {
  const value = severity.toLowerCase();
  return (SEVERITIES as readonly string[]).includes(value)
    ? (value as CatalogSeverity)
    : 'info';
}

function fromScanner(
  scanner: string,
  category: Category,
  rules: readonly RawScannerRule[],
): CatalogRule[] {
  return rules.map((rule) => ({
    id: rule.id,
    category,
    severity: normalizeSeverity(rule.severity),
    title: rule.title ?? rule.name ?? rule.id,
    description: rule.description,
    recommendation: rule.recommendation,
    hipaaReference: rule.hipaaReference,
    source: 'pattern' as const,
    scanner,
  }));
}

/** AI rules carry SHORT category tokens that must be normalized to the enum. */
const AI_CATEGORY_MAP: Record<string, Category> = {
  phi: 'phi-exposure',
  encryption: 'encryption',
  audit: 'audit-logging',
  access: 'access-control',
  retention: 'data-retention',
};

function fromAiRules(): CatalogRule[] {
  return AI_RULES.map((rule) => {
    const category = AI_CATEGORY_MAP[rule.category];
    if (!category) {
      throw new Error(`[rule-catalog] Unknown AI rule category "${rule.category}" for ${rule.id}`);
    }
    return {
      id: rule.id,
      category,
      // AI rules have no fixed severity (severity is decided by the LLM at runtime).
      severity: 'info' as const,
      title: rule.name,
      description: rule.name,
      source: 'ai' as const,
      scanner: 'ai',
    };
  });
}

function buildCatalog(): CatalogRule[] {
  const rules: CatalogRule[] = [
    // Form 1 — exported pattern arrays (category = owning scanner's .category)
    ...fromScanner('phi', 'phi-exposure', PHI_PATTERNS),
    ...fromScanner('skills', 'access-control', ALL_SKILL_PATTERNS),
    ...fromScanner('hipaa2026', 'access-control', ALL_HIPAA_2026_PATTERNS),
    ...fromScanner('api-security', 'access-control', ALL_API_SECURITY_PATTERNS),
    ...fromScanner('configuration', 'audit-logging', ALL_CONFIGURATION_PATTERNS),
    ...fromScanner('authentication', 'access-control', ALL_MFA_PATTERNS),
    ...fromScanner('errors', 'audit-logging', ALL_ERROR_PATTERNS),
    ...fromScanner('operational', 'data-retention', ALL_OPERATIONAL_PATTERNS),
    ...fromScanner('credentials', 'encryption', ALL_CREDENTIAL_PATTERNS),
    ...fromScanner('rbac', 'access-control', ALL_RBAC_PATTERNS),
    ...fromScanner('sanitization', 'access-control', ALL_SANITIZATION_PATTERNS),
    ...fromScanner('revocation', 'access-control', ALL_REVOCATION_PATTERNS),
    // Form 2 — inline arrays exported from index.ts
    ...fromScanner('access', 'access-control', ACCESS_CONTROL_ISSUES),
    ...fromScanner('retention', 'data-retention', RETENTION_ISSUES),
    ...fromScanner('security', 'access-control', SECURITY_PATTERNS),
    // Form 3 — stable families for dynamic-id scanners
    ...fromScanner('audit', 'audit-logging', AUDIT_RULES),
    ...fromScanner('encryption', 'encryption', ENCRYPTION_RULES),
    // AI rules (normalized categories)
    ...fromAiRules(),
  ];

  // Dedupe by id; THROW on duplicate id so a collision can never silently shadow
  // a real rule (and so the catalog count stays honest).
  const byId = new Map<string, CatalogRule>();
  const duplicates: string[] = [];
  for (const rule of rules) {
    if (byId.has(rule.id)) {
      duplicates.push(rule.id);
    } else {
      byId.set(rule.id, rule);
    }
  }
  if (duplicates.length > 0) {
    const unique = [...new Set(duplicates)].sort();
    throw new Error(`[rule-catalog] Duplicate rule id(s): ${unique.join(', ')}`);
  }

  const catalog = [...byId.values()];

  // VALIDATION GATE: every category must be one of the five canonical tokens.
  // This runs at module load and permanently prevents category drift.
  const valid = new Set<string>(CategoryEnum.options);
  const offenders = catalog.filter((rule) => !valid.has(rule.category));
  if (offenders.length > 0) {
    const detail = offenders.map((o) => `${o.id} -> ${o.category}`).join(', ');
    throw new Error(
      `[rule-catalog] Non-canonical categories: ${detail}. Allowed: ${CategoryEnum.options.join(', ')}`,
    );
  }

  return catalog;
}

/** The complete built-in rule catalog. Built and validated once at module load. */
export const RULE_CATALOG: CatalogRule[] = buildCatalog();

/** Return every catalog rule. */
export function getAllRules(): CatalogRule[] {
  return RULE_CATALOG;
}

/** Return the catalog rules belonging to a single canonical category. */
export function getRulesByCategory(category: Category): CatalogRule[] {
  return RULE_CATALOG.filter((rule) => rule.category === category);
}

/** Return a per-category rule count keyed by all five canonical categories. */
export function getCategoryCounts(): Record<Category, number> {
  const counts = Object.fromEntries(
    CategoryEnum.options.map((category) => [category, 0]),
  ) as Record<Category, number>;
  for (const rule of RULE_CATALOG) {
    counts[rule.category] += 1;
  }
  return counts;
}
