/**
 * The signing FAILURE MODE, exercised through the built CLI.
 *
 * Requesting a signature, failing to produce one, and leaving a well-formed
 * unsigned attestation at the output path is the most dangerous shape this
 * command can have: the next pipeline step ships an artifact it believes is
 * signed. It needs no carelessness — `$?` after a pipe reports the LAST stage,
 * so `vlayer attest . --sign | tee log` reports success even when node exits
 * non-zero, and the project's own CI guidance suggests `|| true`.
 *
 * Three properties are pinned here:
 *   1. `--sign` failing exits non-zero, with a code distinct from a general error.
 *   2. On signing failure NOTHING is written to the output path.
 *   3. unsigned-by-request and signing-failed are distinguishable by a script.
 *
 * These run the real `dist/cli.js` with no OIDC identity in the environment, so
 * signing genuinely fails — sigstore is not mocked here.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  SIGNING_FAILED_EXIT_CODE,
  SIGNING_FAILED_MARKER,
} from '../../src/attestation/sign.js';
import { createTempRepo, type TempRepo } from './git-fixture.js';

const CLI = resolve(__dirname, '../../dist/cli.js');

interface Run { code: number; stdout: string; stderr: string }

/** Run the CLI with every ambient OIDC source stripped, so signing must fail. */
function runCli(args: string[], cwd: string): Run {
  const env = { ...process.env, ANTHROPIC_API_KEY: '', VLAYER_AI_KEY: '' };
  delete env.SIGSTORE_ID_TOKEN;
  delete env.ACTIONS_ID_TOKEN_REQUEST_URL;
  delete env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], env,
    });
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

let repo: TempRepo;

beforeAll(() => {
  expect(existsSync(CLI), 'dist/cli.js must be built').toBe(true);
  repo = createTempRepo('vlayer-signfail-');
  repo.write('.gitignore', '.vlayer/\n');
  repo.write('package.json', JSON.stringify({ name: 'x', version: '1.0.0', dependencies: { pino: '^9' } }, null, 2));
  repo.write('src/a.ts', 'export const ok = true;\n');
  repo.commit('initial');
});

afterAll(() => repo.cleanup());

describe('1. --sign failing exits non-zero', () => {
  it('exits with the dedicated signing-failure code, not 0', () => {
    const r = runCli(['attest', '.', '--no-ai', '--sign'], repo.dir);
    expect(r.code).not.toBe(0);
    expect(r.code).toBe(SIGNING_FAILED_EXIT_CODE);
  }, 120_000);

  it('the code is distinct from a general failure', () => {
    // A non-git directory is a general failure; it must not look like a
    // signing failure to a script branching on the exit code.
    const general = runCli(['attest', '.', '--no-ai'], repo.dir);
    expect(general.code).toBe(0);
    expect(SIGNING_FAILED_EXIT_CODE).not.toBe(1);
    expect(SIGNING_FAILED_EXIT_CODE).not.toBe(0);
  }, 120_000);
});

describe('2. signing failure writes NOTHING to the output path', () => {
  it('leaves no attestation behind', () => {
    const out = join(repo.dir, '.vlayer', 'must-not-exist.json');
    const r = runCli(['attest', '.', '--no-ai', '--sign', '-o', '.vlayer/must-not-exist.json'], repo.dir);
    expect(r.code).toBe(SIGNING_FAILED_EXIT_CODE);
    expect(existsSync(out), 'an unsigned attestation was left at the output path').toBe(false);
  }, 120_000);

  it('leaves no bundle behind either', () => {
    expect(existsSync(join(repo.dir, '.vlayer', 'attestation.sigstore.json'))).toBe(false);
  });

  it('does not quarantine a copy under a nearby name — absence is the signal', () => {
    // A second artifact would still be found by a glob such as .vlayer/*.json
    // and invites a "just rename it" workaround.
    const r = runCli(['attest', '.', '--no-ai', '--sign', '-o', '.vlayer/q.json'], repo.dir);
    expect(r.code).toBe(SIGNING_FAILED_EXIT_CODE);
    for (const name of ['q.json', 'q.json.failed', 'q.failed.json', 'q.json.unsigned']) {
      expect(existsSync(join(repo.dir, '.vlayer', name)), `${name} should not exist`).toBe(false);
    }
  }, 120_000);
});

describe('3. unsigned-by-request vs signing-failed are distinguishable', () => {
  it('unsigned by request: exit 0, attestation present, no bundle', () => {
    const r = runCli(['attest', '.', '--no-ai', '-o', '.vlayer/unsigned.json'], repo.dir);
    expect(r.code).toBe(0);
    expect(existsSync(join(repo.dir, '.vlayer', 'unsigned.json'))).toBe(true);
    expect(existsSync(join(repo.dir, '.vlayer', 'attestation.sigstore.json'))).toBe(false);
  }, 120_000);

  it('signing failed: non-zero exit, no attestation at all', () => {
    const r = runCli(['attest', '.', '--no-ai', '--sign', '-o', '.vlayer/failed.json'], repo.dir);
    expect(r.code).toBe(SIGNING_FAILED_EXIT_CODE);
    expect(existsSync(join(repo.dir, '.vlayer', 'failed.json'))).toBe(false);
  }, 120_000);

  it('the two states differ in BOTH exit code and filesystem state', () => {
    const unsigned = runCli(['attest', '.', '--no-ai', '-o', '.vlayer/u2.json'], repo.dir);
    const failed = runCli(['attest', '.', '--no-ai', '--sign', '-o', '.vlayer/f2.json'], repo.dir);
    expect(unsigned.code).not.toBe(failed.code);
    expect(existsSync(join(repo.dir, '.vlayer', 'u2.json'))).toBe(true);
    expect(existsSync(join(repo.dir, '.vlayer', 'f2.json'))).toBe(false);
  }, 120_000);

  it('emits a stable machine-readable marker on signing failure', () => {
    const r = runCli(['attest', '.', '--no-ai', '--sign'], repo.dir);
    expect(r.stderr).toContain(SIGNING_FAILED_MARKER);
    // The unsigned path must never emit it.
    const ok = runCli(['attest', '.', '--no-ai', '-o', '.vlayer/u3.json'], repo.dir);
    expect(ok.stdout + ok.stderr).not.toContain(SIGNING_FAILED_MARKER);
  }, 120_000);
});

describe('the error message describes what sigstore-js can actually do', () => {
  it('does not promise a local interactive browser flow', () => {
    const r = runCli(['attest', '.', '--no-ai', '--sign'], repo.dir);
    const out = (r.stdout + r.stderr).toLowerCase();
    expect(out).not.toMatch(/an interactive browser locally/);
    expect(out).toContain('no local interactive browser flow');
  }, 120_000);

  it('names the supported path and the advanced escape hatch', () => {
    const r = runCli(['attest', '.', '--no-ai', '--sign'], repo.dir);
    const out = r.stdout + r.stderr;
    expect(out).toContain('id-token: write');
    expect(out).toContain('SIGSTORE_ID_TOKEN');
  }, 120_000);
});
