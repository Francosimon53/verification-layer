/**
 * Canonical JSON serialization (RFC 8785 / JCS subset).
 *
 * The bytes produced here ARE the signed payload: `.vlayer/attestation.json`
 * is written as `canonicalize(statement)`, and Sigstore signs those exact
 * bytes. Verification re-reads the file as-is, so any byte-level difference —
 * a reordered key, an inserted space, a changed digit — invalidates the
 * signature. Nothing in this module may depend on JavaScript object insertion
 * order.
 *
 * JCS subset, deliberately narrowed:
 *   - object keys sorted ascending by UTF-16 code unit
 *   - arrays preserve order (ordering is imposed at CONSTRUCTION time and is
 *     semantic — findings by fingerprint, controls by control id, etc.)
 *   - `undefined` and absent optional fields are OMITTED, never emitted as
 *     null, so a value has exactly one representation
 *   - INTEGERS ONLY. The attestation schema enforces `z.int()` on every numeric
 *     field, which removes JCS's float-serialization edge cases entirely rather
 *     than relying on a serializer to get them right. A non-integer reaching
 *     this function is a bug and throws.
 *   - no NaN/Infinity (unrepresentable in JSON, and rejected explicitly)
 */

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(`[vlayer:canonical] ${message}`);
    this.name = 'CanonicalizationError';
  }
}

/** A value that canonicalize() accepts. */
export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue | undefined };

function canonicalizeValue(value: CanonicalValue, path: string): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';

    case 'number': {
      if (!Number.isFinite(value)) {
        throw new CanonicalizationError(`non-finite number at ${path}: ${String(value)}`);
      }
      if (!Number.isInteger(value)) {
        throw new CanonicalizationError(
          `non-integer number at ${path}: ${value}. The attestation schema permits ` +
          `integers only — express fractions as scaled integers (e.g. permille).`,
        );
      }
      if (!Number.isSafeInteger(value)) {
        throw new CanonicalizationError(`integer exceeds safe range at ${path}: ${value}`);
      }
      // Integers in the safe range have exactly one JSON representation.
      // Normalize -0 to 0 so the two spellings cannot produce different bytes.
      return String(value === 0 ? 0 : value);
    }

    case 'string':
      // JSON.stringify implements the JSON string escaping JCS requires,
      // including surrogate handling, for a lone string value.
      return JSON.stringify(value);

    case 'object': {
      if (Array.isArray(value)) {
        const items = value.map((item, index) => {
          if (item === undefined) {
            throw new CanonicalizationError(`undefined array element at ${path}[${index}]`);
          }
          return canonicalizeValue(item, `${path}[${index}]`);
        });
        return `[${items.join(',')}]`;
      }

      const record = value as { [key: string]: CanonicalValue | undefined };
      // Sort by UTF-16 code unit, which is what String comparison does in JS
      // and what JCS specifies.
      const keys = Object.keys(record).sort();
      const parts: string[] = [];
      for (const key of keys) {
        const entry = record[key];
        // OMIT undefined — one representation per value.
        if (entry === undefined) continue;
        parts.push(`${JSON.stringify(key)}:${canonicalizeValue(entry, `${path}.${key}`)}`);
      }
      return `{${parts.join(',')}}`;
    }

    default:
      throw new CanonicalizationError(
        `unsupported value type "${typeof value}" at ${path}`,
      );
  }
}

/**
 * Serialize a value to canonical JSON. Compact (no whitespace), sorted keys,
 * no trailing newline. This is the exact byte sequence written to disk and
 * signed.
 */
export function canonicalize(value: CanonicalValue): string {
  if (value === undefined) {
    throw new CanonicalizationError('cannot canonicalize undefined at root');
  }
  return canonicalizeValue(value, '$');
}

/** Canonical bytes (UTF-8) — the Sigstore signing payload. */
export function canonicalBytes(value: CanonicalValue): Buffer {
  return Buffer.from(canonicalize(value), 'utf-8');
}
