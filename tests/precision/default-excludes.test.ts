import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { scan } from '../../src/scan.js';

// Keep scans deterministic + offline (no AI triage network calls).
beforeAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.VLAYER_AI_KEY;
});

const dirs: string[] = [];
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'vlayer-excludes-'));
  dirs.push(d);
  return d;
}
afterAll(async () => {
  await Promise.all(dirs.map(d => rm(d, { recursive: true, force: true })));
});

// A realistic prior vlayer report whose *text* would self-flag if re-scanned.
const PRIOR_REPORT = JSON.stringify({
  findings: [
    { ruleId: 'enc-weak', title: 'Weak cryptography: DES encryption' },
    { ruleId: 'phi-ssn-hardcoded', title: 'Potential SSN 123-45-6789 detected' },
    { ruleId: 'CRED-003', title: 'Secrets Exposed via NEXT_PUBLIC_ Prefix' },
  ],
});

describe('default exclusion of vlayer own output artifacts', () => {
  it('does not produce findings from a prior vlayer-report.json', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'vlayer-report.json'), PRIOR_REPORT, 'utf-8');
    await writeFile(join(dir, 'app.ts'), 'export const x = 1;\n', 'utf-8');

    const result = await scan({ path: dir });

    const fromReport = result.findings.filter(f => f.file.endsWith('vlayer-report.json'));
    expect(fromReport).toHaveLength(0);
  });

  it('excludes the samples/ directory and report html/pdf by default', async () => {
    const dir = await tempDir();
    await mkdir(join(dir, 'samples'), { recursive: true });
    await writeFile(join(dir, 'samples', 'sample-report.html'), '<p>DES encryption, SSN 123-45-6789</p>', 'utf-8');
    await writeFile(join(dir, 'vlayer-report.html'), '<p>patient ssn dob diagnosis</p>', 'utf-8');
    await writeFile(join(dir, 'app.ts'), 'export const x = 1;\n', 'utf-8');

    const result = await scan({ path: dir });

    expect(result.findings.some(f => f.file.includes('/samples/'))).toBe(false);
    expect(result.findings.some(f => f.file.endsWith('vlayer-report.html'))).toBe(false);
  });

  it('re-includes artifacts when includeOwnArtifacts is set', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'vlayer-report.json'), PRIOR_REPORT, 'utf-8');

    const result = await scan({ path: dir, includeOwnArtifacts: true });

    // With the opt-out flag, the report file is scanned again (and its text
    // self-flags) — proving the default exclusion is what suppressed it.
    expect(result.findings.some(f => f.file.endsWith('vlayer-report.json'))).toBe(true);
  });
});
