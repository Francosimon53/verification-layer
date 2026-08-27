import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { getVersion, getPackageName } from '../src/version.js';

const repoRoot = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8'));

describe('version truth', () => {
  it('getVersion() equals package.json version', () => {
    expect(getVersion()).toBe(manifest.version);
  });

  it('getPackageName() equals package.json name', () => {
    expect(getPackageName()).toBe(manifest.name);
  });

  it('no hardcoded semver version literal remains in src/ outside package metadata', () => {
    // The CLI previously hardcoded `.version('0.2.0')`, drifting from package.json.
    // Guard against any re-introduction of a literal version passed to .version().
    const cli = readFileSync(resolve(repoRoot, 'src/cli.ts'), 'utf-8');
    expect(cli).not.toMatch(/\.version\(\s*['"`]\d+\.\d+\.\d+/);
    expect(cli).toMatch(/\.version\(getVersion\(\)\)/);
  });

  it('package.json description carries no hardcoded rule count', () => {
    expect(manifest.description).not.toMatch(/\b\d+\s+rules\b/i);
  });

  it('built CLI reports the package.json version', () => {
    // Uses the compiled dist entrypoint, the artifact users actually run.
    const out = execFileSync('node', [resolve(repoRoot, 'dist/cli.js'), '--version'], {
      encoding: 'utf-8',
    }).trim();
    expect(out).toBe(manifest.version);
  });
});
