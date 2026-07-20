import { describe, it, expect, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { analyzeSemanticContext } from '../src/semantic-analysis.js';

const TEST_DIR = '/tmp/vlayer-semantic-tests';

async function createTestFile(name: string, content: string): Promise<string> {
  await mkdir(TEST_DIR, { recursive: true });
  const filePath = join(TEST_DIR, name);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('Semantic Analysis', () => {
  describe('String Literals', () => {
    it('should detect patterns in string literals as low confidence', async () => {
      const file = await createTestFile('string-test.ts', `
const ssn = "123-45-6789";
console.log(ssn);
      `);

      const context = await analyzeSemanticContext(file, 2);
      expect(context.confidence).toBe('low');
      expect(context.context).toBe('string');
    });

    it('should detect patterns in template literals as medium confidence', async () => {
      const file = await createTestFile('template-test.ts', `
const ssn = \`123-45-6789\`;
console.log(ssn);
      `);

      const context = await analyzeSemanticContext(file, 2);
      expect(context.confidence).toBe('medium');
      expect(context.context).toBe('template');
    });
  });

  describe('Comments', () => {
    it('should detect patterns in single-line comments as low confidence', async () => {
      const file = await createTestFile('comment-test.ts', `
// SSN: 123-45-6789
const data = getData();
      `);

      const context = await analyzeSemanticContext(file, 2);
      expect(context.confidence).toBe('low');
      expect(context.context).toBe('comment');
    });

    it('should detect patterns in multi-line comments as low confidence', async () => {
      const file = await createTestFile('multiline-comment-test.ts', `
/*
 * SSN: 123-45-6789
 * Example data
 */
const data = getData();
      `);

      const context = await analyzeSemanticContext(file, 3);
      expect(context.confidence).toBe('low');
      expect(context.context).toBe('comment');
    });
  });

  describe('Executable Code', () => {
    it('should detect patterns in executable code as high confidence', async () => {
      const file = await createTestFile('code-test.ts', `
function validateSSN(ssn: string) {
  const pattern = /\\d{3}-\\d{2}-\\d{4}/;
  return pattern.test(ssn);
}
      `);

      const context = await analyzeSemanticContext(file, 3);
      expect(context.confidence).toBe('high');
      expect(context.context).toBe('code');
    });

    it('should detect variable assignments as high confidence', async () => {
      const file = await createTestFile('assignment-test.ts', `
import crypto from 'crypto';
const algorithm = md5;
const weakCrypto = crypto.createHash(algorithm);
      `);

      const context = await analyzeSemanticContext(file, 3);
      expect(context.confidence).toBe('high');
      expect(context.context).toBe('code');
    });
  });

  describe('Test Files', () => {
    it('should detect test files and lower confidence', async () => {
      const file = await createTestFile('example.test.ts', `
const testSSN = "123-45-6789";
      `);

      const context = await analyzeSemanticContext(file, 2);
      expect(context.inTestFile).toBe(true);
      // Even though it's a string (low), being in a test file keeps it low
      expect(context.confidence).toBe('low');
    });

    it('should detect spec files as test files', async () => {
      const file = await createTestFile('example.spec.ts', `
const config = { key: "value" };
      `);

      const context = await analyzeSemanticContext(file, 2);
      expect(context.inTestFile).toBe(true);
    });

    it('should detect __tests__ directory as test files', async () => {
      await mkdir(join(TEST_DIR, '__tests__'), { recursive: true });
      const file = join(TEST_DIR, '__tests__', 'example.ts');
      await writeFile(file, 'const test = true;', 'utf-8');

      const context = await analyzeSemanticContext(file, 1);
      expect(context.inTestFile).toBe(true);
    });
  });

  describe('JSX/TSX', () => {
    it('should analyze JSX files correctly', async () => {
      const file = await createTestFile('component.tsx', `
export function Component() {
  return <div>SSN: 123-45-6789</div>;
}
      `);

      const context = await analyzeSemanticContext(file, 3);
      // JSX text should be detected as low confidence
      expect(context.confidence).toBe('low');
    });
  });

  describe('Fallback for non-TS/JS files', () => {
    it('should use medium confidence for non-parseable files', async () => {
      const file = await createTestFile('data.json', `
{
  "ssn": "123-45-6789"
}
      `);

      const context = await analyzeSemanticContext(file, 3);
      expect(context.confidence).toBe('medium');
      expect(context.context).toBe('code');
    });
  });

  // Cleanup
  afterAll(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });
});
