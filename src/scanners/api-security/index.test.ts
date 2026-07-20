/**
 * API Security Scanner Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { apiSecurityScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('API Security Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-security-test-'));
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

  describe('RATE-001: Authentication Routes Without Rate Limiting', () => {
    it('should detect POST /login without rate limiting', async () => {
      const file = await createTestFile(
        'auth.ts',
        `
import express from 'express';

const app = express();

app.post('/login', (req, res) => {
  // Login logic
  res.json({ success: true });
});
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const rateFindings = findings.filter((f) => f.id === 'RATE-001');
      expect(rateFindings.length).toBeGreaterThan(0);
      expect(rateFindings[0].severity).toBe('high');
    });

    it('should detect POST /api/auth without rate limiting', async () => {
      const file = await createTestFile(
        'api-auth.ts',
        `
router.post('/api/auth', authHandler);
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RATE-001')).toBe(true);
    });

    it('should detect POST /register without rate limiting', async () => {
      const file = await createTestFile(
        'register.ts',
        `
app.post('/register', async (req, res) => {
  const user = await createUser(req.body);
  res.json(user);
});
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RATE-001')).toBe(true);
    });

    it('should detect POST /password-reset without rate limiting', async () => {
      const file = await createTestFile(
        'reset.ts',
        `
app.post('/password-reset', passwordResetHandler);
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RATE-001')).toBe(true);
    });

    it('should detect Fastify auth route without rate limiting', async () => {
      const file = await createTestFile(
        'fastify-auth.ts',
        `
fastify.post('/login', async (request, reply) => {
  return { token: 'abc' };
});
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RATE-001')).toBe(true);
    });

    it('should detect Hono auth route without rate limiting', async () => {
      const file = await createTestFile(
        'hono-auth.ts',
        `
import { Hono } from 'hono';
const app = new Hono();

app.post('/signin', (c) => {
  return c.json({ token: 'abc' });
});
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RATE-001')).toBe(true);
    });

    it('should NOT flag auth route with rateLimit middleware', async () => {
      const file = await createTestFile(
        'safe-login.ts',
        `
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

app.post('/login', loginLimiter, loginHandler);
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const rateFindings = findings.filter((f) => f.id === 'RATE-001');
      expect(rateFindings.length).toBe(0);
    });

    it('should NOT flag auth route with rateLimiter', async () => {
      const file = await createTestFile(
        'rate-limiter.ts',
        `
const rateLimiter = createRateLimiter();

app.post('/auth', rateLimiter, authHandler);
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const rateFindings = findings.filter((f) => f.id === 'RATE-001');
      expect(rateFindings.length).toBe(0);
    });

    it('should NOT flag auth route with throttle middleware', async () => {
      const file = await createTestFile(
        'throttle.ts',
        `
import { throttle } from './middleware';

router.post('/login', throttle, handleLogin);
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const rateFindings = findings.filter((f) => f.id === 'RATE-001');
      expect(rateFindings.length).toBe(0);
    });

    it('should NOT flag auth route with @upstash/ratelimit', async () => {
      const file = await createTestFile(
        'upstash.ts',
        `
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

app.post('/register', async (req, res) => {
  const { success } = await ratelimit.limit(req.ip);
  if (!success) return res.status(429).send('Too many requests');
  // Handle registration
});
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const rateFindings = findings.filter((f) => f.id === 'RATE-001');
      expect(rateFindings.length).toBe(0);
    });
  });

  describe('CORS-001: Open CORS Configuration', () => {
    it('should detect cors({ origin: "*" })', async () => {
      const file = await createTestFile(
        'cors.ts',
        `
import cors from 'cors';

app.use(cors({
  origin: "*"
}));
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const corsFindings = findings.filter((f) => f.id === 'CORS-001');
      expect(corsFindings.length).toBeGreaterThan(0);
      expect(corsFindings[0].severity).toBe('high');
    });

    it('should detect Access-Control-Allow-Origin: *', async () => {
      const file = await createTestFile(
        'headers.ts',
        `
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CORS-001')).toBe(true);
    });

    it('should detect res.header with wildcard origin', async () => {
      const file = await createTestFile(
        'wildcard.ts',
        `
res.header('Access-Control-Allow-Origin', '*');
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CORS-001')).toBe(true);
    });

    it('should detect headers.set with wildcard origin', async () => {
      const file = await createTestFile(
        'headers-set.ts',
        `
response.headers.set('Access-Control-Allow-Origin', '*');
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CORS-001')).toBe(true);
    });

    it('should NOT flag CORS with specific origins array', async () => {
      const file = await createTestFile(
        'safe-cors.ts',
        `
app.use(cors({
  origin: ['https://app.example.com', 'https://admin.example.com']
}));
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const corsFindings = findings.filter((f) => f.id === 'CORS-001');
      expect(corsFindings.length).toBe(0);
    });

    it('should NOT flag CORS with allowedOrigins', async () => {
      const file = await createTestFile(
        'allowed-origins.ts',
        `
const allowedOrigins = ['https://app.example.com'];

app.use(cors({
  origin: allowedOrigins
}));
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const corsFindings = findings.filter((f) => f.id === 'CORS-001');
      expect(corsFindings.length).toBe(0);
    });

    it('should NOT flag CORS with environment variable', async () => {
      const file = await createTestFile(
        'env-origin.ts',
        `
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(',')
}));
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const corsFindings = findings.filter((f) => f.id === 'CORS-001');
      expect(corsFindings.length).toBe(0);
    });

    it('should NOT flag CORS for public assets', async () => {
      const file = await createTestFile(
        'public-assets.ts',
        `
// Public assets can use wildcard CORS
app.use('/public', cors({ origin: '*' }));
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const corsFindings = findings.filter((f) => f.id === 'CORS-001');
      expect(corsFindings.length).toBe(0);
    });
  });

  describe('API-001: PHI in URL Query Parameters', () => {
    it('should detect ?ssn= in URL', async () => {
      const file = await createTestFile(
        'phi-url.ts',
        `
const url = \`/api/patient?ssn=\${ssn}\`;
fetch(url);
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const phiFindings = findings.filter((f) => f.id === 'API-001');
      expect(phiFindings.length).toBeGreaterThan(0);
      expect(phiFindings[0].severity).toBe('high');
      expect(phiFindings[0].category).toBe('phi-exposure');
    });

    it('should detect &dob= in URL', async () => {
      const file = await createTestFile(
        'dob-param.ts',
        `
const queryUrl = '/search?name=John&dob=1990-01-01';
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'API-001')).toBe(true);
    });

    it('should detect ?patient_name= in URL', async () => {
      const file = await createTestFile(
        'patient-name.ts',
        `
axios.get('/api/records?patient_name=John Doe');
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'API-001')).toBe(true);
    });

    it('should detect ?diagnosis= in URL', async () => {
      const file = await createTestFile(
        'diagnosis.ts',
        `
const endpoint = \`/api/search?diagnosis=\${diagnosisCode}\`;
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'API-001')).toBe(true);
    });

    it('should detect URLSearchParams with PHI', async () => {
      const file = await createTestFile(
        'search-params.ts',
        `
const params = new URLSearchParams();
params.append('ssn', patientSSN);
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'API-001')).toBe(true);
    });

    it('should detect searchParams.set with MRN', async () => {
      const file = await createTestFile(
        'mrn-param.ts',
        `
searchParams.set('mrn', medicalRecordNumber);
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'API-001')).toBe(true);
    });

    it('should NOT flag POST request with PHI in body', async () => {
      const file = await createTestFile(
        'safe-post.ts',
        `
const response = await fetch('/api/patient', {
  method: 'POST',
  body: JSON.stringify({ ssn: patientSSN })
});
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const phiFindings = findings.filter((f) => f.id === 'API-001');
      expect(phiFindings.length).toBe(0);
    });

    it('should NOT flag req.body usage', async () => {
      const file = await createTestFile(
        'req-body.ts',
        `
app.post('/api/patient', (req, res) => {
  const { ssn, dob } = req.body;
  // Process PHI safely from body
});
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const phiFindings = findings.filter((f) => f.id === 'API-001');
      expect(phiFindings.length).toBe(0);
    });

    it('should NOT flag comments or examples', async () => {
      const file = await createTestFile(
        'comments.ts',
        `
// Example: Don't use ?ssn=123-45-6789 in URLs
// TODO: Remove ?dob= from query params
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      const phiFindings = findings.filter((f) => f.id === 'API-001');
      expect(phiFindings.length).toBe(0);
    });
  });

  describe('Combined violations', () => {
    it('should detect multiple API violations in same file', async () => {
      const file = await createTestFile(
        'bad-api.ts',
        `
import cors from 'cors';

app.use(cors({ origin: '*' }));

app.post('/login', loginHandler);

const url = \`/api/patient?ssn=\${ssn}\`;
`
      );

      const findings = await apiSecurityScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'RATE-001')).toBe(true);
      expect(findings.some((f) => f.id === 'CORS-001')).toBe(true);
      expect(findings.some((f) => f.id === 'API-001')).toBe(true);
    });
  });

  it('should provide correct HIPAA references', async () => {
    const file = await createTestFile(
      'hipaa-refs.ts',
      `
app.post('/login', handler);
app.use(cors({ origin: '*' }));
const url = '?ssn=123';
`
    );

    const findings = await apiSecurityScanner.scan([file], scanOptions);
    expect(findings.every((f) => f.hipaaReference?.includes('164.312'))).toBe(true);
  });

  it('should have correct severity levels', async () => {
    const file = await createTestFile(
      'severity.ts',
      `
app.post('/login', handler);
app.use(cors({ origin: '*' }));
const url = '?ssn=123';
`
    );

    const findings = await apiSecurityScanner.scan([file], scanOptions);

    const rate001 = findings.find((f) => f.id === 'RATE-001');
    const cors001 = findings.find((f) => f.id === 'CORS-001');
    const api001 = findings.find((f) => f.id === 'API-001');

    expect(rate001?.severity).toBe('high');
    expect(cors001?.severity).toBe('high');
    expect(api001?.severity).toBe('high');
  });
});
