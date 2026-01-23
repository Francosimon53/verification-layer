import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { accessScanner } from '../../src/scanners/access/index.js';
import type { ScanOptions } from '../../src/types.js';

const TEST_DIR = join(process.cwd(), '.tmp-access-scan');

const defaultOptions: ScanOptions = {
  path: TEST_DIR,
};

async function createTestFile(filename: string, content: string): Promise<string> {
  const filePath = join(TEST_DIR, filename);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('Access Scanner', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('SELECT * Detection', () => {
    it('should detect SELECT * FROM patient', async () => {
      const file = await createTestFile('query.sql', `
        SELECT * FROM patient WHERE id = 1;
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('select-star'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('medium');
    });

    it('should detect SELECT * FROM user table', async () => {
      const file = await createTestFile('user-query.sql', `
        SELECT * FROM user WHERE active = true;
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('select-star'));
      expect(finding).toBeDefined();
    });

    it('should detect SELECT * FROM health table', async () => {
      const file = await createTestFile('health-query.ts', `
        const query = "SELECT * FROM health_records";
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('select-star'));
      expect(finding).toBeDefined();
    });

    it('should detect SELECT * FROM medical table', async () => {
      const file = await createTestFile('medical-query.ts', `
        db.query("SELECT * FROM medical_history");
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('select-star'));
      expect(finding).toBeDefined();
    });
  });

  describe('Hardcoded Admin Role Detection', () => {
    it('should detect role = "admin"', async () => {
      const file = await createTestFile('admin-role.ts', `
        const user = { name: "test", role: "admin" };
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-admin'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });

    it('should detect role: "root"', async () => {
      const file = await createTestFile('root-role.ts', `
        const config = { role: "root" };
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-admin'));
      expect(finding).toBeDefined();
    });

    it('should detect role = "superuser"', async () => {
      const file = await createTestFile('superuser.ts', `
        user.role = "superuser";
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-admin'));
      expect(finding).toBeDefined();
    });
  });

  describe('Authentication Bypass Detection', () => {
    it('should detect bypass auth pattern', async () => {
      const file = await createTestFile('bypass-auth.ts', `
        if (devMode) {
          bypassAuth();
        }
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('auth-bypass'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
    });

    it('should detect auth bypass pattern', async () => {
      const file = await createTestFile('auth-bypass.ts', `
        // TODO: remove auth bypass before production
        const authBypass = true;
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('auth-bypass'));
      expect(finding).toBeDefined();
    });

    it('should detect skip auth pattern', async () => {
      const file = await createTestFile('skip-auth.ts', `
        if (skipAuth) {
          return next();
        }
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('auth-bypass'));
      expect(finding).toBeDefined();
    });
  });

  describe('Hardcoded Admin Flag Detection', () => {
    it('should detect isAdmin = true', async () => {
      const file = await createTestFile('isadmin.ts', `
        const user = { isAdmin: true };
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('admin-flag'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('medium');
    });

    it('should detect admin = true', async () => {
      const file = await createTestFile('admin-true.ts', `
        const config = { admin: true };
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('admin-flag'));
      expect(finding).toBeDefined();
    });
  });

  describe('Public Password Field Detection', () => {
    it('should detect public password field in Java', async () => {
      const file = await createTestFile('user.java', `
        public class User {
          public String password;
        }
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('public-password'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
    });

    it('should detect public static password', async () => {
      const file = await createTestFile('config.java', `
        public static String password = "secret123";
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('public-password'));
      expect(finding).toBeDefined();
    });
  });

  describe('CORS Wildcard Detection', () => {
    it('should detect Access-Control-Allow-Origin: *', async () => {
      const file = await createTestFile('cors.ts', `
        res.setHeader('Access-Control-Allow-Origin', '*');
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('cors-wildcard'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });

    it('should detect allowOrigin: "*"', async () => {
      const file = await createTestFile('cors-config.ts', `
        const corsOptions = {
          allowOrigin: "*"
        };
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('cors-wildcard'));
      expect(finding).toBeDefined();
    });
  });

  describe('Session Expiry Detection', () => {
    it('should detect session expires = 0', async () => {
      const file = await createTestFile('session-expires.ts', `
        const sessionConfig = {
          sessionExpires: 0
        };
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('no-session-expiry'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });

    it('should detect maxAge: 0', async () => {
      const file = await createTestFile('maxage.ts', `
        app.use(session({
          cookie: { maxAge: 0 }
        }));
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('no-session-expiry'));
      expect(finding).toBeDefined();
    });
  });

  describe('False Positive Prevention', () => {
    it('should NOT flag SELECT with specific columns', async () => {
      const file = await createTestFile('specific-select.sql', `
        SELECT id, name FROM patient WHERE id = 1;
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('select-star'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag role = "user"', async () => {
      const file = await createTestFile('user-role.ts', `
        const user = { role: "user" };
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-admin'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag private password field', async () => {
      const file = await createTestFile('private-pass.java', `
        public class User {
          private String password;
        }
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('public-password'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag CORS with specific origin', async () => {
      const file = await createTestFile('cors-specific.ts', `
        res.setHeader('Access-Control-Allow-Origin', 'https://app.example.com');
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('cors-wildcard'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag session with proper expiry', async () => {
      const file = await createTestFile('session-expiry.ts', `
        const sessionConfig = {
          cookie: { maxAge: 900000 }
        };
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('no-session-expiry'));
      expect(finding).toBeUndefined();
    });

    it('should NOT scan markdown files', async () => {
      const file = await createTestFile('docs.md', `
        # Security Notes
        Never use role: "admin" in production
        Avoid SELECT * FROM patient
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      expect(findings.length).toBe(0);
    });
  });

  describe('Finding Metadata', () => {
    it('should include correct HIPAA reference', async () => {
      const file = await createTestFile('hipaa-ref.ts', `
        const user = { role: "admin" };
      `);

      const findings = await accessScanner.scan([file], defaultOptions);

      expect(findings[0].hipaaReference).toBe('§164.312(a)(1), §164.312(d)');
    });

    it('should include line number', async () => {
      const file = await createTestFile('line-num.ts', `// line 1
// line 2
const user = { role: "admin" }; // line 3
`);

      const findings = await accessScanner.scan([file], defaultOptions);

      expect(findings[0].line).toBe(3);
    });

    it('should include context lines', async () => {
      const file = await createTestFile('context.ts', `const a = 1;
const b = 2;
const user = { role: "admin" };
const c = 3;
const d = 4;
`);

      const findings = await accessScanner.scan([file], defaultOptions);

      expect(findings[0].context).toBeDefined();
      expect(findings[0].context?.length).toBeGreaterThan(0);
    });
  });
});
