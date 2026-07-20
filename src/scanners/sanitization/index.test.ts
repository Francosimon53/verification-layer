/**
 * Input Sanitization Security Scanner Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sanitizationScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Input Sanitization Security Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sanitize-test-'));
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

  describe('SANITIZE-001: Unsanitized User Input in Database Operations', () => {
    it('should detect req.body in insert operation', async () => {
      const file = await createTestFile(
        'db-insert.ts',
        `
// VIOLATION SANITIZE-001: Direct req.body in insert
app.post('/users', async (req, res) => {
  await db.insert('users').values(req.body);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-001');
      expect(sanitizeFindings.length).toBeGreaterThan(0);
      expect(sanitizeFindings[0].severity).toBe('critical');
    });

    it('should detect req.params in query operation', async () => {
      const file = await createTestFile(
        'db-query.ts',
        `
// VIOLATION SANITIZE-001: Direct req.params in query
app.get('/users/:id', async (req, res) => {
  const user = await db.query('SELECT * FROM users WHERE id = ' + req.params.id);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-001')).toBe(true);
    });

    it('should detect req.query in where clause', async () => {
      const file = await createTestFile(
        'db-where.ts',
        `
// VIOLATION SANITIZE-001: Direct req.query in where
app.get('/search', async (req, res) => {
  const results = await db.select().from('users').where('name', req.query.name);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-001')).toBe(true);
    });

    it('should detect req.body in update operation', async () => {
      const file = await createTestFile(
        'db-update.ts',
        `
// VIOLATION SANITIZE-001: Direct req.body in update
app.put('/users/:id', async (req, res) => {
  await db.update('users').set(req.body).where({ id: req.params.id });
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-001');
      expect(sanitizeFindings.length).toBeGreaterThan(0);
    });

    it('should detect req.body in Prisma create', async () => {
      const file = await createTestFile(
        'prisma-create.ts',
        `
// VIOLATION SANITIZE-001: Direct req.body in Prisma
app.post('/users', async (req, res) => {
  const user = await prisma.user.create({ data: req.body });
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-001')).toBe(true);
    });

    it('should detect req.body in Mongoose create', async () => {
      const file = await createTestFile(
        'mongoose-create.ts',
        `
// VIOLATION SANITIZE-001: Direct req.body in Mongoose
app.post('/users', async (req, res) => {
  await User.create(req.body);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-001')).toBe(true);
    });

    it('should detect SQL template literals with req.query', async () => {
      const file = await createTestFile(
        'sql-template.ts',
        `
// VIOLATION SANITIZE-001: SQL injection via template literal
app.get('/users', async (req, res) => {
  const results = await db.query(\`SELECT * FROM users WHERE email = '\${req.query.email}'\`);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-001')).toBe(true);
    });

    it('should detect raw SQL concatenation', async () => {
      const file = await createTestFile(
        'sql-concat.ts',
        `
// VIOLATION SANITIZE-001: SQL injection via concatenation
app.get('/search', async (req, res) => {
  const sql = 'SELECT * FROM products WHERE name = ' + req.query.name;
  await db.execute(sql);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-001')).toBe(true);
    });

    it('should NOT flag when Zod validation is used', async () => {
      const file = await createTestFile(
        'zod-validation.ts',
        `
// SECURE: Zod validation before DB operation
import { z } from 'zod';

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

app.post('/users', async (req, res) => {
  const validated = userSchema.parse(req.body);
  await db.insert('users').values(validated);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-001');
      expect(sanitizeFindings.length).toBe(0);
    });

    it('should NOT flag when Joi validation is used', async () => {
      const file = await createTestFile(
        'joi-validation.ts',
        `
// SECURE: Joi validation
const Joi = require('joi');
const schema = Joi.object({ name: Joi.string() });

app.post('/users', async (req, res) => {
  const { value } = schema.validate(req.body);
  await db.insert('users').values(value);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-001');
      expect(sanitizeFindings.length).toBe(0);
    });

    it('should NOT flag when Yup validation is used', async () => {
      const file = await createTestFile(
        'yup-validation.ts',
        `
// SECURE: Yup validation
import * as yup from 'yup';

const schema = yup.object({ email: yup.string().email() });

app.post('/users', async (req, res) => {
  const validated = await schema.validate(req.body);
  await db.insert('users').values(validated);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-001');
      expect(sanitizeFindings.length).toBe(0);
    });

    it('should NOT flag when custom validation function is used', async () => {
      const file = await createTestFile(
        'custom-validation.ts',
        `
// SECURE: Custom validation
app.post('/users', async (req, res) => {
  const sanitized = sanitizeUserInput(req.body);
  await db.insert('users').values(sanitized);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-001');
      expect(sanitizeFindings.length).toBe(0);
    });

    it('should NOT flag when safeParse is used', async () => {
      const file = await createTestFile(
        'safe-parse.ts',
        `
// SECURE: safeParse validation
const result = schema.safeParse(req.body);
if (result.success) {
  await db.insert('users').values(result.data);
}
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-001');
      expect(sanitizeFindings.length).toBe(0);
    });
  });

  describe('SANITIZE-002: Insecure File Upload Configuration', () => {
    it('should detect multer without fileFilter', async () => {
      const file = await createTestFile(
        'multer-basic.ts',
        `
// VIOLATION SANITIZE-002: Multer without validation
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('file'), (req, res) => {
  res.send('File uploaded');
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-002');
      expect(sanitizeFindings.length).toBeGreaterThan(0);
      expect(sanitizeFindings[0].severity).toBe('high');
    });

    it('should detect multer without limits', async () => {
      const file = await createTestFile(
        'multer-no-limits.ts',
        `
// VIOLATION SANITIZE-002: Multer without file size limits
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, file.originalname)
  })
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-002')).toBe(true);
    });

    it('should detect formidable without validation', async () => {
      const file = await createTestFile(
        'formidable-basic.ts',
        `
// VIOLATION SANITIZE-002: Formidable without validation
app.post('/upload', (req, res) => {
  const form = new formidable.IncomingForm({ uploadDir: './uploads' });
  form.parse(req);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-002')).toBe(true);
    });

    it('should detect Busboy without limits', async () => {
      const file = await createTestFile(
        'busboy-basic.ts',
        `
// VIOLATION SANITIZE-002: Busboy without limits
const busboy = new Busboy({ headers: req.headers });
busboy.on('file', (fieldname, file, filename) => {
  file.pipe(fs.createWriteStream('./uploads/' + filename));
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-002')).toBe(true);
    });

    it('should NOT flag multer with fileFilter', async () => {
      const file = await createTestFile(
        'multer-secure.ts',
        `
// SECURE: Multer with fileFilter and limits
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-002');
      expect(sanitizeFindings.length).toBe(0);
    });

    it('should NOT flag multer with mimetype validation', async () => {
      const file = await createTestFile(
        'multer-mimetype.ts',
        `
// SECURE: Multer with mimetype validation
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Invalid file type'));
      }
      cb(null, file.originalname);
    }
  })
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-002');
      expect(sanitizeFindings.length).toBe(0);
    });

    it('should NOT flag formidable with file validation', async () => {
      const file = await createTestFile(
        'formidable-secure.ts',
        `
// SECURE: Formidable with validation
const form = new formidable.IncomingForm({
  uploadDir: './uploads',
  maxFileSize: 10 * 1024 * 1024,
  filter: function ({ name, originalFilename, mimetype }) {
    return mimetype && mimetype.includes('image');
  }
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-002');
      expect(sanitizeFindings.length).toBe(0);
    });

    it('should NOT flag Busboy with limits and validation', async () => {
      const file = await createTestFile(
        'busboy-secure.ts',
        `
// SECURE: Busboy with limits
const busboy = new Busboy({
  headers: req.headers,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
  if (!mimetype.startsWith('image/')) {
    file.resume();
    return;
  }
  file.pipe(fs.createWriteStream('./uploads/' + filename));
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      const sanitizeFindings = findings.filter((f) => f.id === 'SANITIZE-002');
      expect(sanitizeFindings.length).toBe(0);
    });
  });

  describe('Combined violations', () => {
    it('should detect both SANITIZE-001 and SANITIZE-002 in same file', async () => {
      const file = await createTestFile(
        'combined.ts',
        `
const upload = multer({ dest: 'uploads/' });

app.post('/upload-profile', upload.single('avatar'), async (req, res) => {
  await db.insert('users').values(req.body);
});
`
      );

      const findings = await sanitizationScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'SANITIZE-001')).toBe(true);
      expect(findings.some((f) => f.id === 'SANITIZE-002')).toBe(true);
    });
  });

  it('should provide correct HIPAA references', async () => {
    const file = await createTestFile(
      'hipaa-refs.ts',
      `
app.post('/test', async (req, res) => {
  await db.insert('users').values(req.body);
  const upload = multer({ dest: 'uploads/' });
});
`
    );

    const findings = await sanitizationScanner.scan([file], scanOptions);
    const sanitize001 = findings.find((f) => f.id === 'SANITIZE-001');
    const sanitize002 = findings.find((f) => f.id === 'SANITIZE-002');

    expect(sanitize001?.hipaaReference).toContain('NPRM Anti-malware');
    expect(sanitize002?.hipaaReference).toContain('NPRM Anti-malware');
  });

  it('should have correct severity levels', async () => {
    const file = await createTestFile(
      'severity.ts',
      `
app.post('/test', async (req, res) => {
  await db.query(req.body);
});
const upload = multer({});
`
    );

    const findings = await sanitizationScanner.scan([file], scanOptions);
    const sanitize001 = findings.find((f) => f.id === 'SANITIZE-001');
    const sanitize002 = findings.find((f) => f.id === 'SANITIZE-002');

    expect(sanitize001?.severity).toBe('critical');
    expect(sanitize002?.severity).toBe('high');
  });
});
