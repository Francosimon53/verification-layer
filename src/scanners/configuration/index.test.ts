/**
 * Configuration Security Scanner Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configurationScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Configuration Security Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
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

  describe('CONFIG-001: Debug/Verbose Mode Without Environment Gate', () => {
    it('should detect debug:true without NODE_ENV gate', async () => {
      const file = await createTestFile(
        'config.ts',
        `export const config = {
  debug: true,
  apiUrl: 'https://api.example.com'
};`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-001');
      expect(configFindings.length).toBeGreaterThan(0);
      expect(configFindings[0].severity).toBe('high');
    });

    it('should detect DEBUG:true', async () => {
      const file = await createTestFile(
        'env.ts',
        `
const settings = {
  DEBUG: true,
  port: 3000
};
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-001')).toBe(true);
    });

    it('should detect verbose:true', async () => {
      const file = await createTestFile(
        'logger.ts',
        `
const loggerConfig = {
  verbose: true,
  level: 'info'
};
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-001')).toBe(true);
    });

    it('should detect devTools:true', async () => {
      const file = await createTestFile(
        'redux.ts',
        `
const store = createStore(reducer, {
  devTools: true
});
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-001')).toBe(true);
    });

    it('should NOT flag debug with NODE_ENV gate', async () => {
      const file = await createTestFile(
        'safe-config.ts',
        `
export const config = {
  debug: process.env.NODE_ENV === 'development',
  apiUrl: 'https://api.example.com'
};
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-001');
      expect(configFindings.length).toBe(0);
    });

    it('should NOT flag debug with isDevelopment check', async () => {
      const file = await createTestFile(
        'safe-debug.ts',
        `
const isDevelopment = process.env.NODE_ENV === 'development';
export const config = {
  debug: isDevelopment
};
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-001');
      expect(configFindings.length).toBe(0);
    });

    it('should NOT flag debug in test files', async () => {
      const file = await createTestFile(
        'app.test.ts',
        `
describe('app', () => {
  const config = { debug: true };
  it('should work', () => {});
});
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-001');
      expect(configFindings.length).toBe(0);
    });

    it('should NOT flag debug in conditional', async () => {
      const file = await createTestFile(
        'conditional.ts',
        `
const config = {
  debug: process.env.NODE_ENV !== 'production'
};
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-001');
      expect(configFindings.length).toBe(0);
    });
  });

  describe('CONFIG-002: Web Server Without Security Headers', () => {
    it('should detect express() without helmet', async () => {
      const file = await createTestFile(
        'server.ts',
        `
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Hello');
});

app.listen(3000);
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-002');
      expect(configFindings.length).toBeGreaterThan(0);
      expect(configFindings[0].severity).toBe('medium');
    });

    it('should detect http.createServer without headers', async () => {
      const file = await createTestFile(
        'http-server.ts',
        `
import http from 'http';

const server = http.createServer((req, res) => {
  res.end('Hello');
});

server.listen(3000);
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-002')).toBe(true);
    });

    it('should detect new Hono() without security', async () => {
      const file = await createTestFile(
        'hono-app.ts',
        `
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('Hello'));
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-002')).toBe(true);
    });

    it('should detect new Elysia() without security', async () => {
      const file = await createTestFile(
        'elysia-app.ts',
        `
import { Elysia } from 'elysia';

const app = new Elysia();
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-002')).toBe(true);
    });

    it('should NOT flag express with helmet', async () => {
      const file = await createTestFile(
        'secure-express.ts',
        `
import express from 'express';
import helmet from 'helmet';

const app = express();
app.use(helmet());

app.listen(3000);
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-002');
      expect(configFindings.length).toBe(0);
    });

    it('should NOT flag server with X-Frame-Options header', async () => {
      const file = await createTestFile(
        'secure-headers.ts',
        `
const app = express();

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-002');
      expect(configFindings.length).toBe(0);
    });

    it('should NOT flag server with CSP header', async () => {
      const file = await createTestFile(
        'csp-headers.ts',
        `
import http from 'http';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.end('Hello');
});
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-002');
      expect(configFindings.length).toBe(0);
    });
  });

  describe('CONFIG-003: Test Framework Imports in Production Code', () => {
    it('should detect jest import in production file', async () => {
      const file = await createTestFile(
        'utils.ts',
        `
import { jest } from '@jest/globals';

export function mockFunction() {
  return jest.fn();
}
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-003');
      expect(configFindings.length).toBeGreaterThan(0);
      expect(configFindings[0].severity).toBe('low');
    });

    it('should detect vitest import in production file', async () => {
      const file = await createTestFile(
        'helper.ts',
        `
import { describe, it, expect } from 'vitest';

export function runTests() {
  describe('tests', () => {});
}
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-003')).toBe(true);
    });

    it('should detect mocha import in production file', async () => {
      const file = await createTestFile(
        'runner.ts',
        `
import { describe } from 'mocha';
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-003')).toBe(true);
    });

    it('should detect chai import in production file', async () => {
      const file = await createTestFile(
        'assertions.ts',
        `
import { expect } from 'chai';
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-003')).toBe(true);
    });

    it('should detect faker import in production file', async () => {
      const file = await createTestFile(
        'data.ts',
        `
import { faker } from '@faker-js/faker';

export const fakeData = faker.name.firstName();
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-003')).toBe(true);
    });

    it('should detect cypress import in production file', async () => {
      const file = await createTestFile(
        'commands.ts',
        `
import { cy } from 'cypress';
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-003')).toBe(true);
    });

    it('should NOT flag test framework imports in test files', async () => {
      const file = await createTestFile(
        'app.test.ts',
        `
import { describe, it, expect } from 'vitest';
import { jest } from '@jest/globals';

describe('app', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-003');
      expect(configFindings.length).toBe(0);
    });

    it('should NOT flag test framework imports in spec files', async () => {
      const file = await createTestFile(
        'component.spec.ts',
        `
import { describe, it } from 'mocha';
import { expect } from 'chai';
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      const configFindings = findings.filter((f) => f.id === 'CONFIG-003');
      expect(configFindings.length).toBe(0);
    });
  });

  describe('Combined violations', () => {
    it('should detect multiple CONFIG violations in same file', async () => {
      const file = await createTestFile(
        'bad-config.ts',
        `
import { jest } from '@jest/globals';
import express from 'express';

const config = {
  debug: true,
  verbose: true
};

const app = express();

app.listen(3000);
`
      );

      const findings = await configurationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'CONFIG-001')).toBe(true);
      expect(findings.some((f) => f.id === 'CONFIG-002')).toBe(true);
      expect(findings.some((f) => f.id === 'CONFIG-003')).toBe(true);
    });
  });

  it('should provide correct HIPAA references', async () => {
    const file = await createTestFile(
      'hipaa-refs.ts',
      `
const config = { debug: true };
const app = express();
import { vitest } from 'vitest';
`
    );

    const findings = await configurationScanner.scan([file], scanOptions);
    expect(findings.every((f) => f.hipaaReference?.includes('Configuration Management'))).toBe(true);
  });

  it('should have correct severity levels', async () => {
    const file1 = await createTestFile(
      'severity-high.ts',
      `const config = { debug: true };`
    );

    const file2 = await createTestFile(
      'severity-medium.ts',
      `const app = express();`
    );

    const file3 = await createTestFile(
      'severity-low.ts',
      `import { jest } from '@jest/globals';`
    );

    const findings1 = await configurationScanner.scan([file1], scanOptions);
    const findings2 = await configurationScanner.scan([file2], scanOptions);
    const findings3 = await configurationScanner.scan([file3], scanOptions);

    const config001 = findings1.find((f) => f.id === 'CONFIG-001');
    const config002 = findings2.find((f) => f.id === 'CONFIG-002');
    const config003 = findings3.find((f) => f.id === 'CONFIG-003');

    expect(config001?.severity).toBe('high');
    expect(config002?.severity).toBe('medium');
    expect(config003?.severity).toBe('low');
  });
});
