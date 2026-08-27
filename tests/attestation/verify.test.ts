/**
 * Verification tests. Sigstore is MOCKED throughout — no network access.
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';

const signMock = vi.fn();
const verifyMock = vi.fn();
vi.mock('sigstore', () => ({
  sign: (...args: unknown[]) => signMock(...args),
  verify: (...args: unknown[]) => verifyMock(...args),
}));

import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { buildAttestation } from '../../src/attestation/build.js';
import { signAttestation, DirtySigningError } from '../../src/attestation/sign.js';
import { verifyAttestation, verifyExitCode } from '../../src/attestation/verify.js';
import { createTempRepo, type TempRepo } from './git-fixture.js';

const clock = { now: () => new Date('2026-08-26T12:00:00.000Z') };

let repo: TempRepo;
let attestationPath: string;
let bundlePath: string;
let bytes: Buffer;

beforeAll(async () => {
  repo = createTempRepo('vlayer-verify-');
  repo.write('package.json', JSON.stringify({ name: 'fx', version: '1.0.0' }));
  repo.write('src/ok.ts', 'export const ok = true;\n');
  repo.commit('initial');

  const built = await buildAttestation({ path: repo.dir, enableAI: false }, clock);
  bytes = built.bytes;
  mkdirSync(join(repo.dir, '.vlayer'), { recursive: true });
  attestationPath = join(repo.dir, '.vlayer', 'attestation.json');
  bundlePath = join(repo.dir, '.vlayer', 'attestation.sigstore.json');
  writeFileSync(attestationPath, bytes);
  writeFileSync(bundlePath, JSON.stringify({ mediaType: 'application/vnd.dev.sigstore.bundle+json;version=0.3' }));
}, 90_000);

afterAll(() => repo.cleanup());
beforeEach(() => {
  signMock.mockReset();
  verifyMock.mockReset();
});

describe('unsigned verification', () => {
  it('reports schema valid, signature NOT PROVIDED, and a policy conclusion', async () => {
    const r = await verifyAttestation({ attestationPath });
    expect(r.schema).toBe('valid');
    expect(r.signature).toBe('not_provided');
    expect(r.signerIdentity).toBeNull();
    expect(r.policy).not.toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('reports subject not_checked without --path', async () => {
    expect((await verifyAttestation({ attestationPath })).subject).toBe('not_checked');
  });

  it('never claims cryptographic verification when unsigned', async () => {
    const r = await verifyAttestation({ attestationPath });
    expect(JSON.stringify(r).toLowerCase()).not.toContain('cryptographically verified');
  });
});

describe('schema verification', () => {
  it('reports invalid for malformed JSON', async () => {
    const bad = join(repo.dir, 'bad.json');
    writeFileSync(bad, '{ not json');
    const r = await verifyAttestation({ attestationPath: bad });
    expect(r.schema).toBe('invalid');
    expect(r.schemaErrors[0]).toMatch(/not valid JSON/);
    expect(verifyExitCode(r)).toBe(1);
  });

  it('reports invalid for a wrong predicateType', async () => {
    const parsed = JSON.parse(bytes.toString('utf-8'));
    parsed.predicateType = 'https://example.com/other/v1';
    const bad = join(repo.dir, 'wrong-type.json');
    writeFileSync(bad, JSON.stringify(parsed));
    const r = await verifyAttestation({ attestationPath: bad });
    expect(r.schema).toBe('invalid');
    expect(r.schemaErrors.join('\n')).toMatch(/predicateType/);
  });
});

describe('subject verification', () => {
  it('reports valid when the attestation matches the repository HEAD', async () => {
    const r = await verifyAttestation({ attestationPath, repositoryPath: repo.dir });
    expect(r.subject).toBe('valid');
    expect(r.subjectDetail).toContain(repo.git(['rev-parse', 'HEAD']));
  });

  it('reports mismatch when the repository has moved on', async () => {
    repo.write('src/ok.ts', 'export const ok = false;\n');
    repo.commit('second');
    const r = await verifyAttestation({ attestationPath, repositoryPath: repo.dir });
    expect(r.subject).toBe('mismatch');
    expect(r.subjectDetail).toMatch(/attestation describes commit/);
    expect(verifyExitCode(r)).toBe(1);
  });
});

describe('signed verification (mocked sigstore)', () => {
  it('reports valid and binds the signer identity', async () => {
    verifyMock.mockResolvedValue({ identity: 'https://github.com/acme/app/.github/workflows/ci.yml@refs/heads/main' });
    const r = await verifyAttestation({ attestationPath, bundlePath });
    expect(r.signature).toBe('valid');
    expect(r.signerIdentity).toContain('github.com/acme/app');
  });

  it('passes the EXACT file bytes to sigstore.verify — this is the binding', async () => {
    verifyMock.mockResolvedValue({ identity: 'signer' });
    await verifyAttestation({ attestationPath, bundlePath });
    expect(verifyMock).toHaveBeenCalledTimes(1);
    const [, payload] = verifyMock.mock.calls[0];
    expect(Buffer.isBuffer(payload)).toBe(true);
    expect((payload as Buffer).equals(bytes)).toBe(true);
  });

  it('reports invalid when the signature does not verify', async () => {
    verifyMock.mockRejectedValue(new Error('signature verification failed'));
    const r = await verifyAttestation({ attestationPath, bundlePath });
    expect(r.signature).toBe('invalid');
    expect(r.signatureDetail).toMatch(/signature verification failed/);
    expect(verifyExitCode(r)).toBe(1);
  });

  it('reports invalid when the bundle cannot be read', async () => {
    const r = await verifyAttestation({ attestationPath, bundlePath: join(repo.dir, 'missing.json') });
    expect(r.signature).toBe('invalid');
    expect(r.signatureDetail).toMatch(/bundle could not be read/);
  });
});

describe('tampering', () => {
  it('a single changed byte reaches sigstore as different bytes and fails', async () => {
    // Real Sigstore fails on a digest mismatch; the mock asserts the tampered
    // bytes are what actually get handed to it, which is the property that makes
    // the real failure inevitable.
    const tamperedPath = join(repo.dir, 'tampered.json');
    // Flip a digit inside a numeric VALUE so the document stays schema-valid and
    // the SIGNATURE is unambiguously what fails.
    const text = bytes.toString('utf-8');
    const marker = '"ruleCatalogRuleCount":143';
    expect(text).toContain(marker);
    const tampered = Buffer.from(text.replace(marker, '"ruleCatalogRuleCount":144'));
    expect(tampered.equals(bytes)).toBe(false);
    writeFileSync(tamperedPath, tampered);

    verifyMock.mockImplementation(async (_bundle: unknown, payload: Buffer) => {
      if (!payload.equals(bytes)) throw new Error('signature verification failed: digest mismatch');
      return { identity: 'signer' };
    });

    const r = await verifyAttestation({ attestationPath: tamperedPath, bundlePath });
    expect(r.schema).toBe('valid'); // still a well-formed statement …
    expect(r.signature).toBe('invalid'); // … but not the bytes that were signed
    expect(r.signatureDetail).toMatch(/digest mismatch/);
    expect(verifyExitCode(r)).toBe(1);
  });

  it('checks the signature even when the schema is invalid — verdicts are independent', async () => {
    const brokenPath = join(repo.dir, 'broken-schema.json');
    const parsed = JSON.parse(bytes.toString('utf-8'));
    parsed.predicate.findings[0] = { ...parsed.predicate.findings[0], description: 'leaked code' };
    writeFileSync(brokenPath, JSON.stringify(parsed));

    verifyMock.mockImplementation(async (_bundle: unknown, payload: Buffer) => {
      if (!payload.equals(bytes)) throw new Error('signature verification failed: digest mismatch');
      return { identity: 'signer' };
    });

    const r = await verifyAttestation({ attestationPath: brokenPath, bundlePath });
    expect(r.schema).toBe('invalid');
    // The key property: a tampered file is NOT reported as merely unsigned.
    expect(r.signature).toBe('invalid');
    expect(verifyMock).toHaveBeenCalled();
  });

  it('re-serializing the attestation also breaks the signature', async () => {
    // Proves the signed payload is the BYTES, not the parsed object: pretty
    // printing the same semantic content must not verify.
    const prettyPath = join(repo.dir, 'pretty.json');
    const pretty = Buffer.from(JSON.stringify(JSON.parse(bytes.toString('utf-8')), null, 2));
    writeFileSync(prettyPath, pretty);

    verifyMock.mockImplementation(async (_bundle: unknown, payload: Buffer) => {
      if (!payload.equals(bytes)) throw new Error('signature verification failed: digest mismatch');
      return { identity: 'signer' };
    });

    const r = await verifyAttestation({ attestationPath: prettyPath, bundlePath });
    expect(r.schema).toBe('valid'); // still semantically valid …
    expect(r.signature).toBe('invalid'); // … but not the signed bytes
  });
});

describe('exit codes', () => {
  it('is zero for a review_required attestation — review does not fail a release', async () => {
    const r = await verifyAttestation({ attestationPath });
    // The fixture's only significant finding is a repository/process observation
    // (no audit logging framework). It stays visible at high severity but must
    // not auto-fail the release.
    expect(r.policy).toBe('review_required');
    expect(verifyExitCode(r)).toBe(0);
  });

  it('is non-zero when the policy failed', () => {
    expect(
      verifyExitCode({
        schema: 'valid',
        schemaErrors: [],
        subject: 'valid',
        subjectDetail: null,
        signature: 'not_provided',
        signatureDetail: null,
        signerIdentity: null,
        policy: 'fail',
        policyReasons: ['blocking-critical'],
        statement: null,
      }),
    ).toBe(1);
  });

  it('is zero for a fully verified, passing attestation', () => {
    expect(
      verifyExitCode({
        schema: 'valid',
        schemaErrors: [],
        subject: 'valid',
        subjectDetail: null,
        signature: 'valid',
        signatureDetail: null,
        signerIdentity: 'signer',
        policy: 'pass',
        policyReasons: [],
        statement: null,
      }),
    ).toBe(0);
  });

  it('is non-zero when sigstore could not run — never treated as unsigned', () => {
    expect(
      verifyExitCode({
        schema: 'valid',
        schemaErrors: [],
        subject: 'valid',
        subjectDetail: null,
        signature: 'not_verifiable',
        signatureDetail: 'sigstore unavailable',
        signerIdentity: null,
        policy: 'pass',
        policyReasons: [],
        statement: null,
      }),
    ).toBe(1);
  });

  it('is zero for a valid unsigned attestation whose policy passes', () => {
    expect(
      verifyExitCode({
        schema: 'valid',
        schemaErrors: [],
        subject: 'not_checked',
        subjectDetail: null,
        signature: 'not_provided',
        signatureDetail: null,
        signerIdentity: null,
        policy: 'pass',
        policyReasons: [],
        statement: null,
      }),
    ).toBe(0);
  });
});

describe('signing guards', () => {
  it('refuses to sign a dirty attestation, and never calls sigstore', async () => {
    await expect(signAttestation(bytes, { dirty: true })).rejects.toBeInstanceOf(DirtySigningError);
    expect(signMock).not.toHaveBeenCalled();
  });

  it('signs the exact canonical bytes for a clean tree', async () => {
    signMock.mockResolvedValue({ mediaType: 'application/vnd.dev.sigstore.bundle+json;version=0.3' });
    await signAttestation(bytes, { dirty: false });
    expect(signMock).toHaveBeenCalledTimes(1);
    const [payload] = signMock.mock.calls[0];
    expect((payload as Buffer).equals(bytes)).toBe(true);
  });
});
