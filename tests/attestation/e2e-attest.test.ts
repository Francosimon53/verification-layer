/**
 * §29 END-TO-END ACCEPTANCE, driven through the built CLI.
 *
 * STATE A: a clean committed repository.
 * STATE B: a committed, intentionally unsafe healthcare change.
 *
 * The point is to prove vlayer EVALUATES RELEASES rather than emitting JSON:
 * between the two states the finding set, the affected control state, the
 * summary, the policy conclusion and the attestation bytes must all move — and
 * STATE A must remain independently understandable afterwards.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createTempRepo, createTempDir, type TempRepo } from './git-fixture.js';

const CLI = resolve(__dirname, '../../dist/cli.js');

let repo: TempRepo;

interface RunResult { code: number; stdout: string; stderr: string }

function runCli(args: string[], cwd: string): RunResult {
  // stderr must be piped explicitly: ora writes spinner/success lines there, and
  // the default stdio would inherit them into the test runner's own output.
  const stdio: ['ignore', 'pipe', 'pipe'] = ['ignore', 'pipe', 'pipe'];
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', ANTHROPIC_API_KEY: '', VLAYER_AI_KEY: '' };
  try {
    const stdout = execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf-8', stdio, env });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    const e = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      code: e.status ?? 1,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
    };
  }
}

function readAttestation(dir: string, name = 'attestation.json') {
  return JSON.parse(readFileSync(join(dir, '.vlayer', name), 'utf-8'));
}

beforeAll(() => {
  expect(existsSync(CLI), 'dist/cli.js must be built before the e2e test').toBe(true);
  repo = createTempRepo('vlayer-e2e-');
  repo.write('package.json', JSON.stringify({ name: 'clinic-api', version: '1.0.0', dependencies: { pino: '^9.0.0' } }, null, 2));
  repo.write(
    'src/patient-service.ts',
    [
      `import pino from 'pino';`,
      `const logger = pino();`,
      ``,
      `export async function getPatient(id: string) {`,
      `  logger.info({ patientId: id }, 'patient lookup');`,
      `  return repository.findById(id);`,
      `}`,
    ].join('\n') + '\n',
  );
  repo.commit('STATE A: clean');
});

afterAll(() => repo.cleanup());

// ---------------------------------------------------------------- STATE A ---

describe('STATE A — clean committed state', () => {
  let stateA: Record<string, never> | any;
  let commitA: string;

  it('vlayer attest . --no-ai succeeds and writes the attestation', () => {
    commitA = repo.git(['rev-parse', 'HEAD']);
    const r = runCli(['attest', '.', '--no-ai'], repo.dir);
    expect(r.code, `attest failed:\n${r.stdout}\n${r.stderr}`).toBe(0);
    expect(r.stdout).toContain('VLayer Attestation V1');
    stateA = readAttestation(repo.dir);
  }, 120_000);

  it('identifies the specific commit and tree', () => {
    expect(stateA.predicate.target.commit).toBe(commitA);
    expect(stateA.predicate.target.tree).toBe(repo.git(['rev-parse', 'HEAD^{tree}']));
    expect(stateA.predicate.target.dirty).toBe(false);
    expect(stateA.subject[0].digest.gitCommit).toBe(commitA);
  });

  it('runs in the deterministic reproducibility mode with --no-ai', () => {
    expect(stateA.predicate.scope.reproducibility).toBe('deterministic');
    expect(stateA.predicate.verifier.aiTriage.applied).toBe(false);
    expect(stateA.predicate.verifier.aiTriage.reproducible).toBe(true);
  });

  it('makes no inappropriate compliance claim', () => {
    const text = JSON.stringify(stateA).toLowerCase();
    for (const claim of ['hipaa certified', 'fully compliant', '100% compliant', 'is compliant', 'cryptographically verified']) {
      expect(text).not.toContain(claim);
    }
    expect(stateA.predicate.scope.technicalOnly).toBe(true);
    expect(stateA.predicate.scope.limitations.join(' ')).toMatch(/does not certify HIPAA compliance/i);
  });

  it('records a policy conclusion with closed-vocabulary reasons', () => {
    expect(['pass', 'fail', 'review_required']).toContain(stateA.predicate.policy.conclusion);
    expect(stateA.predicate.policy.reasons.length).toBeGreaterThan(0);
    expect(stateA.predicate.policy.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifies against its own repository', () => {
    const r = runCli(['verify', '.vlayer/attestation.json', '--path', '.'], repo.dir);
    const out = r.stdout + r.stderr;
    expect(out).toMatch(/Schema:\s+valid/);
    expect(out).toMatch(/Subject:\s+valid/);
    expect(out).toMatch(/Signature: not provided/);
    // An unsigned attestation must never be described as cryptographically verified.
    expect(out.toLowerCase()).not.toContain('cryptographically verified');
  }, 60_000);
});

// ---------------------------------------------------------------- STATE B ---

describe('STATE B — an unsafe healthcare change is committed', () => {
  let stateA: any;
  let stateB: any;
  let commitA: string;
  let commitB: string;

  beforeAll(() => {
    stateA = readAttestation(repo.dir);
    commitA = stateA.predicate.target.commit;

    // A PHI-logging pattern the current rules reliably detect.
    repo.write(
      'src/patient-service.ts',
      [
        `import pino from 'pino';`,
        `const logger = pino();`,
        ``,
        `export async function getPatient(id: string) {`,
        `  const patient = await repository.findById(id);`,
        `  console.log('patient ssn', patient.ssn, patient.dateOfBirth);`,
        `  return patient;`,
        `}`,
      ].join('\n') + '\n',
    );
    commitB = repo.commit('STATE B: log PHI');
    runCli(['attest', '.', '--no-ai', '-o', '.vlayer/attestation-b.json'], repo.dir);
    stateB = readAttestation(repo.dir, 'attestation-b.json');
  }, 120_000);

  it('identifies the NEW commit', () => {
    expect(stateB.predicate.target.commit).toBe(commitB);
    expect(stateB.predicate.target.commit).not.toBe(commitA);
    expect(stateB.predicate.target.tree).not.toBe(stateA.predicate.target.tree);
  });

  it('represents the new blocking finding', () => {
    expect(stateB.predicate.summary.blocking).toBeGreaterThan(stateA.predicate.summary.blocking);
    const fingerprintsA = new Set(stateA.predicate.findings.map((f: any) => f.fingerprint));
    const novel = stateB.predicate.findings.filter((f: any) => !fingerprintsA.has(f.fingerprint));
    expect(novel.length).toBeGreaterThan(0);
    const phi = novel.find((f: any) => f.category === 'phi-exposure' && f.blocking);
    expect(phi, 'expected a new blocking phi-exposure finding').toBeDefined();
    expect(phi.location.path).toBe('src/patient-service.ts');
    expect(phi.location.line).toBeGreaterThan(0);
  });

  it('resolves the new finding to a real catalog rule, not a heuristic', () => {
    const phi = stateB.predicate.findings.find(
      (f: any) => f.category === 'phi-exposure' && f.blocking,
    );
    expect(phi.ruleKnown).toBe(true);
    expect(phi.ruleSource).toBe('builtin');
    expect(phi.ruleId).toBeTruthy();
    // The display id carries an interpolated line number; the canonical id does not.
    expect(phi.emittedId).not.toBe(phi.ruleId);
  });

  it('represents the control mapping for the new finding', () => {
    const phi = stateB.predicate.findings.find(
      (f: any) => f.category === 'phi-exposure' && f.blocking,
    );
    expect(phi.controls.length).toBeGreaterThan(0);
    for (const c of phi.controls) {
      expect(c.controlId).toMatch(/^\d{3}\.\d{3}/);
      expect(c.rawReference.length).toBeGreaterThan(0); // provenance preserved
    }
  });

  it('moves at least one control state', () => {
    const stateOf = (att: any) =>
      new Map(att.predicate.controls.map((c: any) => [c.control.controlId, c.state]));
    const a = stateOf(stateA);
    const b = stateOf(stateB);
    const moved = [...b.entries()].filter(([id, st]) => a.get(id) !== st);
    expect(moved.length, 'expected at least one control state transition').toBeGreaterThan(0);
  });

  it('changes the summary and the policy conclusion appropriately', () => {
    expect(stateB.predicate.summary.detected).toBeGreaterThan(stateA.predicate.summary.detected);
    expect(stateB.predicate.policy.conclusion).toBe('fail');
    expect(stateB.predicate.policy.reasons).toContain('blocking-critical');
  });

  it('produces a different attestation', () => {
    expect(JSON.stringify(stateB)).not.toBe(JSON.stringify(stateA));
    expect(stateB.predicate.verifier.ruleCatalogDigest).toBe(stateA.predicate.verifier.ruleCatalogDigest);
  });

  it('leaves STATE A independently understandable', () => {
    const a = readAttestation(repo.dir);
    expect(a.predicate.target.commit).toBe(commitA);
    const r = runCli(['verify', '.vlayer/attestation.json'], repo.dir);
    expect(r.stdout + r.stderr).toMatch(/Schema:\s+valid/);
  }, 60_000);

  it('reports subject MISMATCH when STATE A is checked against the moved repository', () => {
    const r = runCli(['verify', '.vlayer/attestation.json', '--path', '.'], repo.dir);
    expect(r.stdout + r.stderr).toMatch(/Subject:\s+mismatch/);
    expect(r.code).toBe(1);
  }, 60_000);

  it('leaks no source code from the unsafe change', () => {
    const text = JSON.stringify(stateB);
    expect(text).not.toContain('patient.ssn');
    expect(text).not.toContain('dateOfBirth');
    expect(text).not.toContain('console.log');
    expect(text).not.toContain('/private/var');
    expect(text).not.toContain('/Users/');
  });
});

// ------------------------------------------------------- CLI-level guards ---

describe('CLI guards', () => {
  it('refuses a dirty tree by default and writes nothing', () => {
    repo.write('src/uncommitted.ts', 'export const wip = 1;\n');
    const r = runCli(['attest', '.', '--no-ai', '-o', '.vlayer/should-not-exist.json'], repo.dir);
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/uncommitted change/i);
    expect(existsSync(join(repo.dir, '.vlayer', 'should-not-exist.json'))).toBe(false);
  }, 120_000);

  it('allows --allow-dirty and records dirty: true with the worktree digest', () => {
    const r = runCli(['attest', '.', '--no-ai', '--allow-dirty', '-o', '.vlayer/dirty.json'], repo.dir);
    expect(r.code).toBe(0);
    const att = readAttestation(repo.dir, 'dirty.json');
    expect(att.predicate.target.dirty).toBe(true);
    expect(att.predicate.target.sourceDigestMethod).toBe('vlayer-worktree-sha256-v1');
    expect(att.subject[0].digest).toHaveProperty('sha256');
  }, 120_000);

  it('refuses --sign together with --allow-dirty', () => {
    const r = runCli(['attest', '.', '--no-ai', '--allow-dirty', '--sign'], repo.dir);
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/cannot be combined with --allow-dirty/i);
  }, 120_000);

  it('fails clearly outside a Git repository', () => {
    const d = createTempDir();
    try {
      const r = runCli(['attest', '.', '--no-ai'], d.dir);
      expect(r.code).toBe(1);
      expect(r.stdout + r.stderr).toMatch(/not a Git repository/i);
    } finally {
      d.cleanup();
    }
  }, 120_000);
});
