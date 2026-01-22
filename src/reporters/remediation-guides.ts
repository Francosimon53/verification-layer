export interface RemediationOption {
  title: string;
  description: string;
  code: string;
  language: string;
}

export interface RemediationGuide {
  id: string;
  matchPatterns: string[];
  hipaaImpact: string;
  options: RemediationOption[];
  documentation: Array<{ title: string; url: string }>;
}

export const REMEDIATION_GUIDES: RemediationGuide[] = [
  // === PHI Exposure Guides ===
  {
    id: 'dob-exposure',
    matchPatterns: ['Date of birth exposure', 'dob-exposed'],
    hipaaImpact: "Date of birth is one of the 18 HIPAA identifiers that makes health information \"Protected Health Information\" (PHI).\nExposing DOB in code, logs, or unencrypted storage violates the HIPAA Privacy Rule (§164.502) and Security Rule (§164.312).\nBreaches involving DOB can result in fines of $100-$50,000 per violation, with annual maximums of $1.5 million per violation category.",
    options: [
      {
        title: 'Option 1: Encrypt at Rest with AES-256',
        description: 'Encrypt DOB before storing in database. Use AES-256-GCM for HIPAA-compliant encryption.',
        language: 'typescript',
        code: `import crypto from 'crypto';

// Encryption configuration (store key in secure vault like AWS KMS)
const ENCRYPTION_KEY = process.env.PHI_ENCRYPTION_KEY!; // 32 bytes for AES-256
const ALGORITHM = 'aes-256-gcm';

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

function encryptPHI(plaintext: string): EncryptedData {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex')
  };
}

// Usage
const patient = {
  id: 'patient-123',
  dateOfBirth: encryptPHI('1990-05-15'), // Store encrypted
};`
      },
      {
        title: 'Option 2: Use Environment Variables for Test Data',
        description: 'For development/test environments, load sample PHI from environment variables instead of hardcoding.',
        language: 'typescript',
        code: `// .env.development (add to .gitignore!)
// SAMPLE_DOB=1990-01-15

// config/sample-data.ts
export const samplePatient = {
  firstName: process.env.SAMPLE_FIRST_NAME || 'Test',
  lastName: process.env.SAMPLE_LAST_NAME || 'Patient',
  dateOfBirth: process.env.SAMPLE_DOB || '2000-01-01',
};

// For CI/CD, use secrets management
// GitHub Actions: secrets.SAMPLE_DOB
// AWS: AWS Secrets Manager`
      },
      {
        title: 'Option 3: Use Tokenization',
        description: 'Replace sensitive data with non-sensitive tokens that map to real values in a secure vault.',
        language: 'typescript',
        code: `import { v4 as uuidv4 } from 'uuid';

class PHITokenVault {
  private vault: Map<string, string> = new Map();

  tokenize(sensitiveData: string): string {
    const token = 'PHI_' + uuidv4();
    this.vault.set(token, sensitiveData);
    return token;
  }

  detokenize(token: string): string | null {
    return this.vault.get(token) || null;
  }
}

// Usage
const vault = new PHITokenVault();
const patient = {
  id: 'patient-123',
  dobToken: vault.tokenize('1990-05-15'),
};`
      }
    ],
    documentation: [
      { title: 'HIPAA Security Rule - Encryption Standards', url: 'https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html' },
      { title: 'NIST Cryptographic Standards', url: 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines' },
      { title: 'Node.js Crypto Documentation', url: 'https://nodejs.org/api/crypto.html' }
    ]
  },

  {
    id: 'phi-console-log',
    matchPatterns: ['PHI data in console output', 'Patient name in console', 'phi-console-log', 'Patient object serialized'],
    hipaaImpact: "Logging PHI to console or log files creates unauthorized copies of protected health information.\nConsole logs may be captured by monitoring tools, stored in plain text, or visible to unauthorized personnel.\nThis violates HIPAA's minimum necessary standard (§164.502(b)) and access controls (§164.312(a)(1)).",
    options: [
      {
        title: 'Option 1: Use Structured Logging with PHI Redaction',
        description: 'Implement a logging wrapper that automatically redacts PHI fields.',
        language: 'typescript',
        code: `import pino from 'pino';

// PHI fields to redact
const PHI_FIELDS = [
  'ssn', 'socialSecurityNumber', 'dateOfBirth', 'dob',
  'mrn', 'medicalRecordNumber', 'diagnosis', 'medication'
];

const logger = pino({
  redact: {
    paths: PHI_FIELDS.concat(PHI_FIELDS.map(f => '*.' + f)),
    censor: '[PHI REDACTED]'
  },
  level: process.env.LOG_LEVEL || 'info'
});

// Usage - PHI is automatically redacted
logger.info({ patient: { id: '123', ssn: '123-45-6789' } }, 'Patient loaded');
// Output: {"patient":{"id":"123","ssn":"[PHI REDACTED]"}}`
      },
      {
        title: 'Option 2: Create a Safe Logging Wrapper',
        description: 'Create utility functions that strip PHI before logging.',
        language: 'typescript',
        code: `interface SafePatient {
  id: string;
  hasInsurance: boolean;
  appointmentCount: number;
}

function toSafeLog<T extends { id: string }>(patient: T): SafePatient {
  return {
    id: patient.id,
    hasInsurance: 'insurance' in patient,
    appointmentCount: 'appointments' in patient
      ? (patient as any).appointments?.length || 0
      : 0
  };
}

// Usage
function processPatient(patient: Patient) {
  console.log('Processing patient:', toSafeLog(patient));
  // Logs: { id: '123', hasInsurance: true, appointmentCount: 3 }
}`
      }
    ],
    documentation: [
      { title: 'Pino Logger - Redaction', url: 'https://getpino.io/#/docs/redaction' },
      { title: 'Winston Logger', url: 'https://github.com/winstonjs/winston' },
      { title: 'OWASP Logging Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html' }
    ]
  },

  {
    id: 'phi-storage',
    matchPatterns: ['PHI stored in localStorage', 'PHI stored in sessionStorage', 'PHI stored in cookies', 'phi-localstorage'],
    hipaaImpact: "Browser storage (localStorage, sessionStorage, cookies) is not encrypted and can be accessed by any JavaScript on the page.\nThis creates severe XSS risks where attackers could steal PHI. Browser storage also persists across sessions.\nThis violates HIPAA encryption requirements (§164.312(a)(2)(iv)) and access controls.",
    options: [
      {
        title: 'Option 1: Use Server-Side Sessions Only',
        description: 'Store only a session ID in cookies, keep PHI server-side.',
        language: 'typescript',
        code: `import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,      // HTTPS only
    httpOnly: true,    // No JavaScript access
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  }
}));

// Store PHI in session, not browser
app.get('/api/patient/:id', async (req, res) => {
  const patient = await getPatient(req.params.id);
  req.session.currentPatient = patient; // Server-side only
  res.json({ id: patient.id }); // Only send ID to client
});`
      }
    ],
    documentation: [
      { title: 'OWASP Session Management', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html' },
      { title: 'Express Session', url: 'https://github.com/expressjs/session' }
    ]
  },

  // === Audit Logging Guides ===
  {
    id: 'no-audit-logging',
    matchPatterns: ['No audit logging framework detected', 'audit-framework-missing'],
    hipaaImpact: "HIPAA requires covered entities to implement audit controls that record and examine activity in systems containing PHI (§164.312(b)).\nWithout audit logging, you cannot detect unauthorized access, investigate breaches, or demonstrate compliance during audits.\nMissing audit logs can result in automatic assumption of breach during investigations.",
    options: [
      {
        title: 'Option 1: Implement Winston with HIPAA-Compliant Configuration',
        description: 'Set up Winston logger with file rotation, timestamps, and structured format.',
        language: 'typescript',
        code: `import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.json()
  ),
  defaultMeta: { service: 'healthcare-app' },
  transports: [
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '2190d', // 6 years retention
      zippedArchive: true,
    })
  ]
});

export function auditLog(action: string, details: {
  userId: string;
  patientId?: string;
  resource: string;
  success: boolean;
}) {
  auditLogger.info({ action, ...details, timestamp: new Date().toISOString() });
}`
      },
      {
        title: 'Option 2: Implement Pino with Async Logging',
        description: 'Use Pino for high-performance async logging.',
        language: 'typescript',
        code: `import pino from 'pino';

const transport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      options: { destination: './logs/audit.log' },
      level: 'info'
    }
  ]
});

const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['*.ssn', '*.dateOfBirth']
}, transport);

// Audit middleware
export function auditMiddleware(req: any, res: any, next: any) {
  res.on('finish', () => {
    logger.info({
      type: 'http_request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.user?.id
    });
  });
  next();
}`
      }
    ],
    documentation: [
      { title: 'Winston Documentation', url: 'https://github.com/winstonjs/winston' },
      { title: 'Pino Documentation', url: 'https://getpino.io/' },
      { title: 'HIPAA Audit Controls Guide', url: 'https://www.hhs.gov/hipaa/for-professionals/security/guidance/audit-controls/index.html' }
    ]
  },

  {
    id: 'phi-read-no-audit',
    matchPatterns: ['PHI read operation may lack audit logging', 'phi-access-unlogged'],
    hipaaImpact: "Every access to PHI must be logged per HIPAA's audit control requirements (§164.312(b)).\nWithout logging PHI access, you cannot detect unauthorized access, provide access reports to patients, or investigate breaches.",
    options: [
      {
        title: 'Option 1: Create an Audited Repository Pattern',
        description: 'Wrap data access with automatic audit logging.',
        language: 'typescript',
        code: `import { auditLog } from './audit-logger';

class AuditedPatientRepository {
  constructor(private db: Database, private getContext: () => { userId: string }) {}

  async findById(patientId: string): Promise<Patient | null> {
    const ctx = this.getContext();
    const patient = await this.db.patients.findUnique({ where: { id: patientId } });

    auditLog('PHI_READ', {
      userId: ctx.userId,
      patientId,
      resource: 'patient',
      success: !!patient,
      fieldsAccessed: patient ? Object.keys(patient) : []
    });

    return patient;
  }
}`
      },
      {
        title: 'Option 2: Use Prisma Middleware',
        description: 'Add audit logging middleware to Prisma client.',
        language: 'typescript',
        code: `import { PrismaClient } from '@prisma/client';
import { auditLog } from './audit-logger';

const prisma = new PrismaClient();
const PHI_MODELS = ['Patient', 'MedicalRecord', 'Prescription'];

prisma.$use(async (params, next) => {
  const { model, action, args } = params;

  if (!model || !PHI_MODELS.includes(model)) {
    return next(params);
  }

  const result = await next(params);

  auditLog('PHI_' + action.toUpperCase(), {
    userId: getCurrentUserId(),
    resource: model.toLowerCase(),
    patientId: args?.where?.id || result?.id,
    success: true
  });

  return result;
});`
      }
    ],
    documentation: [
      { title: 'Prisma Middleware', url: 'https://www.prisma.io/docs/concepts/components/prisma-client/middleware' },
      { title: 'HIPAA Audit Requirements', url: 'https://www.hhs.gov/hipaa/for-professionals/security/guidance/audit-controls/index.html' }
    ]
  },

  {
    id: 'data-deletion-no-audit',
    matchPatterns: ['Data deletion without apparent logging', 'unlogged-delete'],
    hipaaImpact: "PHI deletion must be logged to comply with HIPAA audit requirements and to prove proper data retention/destruction.\nHIPAA requires maintaining records of PHI dispositions for 6 years.",
    options: [
      {
        title: 'Option 1: Soft Delete with Audit Trail',
        description: 'Never hard delete PHI - use soft deletes with audit logging.',
        language: 'typescript',
        code: `async function softDeletePatient(
  patientId: string,
  userId: string,
  reason: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: patientId },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        deletionReason: reason
      }
    });

    await tx.phiAuditLog.create({
      data: {
        action: 'PHI_SOFT_DELETE',
        resourceType: 'patient',
        resourceId: patientId,
        userId,
        reason
      }
    });
  });
}`
      }
    ],
    documentation: [
      { title: 'HIPAA Retention Requirements', url: 'https://www.hhs.gov/hipaa/for-professionals/faq/580/does-hipaa-require-covered-entities-to-keep-medical-records/index.html' }
    ]
  },

  // === Security Guides ===
  {
    id: 'hardcoded-credentials',
    matchPatterns: ['Hardcoded password', 'Hardcoded secret', 'API key exposed', 'hardcoded-password', 'hardcoded-secret', 'api-key-exposed'],
    hipaaImpact: "Hardcoded credentials in source code violate HIPAA's access control requirements (§164.312(d)).\nCredentials in code can be exposed through version control, logs, or decompilation, creating unauthorized access paths to PHI.",
    options: [
      {
        title: 'Option 1: Use Environment Variables',
        description: 'Load credentials from environment variables with validation.',
        language: 'typescript',
        code: `import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(20),
  JWT_SECRET: z.string().min(32),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Missing environment variables:', result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();`
      },
      {
        title: 'Option 2: Use AWS Secrets Manager',
        description: 'Store and rotate secrets using AWS Secrets Manager.',
        language: 'typescript',
        code: `import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getSecrets(): Promise<{ apiKey: string; dbUrl: string }> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'healthcare-app/production' })
  );
  return JSON.parse(response.SecretString!);
}

// Usage
const secrets = await getSecrets();
const db = new Database(secrets.dbUrl);`
      }
    ],
    documentation: [
      { title: 'AWS Secrets Manager', url: 'https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html' },
      { title: 'dotenv for Node.js', url: 'https://github.com/motdotla/dotenv' },
      { title: 'OWASP Secrets Management', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html' }
    ]
  },

  {
    id: 'sql-injection',
    matchPatterns: ['SQL query string concatenation', 'SQL query with template literal', 'Database query with template', 'sql-injection'],
    hipaaImpact: "SQL injection can allow attackers to extract entire databases containing PHI, modify medical records, or bypass authentication.\nA single SQL injection vulnerability can result in a massive PHI breach affecting thousands of patients.",
    options: [
      {
        title: 'Option 1: Use Parameterized Queries',
        description: 'Always use parameterized queries or prepared statements.',
        language: 'typescript',
        code: `// BAD - SQL Injection vulnerable
const user = await db.query(
  'SELECT * FROM users WHERE id = ' + userId
);

// GOOD - Parameterized query (PostgreSQL)
const user = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// GOOD - Parameterized query (MySQL)
const user = await db.query(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);`
      },
      {
        title: 'Option 2: Use an ORM (Prisma)',
        description: 'ORMs automatically use parameterized queries.',
        language: 'typescript',
        code: `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Prisma automatically parameterizes - SAFE
const user = await prisma.user.findUnique({
  where: { id: userId }
});

const users = await prisma.user.findMany({
  where: {
    role: userRole,
    createdAt: { gte: startDate }
  }
});`
      }
    ],
    documentation: [
      { title: 'OWASP SQL Injection Prevention', url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html' },
      { title: 'Prisma Documentation', url: 'https://www.prisma.io/docs/' }
    ]
  },

  {
    id: 'xss-innerhtml',
    matchPatterns: ['Unsanitized innerHTML', 'dangerouslySetInnerHTML', 'innerHTML', 'document.write'],
    hipaaImpact: "Cross-Site Scripting (XSS) through innerHTML can allow attackers to steal session cookies, capture PHI displayed on screen, or perform actions on behalf of authenticated users.",
    options: [
      {
        title: 'Option 1: Use textContent Instead',
        description: 'For text-only content, use textContent which is XSS-safe.',
        language: 'typescript',
        code: `// BAD - XSS vulnerable
element.innerHTML = userInput;

// GOOD - Safe for text content
element.textContent = userInput;

// React - Use normal JSX (auto-escaped)
function PatientName({ name }: { name: string }) {
  return <span>{name}</span>; // Safe
}`
      },
      {
        title: 'Option 2: Sanitize HTML with DOMPurify',
        description: 'When HTML is required, sanitize with DOMPurify.',
        language: 'typescript',
        code: `import DOMPurify from 'dompurify';

const purifyConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
  ALLOWED_ATTR: []
};

// Sanitize before setting innerHTML
element.innerHTML = DOMPurify.sanitize(userHtml, purifyConfig);

// React with dangerouslySetInnerHTML
function RichText({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, purifyConfig);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}`
      }
    ],
    documentation: [
      { title: 'DOMPurify', url: 'https://github.com/cure53/DOMPurify' },
      { title: 'OWASP XSS Prevention', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html' }
    ]
  },

  {
    id: 'http-not-https',
    matchPatterns: ['Unencrypted HTTP URL', 'http-url', 'HTTP endpoint'],
    hipaaImpact: "HIPAA requires encryption of PHI in transit (§164.312(e)(1)).\nHTTP transmits data in plain text, allowing interception of PHI through network sniffing or man-in-the-middle attacks.",
    options: [
      {
        title: 'Option 1: Convert to HTTPS',
        description: 'Simply change http:// to https:// for external URLs.',
        language: 'typescript',
        code: `// BAD
const apiUrl = 'http://api.healthcare.com/patients';

// GOOD
const apiUrl = 'https://api.healthcare.com/patients';

// Better - use environment variables
const apiUrl = process.env.API_URL; // Set to https:// in env`
      },
      {
        title: 'Option 2: Enforce HTTPS at Application Level',
        description: 'Add middleware to redirect and enforce HTTPS.',
        language: 'typescript',
        code: `import helmet from 'helmet';

app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' &&
      process.env.NODE_ENV === 'production') {
    return res.redirect('https://' + req.header('host') + req.url);
  }
  next();
});`
      }
    ],
    documentation: [
      { title: 'Helmet.js Security', url: 'https://helmetjs.github.io/' },
      { title: 'HIPAA Transmission Security', url: 'https://www.hhs.gov/hipaa/for-professionals/security/guidance/transmission-security/index.html' }
    ]
  },

  {
    id: 'diagnosis-code-exposure',
    matchPatterns: ['Diagnosis code in source', 'ICD-10', 'diagnosis-code'],
    hipaaImpact: "ICD-10 diagnosis codes are considered PHI when associated with a patient.\nHardcoded diagnosis codes may indicate test data containing real patient information or improper handling of medical classifications.",
    options: [
      {
        title: 'Option 1: Load from Secure Configuration',
        description: 'Store diagnosis codes in encrypted configuration or database.',
        language: 'typescript',
        code: `// BAD - hardcoded diagnosis codes
const testPatient = {
  diagnosis: 'F32.1', // Major depressive disorder
};

// GOOD - load from secure source
async function getDiagnosisCodes() {
  return prisma.diagnosisCode.findMany({
    select: { code: true, description: true }
  });
}

// For test data, use obviously fake codes
const TEST_DIAGNOSIS = {
  code: 'TEST-001',
  description: 'Test Diagnosis - Not Real',
  isTestData: true
};`
      }
    ],
    documentation: [
      { title: 'FHIR Terminology Service', url: 'https://www.hl7.org/fhir/terminology-service.html' },
      { title: 'ICD-10 Code Set', url: 'https://www.cms.gov/medicare/coding-billing/icd-10-codes' }
    ]
  }
];

/**
 * Find the best matching remediation guide for a finding
 */
export function getRemediationGuide(finding: { title: string; id: string }): RemediationGuide | null {
  for (const guide of REMEDIATION_GUIDES) {
    for (const pattern of guide.matchPatterns) {
      if (finding.title.toLowerCase().includes(pattern.toLowerCase()) ||
          finding.id.toLowerCase().includes(pattern.toLowerCase())) {
        return guide;
      }
    }
  }
  return null;
}
