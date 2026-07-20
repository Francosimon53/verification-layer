import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    // Never run tests from linked git worktrees checked out under the repo
    // (e.g. .claude/worktrees/*). Those are stale copies on other commits;
    // globbing into them runs duplicate/old tests and pollutes the suite.
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/.claude-worktrees/**', '**/worktrees/**'],
  },
});
