/**
 * Tests for HIPAA 2026 Security Rule Scanner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hipaa2026Scanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('HIPAA 2026 Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hipaa2026-test-'));
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

  async function createTestFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    testFiles.push(filePath);
    return filePath;
  }

  const scanOptions: ScanOptions = {
    path: tempDir,
  };

  describe('HIPAA-MFA-001: Multi-Factor Authentication', () => {
    it('should detect PHI access without MFA', async () => {
      const file = await createTestFile(
        'auth.ts',
        `
app.post('/login', async (req, res) => {
  const user = await authenticateUser(req.body);
  if (user.role === 'doctor') {
    accessPatientRecords(user);
  }
});
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'HIPAA-MFA-001');

      expect(mfaFindings.length).toBeGreaterThan(0);
      expect(mfaFindings[0].severity).toBe('critical');
      expect(mfaFindings[0].hipaaReference).toContain('164.312(a)(2)(i)');
    });

    it('should not flag PHI access with MFA', async () => {
      const file = await createTestFile(
        'auth-secure.ts',
        `
app.post('/login', async (req, res) => {
  const user = await authenticateUser(req.body);
  if (!user.mfaVerified) {
    return res.status(401).json({ error: 'MFA required' });
  }
  if (user.role === 'doctor') {
    accessPatientRecords(user);
  }
});
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'HIPAA-MFA-001');

      expect(mfaFindings.length).toBe(0);
    });
  });

  describe('HIPAA-ENC-REST-001: Encryption at Rest', () => {
    it('should detect database without encryption', async () => {
      const file = await createTestFile(
        'db.ts',
        `
import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/patients', {
  useNewUrlParser: true,
});
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const encFindings = findings.filter((f) => f.id === 'HIPAA-ENC-REST-001');

      expect(encFindings.length).toBeGreaterThan(0);
      expect(encFindings[0].severity).toBe('critical');
    });

    it('should not flag database with encryption', async () => {
      const file = await createTestFile(
        'db-secure.ts',
        `
import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/patients', {
  useNewUrlParser: true,
  ssl: true,
  encrypt: true,
});
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const encFindings = findings.filter((f) => f.id === 'HIPAA-ENC-REST-001');

      expect(encFindings.length).toBe(0);
    });
  });

  describe('HIPAA-SESSION-001: Session Timeout', () => {
    it('should detect session without timeout', async () => {
      const file = await createTestFile(
        'session.ts',
        `
import session from 'express-session';

app.use(session({
  secret: 'my-secret',
  resave: false,
  saveUninitialized: false,
}));
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const sessionFindings = findings.filter((f) => f.id === 'HIPAA-SESSION-001');

      expect(sessionFindings.length).toBeGreaterThan(0);
      expect(sessionFindings[0].severity).toBe('high');
    });

    it('should not flag session with proper timeout', async () => {
      const file = await createTestFile(
        'session-secure.ts',
        `
import session from 'express-session';

app.use(session({
  secret: 'my-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 900000 } // 15 minutes
}));
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const sessionFindings = findings.filter((f) => f.id === 'HIPAA-SESSION-001');

      expect(sessionFindings.length).toBe(0);
    });
  });

  describe('HIPAA-REVOKE-001: Access Revocation', () => {
    it('should detect user deactivation without token revocation', async () => {
      const file = await createTestFile(
        'user.ts',
        `
async function deactivateUser(userId: string) {
  await User.update({ id: userId }, { active: false });
  console.log('User deactivated');
}
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'HIPAA-REVOKE-001');

      expect(revokeFindings.length).toBeGreaterThan(0);
      expect(revokeFindings[0].severity).toBe('critical');
    });

    it('should not flag deactivation with token revocation', async () => {
      const file = await createTestFile(
        'user-secure.ts',
        `
async function deactivateUser(userId: string) {
  await User.update({ id: userId }, { active: false });
  await revokeAllTokens(userId);
  await invalidateAllSessions(userId);
  console.log('User deactivated and tokens revoked');
}
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'HIPAA-REVOKE-001');

      expect(revokeFindings.length).toBe(0);
    });
  });

  describe('HIPAA-BREACH-001: Breach Notification', () => {
    it('should detect security errors without breach notification', async () => {
      const file = await createTestFile(
        'api.ts',
        `
try {
  await processPhiData(data);
} catch (error) {
  if (error.message.includes('unauthorized')) {
    console.error('Security breach detected');
  }
}
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const breachFindings = findings.filter((f) => f.id === 'HIPAA-BREACH-001');

      expect(breachFindings.length).toBeGreaterThan(0);
      expect(breachFindings[0].severity).toBe('critical');
    });

    it('should not flag errors with breach notification', async () => {
      const file = await createTestFile(
        'api-secure.ts',
        `
try {
  await processPhiData(data);
} catch (error) {
  if (error.message.includes('unauthorized')) {
    console.error('Security breach detected');
    await notifyBreach(error);
    await incidentResponse.trigger('security-breach');
  }
}
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const breachFindings = findings.filter((f) => f.id === 'HIPAA-BREACH-001');

      expect(breachFindings.length).toBe(0);
    });
  });

  describe('HIPAA-SEGMENT-001: Network Segmentation', () => {
    it('should detect CORS wildcard for PHI endpoints', async () => {
      const file = await createTestFile(
        'cors.ts',
        `
import cors from 'cors';

app.use(cors({ origin: '*' }));

app.get('/api/patients', async (req, res) => {
  const patients = await getPatients();
  res.json(patients);
});
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const segmentFindings = findings.filter((f) => f.id === 'HIPAA-SEGMENT-001');

      expect(segmentFindings.length).toBeGreaterThan(0);
      expect(segmentFindings[0].severity).toBe('critical');
    });

    it('should not flag CORS with origin whitelist', async () => {
      const file = await createTestFile(
        'cors-secure.ts',
        `
import cors from 'cors';

app.use(cors({ origin: ['https://hospital.com', 'https://ehr.hospital.com'] }));

app.get('/api/patients', async (req, res) => {
  const patients = await getPatients();
  res.json(patients);
});
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const segmentFindings = findings.filter((f) => f.id === 'HIPAA-SEGMENT-001');

      expect(segmentFindings.length).toBe(0);
    });
  });

  describe('HIPAA-ASSET-001: Technology Asset Inventory', () => {
    it('should generate asset inventory', async () => {
      await createTestFile(
        'services.ts',
        `
import mongoose from 'mongoose';
import { S3Client } from '@aws-sdk/client-s3';
import axios from 'axios';

mongoose.connect('mongodb://localhost/patients');
const s3 = new S3Client({ region: 'us-east-1' });
axios.get('https://api.external.com/patient-data');
        `
      );

      const findings = await hipaa2026Scanner.scan(testFiles, scanOptions);
      const assetFindings = findings.filter((f) => f.id === 'HIPAA-ASSET-001');

      expect(assetFindings.length).toBe(1);
      expect(assetFindings[0].severity).toBe('high');
      expect(assetFindings[0].file).toBe('ASSET-INVENTORY');
      expect(assetFindings[0].recommendation).toContain('DATABASE');
    });
  });

  describe('HIPAA-FLOW-001: PHI Flow Mapping', () => {
    it('should generate PHI flow map', async () => {
      await createTestFile(
        'patient-flow.ts',
        `
app.post('/api/patient', async (req, res) => {
  const patientData = req.body.patient;
  const validated = validatePatient(patientData);
  await savePatient(validated);
  return res.json({ success: true, patient: validated });
});
        `
      );

      const findings = await hipaa2026Scanner.scan(testFiles, scanOptions);
      const flowFindings = findings.filter((f) => f.id === 'HIPAA-FLOW-001');

      expect(flowFindings.length).toBe(1);
      expect(flowFindings[0].severity).toBe('high');
      expect(flowFindings[0].file).toBe('PHI-FLOW-MAP');
      expect(flowFindings[0].recommendation).toContain('INPUT');
      expect(flowFindings[0].recommendation).toContain('PROCESSING');
      expect(flowFindings[0].recommendation).toContain('STORAGE');
    });
  });

  describe('HIPAA-PENTEST-001: Vulnerability Scanning', () => {
    it('should detect missing vulnerability scanning config', async () => {
      const file = await createTestFile(
        'package.json',
        JSON.stringify({
          name: 'test-app',
          version: '1.0.0',
          scripts: {
            test: 'jest',
          },
        })
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const pentestFindings = findings.filter((f) => f.id === 'HIPAA-PENTEST-001');

      expect(pentestFindings.length).toBeGreaterThan(0);
      expect(pentestFindings[0].severity).toBe('high');
    });

    it('should not flag when dependabot exists', async () => {
      const githubDir = path.join(tempDir, '.github');
      await fs.mkdir(githubDir, { recursive: true });
      await fs.writeFile(
        path.join(githubDir, 'dependabot.yml'),
        'version: 2\nupdates:\n  - package-ecosystem: npm',
        'utf-8'
      );

      const file = await createTestFile(
        'package.json',
        JSON.stringify({
          name: 'test-app',
          version: '1.0.0',
        })
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);
      const pentestFindings = findings.filter((f) => f.id === 'HIPAA-PENTEST-001');

      expect(pentestFindings.length).toBe(0);
    });
  });

  describe('General Scanner Behavior', () => {
    it('should only scan code files', async () => {
      await createTestFile('README.md', 'patient data here');
      await createTestFile('data.json', '{"patient": "data"}');
      await createTestFile('code.ts', 'const patient = req.body;');

      const findings = await hipaa2026Scanner.scan(testFiles, scanOptions);

      // Should only find findings in code.ts
      const uniqueFiles = new Set(findings.map((f) => path.basename(f.file)));
      expect(uniqueFiles.has('README.md')).toBe(false);
      expect(uniqueFiles.has('data.json')).toBe(false);
    });

    it('should include confidence scores', async () => {
      const file = await createTestFile(
        'auth.ts',
        `
app.post('/login', async (req) => {
  const user = await authenticateUser(req.body);
  accessPatientRecords(user);
});
        `
      );

      const findings = await hipaa2026Scanner.scan([file], scanOptions);

      for (const finding of findings) {
        expect(finding.confidence).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(finding.confidence);
      }
    });
  });
});
