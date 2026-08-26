/**
 * ANTI-ROT GATE for canonical rule identity.
 *
 * `FindingEvaluation.ruleId` must be FACTUAL, never derived by stripping
 * affixes off the display `Finding.id`. That guarantee holds only while every
 * scanner declares `canonicalRuleId` at its emission points, so this test runs
 * the real scanners against fixtures engineered to trigger them and asserts
 * total coverage. A new scanner that forgets the field fails here.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname, resolve } from 'path';
import { scan } from '../../src/scan.js';
import { RULE_CATALOG } from '../../src/rules/catalog.js';
import type { Finding } from '../../src/types.js';

const CATALOG_IDS = new Set(RULE_CATALOG.map((r) => r.id));

const dir = mkdtempSync(join(tmpdir(), 'vlayer-ruleid-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function write(relative: string, content: string) {
  const target = resolve(dir, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf-8');
}

// A fixture engineered to light up as many scanner families as possible.
write('package.json', JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: { express: '^4.0.0' } }, null, 2));
write('src/phi.ts', [
  `const ssn = "123-45-6789";`,
  `console.log('patient ssn', patient.ssn);`,
  `localStorage.setItem('mrn', record.medicalRecordNumber);`,
  `const dob = "1980-01-01";`,
].join('\n') + '\n');
write('src/crypto.ts', [
  `import crypto from 'crypto';`,
  `const h = crypto.createHash('md5').update(x).digest('hex');`,
  `const d = createCipher('des', key);`,
  `const endpoint = "http://api.patients.example.net/records";`,
].join('\n') + '\n');
write('src/access.ts', [
  `app.use(cors({ origin: '*' }));`,
  `const rows = await db.query('SELECT * FROM patients');`,
  `if (user.role === 'admin') { allow(); }`,
  `const password = "hunter2supersecret";`,
  `const apiKey = "sk_live_51H8xKzABCDEFGHIJKLMNOP";`,
].join('\n') + '\n');
write('src/errors.ts', [
  `try { doWork(); } catch (error) { console.error('failed for patient', patient.ssn, error); }`,
  `throw new Error('patient ' + patient.diagnosis + ' failed');`,
].join('\n') + '\n');
write('src/data.ts', [
  `await db.delete({ where: { id } });`,
  `await prisma.patient.deleteMany({});`,
  `element.innerHTML = req.body.note;`,
].join('\n') + '\n');

describe('canonical rule identity coverage', () => {
  let findings: Finding[];

  it('scans the fixture and produces findings', async () => {
    const result = await scan({ path: dir, enableAI: false });
    findings = result.findings;
    expect(findings.length).toBeGreaterThan(5);
  }, 60_000);

  it('EVERY emitted finding declares a canonicalRuleId', () => {
    const missing = findings.filter((f) => !f.canonicalRuleId);
    const detail = [...new Set(missing.map((f) => `${f.id} (${f.file})`))].slice(0, 20);
    expect(
      missing.length,
      `findings without canonicalRuleId:\n${detail.join('\n')}`,
    ).toBe(0);
  });

  it('every non-custom canonicalRuleId resolves in RULE_CATALOG', () => {
    const unresolved = [
      ...new Set(
        findings
          .map((f) => f.canonicalRuleId!)
          .filter((id) => id && !id.startsWith('custom:') && !CATALOG_IDS.has(id)),
      ),
    ];
    expect(unresolved, `unresolved canonical ids: ${unresolved.join(', ')}`).toEqual([]);
  });

  it('the emitted-id to canonical-id relation is many-to-one (never ambiguous)', () => {
    const byEmitted = new Map<string, Set<string>>();
    for (const f of findings) {
      if (!byEmitted.has(f.id)) byEmitted.set(f.id, new Set());
      byEmitted.get(f.id)!.add(f.canonicalRuleId ?? '<none>');
    }
    const ambiguous = [...byEmitted.entries()].filter(([, ids]) => ids.size > 1);
    expect(ambiguous.map(([id]) => id)).toEqual([]);
  });

  it('canonical ids differ from display ids where the scanner interpolates a line number', () => {
    // Proves the field is load-bearing rather than a duplicate of `id`.
    const interpolated = findings.filter((f) => f.canonicalRuleId && f.id !== f.canonicalRuleId);
    expect(interpolated.length).toBeGreaterThan(0);
    for (const f of interpolated) {
      expect(CATALOG_IDS.has(f.canonicalRuleId!) || f.canonicalRuleId!.startsWith('custom:')).toBe(true);
    }
  });

  it('custom rules use the reserved custom: namespace that cannot collide with built-ins', () => {
    // `:` is outside the built-in id charset (/^[a-z0-9-]+$/ per rules/schema.ts).
    for (const id of CATALOG_IDS) expect(id).not.toContain(':');
  });
});
