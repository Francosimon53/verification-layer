import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildAttestation } from '../../src/attestation/build.js';
import { VlayerStatementV1Schema } from '../../src/attestation/schema.js';
import { createTempRepo, type TempRepo } from './git-fixture.js';

const FIXED = new Date('2026-08-26T12:00:00.000Z');
const clock = { now: () => FIXED };

/** A sentinel that must never appear anywhere in a published attestation. */
const SENTINEL = 'SENTINEL_PHI_TOKEN_7f3a';

let repo: TempRepo;

beforeAll(() => {
  repo = createTempRepo('vlayer-build-');
  repo.write('package.json', JSON.stringify({ name: 'fx', version: '1.0.0' }, null, 2));
  repo.write(
    'src/patients.ts',
    [
      `const marker = "${SENTINEL}";`,
      `console.log('patient ssn', patientRecord.socialSecurityNumber);`,
      `const hash = crypto.createHash('md5').update(marker).digest('hex');`,
      `const endpoint = "http://records.oncology.example.net/api";`,
    ].join('\n') + '\n',
  );
  repo.commit('fixture');
});

afterAll(() => repo.cleanup());

describe('attestation build — shape', () => {
  it('produces a schema-valid in-toto Statement v1', async () => {
    const { statement } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    expect(statement._type).toBe('https://in-toto.io/Statement/v1');
    expect(statement.predicateType).toBe('https://vlayer.app/attestation/technical-compliance/v1');
    expect(statement.predicate.schemaVersion).toBe('1.0.0');
    expect(VlayerStatementV1Schema.safeParse(statement).success).toBe(true);
  }, 60_000);

  it('binds the subject to the git commit and tree', async () => {
    const { statement } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    expect(statement.subject[0].digest).toEqual({
      gitCommit: repo.git(['rev-parse', 'HEAD']),
      gitTree: repo.git(['rev-parse', 'HEAD^{tree}']),
    });
  }, 60_000);

  it('reports the canonical version from package.json', async () => {
    const { statement } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    const pkg = JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('fs').readFileSync(require('path').resolve(__dirname, '../../package.json'), 'utf-8'),
    );
    expect(statement.predicate.verifier.version).toBe(pkg.version);
  }, 60_000);

  it('detects findings in the fixture', async () => {
    const { statement } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    expect(statement.predicate.summary.detected).toBeGreaterThan(0);
    expect(statement.predicate.findings.length).toBe(statement.predicate.summary.detected);
  }, 60_000);
});

describe('attestation build — determinism', () => {
  it('is byte-identical across two builds with a fixed clock', async () => {
    const a = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    const b = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    expect(a.bytes.equals(b.bytes)).toBe(true);
  }, 90_000);

  it('differs ONLY in generatedAt when the clock advances', async () => {
    const a = await buildAttestation({ path: repo.dir, enableAI: false }, { now: () => new Date('2026-01-01T00:00:00.000Z') });
    const b = await buildAttestation({ path: repo.dir, enableAI: false }, { now: () => new Date('2026-12-31T00:00:00.000Z') });
    expect(a.bytes.equals(b.bytes)).toBe(false);

    const stripA = { ...a.statement.predicate, generatedAt: '' };
    const stripB = { ...b.statement.predicate, generatedAt: '' };
    expect(JSON.stringify(stripA)).toBe(JSON.stringify(stripB));
  }, 90_000);

  it('keeps every stable evidence component stable', async () => {
    const a = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    const b = await buildAttestation({ path: repo.dir, enableAI: false }, { now: () => new Date('2027-01-01T00:00:00.000Z') });
    const pa = a.statement.predicate;
    const pb = b.statement.predicate;
    expect(pa.verifier.ruleCatalogDigest).toBe(pb.verifier.ruleCatalogDigest);
    expect(pa.policy.digest).toBe(pb.policy.digest);
    expect(pa.target.sourceDigest).toBe(pb.target.sourceDigest);
    expect(pa.findings.map((f) => f.fingerprint)).toEqual(pb.findings.map((f) => f.fingerprint));
    expect(pa.controls.map((c) => `${c.control.controlId}:${c.state}`))
      .toEqual(pb.controls.map((c) => `${c.control.controlId}:${c.state}`));
  }, 90_000);

  it('emits findings and controls in a deterministic sorted order', async () => {
    const { statement } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    const fps = statement.predicate.findings.map((f) => f.fingerprint);
    expect(fps).toEqual([...fps].sort());
    const ids = statement.predicate.controls.map((c) => c.control.controlId);
    expect(ids).toEqual([...ids].sort());
  }, 60_000);
});

