/**
 * Token Revocation Security Detection Patterns
 * Detects JWT usage without revocation mechanisms and excessive token expiration
 */

export interface RevocationPattern {
  id: string;
  name: string;
  description: string;
  severity: 'high' | 'medium';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  recommendation: string;
  category: string;
}

/**
 * REVOKE-001: JWT Without Server-Side Revocation Mechanism
 * Detects JWT usage without revocation support
 */
export const JWT_WITHOUT_REVOCATION: RevocationPattern = {
  id: 'REVOKE-001',
  name: 'JWT Without Server-Side Revocation Mechanism',
  description:
    'JWT token generation (jwt.sign, jsonwebtoken, jose) without server-side revocation mechanism (revoke, blacklist, allowlist, tokenStore, invalidate, denylist). HIPAA NPRM requires ability to revoke access within 1 hour.',
  severity: 'high',
  hipaaReference: 'NPRM §164.308(a)(3)(ii)(C) - Access Revocation',
  patterns: [
    // jwt.sign() calls
    /jwt\.sign\s*\(/i,

    // jsonwebtoken.sign() calls
    /jsonwebtoken\.sign\s*\(/i,

    // jose sign methods
    /new\s+(?:SignJWT|CompactSign)\s*\(/i,
    /jose\.(?:SignJWT|sign)/i,

    // JWT token generation
    /(?:create|generate)(?:Access)?Token\s*\([^)]*\)/i,

    // Sign JWT patterns
    /\.sign\s*\([^)]*jwt/i,
  ],
  negativePatterns: [
    // Revocation mechanisms
    /revoke/i,
    /blacklist/i,
    /allowlist/i,
    /whitelist/i,
    /denylist/i,
    /tokenStore/i,
    /invalidate/i,
    /revokedTokens/i,
    /tokenBlacklist/i,
    /redis/i, // Common for token storage
    /session/i, // Session-based auth has built-in revocation

    // Database token storage
    /tokenRepository/i,
    /saveToken/i,
    /storeToken/i,

    // Revocation libraries
    /express-jwt-blacklist/i,
    /jwt-redis/i,

    // Comments indicating revocation is handled elsewhere
    /revocation.*handled/i,
    /revoke.*separate/i,
  ],
  recommendation:
    'Implement server-side token revocation mechanism. Store active tokens in Redis/database with TTL, or maintain a blacklist of revoked tokens. Example: await redis.set(`token:${userId}`, token, "EX", 3600); await redis.del(`token:${userId}`) to revoke. HIPAA requires ability to revoke access within 1 hour.',
  category: 'access-control',
};

/**
 * REVOKE-002: Excessive Token Expiration Time
 * Detects tokens with expirations longer than recommended
 */
export const EXCESSIVE_TOKEN_EXPIRATION: RevocationPattern = {
  id: 'REVOKE-002',
  name: 'Excessive Token Expiration Time',
  description:
    'JWT token with excessive expiration time. Access tokens should expire within 24 hours (expiresIn: "24h" or less). Refresh tokens should not exceed 7 days for sensitive data.',
  severity: 'medium',
  hipaaReference: 'NPRM §164.308(a)(3)(ii)(C) - Access Revocation',
  patterns: [
    // expiresIn with excessive time
    // Days: 2d, 3d, 7d, 30d, 90d, etc. (more than 1 day)
    /expiresIn\s*:\s*['"`](?:[2-9]|[1-9]\d+)d['"`]/i,

    // Hours: 25h, 48h, 72h, etc. (more than 24 hours)
    /expiresIn\s*:\s*['"`](?:2[5-9]|[3-9]\d|\d{3,})h['"`]/i,

    // Weeks, years (w, y - note: m in JWT means minutes, not months)
    /expiresIn\s*:\s*['"`]\d+[wy]['"`]/i,

    // Months (spelled out)
    /expiresIn\s*:\s*['"`]\d+\s*(?:month|months|mo)['"`]/i,

    // Numeric seconds: more than 86400 (24 hours)
    /expiresIn\s*:\s*(?:8[7-9]\d{3}|\d{6,})\b/i,

    // maxAge with excessive time (more than 7 days = 604800000 ms)
    /maxAge\s*:\s*(?:6[1-9]\d{7}|[7-9]\d{8}|\d{9,})\b/i,

    // exp claim with far future timestamps (common mistake)
    /exp\s*:\s*Math\.floor\s*\([^)]*\+\s*(?:2[5-9]|[3-9]\d|\d{3,})\s*\*\s*(?:60\s*\*\s*60|3600)/i,
  ],
  negativePatterns: [
    // Acceptable expirations for access tokens (1h - 24h)
    /expiresIn\s*:\s*['"`](?:1?\d|2[0-4])h['"`]/i,
    /expiresIn\s*:\s*['"`]1d['"`]/i,

    // Minutes (m in JWT means minutes, not months)
    /expiresIn\s*:\s*['"`]\d+m['"`]/i,

    // Seconds (s)
    /expiresIn\s*:\s*['"`]\d+s['"`]/i,

    // Acceptable numeric values (up to 24 hours = 86400 seconds)
    /expiresIn\s*:\s*(?:[1-7]\d{3}|[1-8][0-5]\d{3}|86[0-3]\d{2}|8640{1,2})\b/i,

    // Refresh tokens (explicitly marked as such)
    /refresh.*token/i,
    /refreshToken/i,

    // Remember me tokens (longer expiration is acceptable)
    /remember.*me/i,
    /rememberMe/i,

    // API keys (different from access tokens)
    /api.*key/i,
    /apiKey/i,
  ],
  recommendation:
    'Use short-lived access tokens (≤ 24 hours): expiresIn: "1h" or expiresIn: "15m". For longer sessions, implement refresh token rotation. Example: accessToken with expiresIn: "1h", refreshToken with expiresIn: "7d". Reduce attack window if token is compromised.',
  category: 'access-control',
};

export const ALL_REVOCATION_PATTERNS: RevocationPattern[] = [
  JWT_WITHOUT_REVOCATION,
  EXCESSIVE_TOKEN_EXPIRATION,
];
