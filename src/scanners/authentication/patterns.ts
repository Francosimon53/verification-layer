/**
 * Multi-Factor Authentication (MFA) Detection Patterns
 * Enforces MFA requirements per HIPAA NPRM §164.312(d)
 */

export interface MFAPattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[]; // Patterns that indicate compliance
  recommendation: string;
  category: string;
}

/**
 * MFA-001: Auth Provider Configuration Without MFA
 * Detects NextAuth, Clerk, Auth0, Supabase Auth configs without MFA enabled
 */
export const AUTH_CONFIG_NO_MFA: MFAPattern = {
  id: 'MFA-001',
  name: 'Authentication Configuration Without MFA Enabled',
  description:
    'Auth provider configuration (NextAuth, Clerk, Auth0, Supabase) does not have MFA/2FA/TOTP enabled',
  severity: 'critical',
  hipaaReference: 'NPRM §164.312(d) - Person or Entity Authentication',
  patterns: [
    // NextAuth configuration
    /NextAuth\s*\(/i,
    /export\s+(?:default\s+)?NextAuth/i,
    /authOptions\s*[:=]/i,

    // Clerk configuration
    /ClerkProvider/i,
    /clerk\.(?:setup|configure)/i,

    // Auth0 configuration
    /Auth0Provider/i,
    /auth0\.WebAuth/i,
    /new\s+Auth0Client/i,

    // Supabase Auth configuration
    /supabase\.auth\.signUp/i,
    /createClient.*?supabase/i,

    // Generic auth configs
    /authConfig\s*[:=]/i,
    /authentication\s*:\s*\{/i,
  ],
  negativePatterns: [
    // Indicators that MFA is enabled
    /mfa/i,
    /2fa/i,
    /totp/i,
    /otp/i,
    /multiFactor/i,
    /multi[-_]factor/i,
    /twoFactor/i,
    /two[-_]factor/i,
    /authenticator/i,
  ],
  recommendation:
    'Enable MFA in your auth provider configuration. For NextAuth: add adapter with MFA support. For Clerk: enable MFA in dashboard. For Auth0: enable MFA in tenant settings. For Supabase: enable MFA in auth settings.',
  category: 'authentication',
};

/**
 * MFA-002: Login Flow Without Second Factor
 * Detects signIn/login with only email+password without MFA verification
 */
export const LOGIN_NO_SECOND_FACTOR: MFAPattern = {
  id: 'MFA-002',
  name: 'Login Flow Without Second Factor Authentication',
  description:
    'Login/sign-in flow authenticates with only email and password without requiring second factor verification',
  severity: 'high',
  hipaaReference: 'NPRM §164.312(d) - Person or Entity Authentication',
  patterns: [
    // signIn with email+password
    /(?:signIn|login|authenticate)\s*\([^)]*(?:email|username)[^)]*password/i,
    /(?:signIn|login|authenticate)\s*\(\s*\{[^}]*(?:email|username)[^}]*password[^}]*\}/i,

    // Credentials-based auth without MFA
    /credentials\s*:\s*\{[^}]*(?:email|username)[^}]*password[^}]*\}/i,

    // Direct password authentication
    /(?:email|username)\s*,\s*password\s*\)/i,
    /password\s*,\s*(?:email|username)\s*\)/i,
  ],
  negativePatterns: [
    // Indicators of MFA verification
    /mfaToken/i,
    /totpCode/i,
    /verificationCode/i,
    /twoFactorCode/i,
    /authenticatorCode/i,
    /otp/i,
    /mfaVerified/i,
    /requireMfa/i,
    /checkMfa/i,
    /verifyMfa/i,
  ],
  recommendation:
    'Add second factor verification to login flow. After successful password authentication, require MFA token/TOTP code before granting access. Example: if (user.mfaEnabled && !mfaToken) return { error: "MFA required" }',
  category: 'authentication',
};

/**
 * MFA-003: MFA Bypass in Code
 * Detects code that explicitly bypasses or disables MFA requirements
 */
export const MFA_BYPASS: MFAPattern = {
  id: 'MFA-003',
  name: 'MFA Bypass Detected in Code',
  description:
    'Code explicitly bypasses, skips, or disables MFA requirements',
  severity: 'critical',
  hipaaReference: 'NPRM §164.312(d) - Person or Entity Authentication',
  patterns: [
    // Explicit bypass functions
    /skipMfa/i,
    /bypassMfa/i,
    /disableMfa/i,
    /ignoreMfa/i,

    // MFA disabled in config
    /mfaEnabled\s*[:=]\s*false/i,
    /requireMfa\s*[:=]\s*false/i,
    /require(?:Two|2)Factor\s*[:=]\s*false/i,
    /mfa\s*:\s*\{\s*enabled\s*:\s*false/i,
    /twoFactor\s*:\s*false/i,

    // Conditional bypass
    /if\s*\([^)]*skip.*mfa/i,
    /if\s*\([^)]*!.*(?:mfa|2fa|totp)/i,

    // Environment-based bypass (common anti-pattern)
    /process\.env\.(?:SKIP|DISABLE|BYPASS).*MFA/i,
  ],
  negativePatterns: [
    // Valid use cases (testing, error messages)
    /\/\/.*test/i,
    /\/\*.*test/i,
    /describe\(/i,
    /it\(/i,
    /test\(/i,
    /\.test\./i,
    /\.spec\./i,
    /console\.(?:log|warn|error)/i,
    /throw.*error/i,
  ],
  recommendation:
    'Remove MFA bypass code. MFA should be mandatory for all users accessing PHI. If testing is needed, use proper test isolation instead of disabling MFA in production code.',
  category: 'authentication',
};

export const ALL_MFA_PATTERNS: MFAPattern[] = [
  AUTH_CONFIG_NO_MFA,
  LOGIN_NO_SECOND_FACTOR,
  MFA_BYPASS,
];
