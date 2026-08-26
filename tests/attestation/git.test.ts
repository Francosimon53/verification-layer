import { describe, it, expect, afterEach } from 'vitest';
import { realpathSync } from 'fs';
import {
  getGitTarget,
  getRepositoryRoot,
  sanitizeRepositoryUrl,
  buildSubjectName,
  NotAGitRepositoryError,
  DirtyWorkingTreeError,
} from '../../src/attestation/git.js';
import { createTempRepo, createTempDir, type TempRepo } from './git-fixture.js';

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

function repo(): TempRepo {
  const r = createTempRepo();
  cleanups.push(r.cleanup);
  r.write('src/app.ts', 'export const ok = true;\n');
  r.commit('initial');
  return r;
}

describe('git target — clean tree', () => {
  it('records commit, tree and branch matching git plumbing', async () => {
    const r = repo();
    const { target } = await getGitTarget(r.dir);
    expect(target.commit).toBe(r.git(['rev-parse', 'HEAD']));
    expect(target.tree).toBe(r.git(['rev-parse', 'HEAD^{tree}']));
    expect(target.branch).toBe('main');
    expect(target.dirty).toBe(false);
  });

  it('uses the HEAD tree sha as the source digest', async () => {
    const r = repo();
    const { target } = await getGitTarget(r.dir);
    expect(target.sourceDigestMethod).toBe('git-tree-sha1');
    expect(target.sourceDigest).toBe(r.git(['rev-parse', 'HEAD^{tree}']));
    // Independently recomputable by any reviewer — not a hash of our own JSON.
    expect(target.sourceDigest).toMatch(/^[0-9a-f]{40}$/);
  });

  it('is stable across repeated runs on the same commit', async () => {
    const r = repo();
    const a = await getGitTarget(r.dir);
    const b = await getGitTarget(r.dir);
    expect(a.target).toEqual(b.target);
  });

  it('changes the tree when content changes, even at the same path', async () => {
    const r = repo();
    const before = (await getGitTarget(r.dir)).target;
    r.write('src/app.ts', 'export const ok = false;\n');
    r.commit('change');
    const after = (await getGitTarget(r.dir)).target;
    expect(after.tree).not.toBe(before.tree);
    expect(after.commit).not.toBe(before.commit);
  });

  it('resolves the repository root', async () => {
    const r = repo();
    expect(realpathSync(await getRepositoryRoot(r.dir))).toBe(realpathSync(r.dir));
  });
});

describe('git target — non-git directory', () => {
  it('throws NotAGitRepositoryError', async () => {
    const d = createTempDir();
    cleanups.push(d.cleanup);
    await expect(getGitTarget(d.dir)).rejects.toBeInstanceOf(NotAGitRepositoryError);
    await expect(getGitTarget(d.dir)).rejects.toThrow(/requires Git/);
  });
});

