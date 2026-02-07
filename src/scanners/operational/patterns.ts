/**
 * Operational Security Detection Patterns
 * Detects backup configuration, data retention, and API security issues
 */

export interface OperationalPattern {
  id: string;
  name: string;
  description: string;
  severity: 'medium' | 'low';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  recommendation: string;
  category: string;
  requiresProjectScan?: boolean; // For patterns that need to scan entire project
}

/**
 * BACKUP-001: Database Without Backup Configuration
 * Detects database usage without backup/snapshot references in project
 */
export const DATABASE_WITHOUT_BACKUP: OperationalPattern = {
  id: 'BACKUP-001',
  name: 'Database Without Backup Configuration',
  description:
    'Database usage detected (supabase, prisma, mongoose, drizzle, typeorm, sequelize, knex) without backup/snapshot/replicate configuration references in project. Advisory: Full verification requires infrastructure inspection.',
  severity: 'medium',
  hipaaReference: '45 CFR §164.308(a)(7)(ii)(A) - Data Backup Plan',
  patterns: [
    // Database library imports
    /import.*from\s+['"]@supabase\/supabase-js['"]/i,
    /import.*from\s+['"]@prisma\/client['"]/i,
    /import.*from\s+['"]prisma['"]/i,
    /import.*from\s+['"]mongoose['"]/i,
    /import.*from\s+['"]drizzle-orm['"]/i,
    /import.*from\s+['"]typeorm['"]/i,
    /import.*from\s+['"]sequelize['"]/i,
    /import.*from\s+['"]knex['"]/i,

    // Database client initialization
    /new\s+PrismaClient\s*\(/i,
    /mongoose\.connect\s*\(/i,
    /createClient\s*\(.*supabase/i,
    /new\s+Sequelize\s*\(/i,
    /createConnection\s*\(.*typeorm/i,
  ],
  negativePatterns: [
    // Backup-related keywords (these are "good" - they prevent the finding)
    /backup/i,
    /snapshot/i,
    /replicate/i,
    /pg_dump/i,
    /mongodump/i,
    /restore/i,
    /\.backup\(/i,
    /backupSchedule/i,
    /automaticBackup/i,
  ],
  recommendation:
    'Configure automated database backups. Examples: Enable Supabase automatic backups, configure Prisma backup scripts, set up MongoDB Atlas continuous backups, or use pg_dump/mongodump in CI/CD. Document backup schedule and retention policy.',
  category: 'data-retention',
  requiresProjectScan: true, // This pattern needs to scan entire project
};

/**
 * RETENTION-001: PHI Records Without Retention Fields
 * Detects creation of PHI records without retention/expiration fields
 */
export const PHI_RECORDS_WITHOUT_RETENTION: OperationalPattern = {
  id: 'RETENTION-001',
  name: 'PHI Records Created Without Retention Fields',
  description:
    'PHI record creation (insert/create/save/upsert on patient/health/medical/clinical tables) without retention fields (expiresAt, ttl, retainUntil, retentionPeriod, deleteAfter). HIPAA requires minimum necessary retention periods.',
  severity: 'medium',
  hipaaReference: '45 CFR §164.316(b)(2)(i) - Retention Period',
  patterns: [
    // Prisma operations
    /prisma\.patient\.create\s*\(/i,
    /prisma\.health.*\.create\s*\(/i,
    /prisma\.medical.*\.create\s*\(/i,
    /prisma\.clinical.*\.create\s*\(/i,
    /prisma\.patient\.upsert\s*\(/i,
    /prisma\.health.*\.upsert\s*\(/i,

    // Mongoose operations
    /Patient\.create\s*\(/i,
    /Health.*\.create\s*\(/i,
    /Medical.*\.create\s*\(/i,
    /Clinical.*\.create\s*\(/i,
    /new\s+Patient\s*\(.*\)\.save\s*\(/i,

    // Generic ORM insert/create
    /db\.insert\s*\(\s*patient/i,
    /db\.insert\s*\(\s*health/i,
    /db\.insert\s*\(\s*medical/i,
    /db\.insert\s*\(\s*clinical/i,
    /\.insert\s*\(.*\)\s*\.into\s*\(\s*['"`]patient/i,
    /\.insert\s*\(.*\)\s*\.into\s*\(\s*['"`]health/i,

    // Sequelize operations
    /Patient\.create\s*\(\s*\{/i,
    /Health.*Model\.create\s*\(/i,
    /Medical.*\.upsert\s*\(/i,

    // Drizzle operations
    /db\.insert\s*\(.*patient.*\)/i,
    /insertInto\s*\(\s*patient/i,

    // Supabase operations
    /supabase\.from\s*\(\s*['"`]patient.*['"]\s*\)\.insert/i,
    /supabase\.from\s*\(\s*['"`]health.*['"]\s*\)\.insert/i,
    /supabase\.from\s*\(\s*['"`]medical.*['"]\s*\)\.insert/i,
  ],
  negativePatterns: [
    // Retention fields
    /expiresAt/i,
    /ttl/i,
    /retainUntil/i,
    /retentionPeriod/i,
    /deleteAfter/i,
    /retention_date/i,
    /expiration/i,
    /expires_at/i,
    /retain_until/i,
    /delete_after/i,

    // Test files
    /\.test\./i,
    /\.spec\./i,
    /describe\(/i,
    /it\(/i,
  ],
  recommendation:
    'Add retention fields to PHI record creation. Example: { ...patientData, expiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000) } or { ...data, retentionPeriod: "7years", deleteAfter: calculateDeleteDate() }. Define retention policy based on record type and regulatory requirements.',
  category: 'data-retention',
};

/**
 * API-002: JSON Body Parser Without Size Limit
 * Detects express.json() or bodyParser.json() without limit configuration
 */
export const BODY_PARSER_WITHOUT_LIMIT: OperationalPattern = {
  id: 'API-002',
  name: 'JSON Body Parser Without Size Limit',
  description:
    'express.json() or bodyParser.json() configured without limit option. Unlimited body size can lead to DoS attacks via large payload submissions.',
  severity: 'low',
  hipaaReference: '45 CFR §164.308(a)(1)(ii)(D) - System Security',
  patterns: [
    // express.json()
    /express\.json\s*\(\s*\)/i,
    /app\.use\s*\(\s*express\.json\s*\(\s*\)\s*\)/i,

    // bodyParser.json()
    /bodyParser\.json\s*\(\s*\)/i,
    /app\.use\s*\(\s*bodyParser\.json\s*\(\s*\)\s*\)/i,

    // express.json() with empty object
    /express\.json\s*\(\s*\{\s*\}\s*\)/i,
    /bodyParser\.json\s*\(\s*\{\s*\}\s*\)/i,
  ],
  negativePatterns: [
    // Has limit configured
    /limit\s*:/i,
    /\{\s*limit/i,
    /"limit"/i,
    /'limit'/i,

    // Has size configuration
    /size:/i,
    /maxBodySize/i,
  ],
  recommendation:
    'Configure body size limits. Example: app.use(express.json({ limit: "10mb" })) or bodyParser.json({ limit: "1mb" }). Set limit based on expected payload size. Typical values: 1mb for APIs, 10mb for file uploads.',
  category: 'access-control',
};

export const ALL_OPERATIONAL_PATTERNS: OperationalPattern[] = [
  DATABASE_WITHOUT_BACKUP,
  PHI_RECORDS_WITHOUT_RETENTION,
  BODY_PARSER_WITHOUT_LIMIT,
];
