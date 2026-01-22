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
];
