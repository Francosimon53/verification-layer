import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import {
  resolveBranding,
  brandFooterText,
  brandPreparedBy,
  logoDataUri,
  pdfLogoPath,
  escapeHtml,
  DEFAULT_BRAND_NAME,
} from '../../src/reporters/branding.js';

const TEST_DIR = '/tmp/vlayer-branding-tests';
// 1x1 transparent PNG.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true });
  await writeFile(join(TEST_DIR, 'logo.png'), PNG_BYTES);
  await writeFile(join(TEST_DIR, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf-8');
  await writeFile(join(TEST_DIR, 'logo.txt'), 'not an image', 'utf-8');
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('resolveBranding', () => {
  it('returns no branding when nothing is provided', () => {
    const b = resolveBranding(undefined, undefined, TEST_DIR);
    expect(b.name).toBeUndefined();
    expect(b.logoPath).toBeUndefined();
    expect(b.warnings).toEqual([]);
  });

  it('reads name and logo from config', () => {
    const b = resolveBranding(undefined, { name: 'Acme Health', logo: 'logo.png' }, TEST_DIR);
    expect(b.name).toBe('Acme Health');
    expect(b.logoPath).toBe(join(TEST_DIR, 'logo.png'));
    expect(b.logoFormat).toBe('png');
    expect(b.warnings).toEqual([]);
  });

  it('gives CLI flags precedence over config', () => {
    const b = resolveBranding(
      { name: 'CLI Brand', logo: 'logo.png' },
      { name: 'Config Brand', logo: 'logo.svg' },
      TEST_DIR
    );
    expect(b.name).toBe('CLI Brand');
    expect(b.logoFormat).toBe('png');
  });

  it('falls back to config per-field when a CLI flag is absent', () => {
    const b = resolveBranding({ name: 'CLI Brand' }, { name: 'Config', logo: 'logo.png' }, TEST_DIR);
    expect(b.name).toBe('CLI Brand');
    expect(b.logoPath).toBe(join(TEST_DIR, 'logo.png'));
  });

  it('warns and drops the logo when the file does not exist (never throws)', () => {
    const b = resolveBranding({ logo: 'does-not-exist.png' }, undefined, TEST_DIR);
    expect(b.logoPath).toBeUndefined();
    expect(b.warnings).toHaveLength(1);
    expect(b.warnings[0]).toMatch(/not found/i);
  });

  it('warns and drops the logo when the format is unsupported', () => {
    const b = resolveBranding({ logo: 'logo.txt' }, undefined, TEST_DIR);
    expect(b.logoPath).toBeUndefined();
    expect(b.warnings).toHaveLength(1);
    expect(b.warnings[0]).toMatch(/unsupported format/i);
  });

  it('accepts svg logos', () => {
    const b = resolveBranding({ logo: 'logo.svg' }, undefined, TEST_DIR);
    expect(b.logoFormat).toBe('svg');
    expect(b.warnings).toEqual([]);
  });

  it('trims whitespace and ignores empty names', () => {
    expect(resolveBranding({ name: '  Spaced  ' }, undefined, TEST_DIR).name).toBe('Spaced');
    expect(resolveBranding({ name: '   ' }, undefined, TEST_DIR).name).toBeUndefined();
  });
});

describe('footer / prepared-by text', () => {
  it('includes the brand name when present', () => {
    expect(brandFooterText({ name: 'Acme', warnings: [] })).toBe('Prepared by Acme · Powered by VLayer');
    expect(brandPreparedBy({ name: 'Acme', warnings: [] })).toBe('Acme');
  });

  it('falls back to default VLayer text without branding', () => {
    expect(brandFooterText(undefined)).toBe('Powered by VLayer');
    expect(brandPreparedBy(undefined)).toBe(DEFAULT_BRAND_NAME);
  });
});

describe('logo loading', () => {
  it('returns a data URI for a png logo', () => {
    const b = resolveBranding({ logo: 'logo.png' }, undefined, TEST_DIR);
    const uri = logoDataUri(b);
    expect(uri).toMatch(/^data:image\/png;base64,/);
  });

  it('returns null data URI when no logo', () => {
    expect(logoDataUri(undefined)).toBeNull();
  });

  it('exposes png logos to pdf but not svg', () => {
    const png = resolveBranding({ logo: 'logo.png' }, undefined, TEST_DIR);
    const svg = resolveBranding({ logo: 'logo.svg' }, undefined, TEST_DIR);
    expect(pdfLogoPath(png)).toBe(join(TEST_DIR, 'logo.png'));
    expect(pdfLogoPath(svg)).toBeNull();
  });
});

describe('escapeHtml', () => {
  it('escapes injection-relevant characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml("O'Brien & Co")).toBe('O&#039;Brien &amp; Co');
  });
});
