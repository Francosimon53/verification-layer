export interface TrainingModule {
  id: number;
  title: string;
  description: string;
  content: string[];
  codeExamples?: {
    wrong: string;
    right: string;
    explanation: string;
  }[];
}

export const trainingModules: TrainingModule[] = [
  {
    id: 1,
    title: 'What is PHI/ePHI?',
    description: 'Understanding Protected Health Information and the 18 HIPAA identifiers',
    content: [
      '📋 Protected Health Information (PHI) is any information that:',
      '   1. Identifies an individual (or could be used to identify them)',
      '   2. Relates to their past, present, or future health condition, healthcare, or payment',
      '',
      '🔐 The 18 HIPAA Identifiers:',
      '   1. Names                    10. Medical record numbers (MRN)',
      '   2. Geographic data          11. Health plan numbers',
      '   3. Dates (except year)      12. Account numbers',
      '   4. Phone numbers            13. Certificate/license numbers',
      '   5. Fax numbers              14. Vehicle IDs',
      '   6. Email addresses          15. Device IDs/serial numbers',
      '   7. SSN                      16. URLs',
      '   8. Medical record #         17. IP addresses',
      '   9. Health plan #            18. Biometric data (fingerprints, photos)',
      '',
      '⚡ ePHI = PHI in ELECTRONIC form (stored, transmitted, or processed digitally)',
      '',
      '⚠️  KEY POINT: Name + Medical Condition = PHI',
      '   "John Smith has diabetes" = PHI',
      '   "Patient 12345 has diabetes" = NOT PHI (de-identified)',
    ],
  },
  {
    id: 2,
    title: 'The HIPAA Security Rule',
    description: 'Understanding security safeguards and compliance requirements',
    content: [
      '🛡️  The HIPAA Security Rule has 3 types of safeguards:',
      '',
      '1️⃣  ADMINISTRATIVE SAFEGUARDS (§164.308)',
      '   - Security management process (risk analysis, incident response)',
      '   - Workforce security (authorization, supervision, termination)',
      '   - Training and awareness',
      '   - Contingency planning (backup, disaster recovery)',
      '',
      '2️⃣  PHYSICAL SAFEGUARDS (§164.310)',
      '   - Facility access controls',
      '   - Workstation security',
      '   - Device and media controls',
      '',
      '3️⃣  TECHNICAL SAFEGUARDS (§164.312)',
      '   - Access control (unique IDs, emergency access, auto logoff, encryption)',
      '   - Audit controls',
      '   - Integrity controls',
      '   - Transmission security',
      '',
      '📜 Required vs Addressable:',
      '   - REQUIRED: Must implement',
      '   - ADDRESSABLE: Must implement OR document why not applicable + alternative',
      '   - ⚠️  2024 NPRM proposes eliminating this distinction (all become required)',
      '',
      '💰 Penalties for Non-Compliance:',
      '   - Tier 1 (unknowing): $100-$50,000 per violation',
      '   - Tier 2 (reasonable cause): $1,000-$50,000 per violation',
      '   - Tier 3 (willful neglect, corrected): $10,000-$50,000 per violation',
      '   - Tier 4 (willful neglect, not corrected): $50,000 per violation',
      '   - Annual maximum: $1.5 million per violation type',
      '',
      '⏱️  Breach notification timeline: 60 days to notify affected individuals',
    ],
  },
  {
    id: 3,
    title: 'Access Control in Code',
    description: 'Implementing proper access controls for ePHI',
    content: [
      '🔑 Key Access Control Requirements:',
      '',
      '1. UNIQUE USER IDs (§164.312(a)(2)(i)) - REQUIRED',
      '   - Each person must have their own login',
      '   - NO shared accounts (no "admin", "developer", "test")',
      '   - Track who accessed what PHI',
      '',
      '2. AUTOMATIC LOGOFF (§164.312(a)(2)(iii)) - ADDRESSABLE',
      '   - Session timeout ≤ 15 minutes of inactivity',
      '   - Apply to ALL systems with ePHI access',
      '',
      '3. ROLE-BASED ACCESS (Minimum Necessary principle)',
      '   - Users only see PHI needed for their job',
      '   - Developers should NOT have production PHI access',
      '   - Use roles like: admin, clinician, billing, readonly',
      '',
      '4. ACCESS REVIEWS',
      '   - Review user access quarterly',
      '   - Remove access immediately on termination',
    ],
    codeExamples: [
      {
        wrong: `// ❌ WRONG: Shared credentials
const DB_USER = "admin";
const DB_PASS = "admin123";

// ❌ WRONG: No session timeout
app.use(session({
  cookie: { maxAge: null } // Never expires!
}));

// ❌ WRONG: Everyone can access everything
if (user.isAuthenticated()) {
  return allPatientRecords;
}`,
        right: `// ✅ RIGHT: Individual user authentication
const user = await authenticateUser(username, password);
const userId = user.id; // Track individual access

// ✅ RIGHT: 15-minute session timeout
app.use(session({
  cookie: { maxAge: 15 * 60 * 1000 }, // 15 minutes
  rolling: true // Reset on activity
}));

// ✅ RIGHT: Role-based access
if (user.hasRole('CLINICIAN')) {
  return user.getAssignedPatients();
} else if (user.hasRole('BILLING')) {
  return user.getBillingRecords(); // No medical data
}`,
        explanation:
          'Always use individual user accounts, implement session timeouts ≤15 minutes, and restrict access based on roles and minimum necessary principle.',
      },
    ],
  },
  {
    id: 4,
    title: 'Encryption',
    description: 'Encryption requirements for ePHI at rest and in transit',
    content: [
      '🔐 Encryption Requirements:',
      '',
      '1️⃣  ENCRYPTION AT REST (§164.312(a)(2)(iv)) - ADDRESSABLE',
      '   - Use AES-256 (industry standard)',
      '   - Encrypt databases, backups, file storage',
      '   - NEVER use MD5, SHA1, DES, or 3DES for encryption',
      '   - Note: MD5/SHA1 are OK for checksums, NOT for secrets',
      '',
      '2️⃣  ENCRYPTION IN TRANSIT (§164.312(e)(1)) - ADDRESSABLE',
      '   - TLS 1.2 or higher (TLS 1.3 preferred)',
      '   - HTTPS for all web traffic',
      '   - Use HSTS headers (Strict-Transport-Security)',
      '   - No mixed content (HTTP + HTTPS)',
      '',
      '3️⃣  KEY MANAGEMENT',
      '   - NEVER hardcode encryption keys in source code',
      '   - Use environment variables or secret managers (AWS KMS, Vault, etc.)',
      '   - Rotate keys periodically',
      '   - Store keys separately from encrypted data',
      '',
      '⚠️  Safe Harbor: If ePHI is encrypted using NIST standards, breach notification may not be required (must still report to OCR)',
    ],
    codeExamples: [
      {
        wrong: `// ❌ WRONG: Weak encryption
const crypto = require('crypto');
const key = 'hardcoded-key-12345'; // BAD!
const cipher = crypto.createCipher('des', key); // DES is weak!

// ❌ WRONG: No TLS
app.listen(80); // HTTP only

// ❌ WRONG: MD5 for passwords
const hash = crypto.createHash('md5')
  .update(password).digest('hex');`,
        right: `// ✅ RIGHT: Strong encryption
const crypto = require('crypto');
const key = process.env.ENCRYPTION_KEY; // From env
const algorithm = 'aes-256-gcm'; // AES-256
const cipher = crypto.createCipheriv(algorithm, key, iv);

// ✅ RIGHT: TLS 1.2+ with HSTS
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security',
    'max-age=31536000; includeSubDomains');
  next();
});
https.createServer(tlsOptions, app).listen(443);

// ✅ RIGHT: bcrypt for passwords
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash(password, 10);`,
        explanation:
          'Use AES-256 for encryption, TLS 1.2+ for transport, never hardcode keys, and use bcrypt/argon2 for password hashing.',
      },
    ],
  },
  {
    id: 5,
    title: 'Authentication & MFA',
    description: 'Multi-factor authentication and secure authentication practices',
    content: [
      '🔒 Authentication Best Practices:',
      '',
      '1️⃣  WHY PASSWORDS ALONE AREN\'T ENOUGH',
      '   - Passwords can be stolen (phishing, data breaches, keyloggers)',
      '   - 81% of breaches involve weak or stolen passwords',
      '   - MFA reduces account compromise by 99.9% (Microsoft study)',
      '',
      '2️⃣  MFA IMPLEMENTATION',
      '   - TOTP (Time-based One-Time Password) - Google Authenticator, Authy',
      '   - SMS (less secure but better than nothing)',
      '   - Hardware tokens (YubiKey, etc.)',
      '   - Passkeys/WebAuthn (most secure, emerging standard)',
      '',
      '3️⃣  MFA FOR ePHI ACCESS',
      '   - REQUIRED for remote access to ePHI systems',
      '   - Recommended for all ePHI access',
      '   - No MFA bypass in code (even for "trusted" IPs)',
      '',
      '4️⃣  PASSWORD POLICIES',
      '   - Minimum 12 characters (or passphrase)',
      '   - Require complexity OR length (not both)',
      '   - No password expiration (NIST no longer recommends)',
      '   - Check against known breach databases (HaveIBeenPwned)',
    ],
    codeExamples: [
      {
        wrong: `// ❌ WRONG: MFA bypass
if (req.ip === '192.168.1.100' || req.headers['x-admin']) {
  return loginWithoutMFA(user);
}

// ❌ WRONG: Storing MFA secret in plain text
user.mfaSecret = totpSecret; // Unencrypted!

// ❌ WRONG: No rate limiting on auth
app.post('/login', async (req, res) => {
  const user = await authenticate(req.body);
  // Allows unlimited login attempts
});`,
        right: `// ✅ RIGHT: Always require MFA
const user = await authenticate(username, password);
if (!user.mfaVerified) {
  return requireMFAChallenge(user);
}

// ✅ RIGHT: Encrypt MFA secrets
user.mfaSecret = encrypt(totpSecret, encryptionKey);

// ✅ RIGHT: Rate limiting on auth endpoints
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts'
});
app.post('/login', loginLimiter, authenticateHandler);`,
        explanation:
          'Never bypass MFA, encrypt MFA secrets, implement rate limiting on authentication endpoints, and use strong MFA methods (TOTP, hardware tokens, passkeys).',
      },
    ],
  },
  {
    id: 6,
    title: 'Audit Logging',
    description: 'What to log, what not to log, and retention requirements',
    content: [
      '📝 Audit Logging Requirements (§164.312(b)):',
      '',
      '1️⃣  WHAT TO LOG (the 5 W\'s):',
      '   - WHO: User ID, role, IP address',
      '   - WHAT: Action performed (read, write, delete, export)',
      '   - WHEN: Timestamp (with timezone)',
      '   - WHERE: Resource accessed (patient ID, record ID)',
      '   - OUTCOME: Success or failure (with error codes)',
      '',
      '2️⃣  WHAT NOT TO LOG:',
      '   - ❌ PHI in log messages (no names, SSNs, diagnoses)',
      '   - ❌ Passwords or auth tokens',
      '   - ❌ Encryption keys',
      '   - ✅ Use patient IDs, record IDs, or de-identified references',
      '',
      '3️⃣  LOG RETENTION:',
      '   - Minimum 6 years (HIPAA requirement)',
      '   - Longer if required by state law',
      '   - Protect logs from tampering (write-once, centralized logging)',
      '',
      '4️⃣  WHAT TO AUDIT LOG:',
      '   - All ePHI access (read, write, update, delete)',
      '   - Authentication events (login, logout, failed attempts)',
      '   - Authorization changes (role assignments, permission changes)',
      '   - Configuration changes (security settings)',
      '   - Administrative actions (user creation, deletion)',
    ],
    codeExamples: [
      {
        wrong: `// ❌ WRONG: PHI in logs
logger.info(\`User accessed patient: John Smith, DOB: 1985-03-15\`);

// ❌ WRONG: Passwords in logs
logger.error(\`Login failed for user: admin, password: \${password}\`);

// ❌ WRONG: No structured logging
console.log('Someone did something');`,
        right: `// ✅ RIGHT: Log patient IDs, not names
logger.info('ePHI access', {
  userId: user.id,
  action: 'READ',
  resourceType: 'PATIENT',
  resourceId: 'PT-12345', // Patient ID, not name
  timestamp: new Date().toISOString(),
  ipAddress: req.ip,
  outcome: 'SUCCESS'
});

// ✅ RIGHT: Never log sensitive data
logger.error('Authentication failed', {
  userId: username, // OK to log username
  reason: 'INVALID_CREDENTIALS',
  ipAddress: req.ip
  // NO password logged
});

// ✅ RIGHT: Structured logging with context
const auditLog = {
  timestamp: new Date().toISOString(),
  userId: user.id,
  action: 'EXPORT',
  resourceType: 'MEDICAL_RECORD',
  resourceId: recordId,
  outcome: 'SUCCESS',
  details: { format: 'PDF', pageCount: 5 }
};
logger.info('Audit', auditLog);`,
        explanation:
          'Log the 5 W\'s (who, what, when, where, outcome) but NEVER log PHI, passwords, or keys. Use patient IDs instead of names. Retain logs for 6+ years.',
      },
    ],
  },
  {
    id: 7,
    title: 'Input Validation & Injection Prevention',
    description: 'Preventing SQL injection, XSS, and other attacks on PHI systems',
    content: [
      '🛡️  Input Validation for PHI Systems:',
      '',
      '1️⃣  SQL INJECTION',
      '   - NEVER concatenate user input into SQL queries',
      '   - Always use parameterized queries / prepared statements',
      '   - Extra critical with PHI (can expose all patient records)',
      '   - Use ORMs (Sequelize, TypeORM) with proper escaping',
      '',
      '2️⃣  CROSS-SITE SCRIPTING (XSS)',
      '   - Sanitize ALL user input before rendering',
      '   - Use Content-Security-Policy headers',
      '   - Escape HTML entities in PHI display',
      '   - Critical in patient portals and healthcare apps',
      '',
      '3️⃣  FILE UPLOAD SECURITY',
      '   - Validate file types (whitelist, not blacklist)',
      '   - Scan uploads for malware',
      '   - Store uploads outside web root',
      '   - Limit file sizes',
      '   - Medical records, insurance cards, etc. need protection',
      '',
      '4️⃣  API INPUT VALIDATION',
      '   - Validate data types, ranges, formats',
      '   - Reject unexpected fields',
      '   - Use schema validation (Zod, Joi, JSON Schema)',
    ],
    codeExamples: [
      {
        wrong: `// ❌ WRONG: SQL injection vulnerability
const patientId = req.query.id;
const sql = \`SELECT * FROM patients WHERE id = '\${patientId}'\`;
db.query(sql); // Attacker can inject: ' OR '1'='1

// ❌ WRONG: XSS vulnerability
res.send(\`<h1>Patient: \${req.query.name}</h1>\`);
// Attacker can inject: <script>steal()</script>

// ❌ WRONG: No file validation
app.post('/upload', (req, res) => {
  const file = req.files.medicalRecord;
  file.mv('./uploads/' + file.name); // Any file type!
});`,
        right: `// ✅ RIGHT: Parameterized query
const patientId = req.query.id;
const sql = 'SELECT * FROM patients WHERE id = ?';
db.query(sql, [patientId]); // Safe from injection

// ✅ RIGHT: HTML escaping
const escapeHtml = require('escape-html');
res.send(\`<h1>Patient: \${escapeHtml(req.query.name)}</h1>\`);

// ✅ RIGHT: File validation
const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
app.post('/upload', (req, res) => {
  const file = req.files.medicalRecord;
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).send('Invalid file type');
  }
  if (file.size > 10 * 1024 * 1024) { // 10MB limit
    return res.status(400).send('File too large');
  }
  // Scan for malware, store securely
});`,
        explanation:
          'Always use parameterized queries, escape HTML output, validate file uploads, and use schema validation. Input validation is critical for PHI protection.',
      },
    ],
  },
  {
    id: 8,
    title: 'Error Handling',
    description: 'Secure error handling that doesn\'t expose PHI or system details',
    content: [
      '⚠️  Secure Error Handling:',
      '',
      '1️⃣  NEVER EXPOSE STACK TRACES',
      '   - Stack traces reveal code structure, file paths, dependencies',
      '   - Attackers use this info to plan attacks',
      '   - Only show stack traces in development, never production',
      '',
      '2️⃣  NEVER INCLUDE PHI IN ERROR MESSAGES',
      '   - ❌ "Patient John Smith not found"',
      '   - ✅ "Patient record not found" (use patient ID in logs only)',
      '   - ❌ "SSN 123-45-6789 is invalid"',
      '   - ✅ "Invalid identifier format"',
      '',
      '3️⃣  SANITIZE ERROR RESPONSES',
      '   - Generic messages to users',
      '   - Detailed errors in server logs (without PHI)',
      '   - Use error codes, not detailed descriptions',
      '',
      '4️⃣  DATABASE ERRORS',
      '   - Don\'t expose table names, column names, or query details',
      '   - Map database errors to generic messages',
      '   - Log full errors server-side for debugging',
    ],
    codeExamples: [
      {
        wrong: `// ❌ WRONG: Exposing stack traces
app.use((err, req, res, next) => {
  res.status(500).send(err.stack); // Shows file paths!
});

// ❌ WRONG: PHI in error messages
if (!patient) {
  throw new Error(\`Patient \${patientName} not found\`);
}

// ❌ WRONG: Database details exposed
catch (err) {
  res.status(500).send(err.message);
  // "Column 'ssn' doesn't exist in table 'patients'"
}`,
        right: `// ✅ RIGHT: Generic errors to client, detailed logs
app.use((err, req, res, next) => {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    userId: req.user?.id,
    path: req.path
  });

  res.status(500).json({
    error: 'An error occurred',
    code: 'INTERNAL_ERROR',
    requestId: req.id // For support lookup
  });
});

// ✅ RIGHT: Use IDs, not PHI
if (!patient) {
  logger.warn('Patient not found', { patientId });
  throw new Error('Record not found'); // No PHI
}

// ✅ RIGHT: Map database errors
catch (err) {
  logger.error('Database error', { error: err.message });
  res.status(500).json({
    error: 'Database operation failed',
    code: 'DB_ERROR'
  });
}`,
        explanation:
          'Never expose stack traces, PHI, or system details in error messages. Use generic errors for users, detailed logs (without PHI) for debugging.',
      },
    ],
  },
  {
    id: 9,
    title: 'Secure API Design',
    description: 'API security best practices for ePHI systems',
    content: [
      '🔌 API Security for ePHI:',
      '',
      '1️⃣  PHI NEVER IN URL PARAMETERS',
      '   - URLs are logged in browsers, proxies, load balancers',
      '   - ❌ GET /patients?ssn=123-45-6789',
      '   - ✅ POST /patients/search with SSN in request body',
      '   - ✅ GET /patients/PT-12345 (use patient IDs, not PHI)',
      '',
      '2️⃣  RATE LIMITING',
      '   - Prevent brute force attacks on auth endpoints',
      '   - Prevent data scraping / mass PHI extraction',
      '   - Example: 100 requests/minute per IP, 1000/hour per user',
      '',
      '3️⃣  CORS CONFIGURATION',
      '   - Whitelist specific origins, not "*"',
      '   - Use credentials: true only with specific origins',
      '   - Critical for patient portals and SaaS apps',
      '',
      '4️⃣  JWT SECURITY',
      '   - Short expiration (15-30 minutes)',
      '   - Use refresh tokens for longer sessions',
      '   - Implement token revocation (blacklist)',
      '   - Don\'t store PHI in JWT payload (only user ID, roles)',
      '   - Use strong signing algorithm (RS256, not HS256)',
    ],
    codeExamples: [
      {
        wrong: `// ❌ WRONG: PHI in URL
app.get('/patient/:ssn', (req, res) => {
  const patient = getPatientBySSN(req.params.ssn);
});

// ❌ WRONG: No rate limiting
app.post('/login', loginHandler);

// ❌ WRONG: Permissive CORS
app.use(cors({ origin: '*', credentials: true }));

// ❌ WRONG: Long-lived JWT with PHI
const token = jwt.sign({
  userId: user.id,
  ssn: user.ssn, // PHI in token!
  diagnosis: user.diagnosis
}, secret, { expiresIn: '30d' }); // Too long!`,
        right: `// ✅ RIGHT: Use patient IDs in URL
app.get('/patients/:patientId', (req, res) => {
  const patient = getPatient(req.params.patientId);
});

// ✅ RIGHT: Rate limiting
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', apiLimiter);

// ✅ RIGHT: Strict CORS
app.use(cors({
  origin: 'https://patient-portal.example.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

// ✅ RIGHT: Short JWT, no PHI
const token = jwt.sign({
  userId: user.id,
  roles: user.roles
  // NO PHI in token
}, secret, {
  expiresIn: '15m',
  algorithm: 'RS256'
});`,
        explanation:
          'Never put PHI in URLs, implement rate limiting, configure CORS strictly, use short-lived JWTs without PHI, and implement token revocation.',
      },
    ],
  },
  {
    id: 10,
    title: 'Incident Response for Developers',
    description: 'What to do when a security incident occurs',
    content: [
      '🚨 Incident Response for Developers:',
      '',
      '1️⃣  WHAT QUALIFIES AS A SECURITY INCIDENT?',
      '   - Unauthorized access to ePHI (successful or attempted)',
      '   - Malware/ransomware on systems with ePHI',
      '   - Lost/stolen device containing ePHI',
      '   - Accidental ePHI disclosure (wrong email, public exposure)',
      '   - PHI found in logs, error messages, or URLs',
      '   - Misconfigured database/S3 bucket exposing PHI',
      '',
      '2️⃣  WHAT TO DO IMMEDIATELY:',
      '   - 🛑 STOP: Don\'t delete anything (logs, databases, files)',
      '   - 📞 NOTIFY: Contact your Security Officer / Incident Response Team',
      '   - 📸 PRESERVE: Take screenshots, save logs, document timeline',
      '   - 🔒 CONTAIN: Isolate affected systems (if safe to do so)',
      '   - ⏰ DOCUMENT: Write down what happened, when, and who was involved',
      '',
      '3️⃣  WHAT NOT TO DO:',
      '   - ❌ Don\'t hide it or "fix it quietly"',
      '   - ❌ Don\'t delete logs or evidence',
      '   - ❌ Don\'t communicate with press/public',
      '   - ❌ Don\'t assume it\'s "not a big deal"',
      '',
      '4️⃣  NOTIFICATION TIMELINE:',
      '   - Business Associate → Covered Entity: Within 24 hours of discovery',
      '   - Covered Entity → Affected Individuals: Within 60 days',
      '   - If 500+ affected: Notify HHS and media within 60 days',
      '',
      '5️⃣  EVIDENCE PRESERVATION:',
      '   - Keep all logs (even if they contain evidence of the breach)',
      '   - Document: What happened? When? How was it discovered?',
      '   - List: What PHI was involved? How many individuals?',
      '   - Screenshot: Error messages, exposed data, system configs',
      '   - Isolate: Affected systems (but don\'t turn off/wipe)',
      '',
      '⚖️  REMEMBER: Hiding a breach is worse than the breach itself!',
      '   Federal law protects whistleblowers who report violations.',
    ],
  },
];
