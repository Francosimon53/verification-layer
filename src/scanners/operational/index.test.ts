/**
 * Operational Security Scanner Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { operationalScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Operational Security Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'operational-test-'));
  });

  afterEach(async () => {
    // Cleanup
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore
      }
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    testFiles = [];
  });

  async function createTestFile(
    filename: string,
    content: string
  ): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    testFiles.push(filePath);
    return filePath;
  }

  const scanOptions: ScanOptions = {
    path: tempDir,
  };

  describe('BACKUP-001: Database Without Backup Configuration', () => {
    it('should detect Prisma usage without backup configuration', async () => {
      await createTestFile(
        'db.ts',
        `
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      const backupFindings = findings.filter((f) => f.id === 'BACKUP-001');
      expect(backupFindings.length).toBeGreaterThan(0);
      expect(backupFindings[0].severity).toBe('medium');
      expect(backupFindings[0].confidence).toBe('low'); // Advisory
    });

    it('should detect Mongoose usage without backup configuration', async () => {
      await createTestFile(
        'mongoose.ts',
        `
import mongoose from 'mongoose';

mongoose.connect(process.env.MONGODB_URI);
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      expect(findings.some((f) => f.id === 'BACKUP-001')).toBe(true);
    });

    it('should detect Supabase usage without backup configuration', async () => {
      await createTestFile(
        'supabase.ts',
        `
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      expect(findings.some((f) => f.id === 'BACKUP-001')).toBe(true);
    });

    it('should detect Drizzle usage without backup configuration', async () => {
      await createTestFile(
        'drizzle.ts',
        `
import { drizzle } from 'drizzle-orm';
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      expect(findings.some((f) => f.id === 'BACKUP-001')).toBe(true);
    });

    it('should detect TypeORM usage without backup configuration', async () => {
      await createTestFile(
        'typeorm.ts',
        `
import { createConnection } from 'typeorm';

await createConnection();
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      expect(findings.some((f) => f.id === 'BACKUP-001')).toBe(true);
    });

    it('should NOT flag database with backup configuration', async () => {
      await createTestFile(
        'db.ts',
        `
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
`
      );

      await createTestFile(
        'backup.ts',
        `
// Automated backup configuration
const backupSchedule = '0 2 * * *'; // Daily at 2 AM
const backupCommand = 'pg_dump -U postgres mydb > backup.sql';
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      const backupFindings = findings.filter((f) => f.id === 'BACKUP-001');
      expect(backupFindings.length).toBe(0);
    });

    it('should NOT flag database with pg_dump reference', async () => {
      await createTestFile(
        'db.ts',
        `
import mongoose from 'mongoose';
mongoose.connect(uri);
`
      );

      await createTestFile(
        'backup-script.ts',
        `
// Backup script
const backupCommand = 'mongodump --uri="mongodb://localhost:27017/mydb" --out=/backups';
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      const backupFindings = findings.filter((f) => f.id === 'BACKUP-001');
      expect(backupFindings.length).toBe(0);
    });

    it('should NOT flag database with snapshot reference', async () => {
      await createTestFile(
        'db.ts',
        `
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);
`
      );

      await createTestFile(
        'config.yml',
        `
# Database Configuration
# We use Supabase automatic snapshots configured in the dashboard
# Snapshots are taken every 24 hours and retained for 30 days
database:
  snapshot_enabled: true
  snapshot_retention: 30d
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      const backupFindings = findings.filter((f) => f.id === 'BACKUP-001');
      expect(backupFindings.length).toBe(0);
    });

    it('should NOT flag database with replicate reference', async () => {
      await createTestFile(
        'db.ts',
        `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
`
      );

      await createTestFile(
        'config.yml',
        `
database:
  primary: postgres://main
  replicate: postgres://replica
  replication_lag_check: true
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      const backupFindings = findings.filter((f) => f.id === 'BACKUP-001');
      expect(backupFindings.length).toBe(0);
    });
  });

  describe('RETENTION-001: PHI Records Without Retention Fields', () => {
    it('should detect Prisma patient create without retention fields', async () => {
      const file = await createTestFile(
        'patient.ts',
        `
const patient = await prisma.patient.create({
  data: {
    name: 'John Doe',
    ssn: '123-45-6789',
    dob: new Date('1990-01-01')
  }
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      const retentionFindings = findings.filter((f) => f.id === 'RETENTION-001');
      expect(retentionFindings.length).toBeGreaterThan(0);
      expect(retentionFindings[0].severity).toBe('medium');
    });

    it('should detect Mongoose Patient create without retention fields', async () => {
      const file = await createTestFile(
        'patient-model.ts',
        `
const newPatient = await Patient.create({
  name: 'Jane Doe',
  medicalRecordNumber: 'MRN-123456',
  diagnosis: 'Hypertension'
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RETENTION-001')).toBe(true);
    });

    it('should detect health record insert without retention fields', async () => {
      const file = await createTestFile(
        'health.ts',
        `
await prisma.healthRecord.create({
  data: {
    patientId: patient.id,
    diagnosis: 'Diabetes Type 2',
    treatment: 'Metformin 500mg'
  }
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RETENTION-001')).toBe(true);
    });

    it('should detect medical record upsert without retention fields', async () => {
      const file = await createTestFile(
        'medical.ts',
        `
const record = await prisma.medicalRecord.upsert({
  where: { id: recordId },
  update: { notes: 'Updated notes' },
  create: { patientId: pid, notes: 'New record' }
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RETENTION-001')).toBe(true);
    });

    it('should detect Supabase patient insert without retention fields', async () => {
      const file = await createTestFile(
        'supabase-patient.ts',
        `
const { data, error } = await supabase.from('patients').insert({
  name: 'John Smith',
  ssn: '987-65-4321',
  email: 'john@example.com'
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RETENTION-001')).toBe(true);
    });

    it('should detect clinical data insert without retention fields', async () => {
      const file = await createTestFile(
        'clinical.ts',
        `
await db.insert(clinicalNotes).values({
  patientId: '123',
  notes: 'Patient shows improvement',
  provider: 'Dr. Smith'
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RETENTION-001')).toBe(true);
    });

    it('should NOT flag patient create with expiresAt field', async () => {
      const file = await createTestFile(
        'safe-patient.ts',
        `
const patient = await prisma.patient.create({
  data: {
    name: 'John Doe',
    ssn: '123-45-6789',
    expiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000) // 7 years
  }
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      const retentionFindings = findings.filter((f) => f.id === 'RETENTION-001');
      expect(retentionFindings.length).toBe(0);
    });

    it('should NOT flag health record with retentionPeriod field', async () => {
      const file = await createTestFile(
        'safe-health.ts',
        `
await prisma.healthRecord.create({
  data: {
    patientId: patient.id,
    diagnosis: 'Diabetes',
    retentionPeriod: '7years',
    deleteAfter: calculateDeleteDate()
  }
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      const retentionFindings = findings.filter((f) => f.id === 'RETENTION-001');
      expect(retentionFindings.length).toBe(0);
    });

    it('should NOT flag patient create with ttl field', async () => {
      const file = await createTestFile(
        'ttl-patient.ts',
        `
const patient = await Patient.create({
  name: 'Jane Doe',
  mrn: 'MRN-789',
  ttl: 60 * 60 * 24 * 365 * 7 // 7 years in seconds
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      const retentionFindings = findings.filter((f) => f.id === 'RETENTION-001');
      expect(retentionFindings.length).toBe(0);
    });

    it('should NOT flag patient create in test files', async () => {
      const file = await createTestFile(
        'patient.test.ts',
        `
describe('Patient creation', () => {
  it('should create patient', async () => {
    const patient = await prisma.patient.create({
      data: { name: 'Test Patient', ssn: '000-00-0000' }
    });
  });
});
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      const retentionFindings = findings.filter((f) => f.id === 'RETENTION-001');
      expect(retentionFindings.length).toBe(0);
    });
  });

  describe('API-002: JSON Body Parser Without Size Limit', () => {
    it('should detect express.json() without limit', async () => {
      const file = await createTestFile(
        'server.ts',
        `
import express from 'express';

const app = express();
app.use(express.json());
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      const apiFindings = findings.filter((f) => f.id === 'API-002');
      expect(apiFindings.length).toBeGreaterThan(0);
      expect(apiFindings[0].severity).toBe('low');
    });

    it('should detect bodyParser.json() without limit', async () => {
      const file = await createTestFile(
        'body-parser.ts',
        `
import bodyParser from 'body-parser';

app.use(bodyParser.json());
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'API-002')).toBe(true);
    });

    it('should detect express.json() with empty options', async () => {
      const file = await createTestFile(
        'empty-options.ts',
        `
app.use(express.json({}));
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'API-002')).toBe(true);
    });

    it('should detect bodyParser.json() with empty options', async () => {
      const file = await createTestFile(
        'empty-body-parser.ts',
        `
const app = express();
app.use(bodyParser.json({}));
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'API-002')).toBe(true);
    });

    it('should NOT flag express.json() with limit configured', async () => {
      const file = await createTestFile(
        'safe-express.ts',
        `
import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      const apiFindings = findings.filter((f) => f.id === 'API-002');
      expect(apiFindings.length).toBe(0);
    });

    it('should NOT flag bodyParser.json() with limit configured', async () => {
      const file = await createTestFile(
        'safe-body-parser.ts',
        `
app.use(bodyParser.json({
  limit: '1mb',
  strict: true
}));
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      const apiFindings = findings.filter((f) => f.id === 'API-002');
      expect(apiFindings.length).toBe(0);
    });

    it('should NOT flag express.json() with limit on separate line', async () => {
      const file = await createTestFile(
        'multiline-config.ts',
        `
app.use(express.json({
  limit: '5mb',
  type: 'application/json'
}));
`
      );

      const findings = await operationalScanner.scan([file], scanOptions);
      const apiFindings = findings.filter((f) => f.id === 'API-002');
      expect(apiFindings.length).toBe(0);
    });
  });

  describe('Combined violations', () => {
    it('should detect multiple operational violations in same project', async () => {
      await createTestFile(
        'db.ts',
        `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
`
      );

      await createTestFile(
        'patient.ts',
        `
const patient = await prisma.patient.create({
  data: { name: 'John', ssn: '123-45-6789' }
});
`
      );

      await createTestFile(
        'server.ts',
        `
import express from 'express';
const app = express();
app.use(express.json());
`
      );

      const findings = await operationalScanner.scan(testFiles, scanOptions);
      expect(findings.some((f) => f.id === 'BACKUP-001')).toBe(true);
      expect(findings.some((f) => f.id === 'RETENTION-001')).toBe(true);
      expect(findings.some((f) => f.id === 'API-002')).toBe(true);
    });
  });

  it('should provide correct HIPAA references', async () => {
    await createTestFile(
      'db.ts',
      `import { PrismaClient } from '@prisma/client';`
    );

    await createTestFile(
      'patient.ts',
      `await prisma.patient.create({ data: {} });`
    );

    await createTestFile(
      'server.ts',
      `app.use(express.json());`
    );

    const findings = await operationalScanner.scan(testFiles, scanOptions);

    const backup = findings.find((f) => f.id === 'BACKUP-001');
    const retention = findings.find((f) => f.id === 'RETENTION-001');
    const api = findings.find((f) => f.id === 'API-002');

    expect(backup?.hipaaReference).toContain('164.308(a)(7)(ii)(A)');
    expect(retention?.hipaaReference).toContain('164.316(b)(2)(i)');
    expect(api?.hipaaReference).toContain('164.308(a)(1)(ii)(D)');
  });

  it('should have correct severity levels', async () => {
    await createTestFile(
      'db.ts',
      `import mongoose from 'mongoose';`
    );

    await createTestFile(
      'patient.ts',
      `await Patient.create({});`
    );

    await createTestFile(
      'server.ts',
      `app.use(express.json());`
    );

    const findings = await operationalScanner.scan(testFiles, scanOptions);

    const backup = findings.find((f) => f.id === 'BACKUP-001');
    const retention = findings.find((f) => f.id === 'RETENTION-001');
    const api = findings.find((f) => f.id === 'API-002');

    expect(backup?.severity).toBe('medium');
    expect(retention?.severity).toBe('medium');
    expect(api?.severity).toBe('low');
  });

  it('should have correct confidence levels', async () => {
    await createTestFile(
      'db.ts',
      `import { PrismaClient } from '@prisma/client';`
    );

    await createTestFile(
      'patient.ts',
      `await prisma.patient.create({ data: {} });`
    );

    const findings = await operationalScanner.scan(testFiles, scanOptions);

    const backup = findings.find((f) => f.id === 'BACKUP-001');
    const retention = findings.find((f) => f.id === 'RETENTION-001');

    expect(backup?.confidence).toBe('low'); // Advisory finding
    expect(retention?.confidence).toBe('medium');
  });
});
