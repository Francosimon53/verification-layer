import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { isImportLine } from '../../src/scanners/utils.js';
import { authenticationScanner } from '../../src/scanners/authentication/index.js';
import { operationalScanner } from '../../src/scanners/operational/index.js';
import { hipaa2026Scanner } from '../../src/scanners/hipaa2026/index.js';
import type { Finding } from '../../src/types.js';

const dirs: string[] = [];
async function writeTemp(name: string, content: string): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'vlayer-guards-'));
  dirs.push(d);
  const file = join(d, name);
  await writeFile(file, content, 'utf-8');
  return file;
}
afterAll(async () => {
  await Promise.all(dirs.map(d => rm(d, { recursive: true, force: true })));
});

const opts = { path: '/tmp' } as any;
const byId = (findings: Finding[], id: string) => findings.filter(f => f.id === id);

describe('isImportLine', () => {
  it('detects import / require / re-export lines', () => {
    expect(isImportLine("import { createClient } from '@supabase/supabase-js'")).toBe(true);
    expect(isImportLine('import foo from "bar"')).toBe(true);
    expect(isImportLine("import 'side-effect'")).toBe(true);
    expect(isImportLine("} from './module'")).toBe(true);
    expect(isImportLine("export { a } from './m'")).toBe(true);
    expect(isImportLine("const db = require('pg')")).toBe(true);
  });
  it('does not flag real usage lines', () => {
    expect(isImportLine('const supabase = createClient(URL, KEY)')).toBe(false);
    expect(isImportLine('  console.log(patient.ssn)')).toBe(false);
    expect(isImportLine('database.query({ table: "patients" })')).toBe(false);
  });
});

describe('MFA-001 import guard', () => {
  it('does NOT fire when the only supabase reference is an import', async () => {
    const file = await writeTemp('auth.ts', `import { createClient } from '@supabase/supabase-js';\nexport const noop = 1;\n`);
    const findings = await authenticationScanner.scan([file], opts);
    expect(byId(findings, 'MFA-001')).toHaveLength(0);
  });

  it('still fires on real auth usage, anchored to the usage line (not the import)', async () => {
    const file = await writeTemp(
      'auth.ts',
      `import { createClient } from '@supabase/supabase-js';\nconst supabase = createClient(SUPABASE_URL, SUPABASE_KEY);\n`
    );
    const findings = await authenticationScanner.scan([file], opts);
    const mfa = byId(findings, 'MFA-001');
    expect(mfa).toHaveLength(1);
    expect(mfa[0].line).toBe(2); // the createClient() usage, not the import on line 1
  });
});

describe('BACKUP-001 import guard', () => {
  it('anchors to real DB usage, NOT the import line, when usage is present', async () => {
    const file = await writeTemp(
      'db.ts',
      `import { createClient } from '@supabase/supabase-js';\nconst supabase = createClient(SUPABASE_URL, SUPABASE_KEY);\n`
    );
    const findings = await operationalScanner.scan([file], opts);
    const backup = byId(findings, 'BACKUP-001');
    expect(backup).toHaveLength(1);
    expect(backup[0].line).toBe(2); // the createClient() usage, not the import on line 1
  });

  // Deliberate tradeoff (documented in the PR): some DB libraries (drizzle, knex)
  // are only detectable via their import. Rather than lose detection, BACKUP-001
  // falls back to the import line as the advisory anchor when no usage line exists.
  it('falls back to the import anchor for import-only DB libraries (preserves detection)', async () => {
    const file = await writeTemp('db.ts', `import { drizzle } from 'drizzle-orm';\n`);
    const findings = await operationalScanner.scan([file], opts);
    expect(byId(findings, 'BACKUP-001')).toHaveLength(1);
  });
});

describe('HIPAA-SEGMENT-001 scoped to its real (server/infra) intent', () => {
  it('does NOT fire on client-side localStorage of PHI', async () => {
    const file = await writeTemp('page.tsx', `localStorage.setItem("patientCache", JSON.stringify(data));\n`);
    const findings = await hipaa2026Scanner.scan([file], opts);
    expect(byId(findings, 'HIPAA-SEGMENT-001')).toHaveLength(0);
  });

  it('does NOT fire on a client fetch() consuming a PHI API', async () => {
    const file = await writeTemp('page.tsx', `fetch("http://api.local/api/patients").then(r => r.json());\n`);
    const findings = await hipaa2026Scanner.scan([file], opts);
    expect(byId(findings, 'HIPAA-SEGMENT-001')).toHaveLength(0);
  });

  it('still fires on a backend database/storage service handling PHI', async () => {
    const file = await writeTemp('server.ts', `const rows = await database.query({ table: "patients" });\n`);
    const findings = await hipaa2026Scanner.scan([file], opts);
    expect(byId(findings, 'HIPAA-SEGMENT-001').length).toBeGreaterThanOrEqual(1);
  });

  it('still fires on a server route exposing PHI with a CORS wildcard', async () => {
    const file = await writeTemp(
      'route.ts',
      `app.use(cors({ origin: '*' }));\napp.get('/api/patients', (req, res) => res.json(getPatients()));\n`
    );
    const findings = await hipaa2026Scanner.scan([file], opts);
    expect(byId(findings, 'HIPAA-SEGMENT-001').length).toBeGreaterThanOrEqual(1);
  });
});
