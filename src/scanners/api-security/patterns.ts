/**
 * API Security Detection Patterns
 * Detects authentication routes without rate limiting, open CORS, and PHI in URLs
 */

export interface ApiSecurityPattern {
  id: string;
  name: string;
  description: string;
  severity: 'high';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  recommendation: string;
  category: string;
}

/**
 * RATE-001: Authentication Routes Without Rate Limiting
 * Detects auth routes without rate limiting middleware
 */
export const AUTH_WITHOUT_RATE_LIMIT: ApiSecurityPattern = {
  id: 'RATE-001',
  name: 'Authentication Routes Without Rate Limiting',
  description:
    'Authentication route (/login, /signin, /auth, /register, /signup, /password-reset, /forgot-password) defined without rate limiting middleware (rateLimit, rateLimiter, throttle, slowDown, @upstash/ratelimit). Vulnerable to brute force attacks.',
  severity: 'high',
  hipaaReference: '45 CFR §164.312(a)(1) - Access Control',
  patterns: [
    // Express routes
    /(?:app|router)\.(?:post|get|put|patch|delete|all)\s*\(\s*['"`]\/(?:api\/)?(?:auth|login|signin|register|signup|password-reset|forgot-password)/i,

    // Next.js API routes in file path - detected separately
    // This pattern won't match but we'll handle it in the scanner

    // Fastify routes
    /fastify\.(?:post|get|route)\s*\(\s*['"`]\/(?:api\/)?(?:auth|login|signin|register|signup|password-reset|forgot-password)/i,

    // Hono routes
    /app\.(?:post|get|put|patch|delete|all)\s*\(\s*['"`]\/(?:api\/)?(?:auth|login|signin|register|signup|password-reset|forgot-password)/i,

    // Generic route definitions
    /route\s*\(\s*['"`]\/(?:api\/)?(?:auth|login|signin|register|signup|password-reset|forgot-password)/i,
  ],
  negativePatterns: [
    // Rate limiting middleware
    /rateLimit/i,
    /rateLimiter/i,
    /rate-limit/i,
    /throttle/i,
    /slowDown/i,
    /slow-down/i,

    // Upstash rate limiting
    /@upstash\/ratelimit/i,
    /upstash.*limit/i,

    // Express rate limit packages
    /express-rate-limit/i,
    /express-slow-down/i,

    // Redis rate limiting
    /redis.*limit/i,

    // Custom rate limit implementations
    /limitAttempts/i,
    /checkRateLimit/i,
    /rateLimitMiddleware/i,
  ],
  recommendation:
    'Add rate limiting middleware to authentication routes. Example: const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }); app.post("/login", limiter, loginHandler). Prevent brute force attacks on auth endpoints.',
  category: 'access-control',
};

/**
 * CORS-001: Open CORS Configuration
 * Detects CORS configured with origin: "*"
 */
export const OPEN_CORS_CONFIGURATION: ApiSecurityPattern = {
  id: 'CORS-001',
  name: 'Open CORS Configuration (origin: "*")',
  description:
    'CORS configured with origin: "*" or Access-Control-Allow-Origin: *. PHI endpoints must restrict access to trusted domains only. Exposes API to cross-origin attacks from any domain.',
  severity: 'high',
  hipaaReference: '45 CFR §164.312(e)(1) - Transmission Security',
  patterns: [
    // cors({ origin: "*" })
    /cors\s*\(\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/i,

    // cors({ origin: '*' })
    /cors\s*\(\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/i,

    // Access-Control-Allow-Origin: *
    /Access-Control-Allow-Origin['"`]?\s*[,:]?\s*['"`]\*/i,

    // setHeader('Access-Control-Allow-Origin', '*')
    /setHeader\s*\(\s*['"`]Access-Control-Allow-Origin['"`]\s*,\s*['"`]\*['"`]/i,

    // res.header('Access-Control-Allow-Origin', '*')
    /\.header\s*\(\s*['"`]Access-Control-Allow-Origin['"`]\s*,\s*['"`]\*['"`]/i,

    // response.headers.set('Access-Control-Allow-Origin', '*')
    /headers\.set\s*\(\s*['"`]Access-Control-Allow-Origin['"`]\s*,\s*['"`]\*['"`]/i,
  ],
  negativePatterns: [
    // Whitelist/allowlist of specific origins
    /allowedOrigins/i,
    /whitelist/i,
    /allowlist/i,
    /trustedOrigins/i,

    // Environment-based origins
    /process\.env/i,
    /env\.[A-Z_]*ORIGIN/i,
    /ALLOWED_ORIGIN/i,

    // Origin validation functions
    /validateOrigin/i,
    /checkOrigin/i,

    // Array of origins (specific domains)
    /\[.*?https?:\/\//i,

    // Public assets (non-PHI endpoints)
    /public/i,
    /assets/i,
    /static/i,
  ],
  recommendation:
    'Restrict CORS to trusted domains. Example: cors({ origin: ["https://app.example.com", "https://admin.example.com"] }) or use environment variables: cors({ origin: process.env.ALLOWED_ORIGINS.split(",") }). Never use origin: "*" for PHI endpoints.',
  category: 'access-control',
};

/**
 * API-001: PHI in URL Query Parameters
 * Detects PHI data passed as URL query parameters
 */
export const PHI_IN_URL_PARAMS: ApiSecurityPattern = {
  id: 'API-001',
  name: 'PHI Data in URL Query Parameters',
  description:
    'PHI data (ssn, dob, patient_name, patientName, diagnosis, medication, mrn, health_record) passed as URL query parameters (?ssn=, &dob=). URLs are logged by servers, proxies, and browsers, exposing PHI in logs.',
  severity: 'high',
  hipaaReference: '45 CFR §164.312(a)(1) - Access Control',
  patterns: [
    // Query parameter construction with PHI
    /\?ssn=/i,
    /&ssn=/i,
    /\?dob=/i,
    /&dob=/i,
    /\?patient[-_]?name=/i,
    /&patient[-_]?name=/i,
    /\?patientName=/i,
    /&patientName=/i,
    /\?diagnosis=/i,
    /&diagnosis=/i,
    /\?medication=/i,
    /&medication=/i,
    /\?mrn=/i,
    /&mrn=/i,
    /\?health[-_]?record=/i,
    /&health[-_]?record=/i,

    // Template literals with PHI in query
    /`[^`]*\?[^`]*(?:ssn|dob|patient[-_]?name|patientName|diagnosis|medication|mrn|health[-_]?record)=/i,

    // URLSearchParams with PHI
    /(?:params|searchParams|query)\.(?:append|set)\s*\(\s*['"`](?:ssn|dob|patient[-_]?name|patientName|diagnosis|medication|mrn|health[-_]?record)['"`]/i,
  ],
  negativePatterns: [
    // POST request body (safe)
    /\.post\s*\(/i,
    /\.put\s*\(/i,
    /\.patch\s*\(/i,
    /body:/i,
    /data:/i,

    // Request body
    /req\.body/i,
    /request\.body/i,

    // Comments or documentation
    /\/\//,
    /\/\*/,
    /example/i,
    /TODO/i,

    // Test files
    /\.test\./i,
    /\.spec\./i,
    /describe\(/i,
  ],
  recommendation:
    'Never pass PHI in URL query parameters. Use POST request body instead. Example: Instead of GET /api/patient?ssn=123-45-6789, use POST /api/patient with body: { ssn: "123-45-6789" }. URLs are logged in server logs, proxy logs, and browser history.',
  category: 'phi-exposure',
};

export const ALL_API_SECURITY_PATTERNS: ApiSecurityPattern[] = [
  AUTH_WITHOUT_RATE_LIMIT,
  OPEN_CORS_CONFIGURATION,
  PHI_IN_URL_PARAMS,
];
