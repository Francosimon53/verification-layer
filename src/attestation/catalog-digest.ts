/**
 * Deterministic digest over the built-in rule catalog.
 *
 * Purpose: an external reviewer must be able to tell EXACTLY which logical
 * detection catalog produced an evaluation, without shipping the catalog.
 *
 * FIELD SELECTION — security-relevant content only:
 *   id, category, severity, source, scanner, hipaaReference
 *
 * Titles, descriptions and recommendations are deliberately EXCLUDED. They are
 * prose: rewording a description does not change what vlayer detects or how it
 * is adjudicated, and a digest that churned on copy edits would be noise. A
 * change to severity, category, scanner ownership or the control reference DOES
 * change the evaluation, and must change the digest.
 *
 * ORDERING is imposed explicitly (sort by rule id) and serialization goes
 * through the canonical JSON writer. Nothing here depends on object insertion
 * order or on the order `buildCatalog()` happens to concatenate its sources.
 */

import { createHash } from 'crypto';
import { RULE_CATALOG, type CatalogRule } from '../rules/catalog.js';
import type { CompiledCustomRule } from '../types.js';
import { canonicalize } from './canonical.js';

/** The security-relevant projection of a catalog rule. */
interface DigestibleRule {
  id: string;
  category: string;
  severity: string;
  source: string;
  scanner: string;
  hipaaReference: string | null;
}

function project(rule: CatalogRule): DigestibleRule {
  return {
    id: rule.id,
    category: rule.category,
    severity: rule.severity,
    source: rule.source,
    scanner: rule.scanner,
    hipaaReference: rule.hipaaReference ?? null,
  };
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Digest an arbitrary rule set. Exported so tests can prove order-invariance
 * and field sensitivity without mutating the real catalog.
 */
export function digestRules(rules: readonly CatalogRule[]): string {
  const projected = rules.map(project).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const payload = {
    algorithm: 'vlayer-rule-catalog-v1',
    ruleCount: projected.length,
    rules: projected,
  };
  return sha256(canonicalize(payload as never));
}

/** Digest of the built-in catalog shipped in this vlayer build. */
export function ruleCatalogDigest(): string {
  return digestRules(RULE_CATALOG);
}

/** Number of rules in the built-in catalog. Never hardcoded anywhere else. */
export function ruleCatalogRuleCount(): number {
  return RULE_CATALOG.length;
}

/**
 * Digest over the ACTIVE custom rules, when any were loaded. Custom rules
 * change detection behavior just as built-ins do, so an attestation produced
 * with custom rules must be distinguishable from one produced without them.
 * Returns undefined when no custom rules are active.
 *
 * The user's regex `pattern` is included: it IS the detection semantics. It is
 * hashed, never published, and it comes from the project's own rules file
 * rather than from scanned source.
 */
export function customRulesDigest(rules: readonly CompiledCustomRule[]): string | undefined {
  if (rules.length === 0) return undefined;
  const projected = rules
    .map((rule) => ({
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      pattern: rule.pattern,
      flags: rule.flags ?? null,
      mustNotContain: rule.mustNotContain ?? null,
      hipaaReference: rule.hipaaReference ?? null,
      include: [...(rule.include ?? [])].sort(),
      exclude: [...(rule.exclude ?? [])].sort(),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return sha256(
    canonicalize({
      algorithm: 'vlayer-custom-rules-v1',
      ruleCount: projected.length,
      rules: projected,
    } as never),
  );
}
