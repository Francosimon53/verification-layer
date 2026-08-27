/**
 * Verify a VLayer attestation.
 *
 * FOUR INDEPENDENT VERDICTS, never collapsed into one word:
 *
 *   schema     — is this a well-formed VLayer Attestation V1?
 *   subject    — does it describe the repository at --path? (skipped without it)
 *   signature  — not_provided | valid | invalid | not_verifiable
 *   policy     — the conclusion the attestation itself recorded
 *
 * An unsigned attestation is a legitimate, complete artifact. It is reported as
 * `signature: not_provided`, and the phrase "cryptographically verified" is
 * never used for it. If Sigstore cannot run at all, the verdict is
 * `not_verifiable` — never `valid`, and never silently downgraded to unsigned.
 *
 * The bytes verified are the bytes the CALLER supplied, read from disk verbatim.
 * They are never re-serialized or normalized before verification, so a single
 * changed byte fails cryptographically.
 */

import { readFile } from 'fs/promises';
import { VlayerStatementV1Schema, formatSchemaErrors } from './schema.js';
import { verifySignature } from './sign.js';
import { getGitTarget } from './git.js';
import type { Bundle } from './types-sigstore.js';
import type { VerificationResult, VlayerStatementV1 } from './types.js';

export interface VerifyOptions {
  /** Path to the attestation JSON. */
  attestationPath: string;
  /** Path to a Sigstore bundle. Omitted ⇒ signature: 'not_provided'. */
  bundlePath?: string;
  /** Repository to check the subject against. Omitted ⇒ subject: 'not_checked'. */
  repositoryPath?: string;
}

export interface VerifyOutcome extends VerificationResult {
  /** The parsed statement, when the schema is valid. */
  statement: VlayerStatementV1 | null;
}

export async function verifyAttestation(options: VerifyOptions): Promise<VerifyOutcome> {
  // Read the file EXACTLY as it is on disk. This buffer is what the signature
  // must cover; re-serializing it here would defeat the whole point.
  const bytes = await readFile(options.attestationPath);

  const outcome: VerifyOutcome = {
    schema: 'invalid',
    schemaErrors: [],
    subject: 'not_checked',
    subjectDetail: null,
    signature: 'not_provided',
    signatureDetail: null,
    signerIdentity: null,
    policy: null,
    policyReasons: [],
    statement: null,
  };

  // --- 1. Schema -----------------------------------------------------------
  // The three verdicts are INDEPENDENT: a file that fails schema validation must
  // still have its signature checked, because "the schema broke" and "the bytes
  // were tampered with" are different findings and a reviewer needs both. An
  // early return here would report a tampered attestation as `not_provided`.
  let statement: VlayerStatementV1 | null = null;
  try {
    const raw: unknown = JSON.parse(bytes.toString('utf-8'));
    const parsed = VlayerStatementV1Schema.safeParse(raw);
    if (parsed.success) {
      statement = parsed.data as unknown as VlayerStatementV1;
      outcome.schema = 'valid';
      outcome.statement = statement;
      outcome.policy = statement.predicate.policy.conclusion;
      outcome.policyReasons = statement.predicate.policy.reasons;
    } else {
      outcome.schemaErrors = formatSchemaErrors(parsed.error);
    }
  } catch (error) {
    outcome.schemaErrors = [
      `<root>: not valid JSON (${error instanceof Error ? error.message : 'parse error'})`,
    ];
  }

  // --- 2. Subject ----------------------------------------------------------
  // Only meaningful against a parsed statement; reported as not_checked otherwise.
  if (options.repositoryPath && statement) {
    try {
      const { target } = await getGitTarget(options.repositoryPath, { allowDirty: true });
      if (target.commit !== statement.predicate.target.commit) {
        outcome.subject = 'mismatch';
        outcome.subjectDetail =
          `attestation describes commit ${statement.predicate.target.commit}, ` +
          `repository HEAD is ${target.commit}`;
      } else if (
        !statement.predicate.target.dirty &&
        target.tree !== statement.predicate.target.tree
      ) {
        outcome.subject = 'mismatch';
        outcome.subjectDetail =
          `attestation describes tree ${statement.predicate.target.tree}, ` +
          `repository tree is ${target.tree}`;
      } else {
        outcome.subject = 'valid';
        outcome.subjectDetail = `commit ${target.commit}`;
      }
    } catch (error) {
      outcome.subject = 'mismatch';
      outcome.subjectDetail = error instanceof Error ? error.message : 'could not read repository';
    }
  }

  // --- 3. Signature --------------------------------------------------------
  if (options.bundlePath) {
    let bundle: Bundle;
    try {
      bundle = JSON.parse(await readFile(options.bundlePath, 'utf-8')) as Bundle;
    } catch (error) {
      outcome.signature = 'invalid';
      outcome.signatureDetail = `bundle could not be read: ${
        error instanceof Error ? error.message : 'unknown error'
      }`;
      return outcome;
    }

    try {
      const { identity } = await verifySignature(bundle, bytes);
      outcome.signature = 'valid';
      outcome.signerIdentity = identity;
      outcome.signatureDetail = identity
        ? `signature verified over ${bytes.length} bytes, signed by ${identity}`
        : `signature verified over ${bytes.length} bytes`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown verification error';
      // Distinguish "Sigstore could not run" from "the signature is bad". The
      // former must never be reported as valid, and must never be quietly
      // downgraded to unsigned either.
      if (error instanceof Error && error.name === 'SigningUnavailableError') {
        outcome.signature = 'not_verifiable';
        outcome.signatureDetail = message;
      } else {
        outcome.signature = 'invalid';
        outcome.signatureDetail = message;
      }
    }
  }

  return outcome;
}

/** Exit code for `vlayer verify`. Non-zero when anything failed to verify. */
export function verifyExitCode(outcome: VerifyOutcome): number {
  if (outcome.schema !== 'valid') return 1;
  if (outcome.subject === 'mismatch') return 1;
  if (outcome.signature === 'invalid' || outcome.signature === 'not_verifiable') return 1;
  if (outcome.policy === 'fail') return 1;
  return 0;
}
