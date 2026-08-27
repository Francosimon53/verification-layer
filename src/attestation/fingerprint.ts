/**
 * Stable finding identity.
 *
 * PRIVACY FIRST. A SHA-256 over a raw line of code is NOT a privacy control:
 * a low-entropy line (`const ssn = "123-45-6789"`) is guessable by anyone who
 * can enumerate candidates. So the PRE-IMAGE itself must be free of sensitive
 * content, and hashing is only a size/format convenience.
 *
 * `structure` is therefore a REDACTED STRUCTURAL SIGNATURE, not a hash of
 * source. Before anything is hashed:
 *   1. comments are stripped;
 *   2. every string / template / numeric literal and every long base64-or-hex
 *      run is replaced by a placeholder — this is where PHI, secrets, tokens
 *      and patient identifiers are destroyed;
 *   3. every identifier NOT on a fixed allowlist of language keywords and
 *      well-known security-relevant API names is replaced by `I` — variable,
 *      function, table and column names can all carry patient or business
 *      identifiers, so none of them survive.
 *
 * A representative pre-image is `console.log(S,I.I)`: grammar plus allowlisted
 * API names. Recovering it reveals nothing the rule id does not already state.
 *
 * The same normalization is what makes the fingerprint STABLE: it survives
 * renames, reformatting and value changes, which is exactly the cross-release
 * continuity property the evidence model needs. Privacy and stability point the
 * same way here.
 *
 * TWO IDENTITIES:
 *   fingerprint — rule + path + structure. Line-INDEPENDENT. The continuity key
 *                 that follows an issue across releases as code moves.
 *   locationId  — rule + path + line. Exact site, no source content at all.
 */

import { createHash } from 'crypto';
import { canonicalize } from './canonical.js';

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Identifiers that may survive normalization. These are language keywords and
 * API names that ALREADY appear literally in vlayer's own detection patterns,
 * so publishing their presence discloses nothing beyond the rule that matched.
 * Anything not listed here is erased.
 */
const ALLOWED_IDENTIFIERS = new Set<string>([
  // Language keywords / literals
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'def',
  'default', 'delete', 'do', 'elif', 'else', 'end', 'export', 'extends', 'false',
  'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'is',
  'let', 'new', 'nil', 'none', 'not', 'null', 'or', 'and', 'pass', 'private',
  'protected', 'public', 'raise', 'require', 'return', 'self', 'static', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'void',
  'while', 'with', 'yield', 'lambda', 'func', 'package', 'interface', 'type',
  // Logging / output sinks
  'console', 'log', 'info', 'warn', 'error', 'debug', 'trace', 'print', 'println',
  'printf', 'logger', 'winston', 'pino', 'bunyan', 'morgan', 'log4js', 'loguru',
  // Crypto
  'crypto', 'createHash', 'createCipher', 'createCipheriv', 'createDecipher',
  'md5', 'sha1', 'sha256', 'des', 'rc4', 'ecb', 'aes', 'digest', 'hash', 'cipher',
  'bcrypt', 'argon2', 'scrypt', 'pbkdf2', 'randomBytes',
  // Storage / transport
  'localStorage', 'sessionStorage', 'setItem', 'getItem', 'cookie', 'cookies',
  'fetch', 'axios', 'http', 'https', 'url', 'href', 'location', 'window',
  'document', 'innerHTML', 'outerHTML', 'dangerouslySetInnerHTML', 'eval',
  // Data access
  'select', 'insert', 'update', 'delete', 'query', 'exec', 'execute', 'find',
  'findOne', 'findMany', 'create', 'save', 'remove', 'destroy', 'drop', 'truncate',
  'raw', 'prisma', 'mongoose', 'knex', 'sequelize', 'supabase',
  // Auth / access control
  'auth', 'authenticate', 'authorize', 'login', 'logout', 'session', 'token',
  'jwt', 'verify', 'sign', 'role', 'roles', 'admin', 'isAdmin', 'permission',
  'permissions', 'cors', 'origin', 'allowOrigin', 'bypass', 'mfa', 'otp',
  // Common member accessors that carry no user data on their own
  'body', 'params', 'headers', 'req', 'res', 'request', 'response', 'env',
  'process', 'config', 'options', 'data', 'value', 'key', 'name', 'id',
]);

