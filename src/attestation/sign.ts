/**
 * Sigstore signing over the EXACT canonical attestation bytes.
 *
 * TWO LAYERS, deliberately not merged:
 *
 *   A. VLayer semantic attestation — the in-toto Statement v1 JSON. That JSON
 *      IS the attestation; there is no second semantic envelope.
 *
 *   B. Sigstore cryptographic proof — a bundle produced by `sigstore.sign()`
 *      over the exact bytes written to `.vlayer/attestation.json`.
 *
 * `sigstore.attest()` (DSSE) is NOT used. DSSE embeds a copy of the payload
 * inside the bundle, and `verify(bundle)` then checks that embedded copy — so a
 * swapped `attestation.json` would still verify against a bundle describing a
 * different statement. `sign()` commits to the artifact bytes themselves, and
 * `verify(bundle, bytes)` cannot succeed without them. Tampering with a single
 * byte therefore fails verification cryptographically, with no separate
 * equality check to trust.
 *
 * Signing is OPTIONAL. An unsigned attestation is complete and meaningful; it
 * simply reports `signature: not_provided`.
 *
 * IDENTITY: sigstore-js 5.x resolves an OIDC identity through `CIContextProvider`
 * ONLY. That provider reads GitHub Actions' `ACTIONS_ID_TOKEN_REQUEST_URL` /
 * `ACTIONS_ID_TOKEN_REQUEST_TOKEN`, or a pre-obtained `SIGSTORE_ID_TOKEN`. There
 * is no interactive browser or device-code flow in this library — that lives in
 * cosign and sigstore-python. Verified against sigstore@5.0.0.
 *
 * REQUESTED-BUT-FAILED IS NOT UNSIGNED. If a caller asks for a signature and one
 * cannot be produced, `vlayer attest` writes NOTHING and exits with
 * SIGNING_FAILED_EXIT_CODE. See that constant for why.
 */

import type { Bundle } from './types-sigstore.js';

/**
 * Exit code for "a signature was requested and could not be produced".
 *
 * Distinct from 1 (general failure) so a script can tell the two apart without
 * parsing prose: `--sign` that exits 3 means the attestation was built but is
 * unsigned and was NOT written. Unsigned-BY-REQUEST is exit 0 with an
 * attestation present and no bundle; signing-FAILED is exit 3 with neither file.
 */
export const SIGNING_FAILED_EXIT_CODE = 3;

/** Stable machine-readable marker printed on stderr when signing fails. */
export const SIGNING_FAILED_MARKER = 'vlayer:signing-failed';

export class SigningUnavailableError extends Error {
  constructor(cause: string) {
    super(
      `[vlayer] Cryptographic signing is unavailable: ${cause}\n` +
      `Sigstore keyless signing needs an AMBIENT OIDC identity. sigstore-js ships only a\n` +
      `CI identity provider — there is NO local interactive browser flow (that exists in\n` +
      `cosign and sigstore-python, not in this library).\n` +
      `  Supported:  GitHub Actions with 'permissions: { id-token: write }'.\n` +
      `  Advanced:   export SIGSTORE_ID_TOKEN=<a Sigstore-acceptable OIDC token> and re-run.`,
    );
    this.name = 'SigningUnavailableError';
  }
}

export class DirtySigningError extends Error {
  constructor() {
    super(
      `[vlayer] Refusing to sign an attestation for a dirty working tree.\n` +
      `A signature asserts an identity over an immutable source snapshot; a dirty ` +
      `tree has none. Commit your changes, then run 'vlayer attest . --sign'.`,
    );
    this.name = 'DirtySigningError';
  }
}

/** Loaded lazily so importing the attestation module never pulls in Sigstore. */
async function loadSigstore(): Promise<typeof import('sigstore')> {
  try {
    return await import('sigstore');
  } catch (error) {
    throw new SigningUnavailableError(
      `the "sigstore" package could not be loaded (${error instanceof Error ? error.message : 'unknown error'})`,
    );
  }
}

export interface SignOptions {
  /** True when the attestation describes a dirty tree. Signing is then refused. */
  dirty: boolean;
}

/**
 * Sign the canonical attestation bytes, returning a Sigstore bundle.
 *
 * @param bytes  the EXACT bytes written to .vlayer/attestation.json
 */
export async function signAttestation(bytes: Buffer, options: SignOptions): Promise<Bundle> {
  // A dirty attestation is never signable. Enforced here as well as in the CLI
  // so a programmatic caller cannot bypass it.
  if (options.dirty) throw new DirtySigningError();

  const sigstore = await loadSigstore();
  try {
    return (await sigstore.sign(bytes)) as unknown as Bundle;
  } catch (error) {
    throw new SigningUnavailableError(
      error instanceof Error ? error.message : 'unknown signing error',
    );
  }
}

/**
 * Verify a Sigstore bundle against the exact attestation bytes.
 *
 * Returns the bound signer identity on success. Throws on any failure — the
 * caller maps that to `signature: 'invalid'`. There is deliberately no path
 * that reports success without the bytes.
 */
export async function verifySignature(
  bundle: Bundle,
  bytes: Buffer,
): Promise<{ identity: string | null }> {
  const sigstore = await loadSigstore();
  // The payload argument is REQUIRED for a sign()-produced bundle: this is what
  // binds the signature to the bytes the reviewer is actually reading. The cast
  // is confined to this one call — vlayer treats the bundle as opaque elsewhere,
  // since inspecting it would mean re-implementing verification.
  type SerializedBundle = Parameters<typeof sigstore.verify>[0];
  const signer = (await sigstore.verify(bundle as unknown as SerializedBundle, bytes)) as unknown;
  return { identity: extractIdentity(signer) };
}

/** Best-effort human-readable signer identity for display. */
function extractIdentity(signer: unknown): string | null {
  if (!signer || typeof signer !== 'object') return null;
  const record = signer as Record<string, unknown>;
  const identity = record.identity ?? record.subject ?? record.subjectAlternativeName;
  if (typeof identity === 'string') return identity;
  const cert = record.certificate as Record<string, unknown> | undefined;
  if (cert && typeof cert.subjectAlternativeName === 'string') return cert.subjectAlternativeName;
  return null;
}
