import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import type { GitContext } from './types.js';

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
  });
  return String(result.stdout).trim();
}

async function tryGit(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    const value = await runGit(cwd, args);
    return value || undefined;
  } catch {
    return undefined;
  }
}

function validGithubSha(value: string | undefined): string | undefined {
  if (!value || /^0+$/.test(value)) return undefined;
  return value;
}

async function resolveBaseSha(root: string, headSha: string, baseRef?: string): Promise<string | undefined> {
  const githubBaseSha = validGithubSha(process.env.GITHUB_BASE_SHA);
  if (!baseRef && githubBaseSha) return githubBaseSha;

  const requested = baseRef || process.env.GITHUB_BASE_REF;
  if (requested) {
    const candidates = requested.startsWith('refs/') || requested.startsWith('origin/')
      ? [requested]
      : [`origin/${requested}`, requested];

    for (const candidate of candidates) {
      const mergeBase = await tryGit(root, ['merge-base', candidate, headSha]);
      if (mergeBase) return mergeBase;
    }
  }

  return tryGit(root, ['rev-parse', `${headSha}^`]);
}

/**
 * Resolve the source-control context used by a deployment decision. Git is a
 * best-effort enhancement: callers can still evaluate all findings when the
 * target directory is not a repository.
 */
export async function getGitContext(
  projectPath: string,
  baseRef?: string,
  headRef = 'HEAD',
): Promise<GitContext> {
  const cwd = resolve(projectPath);
  const root = await tryGit(cwd, ['rev-parse', '--show-toplevel']);

  if (!root) {
    return {
      available: false,
      root: cwd,
      changedFiles: [],
    };
  }

  const headSha = await tryGit(root, ['rev-parse', headRef]);
  if (!headSha) {
    return {
      available: false,
      root,
      changedFiles: [],
    };
  }

  const baseSha = await resolveBaseSha(root, headSha, baseRef);
  let changedFiles: string[] = [];

  if (baseSha && baseSha !== headSha) {
    const diff = await tryGit(root, [
      'diff',
      '--name-only',
      '--diff-filter=ACMR',
      `${baseSha}...${headSha}`,
    ]);
    changedFiles = diff
      ? diff.split('\n').map(file => file.trim()).filter(Boolean).map(file => file.replace(/\\/g, '/'))
      : [];
  }

  const branch = process.env.GITHUB_HEAD_REF
    || await tryGit(root, ['rev-parse', '--abbrev-ref', headSha]);
  const author = await tryGit(root, ['show', '-s', '--format=%an <%ae>', headSha]);
  const repository = process.env.GITHUB_REPOSITORY;
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const commitUrl = repository ? `${serverUrl}/${repository}/commit/${headSha}` : undefined;

  return {
    available: true,
    root,
    branch,
    headSha,
    baseSha,
    author,
    changedFiles,
    repository,
    commitUrl,
  };
}
