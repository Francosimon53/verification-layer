import type { Severity } from '../../types.js';

interface PHIPattern {
  id: string;
  regex: RegExp;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
}

export const PHI_PATTERNS: PHIPattern[] = [
  {
    id: 'ssn-hardcoded',
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
    severity: 'critical',
    title: 'Potential SSN detected',
    description: 'A pattern matching Social Security Number format was found in the code.',
    recommendation: 'Remove hardcoded SSN. Use secure storage and encryption for sensitive identifiers.',
  },
  {
    id: 'patient-name-log',
    regex: /console\.(log|info|debug|warn|error)\s*\([^)]*patient.*name/i,
    severity: 'high',
    title: 'Patient name in console output',
    description: 'Patient names may be logged to console, exposing PHI.',
    recommendation: 'Remove patient identifiers from logs. Use anonymized IDs for debugging.',
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
  {
    id: 'email-phi-context',
    regex: /patient.*email|email.*patient/i,
    severity: 'medium',
    title: 'Patient email handling detected',
    description: 'Code handles patient email addresses which are PHI.',
    recommendation: 'Ensure patient emails are encrypted and access is logged.',
  },
];
