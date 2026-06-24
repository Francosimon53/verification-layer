import { describe, it, expect } from 'vitest';
import {
  RULE_CATALOG,
  getAllRules,
  getRulesByCategory,
  getCategoryCounts,
} from './catalog.js';
import { CategoryEnum } from './schema.js';

describe('built-in rule catalog', () => {
  it('is non-empty', () => {
    expect(RULE_CATALOG.length).toBeGreaterThan(0);
    expect(getAllRules()).toBe(RULE_CATALOG);
  });

  it('only contains the five canonical categories', () => {
    const allowed = new Set<string>(CategoryEnum.options);
    for (const rule of RULE_CATALOG) {
      expect(allowed.has(rule.category)).toBe(true);
    }
  });

  it('has no duplicate ids', () => {
    const ids = RULE_CATALOG.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getCategoryCounts returns all five keys, each populated', () => {
    const counts = getCategoryCounts();
    expect(Object.keys(counts).sort()).toEqual([...CategoryEnum.options].sort());
    expect(counts['data-retention']).toBeGreaterThan(0);
    expect(counts['access-control']).toBeGreaterThan(0);
    for (const category of CategoryEnum.options) {
      expect(counts[category]).toBeGreaterThan(0);
    }
  });

  it('getRulesByCategory matches counts and includes the known data-retention rules', () => {
    const counts = getCategoryCounts();
    for (const category of CategoryEnum.options) {
      expect(getRulesByCategory(category).length).toBe(counts[category]);
    }
    const retentionIds = getRulesByCategory('data-retention').map((r) => r.id);
    for (const id of [
      'short-retention',
      'unlogged-delete',
      'bulk-delete',
      'backup-disabled',
      'phi-cache',
      'HIPAA-RETENTION-001',
    ]) {
      expect(retentionIds).toContain(id);
    }
  });

  it('normalizes severity to lowercase and marks AI rules as info', () => {
    const severities = new Set(['critical', 'high', 'medium', 'low', 'info']);
    for (const rule of RULE_CATALOG) {
      expect(severities.has(rule.severity)).toBe(true);
      if (rule.source === 'ai') {
        expect(rule.severity).toBe('info');
      }
    }
  });
});
