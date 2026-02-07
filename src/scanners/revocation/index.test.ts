/**
 * Token Revocation Security Scanner Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { revocationScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Token Revocation Security Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revoke-test-'));
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

  describe('REVOKE-001: JWT Without Server-Side Revocation Mechanism', () => {
    it('should detect jwt.sign without revocation', async () => {
      const file = await createTestFile(
        'jwt-sign.ts',
        `
import jwt from 'jsonwebtoken';

function createToken(userId: string) {
  const token = jwt.sign({ userId }, SECRET, { expiresIn: '1h' });
  return token;
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-001');
      expect(revokeFindings.length).toBeGreaterThan(0);
      expect(revokeFindings[0].severity).toBe('high');
    });

    it('should detect jsonwebtoken.sign without revocation', async () => {
      const file = await createTestFile(
        'jsonwebtoken.ts',
        `
import * as jsonwebtoken from 'jsonwebtoken';

export function generateAccessToken(payload: any) {
  return jsonwebtoken.sign(payload, process.env.JWT_SECRET);
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-001')).toBe(true);
    });

    it('should detect jose SignJWT without revocation', async () => {
      const file = await createTestFile(
        'jose-sign.ts',
        `
import { SignJWT } from 'jose';

async function createJWT(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secret);
  return token;
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-001')).toBe(true);
    });

    it('should detect custom token generation without revocation', async () => {
      const file = await createTestFile(
        'custom-token.ts',
        `
function createAccessToken(user: User) {
  const payload = { id: user.id, email: user.email };
  return jwt.sign(payload, SECRET);
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-001')).toBe(true);
    });

    it('should NOT flag when blacklist is used', async () => {
      const file = await createTestFile(
        'jwt-blacklist.ts',
        `
import jwt from 'jsonwebtoken';
import { tokenBlacklist } from './blacklist';

function createToken(userId: string) {
  const token = jwt.sign({ userId }, SECRET, { expiresIn: '1h' });
  return token;
}

async function revokeToken(token: string) {
  await tokenBlacklist.add(token);
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-001');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag when Redis is used for token storage', async () => {
      const file = await createTestFile(
        'jwt-redis.ts',
        `
import jwt from 'jsonwebtoken';
import redis from './redis';

async function createToken(userId: string) {
  const token = jwt.sign({ userId }, SECRET, { expiresIn: '1h' });
  await redis.set(\`token:\${userId}\`, token, 'EX', 3600);
  return token;
}

async function revokeToken(userId: string) {
  await redis.del(\`token:\${userId}\`);
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-001');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag when tokenStore is used', async () => {
      const file = await createTestFile(
        'jwt-store.ts',
        `
import jwt from 'jsonwebtoken';
import { tokenStore } from './store';

function createToken(userId: string) {
  const token = jwt.sign({ userId }, SECRET);
  tokenStore.save(userId, token);
  return token;
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-001');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag when revoke function exists', async () => {
      const file = await createTestFile(
        'jwt-revoke.ts',
        `
import jwt from 'jsonwebtoken';

function createToken(userId: string) {
  return jwt.sign({ userId }, SECRET, { expiresIn: '1h' });
}

async function revokeUserTokens(userId: string) {
  await revokedTokens.add(userId);
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-001');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag session-based authentication', async () => {
      const file = await createTestFile(
        'session-auth.ts',
        `
import jwt from 'jsonwebtoken';
import session from 'express-session';

function createToken(userId: string) {
  return jwt.sign({ userId, sessionId: req.session.id }, SECRET);
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-001');
      expect(revokeFindings.length).toBe(0);
    });
  });

  describe('REVOKE-002: Excessive Token Expiration Time', () => {
    it('should detect expiresIn with 2 days', async () => {
      const file = await createTestFile(
        'expires-2d.ts',
        `
const token = jwt.sign({ userId }, SECRET, { expiresIn: '2d' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-002');
      expect(revokeFindings.length).toBeGreaterThan(0);
      expect(revokeFindings[0].severity).toBe('medium');
    });

    it('should detect expiresIn with 7 days', async () => {
      const file = await createTestFile(
        'expires-7d.ts',
        `
const accessToken = jwt.sign(payload, SECRET, { expiresIn: '7d' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-002')).toBe(true);
    });

    it('should detect expiresIn with 30 days', async () => {
      const file = await createTestFile(
        'expires-30d.ts',
        `
const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '30d' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-002')).toBe(true);
    });

    it('should detect expiresIn with 48 hours', async () => {
      const file = await createTestFile(
        'expires-48h.ts',
        `
const token = jwt.sign(data, SECRET, { expiresIn: '48h' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-002')).toBe(true);
    });

    it('should detect expiresIn with 72 hours', async () => {
      const file = await createTestFile(
        'expires-72h.ts',
        `
jwt.sign({ userId: user.id }, process.env.SECRET, { expiresIn: '72h' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-002')).toBe(true);
    });

    it('should detect expiresIn with 1 week', async () => {
      const file = await createTestFile(
        'expires-1w.ts',
        `
const token = jwt.sign(payload, SECRET, { expiresIn: '1w' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-002')).toBe(true);
    });

    it('should detect numeric expiresIn exceeding 24 hours', async () => {
      const file = await createTestFile(
        'expires-numeric.ts',
        `
const token = jwt.sign({ userId }, SECRET, { expiresIn: 172800 });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-002')).toBe(true);
    });

    it('should detect excessive maxAge', async () => {
      const file = await createTestFile(
        'maxage-excessive.ts',
        `
res.cookie('token', token, { maxAge: 864000000 });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-002')).toBe(true);
    });

    it('should NOT flag expiresIn with 1 hour', async () => {
      const file = await createTestFile(
        'expires-1h.ts',
        `
const token = jwt.sign({ userId }, SECRET, { expiresIn: '1h' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-002');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag expiresIn with 15 minutes', async () => {
      const file = await createTestFile(
        'expires-15m.ts',
        `
const token = jwt.sign(payload, SECRET, { expiresIn: '15m' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-002');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag expiresIn with 24 hours', async () => {
      const file = await createTestFile(
        'expires-24h.ts',
        `
const accessToken = jwt.sign({ id: user.id }, SECRET, { expiresIn: '24h' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-002');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag expiresIn with 1 day', async () => {
      const file = await createTestFile(
        'expires-1d.ts',
        `
const token = jwt.sign({ userId }, SECRET, { expiresIn: '1d' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-002');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag refresh tokens with longer expiration', async () => {
      const file = await createTestFile(
        'refresh-token.ts',
        `
const refreshToken = jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-002');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag remember me tokens', async () => {
      const file = await createTestFile(
        'remember-me.ts',
        `
if (rememberMe) {
  const token = jwt.sign(payload, SECRET, { expiresIn: '30d' });
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-002');
      expect(revokeFindings.length).toBe(0);
    });

    it('should NOT flag API keys', async () => {
      const file = await createTestFile(
        'api-key.ts',
        `
const apiKey = jwt.sign({ clientId }, SECRET, { expiresIn: '90d' });
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      const revokeFindings = findings.filter((f) => f.id === 'REVOKE-002');
      expect(revokeFindings.length).toBe(0);
    });
  });

  describe('Combined violations', () => {
    it('should detect both REVOKE-001 and REVOKE-002 in same file', async () => {
      const file = await createTestFile(
        'combined.ts',
        `
import jwt from 'jsonwebtoken';

function createToken(userId: string) {
  const token = jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
  return token;
}
`
      );

      const findings = await revocationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'REVOKE-001')).toBe(true);
      expect(findings.some((f) => f.id === 'REVOKE-002')).toBe(true);
    });
  });

  it('should provide correct HIPAA references', async () => {
    const file = await createTestFile(
      'hipaa-refs.ts',
      `
import jwt from 'jsonwebtoken';
const token1 = jwt.sign({ userId }, SECRET, { expiresIn: '30d' });
`
    );

    const findings = await revocationScanner.scan([file], scanOptions);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.hipaaReference?.includes('164.308(a)(3)(ii)(C)'))).toBe(true);
  });

  it('should have correct severity levels', async () => {
    const file1 = await createTestFile(
      'severity-high.ts',
      `
import jwt from 'jsonwebtoken';
const token1 = jwt.sign({ userId }, SECRET, { expiresIn: '1h' });
`
    );

    const file2 = await createTestFile(
      'severity-medium.ts',
      `
const token2 = jwt.sign({ userId }, SECRET, { expiresIn: '48h' });
`
    );

    const findings1 = await revocationScanner.scan([file1], scanOptions);
    const findings2 = await revocationScanner.scan([file2], scanOptions);

    const revoke001 = findings1.find((f) => f.id === 'REVOKE-001');
    const revoke002 = findings2.find((f) => f.id === 'REVOKE-002');

    expect(revoke001?.severity).toBe('high');
    expect(revoke002?.severity).toBe('medium');
  });
});
