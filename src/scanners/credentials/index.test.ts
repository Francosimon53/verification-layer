/**
 * Tests for Credential Security Scanner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { credentialsScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Credentials Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cred-test-'));
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

  describe('CRED-001: Weak Password Hashing', () => {
    it('should detect MD5 for password hashing', async () => {
      const file = await createTestFile(
        'auth.ts',
        `
import crypto from 'crypto';

function hashPassword(password: string) {
  const hash = crypto.createHash('md5');
  hash.update(password);
  return hash.digest('hex');
}
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-001');

      expect(credFindings.length).toBeGreaterThan(0);
      expect(credFindings[0].severity).toBe('critical');
      expect(credFindings[0].hipaaReference).toContain('164.312(d)');
    });

    it('should detect SHA1 for password hashing', async () => {
      const file = await createTestFile(
        'password.ts',
        `
const passwordHash = crypto.createHash('sha1').update(userPassword).digest('hex');
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-001');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect SHA256 for password hashing', async () => {
      const file = await createTestFile(
        'user-auth.ts',
        `
async function verifyPassword(password: string, hash: string) {
  const computed = crypto.createHash('sha256').update(password).digest('hex');
  return computed === hash;
}
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-001');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect Python hashlib.md5 for passwords', async () => {
      const file = await createTestFile(
        'auth.py',
        `
import hashlib

def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-001');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should not flag bcrypt for password hashing', async () => {
      const file = await createTestFile(
        'secure-auth.ts',
        `
import bcrypt from 'bcrypt';

async function hashPassword(password: string) {
  const hash = await bcrypt.hash(password, 10);
  return hash;
}
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-001');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag argon2 for password hashing', async () => {
      const file = await createTestFile(
        'argon-auth.ts',
        `
import argon2 from 'argon2';

async function hashPassword(password: string) {
  return await argon2.hash(password);
}
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-001');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag MD5 for file checksum', async () => {
      const file = await createTestFile(
        'checksum.ts',
        `
function calculateChecksum(fileBuffer: Buffer) {
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-001');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag MD5 for integrity check', async () => {
      const file = await createTestFile(
        'integrity.ts',
        `
const hash = crypto.createHash('md5');
hash.update(fileContent);
const integrity = hash.digest('hex');
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-001');

      expect(credFindings.length).toBe(0);
    });
  });

  describe('CRED-002: Hardcoded Credentials', () => {
    it('should detect hardcoded password', async () => {
      const file = await createTestFile(
        'config.ts',
        `
const config = {
  username: 'admin',
  password: 'SuperSecret123!'
};
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBeGreaterThan(0);
      expect(credFindings[0].severity).toBe('critical');
    });

    it('should detect hardcoded API key', async () => {
      const file = await createTestFile(
        'api.ts',
        `
const apiKey = 'fake_key_ABCDEFGH1234567890XXXXXX';
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect hardcoded secret', async () => {
      const file = await createTestFile(
        'secrets.ts',
        `
export const JWT_SECRET = 'my-super-secret-jwt-key-12345';
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect hardcoded token', async () => {
      const file = await createTestFile(
        'auth-token.ts',
        `
const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect hardcoded connection string', async () => {
      const file = await createTestFile(
        'database.ts',
        `
const connectionString = 'postgresql://user:password@localhost:5432/mydb';
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect Bearer token', async () => {
      const file = await createTestFile(
        'bearer.ts',
        `
const token = 'Bearer fake_test_1234567890abcdefghijklmnop';
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should not flag environment variables', async () => {
      const file = await createTestFile(
        'env-config.ts',
        `
const password = process.env.DATABASE_PASSWORD;
const apiKey = process.env.API_KEY;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag import.meta.env', async () => {
      const file = await createTestFile(
        'vite-config.ts',
        `
const secret = import.meta.env.VITE_API_KEY;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag placeholders', async () => {
      const file = await createTestFile(
        'example.ts',
        `
const apiKey = 'your-api-key-here';
const password = 'changeme';
const secret = 'replace-this-value';
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag template literals', async () => {
      const file = await createTestFile(
        'template.ts',
        `
const connectionString = \`postgresql://\${user}:\${password}@localhost/db\`;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag short or generic passwords', async () => {
      const file = await createTestFile(
        'generic.ts',
        `
const password = 'test';
const pwd = '12345';
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBe(0);
    });
  });

  describe('CRED-003: NEXT_PUBLIC_ Secrets', () => {
    it('should detect NEXT_PUBLIC_SECRET', async () => {
      const file = await createTestFile(
        '.env.local',
        `
NEXT_PUBLIC_SECRET=my-secret-key-12345
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBeGreaterThan(0);
      expect(credFindings[0].severity).toBe('critical');
    });

    it('should detect NEXT_PUBLIC_API_KEY', async () => {
      const file = await createTestFile(
        'config.ts',
        `
const apiKey = process.env.NEXT_PUBLIC_API_KEY;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect NEXT_PUBLIC_PASSWORD', async () => {
      const file = await createTestFile(
        'auth.ts',
        `
const password = process.env.NEXT_PUBLIC_PASSWORD;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect NEXT_PUBLIC_SERVICE_ROLE', async () => {
      const file = await createTestFile(
        'supabase.ts',
        `
const serviceRole = process.env.NEXT_PUBLIC_SERVICE_ROLE;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect NEXT_PUBLIC_PRIVATE_KEY', async () => {
      const file = await createTestFile(
        'crypto.ts',
        `
const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect NEXT_PUBLIC_DATABASE_URL', async () => {
      const file = await createTestFile(
        'db.ts',
        `
const dbUrl = process.env.NEXT_PUBLIC_DATABASE_URL;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should detect NEXT_PUBLIC_ADMIN_TOKEN', async () => {
      const file = await createTestFile(
        'admin.ts',
        `
const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBeGreaterThan(0);
    });

    it('should not flag NEXT_PUBLIC_SUPABASE_ANON_KEY', async () => {
      const file = await createTestFile(
        'supabase-config.ts',
        `
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', async () => {
      const file = await createTestFile(
        'clerk.ts',
        `
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag NEXT_PUBLIC_GA_ID (Analytics)', async () => {
      const file = await createTestFile(
        'analytics.ts',
        `
const gaId = process.env.NEXT_PUBLIC_GA_ID;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag NEXT_PUBLIC_APP_URL', async () => {
      const file = await createTestFile(
        'app-config.ts',
        `
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const siteName = process.env.NEXT_PUBLIC_SITE_NAME;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBe(0);
    });

    it('should not flag NEXT_PUBLIC_FEATURE_FLAG', async () => {
      const file = await createTestFile(
        'features.ts',
        `
const newFeature = process.env.NEXT_PUBLIC_FEATURE_NEW_UI;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-003');

      expect(credFindings.length).toBe(0);
    });
  });

  describe('General Scanner Behavior', () => {
    it('should only scan code and config files', async () => {
      await createTestFile('README.md', 'password = "secret123456"');
      await createTestFile('image.png', 'binary data');
      await createTestFile('code.ts', 'const password = "secret123456";');

      const findings = await credentialsScanner.scan(testFiles, scanOptions);

      const mdFindings = findings.filter((f) => f.file.endsWith('.md'));
      const pngFindings = findings.filter((f) => f.file.endsWith('.png'));

      expect(mdFindings.length).toBe(0);
      expect(pngFindings.length).toBe(0);
    });

    it('should skip comment lines', async () => {
      const file = await createTestFile(
        'commented.ts',
        `
// const password = "hardcoded-secret";
/*
 * const apiKey = "fake_key_1234567890";
 */
