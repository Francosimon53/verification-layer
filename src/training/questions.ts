export interface Question {
  moduleId: number;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option (0-based)
  explanation: string;
}

export const questions: Question[] = [
  // MODULE 1: What is PHI/ePHI?
  {
    moduleId: 1,
    question: 'Which of the following is considered PHI?',
    options: [
      'A. Anonymous health statistics from a research study',
      'B. An email saying "John Smith has an appointment on March 15"',
      'C. A de-identified dataset with patient ages but no names',
      'D. General medical information on a public health website',
    ],
    correctAnswer: 1,
    explanation:
      'Name (John Smith) + healthcare information (appointment) = PHI. The other options are either de-identified or don\'t link to an individual.',
  },
  {
    moduleId: 1,
    question: 'How many HIPAA identifiers must be removed for data to be considered de-identified?',
    options: [
      'A. Only the patient name',
      'B. All 18 identifiers',
      'C. Just the SSN and medical record number',
      'D. 10 of the 18 identifiers',
    ],
    correctAnswer: 1,
    explanation:
      'All 18 HIPAA identifiers must be removed for data to be considered properly de-identified under the Safe Harbor method.',
  },
  {
    moduleId: 1,
    question: 'What is the difference between PHI and ePHI?',
    options: [
      'A. PHI is more sensitive than ePHI',
      'B. ePHI is PHI in electronic form',
      'C. ePHI only includes medical diagnoses',
      'D. There is no difference',
    ],
    correctAnswer: 1,
    explanation:
      'ePHI (electronic PHI) is simply PHI that is created, stored, transmitted, or processed electronically. The HIPAA Security Rule applies to ePHI.',
  },
  {
    moduleId: 1,
    question: 'Which of these is NOT one of the 18 HIPAA identifiers?',
    options: [
      'A. Email address',
      'B. IP address',
      'C. Job title',
      'D. Biometric data (fingerprints)',
    ],
    correctAnswer: 2,
    explanation:
      'Job title is not one of the 18 HIPAA identifiers. Email, IP address, and biometric data are all identifiers that must be removed for de-identification.',
  },

  // MODULE 2: The HIPAA Security Rule
  {
    moduleId: 2,
    question: 'Which of the following is a TECHNICAL safeguard?',
    options: [
      'A. Security awareness training',
      'B. Facility access controls',
      'C. Automatic logoff (session timeout)',
      'D. Contingency planning',
    ],
    correctAnswer: 2,
    explanation:
      'Automatic logoff is a technical safeguard (§164.312). Training is administrative, facility access is physical, and contingency planning is administrative.',
  },
  {
    moduleId: 2,
    question: 'What is the difference between Required and Addressable specifications?',
    options: [
      'A. Required must be implemented; Addressable can be ignored',
      'B. Required must be implemented; Addressable must be implemented OR documented why not + alternative',
      'C. There is no difference anymore',
      'D. Addressable only applies to small organizations',
    ],
    correctAnswer: 1,
    explanation:
      'Addressable does NOT mean optional. You must either implement it OR document why it\'s not reasonable/appropriate and provide an equivalent alternative. The 2024 NPRM proposes eliminating this distinction.',
  },
  {
    moduleId: 2,
    question: 'What is the maximum annual penalty for a single type of HIPAA violation?',
    options: [
      'A. $50,000',
      'B. $250,000',
      'C. $1.5 million',
      'D. $10 million',
    ],
    correctAnswer: 2,
    explanation:
      'The annual maximum penalty is $1.5 million per violation type. Individual violations can be $100-$50,000 each depending on the tier.',
  },
  {
    moduleId: 2,
    question: 'How long do you have to notify affected individuals after discovering a breach?',
    options: [
      'A. 24 hours',
      'B. 30 days',
      'C. 60 days',
      'D. 90 days',
    ],
    correctAnswer: 2,
    explanation:
      'Covered entities must notify affected individuals within 60 days of discovering a breach. Business associates must notify the covered entity within 24 hours.',
  },

  // MODULE 3: Access Control in Code
  {
    moduleId: 3,
    question: 'Which of the following violates HIPAA access control requirements?',
    options: [
      'A. Each user has their own unique login ID',
      'B. Developers use a shared "dev" account to access production for troubleshooting',
      'C. Sessions timeout after 15 minutes of inactivity',
      'D. Users can only access records they need for their job',
    ],
    correctAnswer: 1,
    explanation:
      'Shared accounts violate §164.312(a)(2)(i) which REQUIRES unique user identification. Every person must have their own account to track who accessed what.',
  },
  {
    moduleId: 3,
    question: 'What is the recommended maximum session timeout for systems with ePHI?',
    options: [
      'A. 5 minutes',
      'B. 15 minutes',
      'C. 30 minutes',
      'D. 1 hour',
    ],
    correctAnswer: 1,
    explanation:
      'The industry standard for ePHI systems is ≤15 minutes of inactivity. This is an addressable specification under §164.312(a)(2)(iii).',
  },
  {
    moduleId: 3,
    question: 'What does "minimum necessary" mean for access control?',
    options: [
      'A. Users can only access the minimum amount of PHI needed for their job function',
      'B. All authenticated users can access all patient records',
      'C. Only administrators need access controls',
      'D. Minimum necessary only applies to disclosures, not access',
    ],
    correctAnswer: 0,
    explanation:
      'Minimum necessary means users should only have access to the PHI required to perform their specific job duties. This is a core HIPAA principle.',
  },
  {
    moduleId: 3,
    question: 'When should user access be removed?',
    options: [
      'A. Within 30 days of termination',
      'B. At the end of the quarter',
      'C. Immediately upon termination',
      'D. After the final paycheck is issued',
    ],
    correctAnswer: 2,
    explanation:
      'Access to ePHI must be terminated immediately when an employee leaves or changes roles. This is a critical security control.',
  },

  // MODULE 4: Encryption
  {
    moduleId: 4,
    question: 'Which encryption algorithm should be used for ePHI at rest?',
    options: [
      'A. MD5',
      'B. DES',
      'C. AES-256',
      'D. SHA-1',
    ],
    correctAnswer: 2,
    explanation:
      'AES-256 is the industry standard for encrypting data at rest. MD5 and SHA-1 are hashing algorithms (not encryption) and are outdated. DES is weak.',
  },
  {
    moduleId: 4,
    question: 'What is the minimum TLS version that should be used for transmitting ePHI?',
    options: [
      'A. TLS 1.0',
      'B. TLS 1.1',
      'C. TLS 1.2',
      'D. SSL 3.0',
    ],
    correctAnswer: 2,
    explanation:
      'TLS 1.2 is the minimum; TLS 1.3 is preferred. SSL 3.0, TLS 1.0, and TLS 1.1 have known vulnerabilities and should not be used.',
  },
  {
    moduleId: 4,
    question: 'Where should encryption keys be stored?',
    options: [
      'A. Hardcoded in the source code',
      'B. In the same database as the encrypted data',
      'C. In environment variables or a secret manager (AWS KMS, Vault)',
      'D. In a configuration file committed to Git',
    ],
    correctAnswer: 2,
    explanation:
      'Encryption keys must be stored separately from encrypted data, preferably in environment variables or dedicated secret managers like AWS KMS or HashiCorp Vault.',
  },
  {
    moduleId: 4,
    question: 'If ePHI is encrypted according to NIST standards, what happens in a breach?',
    options: [
      'A. No notification is required at all',
      'B. You still must report to OCR, but may not need to notify individuals (Safe Harbor)',
      'C. The penalty is reduced by 50%',
      'D. It is not considered a breach',
    ],
    correctAnswer: 1,
    explanation:
      'Properly encrypted ePHI may qualify for Safe Harbor, meaning individual notification might not be required. However, you must still report the incident to OCR.',
  },

  // MODULE 5: Authentication & MFA
  {
    moduleId: 5,
    question: 'By what percentage does MFA reduce account compromise?',
    options: [
      'A. 50%',
      'B. 75%',
      'C. 90%',
      'D. 99.9%',
    ],
    correctAnswer: 3,
    explanation:
      'According to Microsoft research, MFA blocks 99.9% of account compromise attacks. This makes it one of the most effective security controls.',
  },
  {
    moduleId: 5,
    question: 'When is MFA REQUIRED for ePHI access?',
    options: [
      'A. Only for administrator accounts',
      'B. For remote access to ePHI systems',
      'C. Never, it is only recommended',
      'D. Only for Business Associates, not Covered Entities',
    ],
    correctAnswer: 1,
    explanation:
      'MFA is required for remote access to ePHI systems. It is strongly recommended for all ePHI access as a best practice.',
  },
  {
    moduleId: 5,
    question: 'Which of the following is the MOST secure MFA method?',
    options: [
      'A. SMS text message codes',
      'B. Email verification codes',
      'C. TOTP (Google Authenticator)',
      'D. Passkeys/WebAuthn (hardware tokens)',
    ],
    correctAnswer: 3,
    explanation:
      'Passkeys/WebAuthn (hardware tokens like YubiKey) are the most secure. TOTP is good, but SMS and email are vulnerable to interception.',
  },
  {
    moduleId: 5,
    question: 'What is the current NIST recommendation on password expiration?',
    options: [
      'A. Change passwords every 30 days',
      'B. Change passwords every 90 days',
      'C. Do NOT require periodic password changes',
      'D. Change passwords every 6 months',
    ],
    correctAnswer: 2,
    explanation:
      'NIST no longer recommends forced periodic password changes, as they lead to weaker passwords. Instead, focus on length, complexity, and breach detection.',
  },

  // MODULE 6: Audit Logging
  {
    moduleId: 6,
    question: 'What are the "5 W\'s" that should be in every audit log?',
    options: [
      'A. Who, What, When, Where, Why',
      'B. Who, What, When, Where, Outcome',
      'C. User, Action, Time, Location, Status',
      'D. Both B and C (they mean the same thing)',
    ],
    correctAnswer: 3,
    explanation:
      'Audit logs should capture: WHO (user), WHAT (action), WHEN (timestamp), WHERE (resource), and OUTCOME (success/failure). "Why" is not typically logged.',
  },
  {
    moduleId: 6,
    question: 'Which of the following should NEVER be in audit logs?',
    options: [
      'A. Patient ID',
      'B. User ID',
      'C. Patient name and diagnosis',
      'D. Timestamp',
    ],
    correctAnswer: 2,
    explanation:
      'PHI (like patient names and diagnoses) should NEVER be in logs. Use patient IDs instead. Also never log passwords, auth tokens, or encryption keys.',
  },
  {
    moduleId: 6,
    question: 'How long must audit logs be retained?',
    options: [
      'A. 1 year',
      'B. 3 years',
      'C. 6 years',
      'D. 10 years',
    ],
    correctAnswer: 2,
    explanation:
      'HIPAA requires audit logs to be retained for a minimum of 6 years. Some state laws may require longer retention.',
  },
  {
    moduleId: 6,
    question: 'What should be audit logged?',
    options: [
      'A. Only failed login attempts',
      'B. Only successful ePHI access',
      'C. All ePHI access (read, write, update, delete) and authentication events',
      'D. Only administrative actions',
    ],
    correctAnswer: 2,
    explanation:
      'All ePHI access, authentication events, authorization changes, and administrative actions should be logged. This creates a complete audit trail.',
  },

  // MODULE 7: Input Validation & Injection Prevention
  {
    moduleId: 7,
    question: 'Which of the following prevents SQL injection?',
    options: [
      'A. Concatenating user input into SQL queries',
      'B. Using parameterized queries / prepared statements',
      'C. Sanitizing input by removing special characters',
      'D. Limiting query result size',
    ],
    correctAnswer: 1,
    explanation:
      'Parameterized queries (prepared statements) are the correct defense against SQL injection. Never concatenate user input into queries.',
  },
  {
    moduleId: 7,
    question: 'Why is SQL injection especially critical in PHI systems?',
    options: [
      'A. It can expose all patient records in the database',
      'B. It only affects test databases',
      'C. It is not a serious threat for healthcare apps',
      'D. It only affects payment information, not medical records',
    ],
    correctAnswer: 0,
    explanation:
      'SQL injection can allow attackers to bypass access controls and extract entire databases of patient records, making it extremely critical for PHI systems.',
  },
  {
    moduleId: 7,
    question: 'How should file uploads be validated in a healthcare application?',
    options: [
      'A. No validation needed if the user is authenticated',
      'B. Block files with .exe extension only',
      'C. Whitelist allowed file types (JPEG, PNG, PDF), scan for malware, limit size',
      'D. Allow any file type but store it securely',
    ],
    correctAnswer: 2,
    explanation:
      'File uploads (medical records, insurance cards) must be validated using a whitelist of allowed types, scanned for malware, size-limited, and stored securely.',
  },
  {
    moduleId: 7,
    question: 'What is the correct defense against XSS (Cross-Site Scripting)?',
    options: [
      'A. Disable JavaScript in the browser',
      'B. Escape/sanitize user input before rendering in HTML',
      'C. Use HTTP instead of HTTPS',
      'D. Store all user input in cookies',
    ],
    correctAnswer: 1,
    explanation:
      'XSS is prevented by escaping/sanitizing user input before rendering it in HTML, and using Content-Security-Policy headers.',
  },

  // MODULE 8: Error Handling
  {
    moduleId: 8,
    question: 'What should you do with stack traces in production?',
    options: [
      'A. Display them to users so they can report the error',
      'B. Send them to the client for debugging',
      'C. Log them server-side but never expose to users',
      'D. Disable error logging to improve performance',
    ],
    correctAnswer: 2,
    explanation:
      'Stack traces reveal system architecture and should NEVER be shown to users. Log them server-side for debugging, but show generic errors to users.',
  },
  {
    moduleId: 8,
    question: 'Which error message is appropriate?',
    options: [
      'A. "Patient John Smith, SSN 123-45-6789 not found"',
      'B. "Patient record not found"',
      'C. "SELECT * FROM patients WHERE ssn=\'123-45-6789\' returned 0 rows"',
      'D. "Database error: Table \'patients\' doesn\'t exist"',
    ],
    correctAnswer: 1,
    explanation:
      'Error messages should be generic and not include PHI, table names, column names, or query details. Log patient IDs server-side if needed.',
  },
  {
    moduleId: 8,
    question: 'What should be included in a user-facing error response?',
    options: [
      'A. Full stack trace and database error',
      'B. Generic message, error code, and request ID for support',
      'C. Patient data that caused the error',
      'D. SQL query that failed',
    ],
    correctAnswer: 1,
    explanation:
      'User-facing errors should include a generic message, an error code, and a request ID for support lookup. Never expose technical details or PHI.',
  },

  // MODULE 9: Secure API Design
  {
    moduleId: 9,
    question: 'Why should PHI never be in URL parameters?',
    options: [
      'A. It makes the URL too long',
      'B. URLs are logged in browsers, proxies, and load balancers',
      'C. It slows down the API',
      'D. It is fine to put PHI in URLs if using HTTPS',
    ],
    correctAnswer: 1,
    explanation:
      'URLs are logged everywhere (browser history, server logs, proxy logs, load balancers). PHI in URLs = PHI in logs. Use request bodies or non-PHI IDs instead.',
  },
  {
    moduleId: 9,
    question: 'What is the purpose of rate limiting on authentication endpoints?',
    options: [
      'A. To improve server performance',
      'B. To prevent brute force password attacks',
      'C. To reduce bandwidth costs',
      'D. To force users to remember their passwords',
    ],
    correctAnswer: 1,
    explanation:
      'Rate limiting prevents attackers from making unlimited login attempts to guess passwords. Example: limit to 5 attempts per 15 minutes.',
  },
  {
    moduleId: 9,
    question: 'What is the correct CORS configuration for a patient portal API?',
    options: [
      'A. Allow all origins with credentials: cors({ origin: \'*\', credentials: true })',
      'B. Allow specific origin: cors({ origin: \'https://portal.example.com\', credentials: true })',
      'C. Disable CORS entirely',
      'D. Allow all origins without credentials',
    ],
    correctAnswer: 1,
    explanation:
      'CORS should whitelist specific origins, never use "*" with credentials. This prevents unauthorized sites from accessing your API.',
  },
  {
    moduleId: 9,
    question: 'What should be stored in a JWT for a healthcare application?',
    options: [
      'A. User ID, roles, and patient SSN',
      'B. User ID and roles only (no PHI)',
      'C. Full patient medical records',
      'D. Encryption keys and passwords',
    ],
    correctAnswer: 1,
    explanation:
      'JWTs should contain minimal information: user ID and roles. Never store PHI, passwords, or encryption keys in JWTs as they are not encrypted by default.',
  },
  {
    moduleId: 9,
    question: 'What is a recommended JWT expiration time for ePHI systems?',
    options: [
      'A. 24 hours',
      'B. 7 days',
      'C. 15-30 minutes',
      'D. Never expire',
    ],
    correctAnswer: 2,
    explanation:
      'Short-lived JWTs (15-30 minutes) with refresh tokens provide better security. Long-lived tokens increase risk if compromised.',
  },

  // MODULE 10: Incident Response for Developers
  {
    moduleId: 10,
    question: 'Which of the following is a security incident?',
    options: [
      'A. A developer accidentally logs patient names in application logs',
      'B. A failed login attempt',
      'C. A user forgets their password',
      'D. A scheduled system maintenance',
    ],
    correctAnswer: 0,
    explanation:
      'PHI in logs is a security incident (potential unauthorized disclosure). Failed logins are monitored but typically not incidents unless part of an attack pattern.',
  },
  {
    moduleId: 10,
    question: 'What is the FIRST thing you should do when you discover a potential breach?',
    options: [
      'A. Delete the logs to remove evidence of the breach',
      'B. Fix the vulnerability quietly and don\'t tell anyone',
      'C. Notify your Security Officer / Incident Response Team immediately',
      'D. Post about it on social media to warn users',
    ],
    correctAnswer: 2,
    explanation:
      'Immediately notify your Security Officer or Incident Response Team. Never delete evidence, hide the incident, or communicate publicly without authorization.',
  },
  {
    moduleId: 10,
    question: 'How long does a Business Associate have to notify a Covered Entity after discovering a breach?',
    options: [
      'A. Immediately',
      'B. Within 24 hours',
      'C. Within 60 days',
      'D. Within 30 days',
    ],
    correctAnswer: 1,
    explanation:
      'Business Associates must notify the Covered Entity within 24 hours of discovering a breach. The Covered Entity then has 60 days to notify individuals.',
  },
  {
    moduleId: 10,
    question: 'What should you do with logs after discovering a security incident?',
    options: [
      'A. Delete them to prevent legal liability',
      'B. Preserve them as evidence (even if they contain evidence of the breach)',
      'C. Only keep logs that show you did nothing wrong',
      'D. Send them to the press',
    ],
    correctAnswer: 1,
    explanation:
      'Preserve ALL logs and evidence, even if they show mistakes or vulnerabilities. Deleting evidence is obstruction and makes penalties much worse.',
  },
  {
    moduleId: 10,
    question: 'What is worse than causing a HIPAA breach?',
    options: [
      'A. Reporting the breach late',
      'B. Hiding or covering up the breach',
      'C. Not having encryption',
      'D. Having weak passwords',
    ],
    correctAnswer: 1,
    explanation:
      'Hiding or covering up a breach is worse than the breach itself. It demonstrates willful neglect and can result in criminal penalties. Federal law protects whistleblowers.',
  },
];
