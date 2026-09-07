import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Finding } from '../src/types.js';
import {
  applyBaseline,
  canonicalRuleId,
  createBaselineEntry,
  generateFindingHash,
  loadBaseline,
  saveBaseline,
} from '../src/baseline.js';

function finding(file: string, line = 20, id = 'enc-des-19', code = 'const cipher = DES.encrypt(value)'): Finding {
  return {
    id,
    category: 'encryption',
    severity: 'critical',
    title: 'Weak cryptography: DES encryption',
    description: 'DES is weak',
    file,
    line,
    recommendation: 'Use AES-256-GCM',
    context: [
      { lineNumber: line, content: code, isMatch: true },
    ],
  };
}

describe('baseline v2 fingerprints', () => {
  it('canonicalizes scanner-generated line suffixes without changing catalog IDs', () => {
    expect(canonicalRuleId('enc-des-81')).toBe('enc-des');
    expect(canonicalRuleId('audit-unlogged-read-42')).toBe('audit-unlogged-read');
    expect(canonicalRuleId('CRED-001')).toBe('CRED-001');
    expect(canonicalRuleId('HIPAA-2026-001')).toBe('HIPAA-2026-001');
  });

  it('is stable across checkout roots, line shifts, dynamic IDs, and whitespace-only edits', () => {
    const local = finding('/Users/dev/project/src/crypto.ts', 20, 'enc-des-19', 'const cipher = DES.encrypt(value)');
    const ci = finding('/home/runner/work/project/src/crypto.ts', 88, 'enc-des-87', '  const   cipher = DES.encrypt(value)  ');

    expect(generateFindingHash(local, '/Users/dev/project'))
      .toBe(generateFindingHash(ci, '/home/runner/work/project'));
  });

  it('changes when the matched semantic anchor changes', () => {
    const first = finding('/repo/src/crypto.ts', 20, 'enc-des-19', 'DES.encrypt(patientId)');
    const second = finding('/repo/src/crypto.ts', 21, 'enc-des-20', 'DES.encrypt(accountId)');

    expect(generateFindingHash(first, '/repo')).not.toBe(generateFindingHash(second, '/repo'));
  });

  it('stores relative paths and v2 metadata', () => {
    const entry = createBaselineEntry(
      finding('/workspace/project/src/crypto.ts'),
      '/workspace/project',
    );

    expect(entry.file).toBe('src/crypto.ts');
    expect(entry.ruleId).toBe('enc-des');
    expect(entry.fingerprint).toBe(entry.hash);
    expect(entry.hash).toHaveLength(16);
  });

  it('matches a committed baseline from a different machine without an explicit root', () => {
    const baseline = {
      version: '2.0',
      createdAt: new Date().toISOString(),
      findings: [createBaselineEntry(
        finding('/Users/dev/project/src/crypto.ts', 20, 'enc-des-19'),
        '/Users/dev/project',
      )],
    };

    const current = finding('/home/runner/work/project/src/crypto.ts', 99, 'enc-des-98');
    const [applied] = applyBaseline([current], baseline);

    expect(applied.isBaseline).toBe(true);
  });

  it('does not match the same rule in a different relative file', () => {
    const baseline = {
      version: '2.0',
      createdAt: new Date().toISOString(),
      findings: [createBaselineEntry(
        finding('/repo/src/a/crypto.ts'),
        '/repo',
      )],
    };

    const current = finding('/ci/repo/src/b/crypto.ts');
    const [applied] = applyBaseline([current], baseline, '/ci/repo');

    expect(applied.isBaseline).toBeUndefined();
  });

  it('writes and reloads a portable baseline file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vlayer-baseline-'));
    const output = join(dir, 'baseline.json');
    const project = join(dir, 'checkout');
    const source = join(project, 'src', 'crypto.ts');

    await saveBaseline(output, [finding(source)], project);

    const raw = JSON.parse(await readFile(output, 'utf-8')) as {
      version: string;
      findings: Array<{ file: string }>;
    };
    expect(raw.version).toBe('2.0');
    expect(raw.findings[0].file).toBe('src/crypto.ts');
    expect(raw.findings[0].file.startsWith('/')).toBe(false);

    const loaded = await loadBaseline(output);
    expect(loaded?.version).toBe('2.0');
  });

  it('keeps exact v1 hashes readable', () => {
    const current = finding('/repo/src/crypto.ts', 20, 'enc-des-19');
    // Old v1 key: file:line:id:title
    const { createHash } = require('crypto') as typeof import('crypto');
    const legacy = createHash('sha256')
      .update(`${current.file}:${current.line || 0}:${current.id}:${current.title}`)
      .digest('hex')
      .substring(0, 16);

    const [applied] = applyBaseline([current], {
      version: '1.0',
      createdAt: new Date().toISOString(),
      findings: [{
        hash: legacy,
        id: current.id,
        file: current.file,
        line: current.line,
        title: current.title,
        severity: current.severity,
        category: current.category,
      }],
    });

    expect(applied.isBaseline).toBe(true);
  });
});
