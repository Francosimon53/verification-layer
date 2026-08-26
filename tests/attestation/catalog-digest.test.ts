import { describe, it, expect } from 'vitest';
import {
  digestRules,
  ruleCatalogDigest,
  ruleCatalogRuleCount,
  customRulesDigest,
} from '../../src/attestation/catalog-digest.js';
import { RULE_CATALOG, type CatalogRule } from '../../src/rules/catalog.js';
import type { CompiledCustomRule } from '../../src/types.js';

const base: CatalogRule[] = [
  {
    id: 'b-rule',
    category: 'encryption',
    severity: 'high',
    title: 'B title',
    description: 'B description',
    recommendation: 'B recommendation',
    hipaaReference: '§164.312(a)(2)(iv)',
    source: 'pattern',
    scanner: 'encryption',
  },
  {
    id: 'a-rule',
    category: 'phi-exposure',
    severity: 'critical',
    title: 'A title',
    description: 'A description',
    source: 'pattern',
    scanner: 'phi',
  },
];

function clone(rules: CatalogRule[]): CatalogRule[] {
  return rules.map((r) => ({ ...r }));
}

describe('rule catalog digest', () => {
  it('is stable across repeated calls', () => {
    expect(ruleCatalogDigest()).toBe(ruleCatalogDigest());
  });

  it('is a lowercase hex sha-256', () => {
    expect(ruleCatalogDigest()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is invariant to input ordering', () => {
    expect(digestRules(base)).toBe(digestRules([...base].reverse()));
  });

  it('reports the real catalog size, never a hardcoded count', () => {
    expect(ruleCatalogRuleCount()).toBe(RULE_CATALOG.length);
  });

  // --- field sensitivity: security-relevant changes MUST move the digest ---

  it('changes when a severity changes', () => {
    const changed = clone(base);
    changed[0].severity = 'low';
    expect(digestRules(changed)).not.toBe(digestRules(base));
  });

  it('changes when a category changes', () => {
    const changed = clone(base);
    changed[0].category = 'access-control';
    expect(digestRules(changed)).not.toBe(digestRules(base));
  });

  it('changes when a hipaaReference changes', () => {
    const changed = clone(base);
    changed[0].hipaaReference = '§164.312(b)';
    expect(digestRules(changed)).not.toBe(digestRules(base));
  });

  it('changes when a hipaaReference is removed', () => {
    const changed = clone(base);
    delete changed[0].hipaaReference;
    expect(digestRules(changed)).not.toBe(digestRules(base));
  });

  it('changes when the owning scanner changes', () => {
    const changed = clone(base);
    changed[0].scanner = 'security';
    expect(digestRules(changed)).not.toBe(digestRules(base));
  });

  it('changes when a rule is added or removed', () => {
    expect(digestRules([base[0]])).not.toBe(digestRules(base));
  });

  it('changes when a rule id changes', () => {
    const changed = clone(base);
    changed[0].id = 'b-rule-renamed';
    expect(digestRules(changed)).not.toBe(digestRules(base));
  });

  // --- prose changes MUST NOT move the digest ---

  it('is unchanged when a title changes', () => {
    const changed = clone(base);
    changed[0].title = 'Completely different wording';
    expect(digestRules(changed)).toBe(digestRules(base));
  });

  it('is unchanged when a description changes', () => {
    const changed = clone(base);
    changed[0].description = 'Reworded for clarity';
    expect(digestRules(changed)).toBe(digestRules(base));
  });

  it('is unchanged when a recommendation changes', () => {
    const changed = clone(base);
    changed[0].recommendation = 'Different advice';
    expect(digestRules(changed)).toBe(digestRules(base));
  });
});

describe('custom rules digest', () => {
  const rule = (over: Partial<CompiledCustomRule> = {}): CompiledCustomRule => ({
    id: 'no-phi-log',
    name: 'No PHI log',
    description: 'desc',
    category: 'phi-exposure',
    severity: 'high',
    pattern: 'console\\.log',
    flags: 'gi',
    recommendation: 'rec',
    compiledPattern: /console\.log/gi,
    ...over,
  });

  it('is undefined when no custom rules are active', () => {
    expect(customRulesDigest([])).toBeUndefined();
  });

  it('is stable and order-invariant', () => {
    const a = rule();
    const b = rule({ id: 'other', pattern: 'eval\\(' });
    expect(customRulesDigest([a, b])).toBe(customRulesDigest([b, a]));
  });

  it('changes when the detection pattern changes', () => {
    expect(customRulesDigest([rule()])).not.toBe(
      customRulesDigest([rule({ pattern: 'console\\.error' })]),
    );
  });

  it('changes when severity changes', () => {
    expect(customRulesDigest([rule()])).not.toBe(
      customRulesDigest([rule({ severity: 'low' })]),
    );
  });

  it('is unchanged when only prose fields change', () => {
    expect(customRulesDigest([rule()])).toBe(
      customRulesDigest([rule({ name: 'Renamed', description: 'x', recommendation: 'y' })]),
    );
  });
});
