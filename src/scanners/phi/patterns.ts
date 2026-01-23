import type { Severity, FixType } from '../../types.js';

interface PHIPattern {
  id: string;
  regex: RegExp;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  fixType?: FixType;
}

export const PHI_PATTERNS: PHIPattern[] = [
  // === SSN and identifiers ===
  {
    id: 'ssn-hardcoded',
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
    severity: 'critical',
    title: 'Potential SSN detected',
    description: 'A pattern matching Social Security Number format was found in the code.',
    recommendation: 'Remove hardcoded SSN. Use secure storage and encryption for sensitive identifiers.',
  },
  {
    id: 'medical-record-number',
    regex: /\b(mrn|medical.?record.?number)\s*[:=]\s*['"`]\d+['"`]/i,
    severity: 'high',
    title: 'Medical Record Number exposure',
    description: 'A hardcoded medical record number was detected.',
    recommendation: 'Never hardcode MRNs. Fetch from secure, encrypted storage.',
  },
  {
    id: 'dob-exposed',
    regex: /\b(date.?of.?birth|dob|birth.?date)\s*[:=]\s*['"`]/i,
    severity: 'high',
    title: 'Date of birth exposure',
    description: 'Date of birth information may be hardcoded or improperly handled.',
    recommendation: 'Encrypt DOB at rest and in transit. Apply minimum necessary principle.',
  },
  {
    id: 'diagnosis-code',
    regex: /\b(icd.?10|diagnosis.?code|icd.?code)\s*[:=]\s*['"`][A-Z]\d{2}/i,
    severity: 'medium',
    title: 'Diagnosis code in source',
    description: 'ICD-10 diagnosis codes found in source code.',
    recommendation: 'Load diagnosis codes from secure configuration, not source code.',
  },
  {
    id: 'phi-in-url',
    regex: /\/(patient|user)\/\d+\/(ssn|dob|mrn|diagnosis)/i,
    severity: 'high',
    title: 'PHI identifier in URL pattern',
    description: 'URL pattern suggests PHI may be exposed in URLs.',
    recommendation: 'Never include PHI in URLs. Use opaque tokens or encrypted identifiers.',
  },

  // === PHI Logging Detection ===
  {
    id: 'patient-name-log',
    regex: /console\.(log|info|debug|warn|error)\s*\([^)]*patient.*name/i,
    severity: 'high',
    title: 'Patient name in console output',
    description: 'Patient names may be logged to console, exposing PHI.',
    recommendation: 'Remove patient identifiers from logs. Use anonymized IDs for debugging.',
    fixType: 'phi-console-log',
  },
  {
    id: 'phi-console-log',
    regex: /console\.(log|info|debug|warn|error)\s*\([^)]*(ssn|social.?security|diagnosis|medical.?record|health.?info|patient.?data|dob|birth.?date)/i,
    severity: 'high',
    title: 'PHI data in console output',
    description: 'Sensitive health information may be logged to console.',
    recommendation: 'Never log PHI to console. Use structured logging with PHI redaction.',
    fixType: 'phi-console-log',
  },
  {
    id: 'phi-json-stringify-log',
    regex: /console\.(log|info|debug)\s*\(\s*JSON\.stringify\s*\([^)]*patient/i,
    severity: 'high',
    title: 'Patient object serialized to console',
    description: 'Patient objects are being serialized and logged, potentially exposing all PHI fields.',
    recommendation: 'Create a sanitized version of patient objects for logging, excluding PHI fields.',
    fixType: 'phi-console-log',
  },
  {
    id: 'phi-template-log',
    regex: /console\.(log|info|debug)\s*\(\s*`[^`]*(patient|ssn|diagnosis|dob|\$\{.*patient)/i,
    severity: 'high',
    title: 'PHI in template literal log',
    description: 'Template literal logging may expose PHI data.',
    recommendation: 'Avoid interpolating PHI into log messages.',
    fixType: 'phi-console-log',
  },

  // === Insecure Storage Detection ===
  {
    id: 'phi-localstorage',
    regex: /localStorage\.(setItem|getItem)\s*\(\s*['"`][^'"`]*(patient|ssn|diagnosis|medical|health|dob|mrn)/i,
    severity: 'critical',
    title: 'PHI stored in localStorage',
    description: 'PHI data is being stored in localStorage which is not encrypted and persists indefinitely.',
    recommendation: 'Never store PHI in localStorage. Use encrypted server-side storage with proper access controls.',
  },
  {
    id: 'phi-sessionstorage',
    regex: /sessionStorage\.(setItem|getItem)\s*\(\s*['"`][^'"`]*(patient|ssn|diagnosis|medical|health|dob|mrn)/i,
    severity: 'high',
    title: 'PHI stored in sessionStorage',
    description: 'PHI data is being stored in sessionStorage which is not encrypted.',
    recommendation: 'Avoid storing PHI in browser storage. Use secure, encrypted server-side sessions.',
  },
  {
    id: 'phi-cookie-storage',
    regex: /document\.cookie\s*=.*?(patient|ssn|diagnosis|medical|health|dob|mrn)/i,
    severity: 'critical',
    title: 'PHI stored in cookies',
    description: 'PHI data may be stored in browser cookies without encryption.',
    recommendation: 'Never store PHI in cookies. Use encrypted server-side sessions with secure, httpOnly cookies for session IDs only.',
  },
  {
    id: 'phi-indexeddb',
    regex: /indexedDB|IDBDatabase.*?(patient|health|medical|diagnosis)/i,
    severity: 'high',
    title: 'PHI potentially stored in IndexedDB',
    description: 'PHI may be stored in IndexedDB which lacks built-in encryption.',
    recommendation: 'If using IndexedDB for PHI, implement client-side encryption and proper key management.',
  },

  // === Email and contact PHI ===
  {
    id: 'email-phi-context',
    regex: /patient.*email|email.*patient/i,
    severity: 'medium',
    title: 'Patient email handling detected',
    description: 'Code handles patient email addresses which are PHI.',
    recommendation: 'Ensure patient emails are encrypted and access is logged.',
  },
  {
    id: 'phone-phi-context',
    regex: /patient.*(phone|mobile|cell)|phone.*patient/i,
    severity: 'medium',
    title: 'Patient phone handling detected',
    description: 'Code handles patient phone numbers which are PHI.',
    recommendation: 'Ensure patient contact info is encrypted and access is logged.',
  },
  {
    id: 'address-phi-context',
    regex: /patient.*(address|street|city|zip)|address.*patient/i,
    severity: 'medium',
    title: 'Patient address handling detected',
    description: 'Code handles patient addresses which are PHI.',
    recommendation: 'Ensure patient addresses are encrypted and access is logged.',
  },

  // === PHI in URL Query Parameters ===
  {
    id: 'phi-query-param',
    regex: /[?&](ssn|social.?security|patient.?id|mrn|dob|birth.?date|diagnosis|medical.?record)=/i,
    severity: 'critical',
    title: 'PHI in URL query parameter',
    description: 'PHI identifiers are being passed as URL query parameters, which may be logged in server logs, browser history, and referrer headers.',
    recommendation: 'Never pass PHI in URLs. Use POST requests with encrypted body or session-based lookups.',
  },
  {
    id: 'phi-url-interpolation',
    regex: /\$\{[^}]*(ssn|patientId|mrn|dob|diagnosis)[^}]*\}.*[?&]/i,
    severity: 'critical',
    title: 'PHI interpolated into URL',
    description: 'PHI values are being interpolated into URLs, exposing sensitive data.',
    recommendation: 'Use opaque tokens or encrypted references instead of PHI in URLs.',
  },
  {
    id: 'phi-fetch-url',
    regex: /fetch\s*\(\s*`[^`]*[?&](patient|ssn|mrn|dob)/i,
    severity: 'high',
    title: 'PHI in fetch URL',
    description: 'Fetch request URL contains PHI identifiers.',
    recommendation: 'Pass PHI in request body with proper encryption, not in URLs.',
  },

  // === PHI in HTTP Headers ===
  {
    id: 'phi-header-set',
    regex: /setHeader\s*\(\s*['"`][^'"`]*(patient|ssn|mrn|dob|diagnosis|medical)/i,
    severity: 'critical',
    title: 'PHI in HTTP header',
    description: 'PHI data is being set in HTTP headers, which may be logged or cached.',
    recommendation: 'Never transmit PHI in HTTP headers. Use encrypted request/response body.',
  },
  {
    id: 'phi-header-object',
    regex: /headers\s*[:=]\s*\{[^}]*(patient|ssn|mrn|dob|diagnosis|x-patient|x-medical)/i,
    severity: 'critical',
    title: 'PHI in headers object',
    description: 'Headers object contains PHI-related fields.',
    recommendation: 'Remove PHI from headers. Transmit sensitive data in encrypted request body only.',
  },
  {
    id: 'phi-authorization-header',
    regex: /authorization.*patient|patient.*authorization/i,
    severity: 'high',
    title: 'Patient data in authorization context',
    description: 'Patient identifiers may be exposed in authorization headers.',
    recommendation: 'Use opaque session tokens for authorization, not patient identifiers.',
  },

  // === PHI in Email ===
  {
    id: 'phi-email-body',
    regex: /(sendMail|sendEmail|send_email|mailer\.send)\s*\([^)]*patient/i,
    severity: 'high',
    title: 'PHI in email content',
    description: 'Patient data may be included in email body, which is typically unencrypted.',
    recommendation: 'Avoid sending PHI via email. Use secure patient portals with authentication.',
  },
  {
    id: 'phi-email-template',
    regex: /(email|mail).*template.*patient|patient.*(email|mail).*template/i,
    severity: 'high',
    title: 'PHI in email template',
    description: 'Email templates may contain patient data placeholders.',
    recommendation: 'Do not include PHI in email templates. Send secure links to authenticated portals instead.',
  },
  {
    id: 'phi-email-subject',
    regex: /subject\s*[:=].*patient|subject.*diagnosis|subject.*medical/i,
    severity: 'medium',
    title: 'Potential PHI in email subject',
    description: 'Email subject lines may contain patient-related information.',
    recommendation: 'Keep email subjects generic. Never include patient names, diagnoses, or identifiers.',
  },

  // === PHI Logging Without Redaction ===
  {
    id: 'phi-logger-unredacted',
    regex: /logger\.(info|debug|warn|error)\s*\([^)]*patient(?!.*redact|.*mask|.*sanitize)/i,
    severity: 'high',
    title: 'PHI logged without redaction',
    description: 'Patient data is being logged without apparent redaction or masking.',
    recommendation: 'Implement PHI redaction in logging. Use structured logging with automatic PII masking.',
  },
  {
    id: 'phi-log-file',
    regex: /writeFile.*log.*patient|patient.*writeFile.*log/i,
    severity: 'high',
    title: 'PHI written to log file',
    description: 'Patient data may be written directly to log files.',
    recommendation: 'Use structured logging with PHI redaction. Never write raw PHI to log files.',
  },
  {
    id: 'phi-debug-output',
    regex: /debug\s*[:=]\s*true.*patient|patient.*debug\s*[:=]\s*true/i,
    severity: 'medium',
    title: 'Debug mode with patient data',
    description: 'Debug mode enabled in code handling patient data may expose PHI.',
    recommendation: 'Ensure debug logging excludes PHI or uses proper redaction.',
  },
];