const validCode = true;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);
      const credFindings = findings.filter((f) => f.id === 'CRED-002');

      expect(credFindings.length).toBe(0);
    });

    it('should include confidence scores', async () => {
      const file = await createTestFile(
        'test.ts',
        `
const password = "SecretPassword123!";
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);

      for (const finding of findings) {
        expect(finding.confidence).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(finding.confidence);
      }
    });

    it('should detect multiple violations in same file', async () => {
      const file = await createTestFile(
        'bad-security.ts',
        `
import crypto from 'crypto';

// CRED-001: Weak password hashing
function hashPassword(password: string) {
  return crypto.createHash('md5').update(password).digest('hex');
}

// CRED-002: Hardcoded credentials
const config = {
  apiKey: 'fake_key_ABCDEFGHIJKLMNOP1234567890',
  password: 'AdminPassword123!'
};

// CRED-003: Exposed secret
const secret = process.env.NEXT_PUBLIC_SECRET_KEY;
        `
      );

      const findings = await credentialsScanner.scan([file], scanOptions);

      const cred001 = findings.filter((f) => f.id === 'CRED-001');
      const cred002 = findings.filter((f) => f.id === 'CRED-002');
      const cred003 = findings.filter((f) => f.id === 'CRED-003');

      expect(cred001.length).toBeGreaterThan(0);
      expect(cred002.length).toBeGreaterThan(0);
      expect(cred003.length).toBeGreaterThan(0);
    });
  });
});