describe('attestation build — privacy', () => {
  let serialized: string;

  beforeAll(async () => {
    const { bytes } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    serialized = bytes.toString('utf-8');
  }, 60_000);

  it('contains no source code from the scanned repository', () => {
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).not.toContain('socialSecurityNumber');
    expect(serialized).not.toContain('patientRecord');
    expect(serialized).not.toContain('records.oncology.example.net');
    expect(serialized).not.toContain('Code: ');
  });

  it('declares no source-carrying field on any finding', () => {
    const parsed = JSON.parse(serialized);
    for (const finding of parsed.predicate.findings) {
      for (const key of ['title', 'description', 'recommendation', 'context', 'snippet', 'code']) {
        expect(finding).not.toHaveProperty(key);
      }
    }
  });

  it('contains no absolute filesystem paths', () => {
    expect(serialized).not.toContain('/Users/');
    expect(serialized).not.toContain('/private/var/folders');
    expect(serialized).not.toMatch(/"[a-zA-Z]:\\\\/);
    const parsed = JSON.parse(serialized);
    for (const f of parsed.predicate.findings) {
      if (f.location.path !== null) {
        expect(f.location.path.startsWith('/')).toBe(false);
        expect(f.location.path).not.toContain('..');
      }
    }
  });

  it('contains no raw AI reasoning prose', () => {
    const parsed = JSON.parse(serialized);
    for (const f of parsed.predicate.findings) {
      expect(f).not.toHaveProperty('aiReasoning');
      if (f.aiTriage) expect(f.aiTriage.reasoningDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('makes no compliance claim it cannot support', () => {
    const lower = serialized.toLowerCase();
    expect(lower).not.toContain('hipaa certified');
    expect(lower).not.toContain('fully compliant');
    expect(lower).not.toContain('100% compliant');
    expect(lower).not.toContain('cryptographically verified');
  });

  it('publishes its own limitations explicitly', () => {
    const parsed = JSON.parse(serialized);
    expect(parsed.predicate.scope.limitations.length).toBeGreaterThan(0);
    expect(parsed.predicate.scope.limitations.join(' ')).toMatch(/does not certify HIPAA compliance/i);
    expect(parsed.predicate.scope.technicalOnly).toBe(true);
  });
});

describe('attestation build — reproducibility mode', () => {
  it('--no-ai yields the deterministic mode with every evaluation deterministic', async () => {
    const { statement } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    const p = statement.predicate;
    expect(p.scope.reproducibility).toBe('deterministic');
    expect(p.verifier.aiTriage.applied).toBe(false);
    expect(p.verifier.aiTriage.reproducible).toBe(true);
    expect(p.verifier.aiTriage.model).toBeNull();
    for (const f of p.findings) expect(f.detection.deterministic).toBe(true);
  }, 60_000);
});

describe('attestation build — coverage evidence', () => {
  it('publishes per-scanner execution evidence', async () => {
    const { statement } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    const coverage = statement.predicate.scope.coverage;
    expect(coverage.scanners.length).toBeGreaterThan(0);
    for (const s of coverage.scanners) {
      expect(s.invoked).toBe(true);
      expect(s.filesConsidered).not.toBeNull();
    }
    expect(coverage.rulesInCatalog).toBe(143);
    expect(coverage.rulesExecuted).toBeGreaterThan(0);
  }, 60_000);

  it('publishes the unmapped-rule coverage gap rather than hiding it', async () => {
    const { statement } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    expect(statement.predicate.scope.coverage.rulesWithoutControlMapping).toBeGreaterThan(0);
  }, 60_000);

  it('never reports no_blocking_findings for a control with zero executed rules', async () => {
    const { statement } = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
    for (const c of statement.predicate.controls) {
      if (c.evidence.rulesExecuted === 0) expect(c.state).not.toBe('no_blocking_findings');
    }
  }, 60_000);
});

describe('attestation build — dirty tree', () => {
  it('refuses a dirty tree by default', async () => {
    repo.write('src/extra.ts', 'export const x = 1;\n');
    await expect(buildAttestation({ path: repo.dir, enableAI: false }, clock)).rejects.toThrow(
      /uncommitted change/i,
    );
  }, 60_000);

  it('allows a dirty tree with allowDirty and records dirty: true', async () => {
    const { statement } = await buildAttestation(
      { path: repo.dir, enableAI: false, allowDirty: true },
      clock,
    );
    expect(statement.predicate.target.dirty).toBe(true);
    expect(statement.predicate.target.sourceDigestMethod).toBe('vlayer-worktree-sha256-v1');
    expect(statement.subject[0].digest).toHaveProperty('sha256');
    expect(statement.subject[0].digest).not.toHaveProperty('gitTree');
  }, 60_000);
});