const PLACEHOLDER_IDENTIFIER = 'I';

/**
 * Reduce a single line of source to a redacted structural token string.
 * Exported for tests, which assert directly that no literal or non-allowlisted
 * identifier survives.
 */
export function structuralSignature(line: string): string | null {
  if (typeof line !== 'string') return null;

  let s = line;

  // 1. Strip comments (line comments in JS/TS/Go/Java, Python/Ruby/shell, and
  //    any block comment remnant on this line).
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s.replace(/(^|[^:])\/\/.*$/, '$1 ');
  s = s.replace(/#.*$/, ' ');

  // 2. Destroy ALL literal content before anything else is examined.
  //    Template literals first (they can contain quotes).
  s = s.replace(/`(?:\\.|[^`\\])*`/g, 'T');
  s = s.replace(/"(?:\\.|[^"\\])*"/g, 'S');
  s = s.replace(/'(?:\\.|[^'\\])*'/g, 'S');
  //    Long opaque runs (base64 / hex secrets) that were not quoted.
  s = s.replace(/\b[A-Za-z0-9+/_-]{16,}={0,2}\b/g, (match) =>
    /^[0-9]+$/.test(match) ? 'N' : 'B',
  );
  //    Numeric literals, including hex/float/exponent forms.
  s = s.replace(/\b0[xX][0-9a-fA-F]+\b/g, 'N');
  s = s.replace(/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, 'N');

  // 3. Erase every identifier not on the allowlist.
  s = s.replace(/[A-Za-z_$][A-Za-z0-9_$]*/g, (token) => {
    if (token === 'S' || token === 'T' || token === 'N' || token === 'B') return token;
    return ALLOWED_IDENTIFIERS.has(token) ? token : PLACEHOLDER_IDENTIFIER;
  });

  // 4. Collapse whitespace; keep punctuation and operators (the grammar).
  s = s.replace(/\s+/g, '').trim();

  if (s.length === 0) return null;

  // 5. Bound the pre-image.
  return s.slice(0, 120);
}

export interface FingerprintInput {
  /** Canonical rule id, or null when rule identity is unknown. */
  ruleId: string | null;
  /** Repository-relative POSIX path, or null for project-level findings. */
  path: string | null;
  kind: 'file' | 'project';
  /** The anchor line's source, if available. NEVER the surrounding context. */
  anchorLine?: string | null;
}

export interface FindingIdentity {
  fingerprint: string;
  locationId: string;
  /** False when no structural signature could be derived (coarser identity). */
  structureAvailable: boolean;
}

/**
 * Compute both identities for a finding.
 *
 * `line` participates ONLY in `locationId`. The fingerprint deliberately omits
 * it so an unrelated edit above a finding does not break continuity.
 */
export function computeFindingIdentity(
  input: FingerprintInput,
  line: number | null,
): FindingIdentity {
  const structure =
    input.kind === 'project' || !input.anchorLine
      ? null
      : structuralSignature(input.anchorLine);

  const fingerprint = sha256(
    canonicalize({
      v: 1,
      rule: input.ruleId,
      path: input.path,
      kind: input.kind,
      // A 32-char digest of the redacted token string. The token string itself
      // is already free of literals and non-allowlisted identifiers.
      structure: structure === null ? null : sha256(structure).slice(0, 32),
    } as never),
  );

  const locationId = sha256(
    canonicalize({
      v: 1,
      rule: input.ruleId,
      path: input.path,
      line,
    } as never),
  );

  return { fingerprint, locationId, structureAvailable: structure !== null };
}

/**
 * The legacy baseline hash (`src/baseline.ts`), recomputed over the
 * REPOSITORY-RELATIVE path.
 *
 * The legacy function hashes the ABSOLUTE path and the rule title, so its
 * output is machine-specific and drifts when prose is edited — it cannot enter
 * a shareable attestation. This variant keeps the same construction and width
 * so the value is recognizable, while being portable. It will NOT match a
 * `.vlayer-baseline.json` generated on a different machine; that is documented.
 */
export function baselineHashRelative(
  relativePath: string | null,
  line: number | null,
  emittedId: string,
  title: string,
): string {
  const key = `${relativePath ?? ''}:${line ?? 0}:${emittedId}:${title}`;
  return createHash('sha256').update(key).digest('hex').substring(0, 16);
}
