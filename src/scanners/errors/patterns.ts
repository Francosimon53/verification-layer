/**
 * Error Handling Security Detection Patterns
 * Detects unsafe error responses and PHI in error logs
 */

export interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[]; // Patterns that indicate safe usage
  recommendation: string;
  category: string;
}

/**
 * ERROR-001: Unsanitized Error Details Sent to User
 * Detects error.stack or error.message sent directly in responses
 */
export const UNSANITIZED_ERROR_RESPONSE: ErrorPattern = {
  id: 'ERROR-001',
  name: 'Unsanitized Error Details Sent to User',
  description:
    'Response sends error.stack or error.message directly to user without sanitization, potentially exposing sensitive system information',
  severity: 'high',
  hipaaReference: '45 CFR §164.312(b) - Audit Controls',
  patterns: [
    // res.send/json with error.stack
    /res\.(?:send|json)\s*\([^)]*err(?:or)?\.stack/i,

    // res.send/json with error.message
    /res\.(?:send|json)\s*\([^)]*err(?:or)?\.message/i,

    // res.send/json with error object directly (just the variable)
    /res\.(?:send|json)\s*\(\s*err(?:or)?\s*\)/i,

    // return error object directly
    /return.*?res\.(?:send|json)\s*\(\s*err(?:or)?\s*\)/i,

    // Response with error details
    /response\.(?:send|json)\s*\([^)]*err(?:or)?\.(?:stack|message)/i,

    // Next.js/Express error handlers
    /next\s*\(\s*err(?:or)?\s*\)/i,

    // throw error with stack
    /throw.*?err(?:or)?\.stack/i,
  ],
  negativePatterns: [
    // Sanitized error messages
    /sanitize/i,
    /safe.*?error/i,
    /filterError/i,

    // Generic user-friendly messages
    /['"](?:An error occurred|Internal server error|Something went wrong)/i,

    // Logging (not sending to user)
    /console\./i,
    /logger\./i,
    /log\(/i,

    // Development environment checks
    /process\.env\.NODE_ENV\s*===?\s*['"]development['"]/i,
    /isDevelopment/i,
  ],
  recommendation:
    'Never send error.stack or error.message directly to users. Use generic error messages for production. Example: res.status(500).json({ error: "An error occurred" }). Log detailed errors server-side only.',
  category: 'audit-logging',
};

/**
 * ERROR-002: PHI in Error Logs/Throws
 * Detects PHI data in console.log, logger, or throw Error
 */
export const PHI_IN_ERROR_LOGS: ErrorPattern = {
  id: 'ERROR-002',
  name: 'PHI Data in Error Logs or Thrown Errors',
  description:
    'Protected Health Information (patient, ssn, dob, mrn, diagnosis, medication, healthRecord) exposed in console logs, logger, or thrown errors',
  severity: 'critical',
  hipaaReference: '45 CFR §164.312(c) - Integrity Controls',
  patterns: [
    // console.* with PHI
    /console\.(?:log|error|warn|info|debug)\s*\([^)]*(?:patient|ssn|dob|mrn|diagnosis|medication|health[-_]?record)/i,

    // logger.* with PHI
    /logger\.(?:error|warn|info|debug|log)\s*\([^)]*(?:patient|ssn|dob|mrn|diagnosis|medication|health[-_]?record)/i,

    // throw Error with PHI
    /throw\s+(?:new\s+)?Error\s*\([^)]*(?:patient|ssn|dob|mrn|diagnosis|medication|health[-_]?record)/i,

    // log.* with PHI (Winston, Bunyan, etc.)
    /log\.(?:error|warn|info|debug)\s*\([^)]*(?:patient|ssn|dob|mrn|diagnosis|medication|health[-_]?record)/i,

    // console with patient data object
    /console\.[a-z]+\s*\([^)]*patient(?:Data|Info|Record|Object)/i,

    // logger with health record
    /logger\.[a-z]+\s*\([^)]*health[-_]?record/i,
  ],
  negativePatterns: [
    // Redacted or masked PHI
    /redact/i,
    /mask/i,
    /sanitize/i,
    /obfuscate/i,

    // Generic messages without actual data
    /['"]Patient not found['"]/i,
    /['"]Invalid patient ID['"]/i,
    /['"]Health record/i,

    // Patient ID only (not full PHI)
    /patient[-_]?id\b/i,

    // Test files
    /\.test\./i,
    /\.spec\./i,
    /describe\(/i,
  ],
  recommendation:
    'Never log PHI in error messages. Redact sensitive data before logging. Example: logger.error("Error processing patient", { patientId: redact(patient.id) }). Use patient IDs only, never full PHI.',
  category: 'phi-exposure',
};

export const ALL_ERROR_PATTERNS: ErrorPattern[] = [
  UNSANITIZED_ERROR_RESPONSE,
  PHI_IN_ERROR_LOGS,
];
