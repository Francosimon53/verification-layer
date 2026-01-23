import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { securityScanner } from '../../src/scanners/security/index.js';
import type { ScanOptions } from '../../src/types.js';

// Use path without "test" to avoid scanner skipping hardcoded credential patterns
const TEST_DIR = join(process.cwd(), '.tmp-security-scan');

const defaultOptions: ScanOptions = {
  path: TEST_DIR,
};

async function createTestFile(filename: string, content: string): Promise<string> {
  const filePath = join(TEST_DIR, filename);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('Security Scanner', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('Hardcoded Passwords Detection', () => {
    it('should detect password = "value"', async () => {
      const file = await createTestFile('config.ts', `
        const config = {
          password: "supersecret123"
        };
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-password'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
      expect(finding?.fixType).toBe('hardcoded-password');
    });

    it('should detect password with colon syntax', async () => {
      const file = await createTestFile('db.ts', `
        const db = { password: "mypassword" };
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-password'));
      expect(finding).toBeDefined();
    });

    it('should detect pwd variable', async () => {
      const file = await createTestFile('auth.ts', `
        const pwd = "secret1234";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-pwd'));
      expect(finding).toBeDefined();
    });

    it('should detect hardcoded secret', async () => {
      const file = await createTestFile('secrets.ts', `
        const secret = "verylongsecretvalue123";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-secret'));
      expect(finding).toBeDefined();
      expect(finding?.fixType).toBe('hardcoded-secret');
    });

    it('should detect credentials object with password', async () => {
      const file = await createTestFile('creds.ts', `
        const credentials = { username: "admin", password: "admin123" };
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('credentials-object'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });
  });

  describe('API Keys Detection', () => {
    it('should detect api_key exposure', async () => {
      const file = await createTestFile('api.ts', `
        const api_key = "abcdefghij1234567890klmnop";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('api-key-exposed'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
      expect(finding?.fixType).toBe('api-key-exposed');
    });

    it('should detect api-key with hyphen', async () => {
      const file = await createTestFile('api-hyphen.ts', `
        const api-key = "12345678901234567890abcd";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('api-key-exposed'));
      expect(finding).toBeDefined();
    });

    it('should detect apikey without separator', async () => {
      const file = await createTestFile('apikey.ts', `
        const apikey = "abcdefghijklmnopqrstuvwxyz";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('apikey-exposed'));
      expect(finding).toBeDefined();
    });

    it('should detect Stripe live key', async () => {
      // Build pattern dynamically to avoid GitHub secret scanning
      const prefix = 'sk_live_';
      const suffix = 'xxxxxxxxxxxxxxxxxxxx1234';
      const file = await createTestFile('stripe.ts', `
        const stripeKey = "${prefix}${suffix}";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('stripe-key-exposed'));
      expect(finding).toBeDefined();
    });

    it('should detect Stripe test key', async () => {
      // Build pattern dynamically to avoid GitHub secret scanning
      const prefix = 'pk_test_';
      const suffix = 'xxxxxxxxxxxxxxxxxxxx5678';
      const file = await createTestFile('stripe-pk.ts', `
        const publishableKey = "${prefix}${suffix}";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('stripe-key-exposed'));
      expect(finding).toBeDefined();
    });

    it('should detect AWS Access Key', async () => {
      const file = await createTestFile('aws.ts', `
        const awsKey = "AKIAIOSFODNN7EXAMPLE";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('aws-key-exposed'));
      expect(finding).toBeDefined();
    });

    it('should detect bearer token', async () => {
      const file = await createTestFile('bearer.ts', `
        const header = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('bearer-token-exposed'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });

    it('should detect auth_token', async () => {
      const file = await createTestFile('auth-token.ts', `
        const auth_token = "abc123def456ghi789jkl012mno";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('auth-token-exposed'));
      expect(finding).toBeDefined();
    });

    it('should detect private key', async () => {
      const file = await createTestFile('private-key.ts', `
        const private_key = "-----BEGIN RSA PRIVATE KEY-----";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('private-key-exposed'));
      expect(finding).toBeDefined();
    });
  });

  describe('Database Credentials Detection', () => {
    it('should detect MongoDB URI with credentials', async () => {
      const file = await createTestFile('mongo.ts', `
        const uri = "mongodb://admin:password123@localhost:27017/db";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('mongodb-uri-credentials'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
    });

    it('should detect MongoDB+srv URI', async () => {
      const file = await createTestFile('mongo-srv.ts', `
        const uri = "mongodb+srv://user:pass@cluster.mongodb.net/db";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('mongodb-uri-credentials'));
      expect(finding).toBeDefined();
    });

    it('should detect PostgreSQL URI with credentials', async () => {
      const file = await createTestFile('postgres.ts', `
        const uri = "postgresql://user:password@localhost:5432/mydb";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('postgres-uri-credentials'));
      expect(finding).toBeDefined();
    });

    it('should detect postgres:// shorthand', async () => {
      const file = await createTestFile('pg.ts', `
        const db = "postgres://admin:secret@db.server.com/production";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('postgres-uri-credentials'));
      expect(finding).toBeDefined();
    });

    it('should detect MySQL URI with credentials', async () => {
      const file = await createTestFile('mysql.ts', `
        const uri = "mysql://root:password@localhost:3306/app";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('mysql-uri-credentials'));
      expect(finding).toBeDefined();
    });
  });

  describe('Input Sanitization Issues Detection', () => {
    it('should detect unsanitized innerHTML', async () => {
      const file = await createTestFile('dom.ts', `
        element.innerHTML = userInput;
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('innerhtml-unsanitized'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
      expect(finding?.fixType).toBe('innerhtml-unsanitized');
    });

    it('should detect dangerouslySetInnerHTML in React', async () => {
      const file = await createTestFile('component.tsx', `
        return <div dangerouslySetInnerHTML={{ __html: content }} />;
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('dangerous-innerhtml-react'));
      expect(finding).toBeDefined();
    });

    it('should detect eval() usage', async () => {
      const file = await createTestFile('eval.ts', `
        const result = eval(userCode);
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('eval-usage'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
    });

    it('should detect Function constructor', async () => {
      const file = await createTestFile('function.ts', `
        const fn = new Function("a", "b", "return a + b");
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('function-constructor'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });

    it('should detect document.write', async () => {
      const file = await createTestFile('docwrite.ts', `
        document.write("<h1>" + title + "</h1>");
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('document-write'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('medium');
    });
  });

  describe('SQL Injection Detection', () => {
    it('should detect SQL string concatenation', async () => {
      const file = await createTestFile('sql-concat.ts', `
        const query = "SELECT * FROM users WHERE id = '" + id + "'";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('sql-string-concat'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
      expect(finding?.fixType).toBe('sql-injection-concat');
    });

    it('should detect SQL with template literal interpolation', async () => {
      const file = await createTestFile('sql-template.ts', `
        const query = \`SELECT * FROM users WHERE id = \${userId}\`;
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('sql-template-literal'));
      expect(finding).toBeDefined();
      expect(finding?.fixType).toBe('sql-injection-template');
    });

    it('should detect WHERE clause with interpolation', async () => {
      const file = await createTestFile('sql-where.ts', `
        const sql = \`SELECT name FROM patients WHERE status = \${status}\`;
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('sql-template-literal'));
      expect(finding).toBeDefined();
    });

    it('should detect INSERT with interpolation', async () => {
      const file = await createTestFile('sql-insert.ts', `
        db.query(\`INSERT INTO users VALUES (\${name}, \${email})\`);
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('query-template-injection'));
      expect(finding).toBeDefined();
    });

    it('should detect UPDATE with interpolation', async () => {
      const file = await createTestFile('sql-update.ts', `
        const sql = \`UPDATE users SET name = \${name} WHERE id = 1\`;
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('sql-template-literal'));
      expect(finding).toBeDefined();
    });

    it('should detect DELETE with interpolation', async () => {
      const file = await createTestFile('sql-delete.ts', `
        const sql = \`DELETE FROM users WHERE id = \${id}\`;
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('sql-template-literal'));
      expect(finding).toBeDefined();
    });

    it('should detect query() with template interpolation', async () => {
      const file = await createTestFile('query-template.ts', `
        db.query(\`SELECT * FROM \${table} WHERE id = \${id}\`);
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('query-template-injection'));
      expect(finding).toBeDefined();
    });

    it('should detect execute() with string concatenation', async () => {
      const file = await createTestFile('execute-concat.ts', `
        connection.query("SELECT * FROM users" + whereClause);
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('execute-string-concat'));
      expect(finding).toBeDefined();
    });
  });

  describe('False Positive Prevention', () => {
    it('should NOT flag short passwords (< 4 chars)', async () => {
      const file = await createTestFile('short-pass.ts', `
        const password = "abc";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-password'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag short secrets (< 8 chars)', async () => {
      const file = await createTestFile('short-secret.ts', `
        const secret = "short";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-secret'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag short API keys (< 20 chars)', async () => {
      const file = await createTestFile('short-api.ts', `
        const api_key = "shortkey";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('api-key-exposed'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag parameterized queries', async () => {
      const file = await createTestFile('safe-query.ts', `
        db.query("SELECT * FROM users WHERE id = $1", [userId]);
        db.query("SELECT * FROM users WHERE id = ?", [userId]);
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const sqlFinding = findings.find(f =>
        f.id.includes('sql-string-concat') ||
        f.id.includes('sql-template-literal')
      );
      expect(sqlFinding).toBeUndefined();
    });

    it('should NOT flag innerHTML with string literal', async () => {
      const file = await createTestFile('safe-html.ts', `
        element.innerHTML = "<p>Static content</p>";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('innerhtml-unsanitized'));
      expect(finding).toBeUndefined();
    });

    it('should NOT flag database URI without credentials', async () => {
      const file = await createTestFile('safe-uri.ts', `
        const uri = "mongodb://localhost:27017/mydb";
        const pg = "postgresql://localhost:5432/mydb";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f =>
        f.id.includes('mongodb-uri-credentials') ||
        f.id.includes('postgres-uri-credentials')
      );
      expect(finding).toBeUndefined();
    });

    it('should NOT scan markdown files', async () => {
      const file = await createTestFile('readme.md', `
        # Security
        Never use password = "secret" in production
        Avoid eval(userInput)
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      expect(findings.length).toBe(0);
    });
  });

  describe('Finding Metadata', () => {
    it('should include correct HIPAA reference', async () => {
      const file = await createTestFile('hipaa.ts', `
        const password = "secret123";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      expect(findings[0].hipaaReference).toBe('§164.312(a)(1), §164.312(d)');
    });

    it('should include line number', async () => {
      const file = await createTestFile('line-num.ts', `// line 1
// line 2
const password = "secret123"; // line 3
`);

      const findings = await securityScanner.scan([file], defaultOptions);

      expect(findings[0].line).toBe(3);
    });

    it('should include context lines', async () => {
      const file = await createTestFile('context.ts', `const a = 1;
const b = 2;
const password = "secret123";
const c = 3;
const d = 4;
`);

      const findings = await securityScanner.scan([file], defaultOptions);

      expect(findings[0].context).toBeDefined();
      expect(findings[0].context?.length).toBeGreaterThan(0);
    });

    it('should use access-control category', async () => {
      const file = await createTestFile('category.ts', `
        const password = "secret123";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      expect(findings[0].category).toBe('access-control');
    });
  });

  describe('Multiple File Types', () => {
    it('should scan .env files', async () => {
      const file = await createTestFile('app.env', `
        DATABASE_URL=postgresql://user:pass@localhost/db
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('postgres-uri-credentials'));
      expect(finding).toBeDefined();
    });

    it('should scan .sql files', async () => {
      const file = await createTestFile('query.sql', `
        SELECT * FROM users WHERE id = '\${userId}';
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      // SQL files are scanned - this contains template literal pattern
      const finding = findings.find(f => f.id.includes('sql-template-literal'));
      expect(finding).toBeDefined();
    });

    it('should scan Python files', async () => {
      const file = await createTestFile('config.py', `
        password = "pythonsecret123"
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-password'));
      expect(finding).toBeDefined();
    });

    it('should scan Java files', async () => {
      const file = await createTestFile('Config.java', `
        String password = "javasecret123";
      `);

      const findings = await securityScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('hardcoded-password'));
      expect(finding).toBeDefined();
    });
  });
});
