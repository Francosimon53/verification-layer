/**
 * Input Sanitization Security Detection Patterns
 * Detects unsafe user input handling and file upload configurations
 */

export interface SanitizationPattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  recommendation: string;
  category: string;
}

/**
 * SANITIZE-001: Unsanitized User Input in Database Operations
 * Detects req.body/req.params/req.query used directly in DB operations
 */
export const UNSANITIZED_DB_INPUT: SanitizationPattern = {
  id: 'SANITIZE-001',
  name: 'Unsanitized User Input in Database Operations',
  description:
    'User input from req.body, req.params, or req.query used directly in database operations (insert, update, query, sql, where) without validation (zod, yup, joi, validate, sanitize, parse)',
  severity: 'critical',
  hipaaReference: 'NPRM Anti-malware',
  patterns: [
    // Database operations with req.body - matches both .insert() and method calls
    /(?:insert|update|query|sql|where|execute)\s*\([^)]*req\.body/i,
    /(?:insert|update|query|sql|where|execute)\s*\([^)]*req\['body'\]/i,

    // Database operations with req.params
    /(?:insert|update|query|sql|where|execute)\s*\([^)]*req\.params/i,
    /(?:insert|update|query|sql|where|execute)\s*\([^)]*req\['params'\]/i,

    // Database operations with req.query
    /(?:insert|update|query|sql|where|execute)\s*\([^)]*req\.query/i,
    /(?:insert|update|query|sql|where|execute)\s*\([^)]*req\['query'\]/i,

    // SQL template literals with user input
    /(?:sql|query|execute)\s*`[^`]*\$\{req\.(?:body|params|query)/i,

    // Raw SQL queries with concatenation
    /(?:SELECT|INSERT|UPDATE|DELETE).*?\+\s*req\.(?:body|params|query)/i,

    // Prisma operations with unsanitized input
    /prisma\.\w+\.(?:create|update|upsert|delete)\s*\([^)]*req\.(?:body|params|query)/i,

    // Mongoose operations with unsanitized input
    /(?:create|findOneAndUpdate|updateOne|updateMany)\s*\([^)]*req\.(?:body|params|query)/i,

    // TypeORM operations
    /(?:save|insert|update)\s*\([^)]*req\.(?:body|params|query)/i,

    // Knex operations
    /knex\s*\([^)]*\)\.(?:insert|update|where)\s*\([^)]*req\.(?:body|params|query)/i,

    // Generic database method calls with chaining like .values(), .set(), .data
    /\.(?:values|set|data)\s*\([^)]*req\.(?:body|params|query)/i,

    // Direct method calls like User.create(req.body)
    /\w+\.create\s*\(\s*req\.(?:body|params|query)/i,
  ],
  negativePatterns: [
    // Validation libraries
    /zod/i,
    /yup/i,
    /joi/i,
    /validate/i,
    /sanitize/i,
    /parse(?:Int|Float|Body)?/i,
    /safeParse/i,

    // Schema validation
    /schema\.validate/i,
    /\.schema\(/i,

    // Type guards and checks
    /typeof\s+/i,
    /instanceof\s+/i,

    // Validation middleware
    /validationResult/i,
    /express-validator/i,

    // Safe wrappers
    /sanitized/i,
    /validated/i,
    /checked/i,
  ],
  recommendation:
    'Always validate and sanitize user input before database operations. Use validation libraries like Zod, Yup, or Joi. Example: const validated = schema.parse(req.body); await db.insert(validated). Never use raw req.body/params/query directly in database operations.',
  category: 'access-control',
};

/**
 * SANITIZE-002: Insecure File Upload Configuration
 * Detects file upload configuration without proper validation
 */
export const INSECURE_FILE_UPLOAD: SanitizationPattern = {
  id: 'SANITIZE-002',
  name: 'Insecure File Upload Configuration',
  description:
    'File upload configuration (multer, formidable, busboy) missing fileFilter, limits, or MIME type validation',
  severity: 'high',
  hipaaReference: 'NPRM Anti-malware',
  patterns: [
    // Multer configuration (will check context for validation)
    /multer\s*\(\s*\{/i,

    // Formidable without file validation
    /(?:new\s+)?formidable\.IncomingForm\s*\(/i,
    /formidable\(\s*\(/i,

    // Busboy without limits
    /(?:new\s+)?Busboy\s*\(\s*\{/i,
    /busboy\s*\(\s*\{/i,
  ],
  negativePatterns: [
    // Has fileFilter
    /fileFilter/i,

    // Has limits
    /limits\s*:/i,
    /fileSize/i,
    /maxFileSize/i,

    // Has MIME type validation
    /mimetype/i,
    /mimeType/i,
    /contentType/i,
    /allowedTypes/i,
    /allowedMimeTypes/i,

    // File type checking
    /\.endsWith\s*\(/i,
    /\.includes\s*\(/i,
    /test\s*\(/i, // regex test for file extensions

    // Validation functions
    /validateFile/i,
    /checkFileType/i,
    /isValidFile/i,
  ],
  recommendation:
    'Configure file upload middleware with proper validation. Example: multer({ fileFilter: (req, file, cb) => { if (allowedMimes.includes(file.mimetype)) cb(null, true); else cb(new Error("Invalid file type")); }, limits: { fileSize: 5 * 1024 * 1024 } }). Always validate file type, size, and extension.',
  category: 'access-control',
};

export const ALL_SANITIZATION_PATTERNS: SanitizationPattern[] = [
  UNSANITIZED_DB_INPUT,
  INSECURE_FILE_UPLOAD,
];
