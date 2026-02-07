/**
 * Configuration Security Detection Patterns
 * Detects insecure configuration settings and missing security controls
 */

export interface ConfigurationPattern {
  id: string;
  name: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  recommendation: string;
  category: string;
}

/**
 * CONFIG-001: Debug/Verbose Mode Without Environment Gate
 * Detects debug/verbose flags enabled without NODE_ENV check
 */
export const DEBUG_WITHOUT_ENV_GATE: ConfigurationPattern = {
  id: 'CONFIG-001',
  name: 'Debug/Verbose Mode Without Environment Gate',
  description:
    'Debug or verbose mode enabled (debug:true, DEBUG:true, verbose:true, devTools:true) without NODE_ENV environment gate. May expose sensitive information in production.',
  severity: 'high',
  hipaaReference: 'NPRM Configuration Management',
  patterns: [
    // debug: true
    /\bdebug\s*:\s*true\b/i,

    // DEBUG: true (environment variable style)
    /\bDEBUG\s*:\s*true\b/,

    // verbose: true
    /\bverbose\s*:\s*true\b/i,

    // devTools: true
    /\bdevTools\s*:\s*true\b/i,

    // debug = true
    /\bdebug\s*=\s*true\b/i,

    // process.env.DEBUG = 'true'
    /process\.env\.DEBUG\s*=\s*['"]true['"]/i,
  ],
  negativePatterns: [
    // Environment checks
    /NODE_ENV/i,
    /process\.env\.NODE_ENV/i,
    /isDevelopment/i,
    /isProduction/i,
    /\.env\s*===?\s*['"]development['"]/i,
    /\.env\s*!==?\s*['"]production['"]/i,

    // Conditional logic
    /if\s*\(/i,
    /\?\s*true\s*:\s*false/i,

    // Test files
    /\.test\./i,
    /\.spec\./i,
    /describe\(/i,
    /it\(/i,

    // Type definitions
    /interface\s+/i,
    /type\s+\w+\s*=/i,

    // Comments (at start of line or after whitespace)
    /^\s*\/\//,
    /^\s*\/\*/,
  ],
  recommendation:
    'Gate debug/verbose modes with environment checks. Example: debug: process.env.NODE_ENV === "development", or use environment variables: debug: process.env.DEBUG === "true". Never hardcode debug:true in production config.',
  category: 'audit-logging',
};

/**
 * CONFIG-002: Web Server Without Security Headers
 * Detects web servers created without helmet or security headers middleware
 */
export const SERVER_WITHOUT_SECURITY_HEADERS: ConfigurationPattern = {
  id: 'CONFIG-002',
  name: 'Web Server Without Security Headers Middleware',
  description:
    'Web server created (express(), createServer, new Hono, new Elysia) without helmet() or security headers middleware (CSP, X-Frame-Options, X-Content-Type-Options). Missing security headers expose app to XSS, clickjacking, and MIME sniffing attacks.',
  severity: 'medium',
  hipaaReference: 'NPRM Configuration Management',
  patterns: [
    // Express app creation
    /(?:const|let|var)\s+\w+\s*=\s*express\s*\(\s*\)/i,

    // HTTP server creation
    /(?:http|https)\.createServer\s*\(/i,

    // Hono
    /new\s+Hono\s*\(/i,

    // Elysia
    /new\s+Elysia\s*\(/i,

    // Fastify
    /fastify\s*\(\s*\{/i,

    // Koa
    /new\s+Koa\s*\(/i,
  ],
  negativePatterns: [
    // Helmet middleware
    /helmet\s*\(/i,
    /app\.use\s*\(\s*helmet/i,

    // Security headers
    /Content-Security-Policy/i,
    /X-Frame-Options/i,
    /X-Content-Type-Options/i,
    /Strict-Transport-Security/i,
    /X-XSS-Protection/i,

    // Header setting methods
    /setHeader\s*\(/i,
    /\.set\s*\(\s*['"]X-Frame-Options['"]/i,
    /\.header\s*\(/i,

    // Security middleware
    /cors\s*\(/i,
    /compression\s*\(/i,

    // Configuration objects with security
    /security/i,
  ],
  recommendation:
    'Add helmet middleware for Express: app.use(helmet()), or set security headers manually: res.setHeader("X-Frame-Options", "DENY"); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Content-Security-Policy", "default-src \'self\'"). Use helmet for comprehensive security headers.',
  category: 'audit-logging',
};

/**
 * CONFIG-003: Test Framework Imports in Production Code
 * Detects test framework imports in non-test files
 */
export const TEST_IMPORTS_IN_PRODUCTION: ConfigurationPattern = {
  id: 'CONFIG-003',
  name: 'Test Framework Imports in Production Code',
  description:
    'Test framework imports (jest, vitest, mocha, chai, faker, cypress) found in production code (non-test files). Test frameworks should only be imported in test files (*.test.*, *.spec.*).',
  severity: 'low',
  hipaaReference: 'NPRM Configuration Management',
  patterns: [
    // Jest
    /import\s+.*?from\s+['"]@?jest/i,
    /require\s*\(\s*['"]@?jest/i,

    // Vitest
    /import\s+.*?from\s+['"]vitest['"]/i,
    /require\s*\(\s*['"]vitest['"]/i,

    // Mocha
    /import\s+.*?from\s+['"]mocha['"]/i,
    /require\s*\(\s*['"]mocha['"]/i,

    // Chai
    /import\s+.*?from\s+['"]chai['"]/i,
    /require\s*\(\s*['"]chai['"]/i,

    // Faker
    /import\s+.*?from\s+['"]@?faker/i,
    /require\s*\(\s*['"]@?faker/i,

    // Cypress
    /import\s+.*?from\s+['"]cypress['"]/i,
    /require\s*\(\s*['"]cypress['"]/i,

    // Testing Library
    /import\s+.*?from\s+['"]@testing-library/i,
    /require\s*\(\s*['"]@testing-library/i,
  ],
  negativePatterns: [
    // This pattern will be checked in the scanner by filename, not content
  ],
  recommendation:
    'Remove test framework imports from production code. Test frameworks should only be imported in test files (*.test.ts, *.spec.js, etc.). Move test utilities to separate test helper files.',
  category: 'audit-logging',
};

export const ALL_CONFIGURATION_PATTERNS: ConfigurationPattern[] = [
  DEBUG_WITHOUT_ENV_GATE,
  SERVER_WITHOUT_SECURITY_HEADERS,
  TEST_IMPORTS_IN_PRODUCTION,
];
