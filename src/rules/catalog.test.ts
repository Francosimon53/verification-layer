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

  it('lists every distinct encryption check with stable ids (no collapsed families)', () => {
    const encryption = getRulesByCategory('encryption');
    const ids = encryption.map((r) => r.id);

    // 16 encryption-scanner patterns + 3 credentials + 1 AI (HIPAA-SEC-001)
    expect(encryption.length).toBe(20);

    // The collapsed families must be gone.
    expect(ids).not.toContain('enc-weak');
    expect(ids).not.toContain('enc-missing');

    // Every distinct check is now individually enumerated.
    const expectedEncryptionScannerIds = [
      'enc-md5', 'enc-sha1', 'enc-des', 'enc-rc4', 'enc-deprecated-cipher', 'enc-ecb-mode',
      'enc-http-url', 'enc-ssl-disabled', 'enc-ssl-verify-disabled',
      'enc-tls-cert-validation-disabled', 'enc-backup-encryption-disabled',
      'enc-db-backup-no-ssl', 'enc-backup-file-unencrypted', 'enc-phi-backup-unencrypted',
      'enc-s3-backup-no-sse', 'enc-backup-storage-unencrypted',
    ];
    for (const id of expectedEncryptionScannerIds) {
      expect(ids).toContain(id);
    }

    // Severities are preserved from the patterns (not flattened to one value).
    const desRule = encryption.find((r) => r.id === 'enc-des');
    expect(desRule?.severity).toBe('critical');
    const sha1Rule = encryption.find((r) => r.id === 'enc-sha1');
    expect(sha1Rule?.severity).toBe('medium');
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
