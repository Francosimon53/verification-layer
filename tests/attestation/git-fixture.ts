/**
 * Hermetic temporary Git repositories for attestation tests.
 * `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` are neutralized so a developer's
 * global gitconfig (hooks, templates, signing, default branch) cannot change
 * test outcomes.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';

const HERMETIC_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'vlayer test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'vlayer test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00+00:00',
  GIT_COMMITTER_DATE: '2026-01-01T00:00:00+00:00',
};

export function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, env: HERMETIC_ENV, encoding: 'utf-8' }).trim();
}

export interface TempRepo {
  dir: string;
  write(relative: string, content: string): void;
  commit(message: string): string;
  git(args: string[]): string;
  cleanup(): void;
}

export function createTempRepo(prefix = 'vlayer-attest-'): TempRepo {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  git(dir, ['init', '--quiet', '--initial-branch=main']);
  git(dir, ['config', 'user.name', 'vlayer test']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'commit.gpgsign', 'false']);

  return {
    dir,
    write(relative: string, content: string) {
      const target = resolve(dir, relative);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, 'utf-8');
    },
    commit(message: string) {
      git(dir, ['add', '-A']);
      git(dir, ['commit', '--quiet', '--no-verify', '-m', message]);
      return git(dir, ['rev-parse', 'HEAD']);
    },
    git(args: string[]) {
      return git(dir, args);
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A tmpdir that is deliberately NOT a git repository. */
export function createTempDir(prefix = 'vlayer-nogit-'): { dir: string; cleanup(): void } {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
