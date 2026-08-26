/**
 * Git identity and immutable source-snapshot digest.
 *
 * An attestation is about a RELEASE, so its subject must be tied to an
 * immutable source snapshot. The source digest is NEVER a hash of the
 * attestation JSON — that would be circular and would prove nothing about the
 * code. It is a digest of the source tree itself:
 *
 *   clean tree → `git-tree-sha1`: the HEAD tree object id, which Git already
 *     computes as a Merkle digest over the entire snapshot. Any reviewer can
 *     recompute it with `git rev-parse HEAD^{tree}`.
 *
 *   dirty tree (development only, `--allow-dirty`, never signable) →
 *     `vlayer-worktree-sha256-v1`: SHA-256 over the canonical sorted list of
 *     `path → sha256(file bytes)` for every tracked and untracked-but-not-
 *     ignored file. Independent of Git plumbing, and deterministic.
 *
 * REPOSITORY PRIVACY: a git remote can carry credentials, tokens, a private
 * hostname and a sensitive product name. `sanitizeRepositoryUrl` drops
 * userinfo, port, query and fragment at parse time — they are never carried
 * into a string that could be logged — and any host outside a small public
 * forge allowlist is treated as private infrastructure and redacted entirely.
 * A stable `repositoryDigest` is always emitted so releases of the same repo
 * can be correlated over time without disclosing its identity.
 */

import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { promisify } from 'util';
import { join } from 'path';
import type { AttestationTarget, RepositoryHostClass } from './types.js';
import { canonicalize } from './canonical.js';

const execFileAsync = promisify(execFile);

export class NotAGitRepositoryError extends Error {
  constructor(path: string) {
    super(
      `[vlayer] "${path}" is not a Git repository. ` +
      `vlayer attest requires Git: an attestation must be bound to an immutable commit.`,
    );
    this.name = 'NotAGitRepositoryError';
  }
}

export class DirtyWorkingTreeError extends Error {
  constructor(count: number) {
    super(
      `[vlayer] Working tree has ${count} uncommitted change(s). ` +
      `A release attestation must describe a committed snapshot. ` +
      `Commit your changes, or pass --allow-dirty for a local (unsignable) evaluation.`,
    );
    this.name = 'DirtyWorkingTreeError';
  }
}

/**
 * Public forges where disclosing `<host>/<path>` reveals nothing beyond the
 * repository's own visibility. Anything else is assumed to be private
 * infrastructure — default-deny, because an unknown host is more likely an
 * internal GHE/GitLab instance whose name leaks org structure.
 */
const PUBLIC_FORGE_HOSTS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'dev.azure.com',
  'codeberg.org',
  'git.sr.ht',
]);

export interface SanitizedRepository {
  /** `<host>/<path>` for an allowlisted forge, else null. */
  repository: string | null;
  hostClass: RepositoryHostClass;
  /** SHA-256 over the canonical form. Null only when there is no remote at all. */
  repositoryDigest: string | null;
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Reduce a raw remote URL to `<host>/<path>`, discarding every field that can
 * carry a secret or private detail. Returns null when the input cannot be
 * understood as a remote.
 */
function canonicalRemoteForm(raw: string): { host: string; path: string } | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // scp-style: git@host:owner/repo.git  (also ssh://-less user@host:path)
  const scp = /^(?:[^@/\s]+@)?([^@:/\s]+):(?!\/\/)(.+)$/.exec(trimmed);
  if (scp) {
    return normalizeParts(scp[1], scp[2]);
  }

  // Anything with a scheme: https://, ssh://, git://, http://, file://
  try {
    const url = new URL(trimmed);
    // `url.hostname` deliberately excludes userinfo AND port. `url.pathname`
    // excludes `search` and `hash`. Nothing else from `url` is read, so
    // credentials/tokens/query/fragment cannot survive this function.
    if (!url.hostname) return null;
    return normalizeParts(url.hostname, url.pathname);
  } catch {
    // Bare `host/owner/repo` with no scheme.
    const bare = /^([^/\s:@]+\.[^/\s:@]+)\/(.+)$/.exec(trimmed);
    if (bare) return normalizeParts(bare[1], bare[2]);
    return null;
  }
}

function normalizeParts(hostRaw: string, pathRaw: string): { host: string; path: string } | null {
  const host = hostRaw.toLowerCase().replace(/^\[|\]$/g, '');
  const path = pathRaw
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\.git$/i, '');
  if (!host || !path) return null;
  return { host, path };
}

/**
 * Sanitize a remote URL for publication.
 *
 * @param raw       the raw remote URL, or null when the repo has no remote
 * @param override  an explicit `--repository` value supplied by the user
 * @param omit      `--no-repository`: redact identity even for a public forge
 */
export function sanitizeRepositoryUrl(
  raw: string | null,
  options: { override?: string; omit?: boolean } = {},
): SanitizedRepository {
  if (options.override) {
    const parts = canonicalRemoteForm(options.override);
    const canonical = parts ? `${parts.host}/${parts.path}` : options.override.trim();
    return {
      repository: options.omit ? null : canonical,
      hostClass: parts && PUBLIC_FORGE_HOSTS.has(parts.host) ? 'public-forge' : 'unknown',
      repositoryDigest: sha256(`vlayer-repo-v1|${canonical}`),
    };
  }

  if (!raw) {
    return { repository: null, hostClass: 'unknown', repositoryDigest: null };
  }

  const parts = canonicalRemoteForm(raw);
  if (!parts) {
    // Unparseable. Still correlate on the raw string's digest, but publish
    // nothing — we cannot prove it is free of secrets.
    return { repository: null, hostClass: 'unknown', repositoryDigest: sha256(`vlayer-repo-v1|${raw.trim()}`) };
  }

  const canonical = `${parts.host}/${parts.path}`;
  const digest = sha256(`vlayer-repo-v1|${canonical}`);
  const isPublicForge = PUBLIC_FORGE_HOSTS.has(parts.host);

  if (options.omit || !isPublicForge) {
    return {
      repository: null,
      hostClass: isPublicForge ? 'public-forge' : 'private',
      repositoryDigest: digest,
    };
  }

  return { repository: canonical, hostClass: 'public-forge', repositoryDigest: digest };
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    // Keep git hermetic: no pager, no interactive prompts.
    env: { ...process.env, GIT_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0' },
  });
  return stdout;
}

