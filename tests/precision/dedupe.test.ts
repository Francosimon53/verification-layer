import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { dedupeFindings, scan } from '../../src/scan.js';
import type { Finding } from '../../src/types.js';

// Keep the integration scan deterministic + offline (no AI triage network calls).
beforeAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.VLAYER_AI_KEY;
});

const dirs: string[] = [];
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'vlayer-dedupe-'));
  dirs.push(d);
  return d;
}
afterAll(async () => {
  await Promise.all(dirs.map(d => rm(d, { recursive: true, force: true })));
});

function finding(over: Partial<Finding>): Finding {
  return {
    id: 'ERROR-002',
    category: 'audit-logging',
    severity: 'critical',
    title: 'PHI Data in Error Logs or Thrown Errors',
    description: 'x',
    file: 'src/a.ts',
    line: 10,
    recommendation: 'x',
    ...over,
  };
}

describe('dedupeFindings (unit)', () => {
  it('collapses two findings with identical id+file+line+snippet', () => {
    const a = finding({});
    const b = finding({});
    const out = dedupeFindings([a, b]);
    expect(out).toHaveLength(1);
  });

  it('keeps findings that differ by line', () => {
    expect(dedupeFindings([finding({ line: 10 }), finding({ line: 11 })])).toHaveLength(2);
  });

  it('keeps findings that differ by rule id', () => {
    expect(dedupeFindings([finding({ id: 'ERROR-002' }), finding({ id: 'ERROR-001' })])).toHaveLength(2);
  });

  it('keeps findings that differ by file', () => {
    expect(dedupeFindings([finding({ file: 'a.ts' }), finding({ file: 'b.ts' })])).toHaveLength(2);
  });

  it('preserves order, keeping the first occurrence', () => {
    const first = finding({ description: 'first' });
    const second = finding({ description: 'second' });
    const out = dedupeFindings([first, second]);
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe('first');
  });

  it('does not merge when normalized snippet differs', () => {
    const a = finding({ context: [{ lineNumber: 10, content: 'console.error(patient.ssn)', isMatch: true }] });
    const b = finding({ context: [{ lineNumber: 10, content: 'console.error(patient.dob)', isMatch: true }] });
    expect(dedupeFindings([a, b])).toHaveLength(2);
  });
});

describe('dedupe in the scan pipeline (integration)', () => {
  // errorsScanner is registered under BOTH phi-exposure and audit-logging, so it
  // historically emitted each ERROR-00x finding twice on the same line. The
  // dedupe pass must collapse those before any report is built.
  it('produces no exact-duplicate findings even when a scanner runs twice', async () => {
    const dir = await tempDir();
    await writeFile(
      join(dir, 'route.ts'),
      [
        'export function handler(patient: any, err: any) {',
        '  console.error(`Accessed patient ${patient.name}, SSN: ${patient.ssn}`);',
        '  throw new Error(`Failed for patient ${patient.name}`);',
        '}',
        '',
      ].join('\n'),
      'utf-8'
    );

    const result = await scan({ path: dir });

    const keys = result.findings.map(f => `${f.id}|${f.file}|${f.line}`);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size); // zero exact duplicates

    // Sanity: the PHI-in-error finding is still present (we didn't over-dedupe).
    expect(result.findings.some(f => f.id === 'ERROR-002')).toBe(true);
  });
});
