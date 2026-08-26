/**
 * Minimal structural type for a Sigstore bundle.
 *
 * Declared locally rather than imported from `sigstore` so that the attestation
 * types, the schema and the verifier stay importable without loading the
 * Sigstore package (which is only needed when signing or verifying a signature).
 * The bundle is treated as an opaque, serializable value; vlayer never inspects
 * its internals, because doing so would be re-implementing verification.
 */
export interface Bundle {
  mediaType?: string;
  [key: string]: unknown;
}
