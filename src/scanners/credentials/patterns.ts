/**
 * Credential Security Detection Patterns
 * Detects weak password hashing, hardcoded credentials, and exposed secrets
 */

export interface CredentialPattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[]; // Patterns that indicate compliance/safe usage
  recommendation: string;
  category: string;
}

/**
 * CRED-001: Weak Password Hashing Algorithm
 * Detects MD5, SHA1, SHA256 for password hashing instead of bcrypt/argon2/scrypt
 */
export const WEAK_PASSWORD_HASH: CredentialPattern = {
  id: 'CRED-001',
  name: 'Weak Password Hashing Algorithm Detected',
  description:
    'Using MD5, SHA1, or SHA256 for password hashing instead of secure algorithms like bcrypt, argon2, or scrypt',
  severity: 'critical',
  hipaaReference: '45 CFR §164.312(d) - Person or Entity Authentication',
  patterns: [
    // crypto.createHash with weak algorithms near password
    /createHash\s*\(\s*['"`](?:md5|sha1|sha-?1|sha256|sha-?256)['"`]\s*\)/i,

    // hashlib with weak algorithms (Python)
    /hashlib\.(?:md5|sha1|sha256)\s*\(/i,

    // Direct mentions of weak hashing for passwords
    /(?:md5|sha1|sha256).*?(?:password|pass|pwd|hash)/i,
    /(?:password|pass|pwd).*?(?:md5|sha1|sha256)/i,
  ],
  negativePatterns: [
    // Secure algorithms
    /bcrypt/i,
    /argon2/i,
    /scrypt/i,
    /pbkdf2/i,

    // Comments explaining not to use MD5
    /\/\/.*(?:don't|do not|avoid|never).*md5/i,
    /\/\*.*(?:don't|do not|avoid|never).*md5/i,

    // Non-password use cases (checksums, file hashing)
    /checksum/i,
    /file.*hash/i,
    /integrity/i,
  ],
  recommendation:
    'Use bcrypt, argon2, or scrypt for password hashing. Example: await bcrypt.hash(password, 10) or await argon2.hash(password). Never use MD5, SHA1, or simple SHA256 for passwords.',
  category: 'encryption',
};

/**
 * CRED-002: Hardcoded Credentials in Code
 * Detects credentials assigned to string literals
 */
export const HARDCODED_CREDENTIALS: CredentialPattern = {
  id: 'CRED-002',
  name: 'Hardcoded Credentials Detected',
  description:
    'Credentials (password, apiKey, secret, token, connectionString) hardcoded as string literals instead of using environment variables',
  severity: 'critical',
  hipaaReference: '45 CFR §164.312(a)(2)(i) - Unique User Identification',
  patterns: [
    // Password assignments to string literals (8+ chars)
    /(?:password|passwd|pwd)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,

    // API keys
    /(?:api[-_]?key|apikey)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,

    // Secrets
    /(?:secret|private[-_]?key|privatekey)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,

    // Tokens
    /(?:token|auth[-_]?token|access[-_]?token)\s*[:=]\s*['"`][^'"`]{16,}['"`]/i,

    // Connection strings
    /(?:connection[-_]?string|connectionstring|database[-_]?url)\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,

    // Bearer tokens
    /['"`]Bearer\s+[A-Za-z0-9_\-\.]{16,}['"`]/i,

    // AWS/Service keys
    /(?:aws|service|client)[-_]?(?:key|secret)\s*[:=]\s*['"`][A-Za-z0-9+/]{20,}['"`]/i,
  ],
  negativePatterns: [
    // Environment variables
    /process\.env/i,
    /import\.meta\.env/i,
    /env\./i,
    /ENV\[/i,
    /getenv/i,

    // Placeholders
    /your[-_]?(?:key|secret|password|token)/i,
    /(?:placeholder|example|dummy|test|sample)/i,
    /changeme/i,
    /replace[-_]?(?:this|me)/i,
    /(?:xxx|yyy|zzz)/i,

    // Empty or template strings
    /['"]\s*['"]/i,
    /\$\{/i, // Template literals

    // Comments
    /\/\//i,
    /\/\*/i,
  ],
  recommendation:
    'Move credentials to environment variables. Use process.env.PASSWORD or a secure secrets manager. Never commit credentials to source control. Add credentials to .gitignore.',
  category: 'encryption',
};

/**
 * CRED-003: Secrets Exposed via NEXT_PUBLIC_ Prefix
 * Detects sensitive values exposed to client-side via Next.js public env vars
 */
export const NEXT_PUBLIC_SECRETS: CredentialPattern = {
  id: 'CRED-003',
  name: 'Secrets Exposed to Client via NEXT_PUBLIC_ Prefix',
  description:
    'Sensitive credentials exposed to client-side code using NEXT_PUBLIC_ environment variable prefix',
  severity: 'critical',
  hipaaReference: '45 CFR §164.312(a)(2)(i) - Unique User Identification',
  patterns: [
    // NEXT_PUBLIC_SECRET
    /NEXT_PUBLIC_SECRET/i,

    // NEXT_PUBLIC_*KEY
    /NEXT_PUBLIC_.*?KEY/i,

    // NEXT_PUBLIC_*PASSWORD
    /NEXT_PUBLIC_.*?PASSWORD/i,

    // NEXT_PUBLIC_SERVICE_ROLE
    /NEXT_PUBLIC_SERVICE_ROLE/i,

    // NEXT_PUBLIC_*TOKEN
    /NEXT_PUBLIC_.*?TOKEN/i,

    // NEXT_PUBLIC_*PRIVATE*
    /NEXT_PUBLIC_.*?PRIVATE/i,

    // NEXT_PUBLIC_DATABASE
    /NEXT_PUBLIC_DATABASE/i,

    // NEXT_PUBLIC_*ADMIN*
    /NEXT_PUBLIC_.*?ADMIN/i,
  ],
  negativePatterns: [
    // Legitimate public keys
    /NEXT_PUBLIC_(?:SUPABASE|FIREBASE|CLERK)_(?:ANON|PUBLISHABLE)_KEY/i,
    /NEXT_PUBLIC_.*?PUBLISHABLE/i,
    /NEXT_PUBLIC_.*?PUBLIC_KEY/i,

    // Analytics and tracking (safe to expose)
    /NEXT_PUBLIC_(?:GA|GTM|ANALYTICS|MIXPANEL|SEGMENT)_/i,

    // App metadata (safe)
    /NEXT_PUBLIC_(?:APP|SITE|BASE)_(?:URL|NAME|VERSION)/i,

    // Feature flags
    /NEXT_PUBLIC_FEATURE_/i,

    // Comments explaining the issue
    /\/\/.*(?:don't|do not|avoid|never)/i,
  ],
  recommendation:
    'Remove NEXT_PUBLIC_ prefix from sensitive variables. Use server-side environment variables (without NEXT_PUBLIC_) and access them in API routes or getServerSideProps. Only use NEXT_PUBLIC_ for truly public values like API endpoints or publishable keys.',
  category: 'encryption',
};

export const ALL_CREDENTIAL_PATTERNS: CredentialPattern[] = [
  WEAK_PASSWORD_HASH,
  HARDCODED_CREDENTIALS,
  NEXT_PUBLIC_SECRETS,
];