async function gitOrNull(cwd: string, args: string[]): Promise<string | null> {
  try {
    return (await git(cwd, args)).trim();
  } catch {
    return null;
  }
}

/** Absolute path to the repository root, or throw if `path` is not in a repo. */
export async function getRepositoryRoot(path: string): Promise<string> {
  const root = await gitOrNull(path, ['rev-parse', '--show-toplevel']);
  if (!root) throw new NotAGitRepositoryError(path);
  return root;
}

/**
 * Files that differ from HEAD, plus untracked-but-not-ignored files.
 * `--porcelain=v1 -z` is the stable machine format.
 */
async function getDirtyPaths(root: string): Promise<string[]> {
  const out = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const paths: string[] = [];
  const records = out.split('\0');
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record.length < 4) continue;
    const status = record.slice(0, 2);
    paths.push(record.slice(3));
    // A rename/copy record is followed by its origin path in the next field.
    if (status.includes('R') || status.includes('C')) i++;
  }
  return paths;
}

/**
 * Deterministic digest of the WORKING TREE (used only for dirty, unsignable
 * attestations). Hashes every tracked + untracked-not-ignored file's content.
 */
async function worktreeDigest(root: string): Promise<string> {
  const tracked = (await git(root, ['ls-files', '-z'])).split('\0').filter(Boolean);
  const untracked = (
    await git(root, ['ls-files', '-z', '--others', '--exclude-standard'])
  )
    .split('\0')
    .filter(Boolean);

  const all = [...new Set([...tracked, ...untracked])].sort();
  const entries: Array<{ path: string; sha256: string }> = [];

  for (const relative of all) {
    try {
      const bytes = await readFile(join(root, relative));
      entries.push({ path: relative, sha256: createHash('sha256').update(bytes).digest('hex') });
    } catch {
      // Deleted-but-still-indexed, or unreadable: record its absence explicitly
      // so the digest still changes deterministically.
      entries.push({ path: relative, sha256: 'absent' });
    }
  }

  return sha256(
    canonicalize({
      algorithm: 'vlayer-worktree-sha256-v1',
      fileCount: entries.length,
      files: entries,
    } as never),
  );
}

export interface GitTargetOptions {
  allowDirty?: boolean;
  repositoryOverride?: string;
  omitRepository?: boolean;
}

/**
 * Collect the attestation target for `path`.
 *
 * Throws NotAGitRepositoryError when there is no repository, and
 * DirtyWorkingTreeError when the tree is dirty and `allowDirty` is not set.
 */
export async function getGitTarget(
  path: string,
  options: GitTargetOptions = {},
): Promise<{ target: AttestationTarget; root: string }> {
  const root = await getRepositoryRoot(path);

  const commit = await gitOrNull(root, ['rev-parse', 'HEAD']);
  if (!commit) {
    throw new NotAGitRepositoryError(
      `${path} (repository has no commits — HEAD is unborn)`,
    );
  }
  const tree = await gitOrNull(root, ['rev-parse', 'HEAD^{tree}']);
  if (!tree) throw new NotAGitRepositoryError(path);

  // `--show-current` is empty on a detached HEAD, which is the normal state in
  // CI; a null branch is honest there.
  const branchRaw = await gitOrNull(root, ['branch', '--show-current']);
  const branch = branchRaw && branchRaw.length > 0 ? branchRaw : null;

  const dirtyPaths = await getDirtyPaths(root);
  const dirty = dirtyPaths.length > 0;

  if (dirty && !options.allowDirty) {
    throw new DirtyWorkingTreeError(dirtyPaths.length);
  }

  const remote = await gitOrNull(root, ['remote', 'get-url', 'origin']);
  const repo = sanitizeRepositoryUrl(remote, {
    override: options.repositoryOverride,
    omit: options.omitRepository,
  });

  const sourceDigest = dirty ? await worktreeDigest(root) : tree;
  const sourceDigestMethod = dirty ? 'vlayer-worktree-sha256-v1' : 'git-tree-sha1';

  return {
    root,
    target: {
      repository: repo.repository,
      repositoryHostClass: repo.hostClass,
      repositoryDigest: repo.repositoryDigest,
      commit,
      tree,
      branch,
      dirty,
      sourceDigest,
      sourceDigestMethod,
    },
  };
}

/**
 * in-toto subject for a target. Uses the SANITIZED repository, or a digest-only
 * identifier when the repository is redacted — the raw URL never reappears here.
 */
export function buildSubjectName(target: AttestationTarget): string {
  if (target.repository) return `git+${target.repository}@${target.commit}`;
  if (target.repositoryDigest) return `vlayer:repo:${target.repositoryDigest}@${target.commit}`;
  return `vlayer:commit:${target.commit}`;
}
