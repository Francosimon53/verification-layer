import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { generateAuditorReport } from '../../src/reporters/auditor-report.js';
import { resolveBranding } from '../../src/reporters/branding.js';
import type { ScanResult } from '../../src/types.js';

const TEST_DIR = '/tmp/vlayer-auditor-report-tests';
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true });
  await writeFile(join(TEST_DIR, 'logo.png'), PNG_BYTES);
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

function makeScanResult(): ScanResult {
  return {
    findings: [
      {
        id: 'phi-1',
        category: 'phi-exposure',
        severity: 'high',
        title: 'PHI written to console',
        description: 'Patient SSN logged',
        file: 'src/patient.ts',
        line: 42,
        recommendation: 'Redact PHI before logging',
        hipaaReference: '164.312(a)(1)',
      },
    ],
    groupedFindings: [],
    rawFindingsCount: 1,
    scannedFiles: 10,
    scanDuration: 123,
    complianceScore: {
      score: 78,
      grade: 'C',
      status: 'fair',
      breakdown: { total: 1, critical: 0, high: 1, medium: 0, low: 0, acknowledged: 0 },
      penalties: { critical: 0, high: 22, medium: 0, low: 0, total: 22 },
      recommendations: ['Fix high-severity findings'],
    },
  };
}

describe('generateAuditorReport branding', () => {
  it('includes brand name, logo and footer when branding is provided', () => {
    const branding = resolveBranding({ name: 'Acme Health', logo: 'logo.png' }, undefined, TEST_DIR);
    const { html } = generateAuditorReport(makeScanResult(), '/repo', { branding });

    expect(html).toContain('Prepared by Acme Health');
    expect(html).toContain('Prepared by Acme Health · Powered by VLayer');
    expect(html).toContain('class="brand-logo"');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('class="brand-page-footer"');
    // Default placeholder is replaced by the brand logo.
    expect(html).not.toContain('<div class="logo-placeholder">VL</div>');
  });

  it('renders default VLayer presentation unchanged when no branding is given', () => {
    const { html } = generateAuditorReport(makeScanResult(), '/repo', {});

    expect(html).toContain('<div class="logo-placeholder">VL</div>');
    expect(html).toContain('VLayer HIPAA Compliance Scanner');
    expect(html).not.toContain('Prepared by');
    expect(html).not.toContain('<div class="brand-page-footer">');
  });

  it('escapes a malicious brand name (no HTML injection)', () => {
    const branding = resolveBranding({ name: '<img src=x onerror=alert(1)>' }, undefined, TEST_DIR);
    const { html } = generateAuditorReport(makeScanResult(), '/repo', { branding });

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('returns a 64-char hex SHA256 hash', () => {
    const { hash } = generateAuditorReport(makeScanResult(), '/repo', {});
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
