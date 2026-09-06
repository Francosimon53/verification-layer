import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { securityScanner } from './index.js';

const TEST_DIR = join(process.cwd(), '.tmp-security-sanitizer-regression');

async function scan(name: string, content: string) {
  const file = join(TEST_DIR, name);
  await writeFile(file, content, 'utf-8');
  return securityScanner.scan([file], { path: TEST_DIR });
}

describe('dangerouslySetInnerHTML sanitizer regression', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('still flags raw content passed to dangerouslySetInnerHTML', async () => {
    const findings = await scan(
      'raw.tsx',
      `export function Post({ content }: { content: string }) {
        return <div dangerouslySetInnerHTML={{ __html: content }} />;
      }`,
    );

    expect(findings.some((finding) => finding.id.includes('dangerous-innerhtml-react'))).toBe(true);
  });

  it('does not flag DOMPurify.sanitize passed directly to __html', async () => {
    const findings = await scan(
      'dompurify.tsx',
      `import DOMPurify from 'isomorphic-dompurify';
      export function Post({ content }: { content: string }) {
        return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />;
      }`,
    );

    expect(findings.some((finding) => finding.id.includes('dangerous-innerhtml-react'))).toBe(false);
  });

  it('does not flag sanitizeHtml passed directly to __html', async () => {
    const findings = await scan(
      'sanitize-html.tsx',
      `import sanitizeHtml from 'sanitize-html';
      export function Post({ content }: { content: string }) {
        return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />;
      }`,
    );

    expect(findings.some((finding) => finding.id.includes('dangerous-innerhtml-react'))).toBe(false);
  });
});
