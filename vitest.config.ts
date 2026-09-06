import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    // Never run compiled output or tests from linked git worktrees checked out
    // under the repo. Both are duplicate/stale copies of source tests.
    exclude: [
      ...configDefaults.exclude,
      'dist/**',
      '**/.claude/**',
      '**/.claude-worktrees/**',
      '**/worktrees/**',
    ],
  },
});
