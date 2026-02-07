/**
 * HIPAA 2026 Security Rule Detection Patterns
 * Covers 15 technical requirements (all now "required" instead of "addressable")
 * Expected enforcement: May 2026
 */

import type { Finding } from '../../types.js';

export interface HIPAA2026Pattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[]; // Patterns that indicate compliance
  autoFix?: string;
  confidence: 'high' | 'medium' | 'low';
  category: string;
}

/**
 * HIPAA-MFA-001: Multi-Factor Authentication Enforcement
 */
export const MFA_PATTERNS: HIPAA2026Pattern = {
  id: 'HIPAA-MFA-001',
  name: 'Missing Multi-Factor Authentication for PHI Access',
  description: 'Endpoints accessing PHI must enforce MFA. All auth configs must require multi-factor authentication.',
  severity: 'critical',
  hipaaReference: '45 CFR §164.312(a)(2)(i) - Access Control (Required)',
  patterns: [
    // Login/auth without MFA
    /(?:login|authenticate|signin|auth).*?(?:patient|phi|medical|health)(?!.*?(?:mfa|multi.?factor|2fa|totp|authenticator))/i,
    // Auth configs without MFA
    /(?:passport|auth0|okta|cognito)\.(?:use|configure).*?(?!.*?(?:mfa|multiFactor|requireMFA))/i,
    // Admin endpoints without MFA
    /\/admin.*?(?:patient|medical|phi)(?!.*?(?:mfa|2fa))/i,
    // Session creation without MFA
    /createSession.*?(?:user|admin)(?!.*?mfaVerified)/i,
    // JWT without MFA claim
    /jwt\.sign\(.*?(?:patient|phi)(?!.*?mfaVerified)/i,
  ],
  negativePatterns: [
    /requireMFA:\s*true/i,
    /mfaVerified/i,
    /authenticator\.verify/i,
    /totp\.validate/i,
  ],
  autoFix: 'Add MFA enforcement: requireMFA: true, verify TOTP/authenticator before granting access',
  confidence: 'high',
  category: 'access-control',
};

/**
 * HIPAA-ENC-REST-001: Encryption at Rest
 */
export const ENCRYPTION_AT_REST_PATTERNS: HIPAA2026Pattern = {
  id: 'HIPAA-ENC-REST-001',
  name: 'ePHI Stored Without Encryption at Rest',
  description: 'All ePHI must be encrypted at rest using AES-256 or stronger.',
  severity: 'critical',
  hipaaReference: '45 CFR §164.312(a)(2)(iv) - Encryption (Required)',
  patterns: [
    // Database without encryption
    /(?:mongoose|sequelize|typeorm|prisma)\.(?:connect|createConnection).*?(?!.*?(?:encrypt|ssl|tls))/i,
    // File storage without encryption
    /(?:fs\.writeFile|writeFileSync|s3\.putObject).*?(?:patient|phi|medical)(?!.*?(?:encrypt|cipher))/i,
    // LocalStorage with PHI
    /localStorage\.setItem.*?(?:patient|ssn|mrn|phi)/i,
    // Cookie with PHI unencrypted
    /(?:res\.cookie|setCookie).*?(?:patient|phi|medical)(?!.*?(?:encrypt|secure|httpOnly))/i,
    // MongoDB without encryption
    /MongoClient\.connect.*?(?!.*?(?:ssl|tls|encryption))/i,
    // PostgreSQL without encryption
    /(?:pg|postgres)\.(?:connect|Pool).*?(?!.*?ssl)/i,
  ],
  negativePatterns: [
    /encrypt:\s*true/i,
    /ssl:\s*true/i,
    /cipher\./i,
    /aes-256/i,
  ],
  autoFix: 'Enable encryption at rest: Set encrypt: true in DB config, use crypto.cipher for file storage',
  confidence: 'high',
  category: 'encryption',
};

/**
 * HIPAA-SESSION-001: Automatic Session Timeout
 */
export const SESSION_TIMEOUT_PATTERNS: HIPAA2026Pattern = {
  id: 'HIPAA-SESSION-001',
  name: 'Missing Automatic Session Timeout',
  description: 'PHI access sessions must auto-expire within 15 minutes of inactivity.',
  severity: 'high',
  hipaaReference: '45 CFR §164.312(a)(2)(iii) - Session Control (Required)',
  patterns: [
    // Session config without expiration
    /(?:express-session|session)\.(?:configure|use)(?!.*?(?:maxAge|expires|timeout))/i,
    // Session with timeout > 15 min (900000 ms)
    /maxAge:\s*(?:9[0-9]{5}[0-9]+|[1-9][0-9]{6,})/i,
    // JWT without expiration
    /jwt\.sign\([^)]*(?!.*?expiresIn)/i,
    // Cookie session without expiration
    /cookie-session.*?(?!.*?maxAge)/i,
    // Missing idle timeout
    /session.*?(?!.*?(?:idle|inactivity).*?timeout)/i,
  ],
  negativePatterns: [
    /maxAge:\s*[1-8][0-9]{5}/i, // <= 900000 (15 min)
    /expiresIn:\s*['"](?:1[0-5]m|[1-9]m)['"]/i,
    /idleTimeout/i,
  ],
  autoFix: 'Set session timeout: maxAge: 900000 (15 min), implement idle timeout detector',
  confidence: 'high',
  category: 'access-control',
};

/**
 * HIPAA-REVOKE-001: Immediate Access Revocation
 */
export const ACCESS_REVOCATION_PATTERNS: HIPAA2026Pattern = {
  id: 'HIPAA-REVOKE-001',
  name: 'Missing Immediate Access Revocation',
  description: 'User deactivation must immediately invalidate all sessions and tokens.',
  severity: 'critical',
  hipaaReference: '45 CFR §164.308(a)(3)(ii)(C) - Termination Procedures (Required)',
  patterns: [
    // Deactivate user without token revocation
    /(?:deactivate|disable|remove)User(?!.*?(?:revoke|invalidate|blacklist).*?(?:token|session))/i,
    // Delete user without session cleanup
    /(?:deleteUser|removeUser).*?(?!.*?(?:logout|invalidate|clearSessions))/i,
    // Missing token blacklist
    /(?:user|admin).*?(?:deactivat|terminat).*?(?!.*?blacklist)/i,
    // Role change without re-auth
    /(?:updateRole|changePermissions)(?!.*?(?:logout|reauth|invalidate))/i,
  ],
  negativePatterns: [
    /revokeAllTokens/i,
    /invalidateAllSessions/i,
    /tokenBlacklist\.add/i,
    /clearUserSessions/i,
  ],
  autoFix: 'Add token revocation: Call revokeAllTokens() and invalidateAllSessions() on user deactivation',
  confidence: 'medium',
  category: 'access-control',
};

/**
 * HIPAA-BREACH-001: 24-Hour Breach Notification
 */
export const BREACH_NOTIFICATION_PATTERNS: HIPAA2026Pattern = {
  id: 'HIPAA-BREACH-001',
  name: 'Missing Breach Notification Mechanism',
  description: 'Must have automated breach detection and notification within 24 hours.',
  severity: 'critical',
  hipaaReference: '45 CFR §164.308(a)(6)(ii) - Security Incident Procedures (Required)',
  patterns: [
    // Security errors without breach handler
    /catch\s*\(.*?error.*?\).*?(?:security|unauthorized|breach)(?!.*?(?:notifyBreach|incidentResponse|alertSecurity))/i,
    // Failed login attempts without monitoring
    /(?:failed|invalid).*?(?:login|auth)(?!.*?(?:monitor|alert|notify))/i,
    // Data access anomaly without alert
    /(?:unusual|suspicious).*?access(?!.*?(?:alert|notify|incident))/i,
  ],
  negativePatterns: [
    /breachNotification\./i,
    /incidentResponse\.trigger/i,
    /securityAlert\.send/i,
    /notifyBreach/i,
  ],
  autoFix: 'Implement breach notification: Create incident response handler, set up 24h alert system',
  confidence: 'medium',
  category: 'audit-logging',
};

/**
 * HIPAA-SEGMENT-001: Network Segmentation
 */
export const NETWORK_SEGMENTATION_PATTERNS: HIPAA2026Pattern = {
  id: 'HIPAA-SEGMENT-001',
  name: 'Missing Network Segmentation for PHI',
  description: 'PHI services must be network-segmented with restricted CORS and firewall rules.',
  severity: 'critical',
  hipaaReference: '45 CFR §164.312(e)(1) - Transmission Security (Required)',
  patterns: [
    // CORS allowing all origins for PHI
    /cors\(\{?\s*origin:\s*['"]?\*['"]?.*?(?:patient|phi|medical)/i,
    // PHI API without network restrictions
    /\/api.*?(?:patient|phi|medical)(?!.*?(?:firewall|vpc|subnet|private))/i,
    // Internal PHI service publicly accessible
    /(?:express|fastify|koa)\.listen.*?(?:patient|phi)(?!.*?(?:localhost|127\.0\.0\.1|private))/i,
    // Missing VPC/subnet config
    /(?:database|storage).*?(?:patient|phi)(?!.*?(?:vpc|subnet|securityGroup))/i,
  ],
  negativePatterns: [
    /origin:\s*\[.*?\]/i, // Whitelist
    /private.*?subnet/i,
    /securityGroup/i,
    /firewall.*?rules/i,
  ],
  autoFix: 'Implement network segmentation: Use VPC/subnet isolation, restrict CORS to whitelisted origins',
  confidence: 'high',
  category: 'access-control',
};

/**
 * HIPAA-ASSET-001: Technology Asset Inventory
 * Special pattern - triggers asset inventory generation
 */
export const ASSET_INVENTORY_PATTERNS: HIPAA2026Pattern = {
  id: 'HIPAA-ASSET-001',
  name: 'Generate ePHI Technology Asset Inventory',
  description: 'Automatic inventory of all systems processing, storing, or transmitting ePHI.',
  severity: 'high',
  hipaaReference: '45 CFR §164.308(a)(1)(ii)(A) - Risk Analysis (Required)',
  patterns: [
    // Databases
    /(?:mongoose|sequelize|prisma|typeorm|knex)\.(?:connect|model)/i,
    // Storage services
    /(?:s3|azure\.storage|gcs)\./i,
    // Third-party integrations
    /(?:stripe|twilio|sendgrid|mailgun)\.(?:api|client)/i,
    // APIs
    /(?:axios|fetch|got|request)\./i,
  ],
  autoFix: 'Asset inventory will be generated automatically in scan report',
  confidence: 'high',
  category: 'data-retention',
};

/**
 * HIPAA-FLOW-001: ePHI Flow Mapping
 * Special pattern - triggers flow map generation
 */
export const PHI_FLOW_MAPPING_PATTERNS: HIPAA2026Pattern = {
  id: 'HIPAA-FLOW-001',
  name: 'Generate ePHI Flow Map',
  description: 'Automatic mapping of PHI data flow through system (input → processing → storage → output).',
  severity: 'high',
  hipaaReference: '45 CFR §164.308(a)(1)(ii)(A) - Risk Analysis (Required)',
  patterns: [
    // Input points
    /(?:req\.body|req\.params|req\.query).*?(?:patient|phi|medical)/i,
    // Processing
    /(?:process|transform|validate).*?(?:patient|phi)/i,
    // Storage
    /(?:save|insert|update).*?(?:patient|phi)/i,
    // Output
    /(?:res\.(?:send|json)|return).*?(?:patient|phi)/i,
  ],
  autoFix: 'PHI flow map will be generated automatically in scan report',
  confidence: 'high',
  category: 'data-retention',
};

/**
 * HIPAA-PENTEST-001: Vulnerability Scanning Configuration
 */
export const VULNERABILITY_SCANNING_PATTERNS: HIPAA2026Pattern = {
  id: 'HIPAA-PENTEST-001',
  name: 'Missing Vulnerability Scanning Configuration',
  description: 'Must have automated vulnerability scanning (Dependabot, Snyk, Trivy) in CI/CD.',
  severity: 'high',
  hipaaReference: '45 CFR §164.308(a)(8) - Evaluation (Required)',
  patterns: [
    // Missing security scanning configs
    /package\.json(?!.*?(?:snyk|audit|vulnerability))/i,
  ],
  negativePatterns: [
    /dependabot\.yml/i,
    /snyk\.yml/i,
    /trivy/i,
    /npm audit/i,
    /security.*?scan/i,
  ],
  autoFix: 'Add vulnerability scanning: Enable Dependabot, add Snyk/Trivy to CI/CD pipeline',
  confidence: 'medium',
  category: 'audit-logging',
};

export const ALL_HIPAA_2026_PATTERNS: HIPAA2026Pattern[] = [
  MFA_PATTERNS,
  ENCRYPTION_AT_REST_PATTERNS,
  SESSION_TIMEOUT_PATTERNS,
  ACCESS_REVOCATION_PATTERNS,
  BREACH_NOTIFICATION_PATTERNS,
  NETWORK_SEGMENTATION_PATTERNS,
  ASSET_INVENTORY_PATTERNS,
  PHI_FLOW_MAPPING_PATTERNS,
  VULNERABILITY_SCANNING_PATTERNS,
];