describe('git target — dirty tree', () => {
  it('rejects a dirty tree by default', async () => {
    const r = repo();
    r.write('src/app.ts', 'export const ok = "modified";\n');
    await expect(getGitTarget(r.dir)).rejects.toBeInstanceOf(DirtyWorkingTreeError);
  });

  it('detects an untracked file as dirty', async () => {
    const r = repo();
    r.write('src/extra.ts', 'export const extra = 1;\n');
    await expect(getGitTarget(r.dir)).rejects.toBeInstanceOf(DirtyWorkingTreeError);
  });

  it('allows a dirty tree with allowDirty and switches the digest method', async () => {
    const r = repo();
    r.write('src/app.ts', 'export const ok = "modified";\n');
    const { target } = await getGitTarget(r.dir, { allowDirty: true });
    expect(target.dirty).toBe(true);
    expect(target.sourceDigestMethod).toBe('vlayer-worktree-sha256-v1');
    expect(target.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
    // The worktree digest must NOT equal the HEAD tree — that is the point.
    expect(target.sourceDigest).not.toBe(target.tree);
  });

  it('produces a deterministic worktree digest for identical content', async () => {
    const r = repo();
    r.write('src/app.ts', 'export const ok = "modified";\n');
    const a = await getGitTarget(r.dir, { allowDirty: true });
    const b = await getGitTarget(r.dir, { allowDirty: true });
    expect(a.target.sourceDigest).toBe(b.target.sourceDigest);
  });

  it('changes the worktree digest when working-tree content changes', async () => {
    const r = repo();
    r.write('src/app.ts', 'a\n');
    const a = await getGitTarget(r.dir, { allowDirty: true });
    r.write('src/app.ts', 'b\n');
    const b = await getGitTarget(r.dir, { allowDirty: true });
    expect(a.target.sourceDigest).not.toBe(b.target.sourceDigest);
  });
});

describe('repository URL sanitization', () => {
  it('publishes an allowlisted public forge as scheme-less host/path', () => {
    const r = sanitizeRepositoryUrl('https://github.com/acme/health-app.git');
    expect(r.repository).toBe('github.com/acme/health-app');
    expect(r.hostClass).toBe('public-forge');
    expect(r.repositoryDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('strips credentials, token, port, query string and fragment', () => {
    const r = sanitizeRepositoryUrl(
      'https://user:ghp_SECRETTOKEN@github.com:8443/acme/health-app.git?token=abc#frag',
    );
    expect(r.repository).toBe('github.com/acme/health-app');
    const serialized = JSON.stringify(r);
    for (const secret of ['user', 'ghp_SECRETTOKEN', '8443', 'token=abc', 'frag']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('redacts a non-allowlisted (private) host entirely', () => {
    const r = sanitizeRepositoryUrl(
      'https://user:ghp_TOKEN@ghe.internal.acme.com/oncology/patient-portal.git',
    );
    expect(r.repository).toBeNull();
    expect(r.hostClass).toBe('private');
    expect(r.repositoryDigest).toMatch(/^[0-9a-f]{64}$/);
    const serialized = JSON.stringify(r);
    for (const secret of ['ghe.internal.acme.com', 'ghp_TOKEN', 'oncology', 'patient-portal']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('normalizes scp-style remotes', () => {
    expect(sanitizeRepositoryUrl('git@github.com:acme/health-app.git').repository)
      .toBe('github.com/acme/health-app');
  });

  it('normalizes ssh:// and git:// to the same canonical form', () => {
    const https = sanitizeRepositoryUrl('https://github.com/acme/app.git');
    const ssh = sanitizeRepositoryUrl('ssh://git@github.com/acme/app.git');
    const scp = sanitizeRepositoryUrl('git@github.com:acme/app.git');
    expect(ssh.repository).toBe(https.repository);
    expect(scp.repository).toBe(https.repository);
    expect(ssh.repositoryDigest).toBe(https.repositoryDigest);
  });

  it('produces a stable digest that correlates releases without disclosure', () => {
    const a = sanitizeRepositoryUrl('https://ghe.internal.acme.com/team/repo.git');
    const b = sanitizeRepositoryUrl('git@ghe.internal.acme.com:team/repo.git');
    expect(a.repositoryDigest).toBe(b.repositoryDigest);
    expect(a.repository).toBeNull();
  });

  it('honours --no-repository even for a public forge', () => {
    const r = sanitizeRepositoryUrl('https://github.com/acme/app.git', { omit: true });
    expect(r.repository).toBeNull();
    expect(r.repositoryDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('honours an explicit --repository override', () => {
    const r = sanitizeRepositoryUrl('https://ghe.internal/team/repo.git', {
      override: 'github.com/acme/public-mirror',
    });
    expect(r.repository).toBe('github.com/acme/public-mirror');
    expect(JSON.stringify(r)).not.toContain('ghe.internal');
  });

  it('handles a repository with no remote', () => {
    const r = sanitizeRepositoryUrl(null);
    expect(r.repository).toBeNull();
    expect(r.repositoryDigest).toBeNull();
  });

  it('never publishes an unparseable remote', () => {
    const r = sanitizeRepositoryUrl('not a url at all');
    expect(r.repository).toBeNull();
    expect(r.repositoryDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('subject naming', () => {
  const base = {
    repositoryHostClass: 'public-forge' as const,
    commit: '9'.repeat(40),
    tree: '8'.repeat(40),
    branch: 'main',
    dirty: false,
    sourceDigest: '8'.repeat(40),
    sourceDigestMethod: 'git-tree-sha1' as const,
  };

  it('uses the sanitized repository when published', () => {
    expect(
      buildSubjectName({ ...base, repository: 'github.com/acme/app', repositoryDigest: 'a'.repeat(64) }),
    ).toBe(`git+github.com/acme/app@${base.commit}`);
  });

  it('falls back to a digest identifier when the repository is redacted', () => {
    const name = buildSubjectName({
      ...base,
      repository: null,
      repositoryHostClass: 'private',
      repositoryDigest: 'a'.repeat(64),
    });
    expect(name).toBe(`vlayer:repo:${'a'.repeat(64)}@${base.commit}`);
    expect(name).not.toContain('internal');
  });

  it('falls back to commit-only when there is no remote', () => {
    expect(
      buildSubjectName({ ...base, repository: null, repositoryHostClass: 'unknown', repositoryDigest: null }),
    ).toBe(`vlayer:commit:${base.commit}`);
  });
});
