/**
 * Role-Based Access Control (RBAC) Detection Patterns
 * Enforces proper authorization and minimum necessary principle per HIPAA
 */

export interface RBACPattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  hipaaReference: string;
  patterns: RegExp[];
  negativePatterns?: RegExp[]; // Patterns that indicate compliance
  recommendation: string;
  category: string;
}

/**
 * RBAC-001: PHI Data Access Without Role/Permission Verification
 * Detects database queries to PHI tables without authorization checks
 */
export const PHI_ACCESS_NO_AUTHZ: RBACPattern = {
  id: 'RBAC-001',
  name: 'PHI Data Access Without Role/Permission Verification',
  description:
    'Database query accessing PHI data (patient, health, medical, diagnosis, treatment, prescription) without role or permission verification',
  severity: 'high',
  hipaaReference: '45 CFR §164.312(a)(1) - Access Control',
  patterns: [
    // Database queries to PHI tables
    /(?:from|FROM)\s+(?:patients?|health_records?|medical_records?|diagnos[ei]s|treatments?|prescriptions?|medications?|encounters?|visits?|lab_results?)/i,
    /\.(?:from|table)\s*\(\s*['"`](?:patients?|health_records?|medical_records?|diagnos[ei]s|treatments?|prescriptions?|medications?|encounters?|visits?|lab_results?)['"`]/i,

    // ORM queries
    /(?:Patient|HealthRecord|MedicalRecord|Diagnosis|Treatment|Prescription|Medication|Encounter|Visit|LabResult)\.(?:find|findOne|findAll|findMany|query|where)/i,

    // Supabase/Prisma queries
    /supabase\.from\s*\(\s*['"`](?:patients?|health_records?|medical_records?|diagnos[ei]s|treatments?|prescriptions?|medications?)['"`]/i,
    /prisma\.(?:patient|healthRecord|medicalRecord|diagnosis|treatment|prescription|medication)\.(?:findMany|findUnique|findFirst)/i,
  ],
  negativePatterns: [
    // Indicators of authorization checks
    /role/i,
    /permission/i,
    /authorize/i,
    /isAdmin/i,
    /canAccess/i,
    /hasPermission/i,
    /checkAccess/i,
    /verifyRole/i,
    /requireRole/i,
    /isAuthorized/i,
    /checkPermission/i,
  ],
  recommendation:
    'Add role/permission verification before accessing PHI data. Example: if (!hasPermission(user, "read:patients")) throw new Error("Unauthorized"). Implement RBAC middleware to verify user roles before database queries.',
  category: 'access-control',
};

/**
 * RBAC-002: Service Role Keys in Client-Side Code
 * Detects privileged keys exposed to client, admin defaults, or always-admin conditions
 */
export const SERVICE_ROLE_CLIENT_SIDE: RBACPattern = {
  id: 'RBAC-002',
  name: 'Service Role Key or Admin Default in Client Code',
  description:
    'Privileged service_role key exposed in client-side code, isAdmin set to true as default, or conditions that always grant admin access',
  severity: 'critical',
  hipaaReference: '45 CFR §164.312(a)(1) - Access Control',
  patterns: [
    // Service role keys in client files
    /service_role/i,
    /serviceRole/i,
    /SERVICE_ROLE/i,

    // Admin defaults
    /isAdmin\s*[:=]\s*true/i,
    /role\s*[:=]\s*['"`]admin['"`]/i,
    /admin\s*:\s*true/i,

    // Always-admin conditions
    /if\s*\(\s*true\s*\).*admin/i,
    /const\s+isAdmin\s*=\s*true/i,
    /let\s+isAdmin\s*=\s*true/i,

    // Hardcoded admin users
    /userId\s*===?\s*['"`]admin['"`]/i,
    /email\s*===?\s*['"`]admin@/i,
  ],
  negativePatterns: [
    // Server-side context (API routes, server components)
    /\/api\//i,
    /\.server\./i,
    /getServerSideProps/i,
    /getStaticProps/i,
    // Environment variables (should be server-side only)
    /process\.env/i,
    // Test files
    /\.test\./i,
    /\.spec\./i,
    /describe\(/i,
  ],
  recommendation:
    'Remove service_role keys from client-side code - these should only exist in server-side API routes. Never default isAdmin to true. Implement proper role assignment based on authenticated user data from secure backend.',
  category: 'access-control',
};

/**
 * RBAC-003: SELECT * on PHI Tables (Violates Minimum Necessary)
 * Detects SELECT * queries that retrieve all columns from PHI tables
 */
export const SELECT_ALL_PHI: RBACPattern = {
  id: 'RBAC-003',
  name: 'SELECT * on PHI Tables Violates Minimum Necessary Principle',
  description:
    'Query uses SELECT * or .select("*") on tables containing PHI, retrieving more data than necessary in violation of HIPAA minimum necessary principle',
  severity: 'medium',
  hipaaReference:
    '45 CFR §164.502(b) - Minimum Necessary Requirement',
  patterns: [
    // SQL SELECT *
    /SELECT\s+\*\s+FROM\s+(?:patients?|health_records?|medical_records?|diagnos[ei]s|treatments?|prescriptions?|medications?|encounters?|visits?|lab_results?)/i,

    // ORM select all
    /\.select\s*\(\s*['"`]\*['"`]\s*\)/i,
    /\.select\s*\(\s*\*\s*\)/i,

    // Prisma/TypeORM select all fields
    /\.findMany\s*\(\s*\{[^}]*\}\s*\)(?!.*select)/i,
    /\.find\s*\(\s*\{[^}]*\}\s*\)(?!.*select)/i,

    // Supabase select all
    /supabase\.from\s*\([^)]*(?:patient|health|medical|diagnosis|treatment|prescription)[^)]*\)\.select\s*\(\s*['"`]\*['"`]/i,
  ],
  negativePatterns: [
    // Specific field selection
    /\.select\s*\(\s*['"`][a-zA-Z_,\s]+['"`]\s*\)/i,
    /SELECT\s+[a-zA-Z_,\s]+\s+FROM/i,
    // Projection/pick specific fields
    /select\s*:\s*\{/i,
    /pick\s*\(/i,
    /omit\s*\(/i,
  ],
  recommendation:
    'Select only the minimum necessary fields required for the operation. Example: Instead of SELECT * FROM patients, use SELECT id, name, dob FROM patients. For ORMs: .select("id, name, dob") or use field projections.',
  category: 'access-control',
};

export const ALL_RBAC_PATTERNS: RBACPattern[] = [
  PHI_ACCESS_NO_AUTHZ,
  SERVICE_ROLE_CLIENT_SIDE,
  SELECT_ALL_PHI,
];
