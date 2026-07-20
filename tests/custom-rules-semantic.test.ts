import { describe, it, expect, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { scan } from '../src/scan.js';

const TEST_DIR = '/tmp/vlayer-custom-rules-semantic';

async function createTestFile(name: string, content: string): Promise<string> {
  await mkdir(TEST_DIR, { recursive: true });
  const filePath = join(TEST_DIR, name);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('Custom Rules with Semantic Awareness', () => {
  describe('Confidence levels in custom rules', () => {
    it('should respect explicit confidence from custom rule', async () => {
      const rulesFile = await createTestFile('rules.yaml', `
version: "1.0"
rules:
  - id: test-high-confidence
    name: Test high confidence
    description: Test rule with high confidence
    category: encryption
    severity: high
    pattern: "secretKey"
    recommendation: Test recommendation
    confidence: high
    adjustConfidenceByContext: false
      `);

      const configFile = await createTestFile('.vlayerrc.json', `{
  "customRulesPath": "${rulesFile}"
}`);

      const testFile = await createTestFile('test.ts', `
const secretKey = "abc123";  // In a string
      `);

      const result = await scan({
        path: TEST_DIR,
        configFile: configFile,
      });

      const finding = result.findings.find(f => f.id.includes('test-high-confidence'));
      expect(finding).toBeDefined();
      // Should keep high confidence even though it's in a string
      // because adjustConfidenceByContext is false
      expect(finding?.confidence).toBe('high');
    });

    it('should allow semantic analysis to adjust confidence when enabled', async () => {
      const rulesFile = await createTestFile('rules2.yaml', `
version: "1.0"
rules:
  - id: test-adjustable-confidence
    name: Test adjustable confidence
    description: Test rule with adjustable confidence
    category: encryption
    severity: high
    pattern: "password"
    recommendation: Test recommendation
    confidence: high
    adjustConfidenceByContext: true
      `);

      const configFile = await createTestFile('.vlayerrc2.json', `{
  "customRulesPath": "${rulesFile}"
}`);

      const testFile = await createTestFile('test2.ts', `
const password = "test123";  // String literal
      `);

      const result = await scan({
        path: TEST_DIR,
        configFile: configFile,
      });

      const finding = result.findings.find(f => f.id.includes('test-adjustable-confidence'));
      expect(finding).toBeDefined();
      // Should be low confidence because it's in a string
      expect(finding?.confidence).toBe('low');
    });

    it('should use default confidence from rule if specified', async () => {
      const rulesFile = await createTestFile('rules3.yaml', `
version: "1.0"
rules:
  - id: test-medium-confidence
    name: Test medium confidence
    description: Test rule with medium confidence
    category: encryption
    severity: medium
    pattern: "apiKey"
    recommendation: Test recommendation
    confidence: medium
      `);

      const configFile = await createTestFile('.vlayerrc3.json', `{
  "customRulesPath": "${rulesFile}"
}`);

      const testFile = await createTestFile('test3.ts', `
// apiKey should be in env
const config = getConfig();
      `);

      const result = await scan({
        path: TEST_DIR,
        configFile: configFile,
      });

      const finding = result.findings.find(f => f.id.includes('test-medium-confidence'));
      expect(finding).toBeDefined();
      // Should be low because it's in a comment, semantic analysis adjusts it
      expect(finding?.confidence).toBe('low');
    });
  });

  describe('Default behavior without semantic awareness fields', () => {
    it('should work with legacy rules without semantic fields', async () => {
      const rulesFile = await createTestFile('rules-legacy.yaml', `
version: "1.0"
rules:
  - id: legacy-rule
    name: Legacy rule
    description: Rule without semantic awareness
    category: encryption
    severity: high
    pattern: "oldPattern"
    recommendation: Update this
      `);

      const configFile = await createTestFile('.vlayerrc-legacy.json', `{
  "customRulesPath": "${rulesFile}"
}`);

      const testFile = await createTestFile('legacy.ts', `
const oldPattern = "value";
      `);

      const result = await scan({
        path: TEST_DIR,
        configFile: configFile,
      });

      const finding = result.findings.find(f => f.id.includes('legacy-rule'));
      expect(finding).toBeDefined();
      // Should get confidence from semantic analysis (medium for code without explicit confidence)
      expect(finding?.confidence).toBe('medium');
    });
  });

  describe('Confidence in different contexts', () => {
    it('should assign low confidence to findings in comments', async () => {
      const rulesFile = await createTestFile('rules-comment.yaml', `
version: "1.0"
rules:
  - id: pattern-in-comment
    name: Pattern in comment
    description: Pattern found in comment
    category: phi-exposure
    severity: medium
    pattern: "SSN:\\\\s*\\\\d{3}-\\\\d{2}-\\\\d{4}"
    recommendation: Remove examples from comments
    confidence: medium
    adjustConfidenceByContext: true
      `);

      const configFile = await createTestFile('.vlayerrc-comment.json', `{
  "customRulesPath": "${rulesFile}"
}`);

      const testFile = await createTestFile('comment-test.ts', `
// Example SSN: 123-45-6789
const data = getData();
      `);

      const result = await scan({
        path: TEST_DIR,
        configFile: configFile,
      });

      const finding = result.findings.find(f => f.id.includes('pattern-in-comment'));
      expect(finding).toBeDefined();
      expect(finding?.confidence).toBe('low'); // Comment should be low
    });

    it('should assign high confidence to findings in executable code', async () => {
      const rulesFile = await createTestFile('rules-code.yaml', `
version: "1.0"
rules:
  - id: pattern-in-code
    name: Pattern in code
    description: Pattern found in code
    category: encryption
    severity: high
    pattern: "createHash\\\\("
    recommendation: Use secure hashing
    confidence: high
    adjustConfidenceByContext: true
      `);

      const configFile = await createTestFile('.vlayerrc-code.json', `{
  "customRulesPath": "${rulesFile}"
}`);

      const testFile = await createTestFile('code-test.ts', `
import crypto from 'crypto';
const hash = crypto.createHash('md5');
      `);

      const result = await scan({
        path: TEST_DIR,
        configFile: configFile,
      });

      const finding = result.findings.find(f => f.id.includes('pattern-in-code'));
      expect(finding).toBeDefined();
      expect(finding?.confidence).toBe('high'); // Code should stay high
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
