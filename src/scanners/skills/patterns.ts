/**
 * AI Agent Skills Security Patterns (HIPAA-focused)
 * Detects vulnerabilities in SKILL.md files for Claude Code, MCP, Cursor, etc.
 */

export interface SkillPattern {
  id: string;
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  hipaaReference?: string;
  category: 'phi-exposure' | 'credential-leak' | 'malicious' | 'hipaa-violation';
}

// PHI Exposure Patterns
export const PHI_EXPOSURE_PATTERNS: SkillPattern[] = [
  {
    id: 'skill-phi-hardcoded-ssn',
    name: 'Hardcoded SSN in skill prompt',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
    severity: 'critical',
    description: 'Social Security Number found in skill definition',
    recommendation: 'Never hardcode PHI in skill prompts. Use placeholders like {{patient_id}} instead.',
    hipaaReference: '§164.502(a) - PHI Use and Disclosure',
    category: 'phi-exposure',
  },
  {
    id: 'skill-phi-patient-name',
    name: 'Patient name in example',
    pattern: /(?:patient|client|user)(?:\s+name)?[:=]\s*['"]?(?!{{)[A-Z][a-z]+\s+[A-Z][a-z]+['"]?/i,
    severity: 'high',
    description: 'Real patient name appears in skill prompt example',
    recommendation: 'Use fictional names (e.g., "John Doe") or template variables {{patient_name}}',
    hipaaReference: '§164.502(a) - PHI Use and Disclosure',
    category: 'phi-exposure',
  },
  {
    id: 'skill-phi-dob',
    name: 'Date of birth in prompt',
    pattern: /(?:dob|date.{0,5}birth|birthdate)[:=]\s*['"]?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}['"]?/i,
    severity: 'high',
    description: 'Date of birth found in skill definition',
    recommendation: 'Use template variable {{date_of_birth}} instead of actual dates',
    hipaaReference: '§164.502(a) - PHI Use and Disclosure',
    category: 'phi-exposure',
  },
  {
    id: 'skill-phi-mrn',
    name: 'Medical Record Number exposed',
    pattern: /(?:mrn|medical.{0,10}record.{0,10}number)[:=]\s*['"]?\d{6,}['"]?/i,
    severity: 'critical',
    description: 'Medical Record Number found in skill prompt',
    recommendation: 'Never include real MRNs. Use {{medical_record_number}} placeholder.',
    hipaaReference: '§164.502(a) - PHI Use and Disclosure',
    category: 'phi-exposure',
  },
  {
    id: 'skill-phi-diagnosis',
    name: 'Diagnosis code in prompt',
    pattern: /(?:diagnosis|icd.?10?|condition)[:=]\s*['"]?[A-Z]\d{2}(?:\.\d{1,2})?['"]?/i,
    severity: 'medium',
    description: 'ICD diagnosis code found in skill example',
    recommendation: 'Use generic examples or template variables for diagnoses',
    hipaaReference: '§164.502(a) - PHI Use and Disclosure',
    category: 'phi-exposure',
  },
];

// Credential Leak Patterns
export const CREDENTIAL_LEAK_PATTERNS: SkillPattern[] = [
  {
    id: 'skill-api-key-exposed',
    name: 'API key in skill configuration',
    pattern: /(?:api.{0,5}key|apikey|access.{0,5}key)[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i,
    severity: 'critical',
    description: 'Hardcoded API key found in skill',
    recommendation: 'Use environment variables: ${ANTHROPIC_API_KEY} or prompt user for keys',
    category: 'credential-leak',
  },
  {
    id: 'skill-aws-credentials',
    name: 'AWS credentials exposed',
    pattern: /(?:AKIA|aws_access_key_id|aws_secret_access_key)[:=\s]['"]?[A-Z0-9]{20,}['"]?/i,
    severity: 'critical',
    description: 'AWS credentials found in skill definition',
    recommendation: 'Never hardcode AWS credentials. Use IAM roles or environment variables.',
    category: 'credential-leak',
  },
  {
    id: 'skill-database-password',
    name: 'Database password in connection string',
    pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:([^@\s]{4,})@/i,
    severity: 'critical',
    description: 'Database password exposed in connection string',
    recommendation: 'Use environment variables: ${DB_PASSWORD} or credential manager',
    category: 'credential-leak',
  },
  {
    id: 'skill-bearer-token',
    name: 'Bearer token hardcoded',
    pattern: /bearer\s+[A-Za-z0-9_\-\.]{20,}/i,
    severity: 'critical',
    description: 'Bearer authentication token found in skill',
    recommendation: 'Tokens should be fetched securely at runtime, not hardcoded',
    category: 'credential-leak',
  },
  {
    id: 'skill-private-key',
    name: 'Private key in skill',
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    severity: 'critical',
    description: 'Private cryptographic key found in skill definition',
    recommendation: 'Never include private keys. Use key management service.',
    category: 'credential-leak',
  },
];

// Malicious Command Patterns
export const MALICIOUS_PATTERNS: SkillPattern[] = [
  {
    id: 'skill-data-exfiltration',
    name: 'Data exfiltration detected',
    pattern: /curl\s+(?:-X\s+POST\s+)?(?:https?:\/\/)?(?!localhost|127\.0\.0\.1|api\.(?:anthropic|openai)\.com)[^\s]+.*?\|/,
    severity: 'critical',
    description: 'Potential data exfiltration via curl to external domain',
    recommendation: 'Review external API calls. Healthcare data should not be sent to unknown endpoints.',
    hipaaReference: '§164.308(a)(4) - Access Controls',
    category: 'malicious',
  },
  {
    id: 'skill-reverse-shell',
    name: 'Reverse shell attempt',
    pattern: /(?:bash|sh|zsh)\s+-[ci]\s+['"].*?\/dev\/tcp\/|nc\s+-[el]|ncat\s+--exec/,
    severity: 'critical',
    description: 'Reverse shell command detected - potential backdoor',
    recommendation: 'REJECT THIS SKILL. This is a clear malicious pattern.',
    category: 'malicious',
  },
  {
    id: 'skill-atomic-stealer',
    name: 'Atomic Stealer pattern',
    pattern: /(?:curl|wget).*?\.sh\s*\|\s*(?:bash|sh)|base64\s+-d.*?\|\s*(?:bash|sh)/,
    severity: 'critical',
    description: 'Pattern matches known Atomic Stealer malware distribution',
    recommendation: 'REJECT THIS SKILL. This matches malware signatures from Snyk analysis.',
    category: 'malicious',
  },
  {
    id: 'skill-credential-scraper',
    name: 'Credential scraping detected',
    pattern: /(?:cat|grep|find).*?(?:\.aws|\.ssh|\.env|password|credential|secret)/i,
    severity: 'high',
    description: 'Commands that search for credential files',
    recommendation: 'Verify legitimacy. Skills should not scrape credential files.',
    category: 'malicious',
  },
  {
    id: 'skill-obfuscated-command',
    name: 'Obfuscated command execution',
    pattern: /eval\s*\$\(|`.*?`|\$\{[^}]*?\}/,
    severity: 'high',
    description: 'Command substitution or eval - common in malware',
    recommendation: 'Review carefully. Obfuscation often hides malicious intent.',
    category: 'malicious',
  },
];

// HIPAA-Specific Violations
export const HIPAA_VIOLATION_PATTERNS: SkillPattern[] = [
  {
    id: 'skill-http-phi-transmission',
    name: 'PHI transmitted over HTTP',
    pattern: /(?:curl|fetch|axios|request).*?http:\/\/(?!localhost|127\.0\.0\.1).*?(?:patient|phi|health|medical)/i,
    severity: 'critical',
    description: 'Skill transmits PHI over unencrypted HTTP',
    recommendation: 'Use HTTPS for all PHI transmission. HTTP violates HIPAA encryption requirements.',
    hipaaReference: '§164.312(e)(1) - Transmission Security',
    category: 'hipaa-violation',
  },
  {
    id: 'skill-no-audit-logging',
    name: 'PHI access without audit logging',
    pattern: /(?:SELECT|UPDATE|DELETE).*?FROM.*?(?:patient|phi|health_record)(?!.*?(?:log|audit))/i,
    severity: 'high',
    description: 'Skill accesses PHI database without audit logging',
    recommendation: 'Add audit logging: auditLog.record({ action, userId, resourceId })',
    hipaaReference: '§164.308(a)(1)(ii)(D) - Audit Controls',
    category: 'hipaa-violation',
  },
  {
    id: 'skill-phi-in-logs',
    name: 'PHI logged to console/files',
    pattern: /(?:console\.log|print|echo|logger\.).*?(?:\$\{?patient|\$\{?phi|medical_record)/i,
    severity: 'high',
    description: 'Skill logs PHI to console or log files',
    recommendation: 'Never log PHI. Use redacted logging: logger.info({ patientId: "***" })',
    hipaaReference: '§164.502(a) - PHI Use and Disclosure',
    category: 'hipaa-violation',
  },
  {
    id: 'skill-phi-in-url',
    name: 'PHI in URL parameters',
    pattern: /(?:\?|&)(?:ssn|dob|mrn|diagnosis)=/i,
    severity: 'critical',
    description: 'Skill passes PHI in URL query parameters',
    recommendation: 'Use POST with encrypted body. URLs are logged by proxies/servers.',
    hipaaReference: '§164.312(e)(1) - Transmission Security',
    category: 'hipaa-violation',
  },
  {
    id: 'skill-no-encryption',
    name: 'Missing encryption for PHI storage',
    pattern: /(?:localStorage|sessionStorage|\.setItem).*?(?:patient|phi|health)/i,
    severity: 'critical',
    description: 'Skill stores PHI in browser storage without encryption',
    recommendation: 'Use encrypted storage or server-side session storage only.',
    hipaaReference: '§164.312(a)(2)(iv) - Encryption',
    category: 'hipaa-violation',
  },
];

// All patterns combined
export const ALL_SKILL_PATTERNS: SkillPattern[] = [
  ...PHI_EXPOSURE_PATTERNS,
  ...CREDENTIAL_LEAK_PATTERNS,
  ...MALICIOUS_PATTERNS,
  ...HIPAA_VIOLATION_PATTERNS,
];
