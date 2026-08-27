/**
 * Canonical package version.
 *
 * `package.json` is the ONE source of truth for the version vlayer reports —
 * the CLI (`vlayer --version`) and `attestation.verifier.version` both read it
 * from here. Never copy the version into a hand-maintained constant: the CLI
 * previously hardcoded `0.2.0` while the package was at 0.24.5, which made every
 * `--version` output and any future attestation provenance wrong.
 *
 * `createRequire` is used rather than an ESM JSON import so this works on
 * Node 18 without import-attribute flags, and resolves correctly both from
 * `dist/` in a published install and from `src/` under vitest.
 */

import { createRequire } from 'module';

interface PackageManifest {
  name?: string;
  version?: string;
}

/**
 * Resolve `package.json` relative to this module. In a published package this
 * file is `dist/version.js`, so the manifest is one directory up; under vitest
 * it is `src/version.ts`, and the manifest is likewise one directory up.
 */
function readManifest(): PackageManifest {
  const require = createRequire(import.meta.url);
  return require('../package.json') as PackageManifest;
}

/** The canonical vlayer version, as declared in package.json. */
export function getVersion(): string {
  const version = readManifest().version;
  if (!version) {
    throw new Error('[vlayer] package.json is missing a "version" field');
  }
  return version;
}

/** The canonical package name, as declared in package.json. */
export function getPackageName(): string {
  return readManifest().name ?? 'verification-layer';
}
