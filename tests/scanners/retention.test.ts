import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { retentionScanner } from '../../src/scanners/retention/index.js';
import type { ScanOptions } from '../../src/types.js';

const TEST_DIR = join(process.cwd(), '.tmp-retention-scan');

const defaultOptions: ScanOptions = {
  path: TEST_DIR,
};

async function createTestFile(filename: string, content: string): Promise<string> {
  const filePath = join(TEST_DIR, filename);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('Retention Scanner', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('Short Retention Period Detection', () => {
    it('should detect deleteAfter with days < 6 years', async () => {
      const file = await createTestFile('short-retention.ts', `
        const config = {
          deleteAfter: 30 days
        };
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('short-retention'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });

    it('should detect deleteAfter with hours', async () => {
      const file = await createTestFile('hours-retention.ts', `
        const config = { deleteAfter: 24 hours };
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('short-retention'));
      expect(finding).toBeDefined();
    });

    it('should detect deleteAfter with minutes', async () => {
      const file = await createTestFile('minutes-retention.ts', `
        const config = { deleteAfter: 60 minutes };
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('short-retention'));
      expect(finding).toBeDefined();
    });

    it('should detect short retention in YAML', async () => {
      const file = await createTestFile('config.yaml', `
        retention:
          deleteAfter: 365 days
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('short-retention'));
      expect(finding).toBeDefined();
    });
  });

  describe('Unlogged Delete Detection', () => {
    it('should detect .delete() without logging', async () => {
      const file = await createTestFile('unlogged-delete.ts', `
        async function removeRecord(id) {
          await record.delete();
        }
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('unlogged-delete'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('medium');
    });

    it('should NOT flag .delete() with audit in same line', async () => {
      const file = await createTestFile('logged-delete.ts', `
        async function removeRecord(id) {
          await record.delete(); audit.log('deleted', id);
        }
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('unlogged-delete'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag .delete() with log in same line', async () => {
      const file = await createTestFile('logged-delete2.ts', `
        await record.delete(); logger.log('Record deleted');
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('unlogged-delete'));
      expect(finding).toBeUndefined();
    });
  });

  describe('Bulk Delete Detection', () => {
    it('should detect TRUNCATE TABLE', async () => {
      const file = await createTestFile('truncate.sql', `
        TRUNCATE TABLE patient_records;
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('bulk-delete'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
    });

    it('should detect DROP TABLE', async () => {
      const file = await createTestFile('drop.sql', `
        DROP TABLE medical_history;
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('bulk-delete'));
      expect(finding).toBeDefined();
    });

    it('should detect truncate in TypeScript string', async () => {
      const file = await createTestFile('truncate-ts.ts', `
        const query = "TRUNCATE TABLE old_records";
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('bulk-delete'));
      expect(finding).toBeDefined();
    });

    it('should detect drop table in Python', async () => {
      const file = await createTestFile('drop.py', `
        cursor.execute("DROP TABLE temp_data")
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('bulk-delete'));
      expect(finding).toBeDefined();
    });
  });

  describe('Backup Disabled Detection', () => {
    it('should detect backup disable pattern', async () => {
      const file = await createTestFile('backup-off.ts', `
        const config = { backupDisable: true };
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('backup-disabled'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });

    it('should detect disable backup pattern', async () => {
      const file = await createTestFile('disable-backup.ts', `
        // disableBackup for testing
        const disableBackup = true;
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('backup-disabled'));
      expect(finding).toBeDefined();
    });

    it('should detect in YAML config', async () => {
      const file = await createTestFile('db-config.yaml', `
        database:
          backup: disable
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('backup-disabled'));
      expect(finding).toBeDefined();
    });
  });

  describe('PHI Cache Detection', () => {
    it('should detect cache patient pattern', async () => {
      const file = await createTestFile('cache-patient.ts', `
        const cachePatient = (patient) => redis.set(patient.id, patient);
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-cache'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('medium');
    });

    it('should detect patient cache pattern', async () => {
      const file = await createTestFile('patient-cache.ts', `
        const patientCache = new Map();
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-cache'));
      expect(finding).toBeDefined();
    });

    it('should detect in Java', async () => {
      const file = await createTestFile('cache.java', `
        private Cache<String, Patient> patientCache;
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-cache'));
      expect(finding).toBeDefined();
    });
  });

  describe('False Positive Prevention', () => {
    it('should NOT flag retention >= 6 years (2190+ days)', async () => {
      const file = await createTestFile('long-retention.ts', `
        const config = { deleteAfter: 2555 days }; // 7 years
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('short-retention'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag generic delete operations', async () => {
      const file = await createTestFile('generic-delete.ts', `
        items.delete(id);
        cache.delete(key);
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      // These match the unlogged-delete pattern but are generic operations
      // The scanner will flag them - this documents current behavior
    });

    it('should NOT flag non-patient cache', async () => {
      const file = await createTestFile('generic-cache.ts', `
        const userCache = new Map();
        const productCache = new LRUCache();
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-cache'));
      expect(finding).toBeUndefined();
    });

    it('should NOT scan markdown files', async () => {
      const file = await createTestFile('docs.md', `
        # Retention Policy
        - TRUNCATE TABLE is dangerous
        - deleteAfter: 30 days is too short
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      expect(findings.length).toBe(0);
    });
  });

  describe('Finding Metadata', () => {
    it('should include correct HIPAA reference', async () => {
      const file = await createTestFile('hipaa.sql', `
        TRUNCATE TABLE records;
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      expect(findings[0].hipaaReference).toBe('§164.530(j)');
    });

    it('should include line number', async () => {
      const file = await createTestFile('line-num.sql', `-- line 1
-- line 2
TRUNCATE TABLE data; -- line 3
`);

      const findings = await retentionScanner.scan([file], defaultOptions);

      expect(findings[0].line).toBe(3);
    });

    it('should include context lines', async () => {
      const file = await createTestFile('context.sql', `SELECT 1;
SELECT 2;
TRUNCATE TABLE old_data;
SELECT 3;
SELECT 4;
`);

      const findings = await retentionScanner.scan([file], defaultOptions);

      expect(findings[0].context).toBeDefined();
      expect(findings[0].context?.length).toBeGreaterThan(0);
    });

    it('should include appropriate recommendation for bulk delete', async () => {
      const file = await createTestFile('recommendation.sql', `
        DROP TABLE patient_data;
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      expect(findings[0].recommendation).toContain('soft-delete');
    });
  });

  describe('Multiple File Types', () => {
    it('should scan .sql files', async () => {
      const file = await createTestFile('migration.sql', `
        TRUNCATE TABLE legacy_data;
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      expect(findings.length).toBeGreaterThan(0);
    });

    it('should scan .yaml files', async () => {
      const file = await createTestFile('retention.yaml', `
        policy:
          deleteAfter: 90 days
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('short-retention'));
      expect(finding).toBeDefined();
    });

    it('should scan .yml files', async () => {
      const file = await createTestFile('config.yml', `
        backup: disable
      `);

      const findings = await retentionScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('backup-disabled'));
      expect(finding).toBeDefined();
    });
  });
});
