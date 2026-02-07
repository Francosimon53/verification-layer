/**
 * Tests for Role-Based Access Control Scanner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rbacScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('RBAC Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbac-test-'));
  });

  afterEach(async () => {
    // Cleanup
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore
      }
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    testFiles = [];
  });

  async function createTestFile(
    filename: string,
    content: string
  ): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    testFiles.push(filePath);
    return filePath;
  }

  const scanOptions: ScanOptions = {
    path: tempDir,
  };

  describe('RBAC-001: PHI Access Without Authorization', () => {
    it('should detect SQL query to patients table without role check', async () => {
      const file = await createTestFile(
        'api.ts',
        `
export async function getPatients(req: Request) {
  const result = await db.query(
    'SELECT * FROM patients WHERE active = true'
  );
  return result.rows;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-001');

      expect(rbacFindings.length).toBeGreaterThan(0);
      expect(rbacFindings[0].severity).toBe('high');
      expect(rbacFindings[0].hipaaReference).toContain('164.312(a)(1)');
    });

    it('should detect ORM query to health_records without permission check', async () => {
      const file = await createTestFile(
        'records.ts',
        `
async function getMedicalRecords(patientId: string) {
  const records = await MedicalRecord.findAll({
    where: { patientId }
  });
  return records;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-001');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should detect Supabase query to prescriptions without authorization', async () => {
      const file = await createTestFile(
        'prescriptions.ts',
        `
export async function getPrescriptions(userId: string) {
  const { data } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('user_id', userId);
  return data;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-001');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should detect Prisma query to patients without role verification', async () => {
      const file = await createTestFile(
        'patient-service.ts',
        `
async function listPatients() {
  const patients = await prisma.patient.findMany({
    take: 100
  });
  return patients;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-001');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should not flag query with role verification', async () => {
      const file = await createTestFile(
        'secure-api.ts',
        `
export async function getPatients(req: Request, user: User) {
  if (!hasPermission(user, 'read:patients')) {
    throw new Error('Unauthorized');
  }

  const result = await db.query(
    'SELECT * FROM patients WHERE active = true'
  );
  return result.rows;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-001');

      expect(rbacFindings.length).toBe(0);
    });

    it('should not flag query with isAdmin check', async () => {
      const file = await createTestFile(
        'admin-route.ts',
        `
async function getMedicalRecords(user: User) {
  if (!user.isAdmin) {
    throw new ForbiddenError();
  }

  const records = await MedicalRecord.findAll();
  return records;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-001');

      expect(rbacFindings.length).toBe(0);
    });

    it('should not flag query with canAccess verification', async () => {
      const file = await createTestFile(
        'authorization.ts',
        `
export async function getDiagnosis(diagnosisId: string, userId: string) {
  const canAccess = await checkAccess(userId, 'diagnosis', diagnosisId);
  if (!canAccess) return null;

  const diagnosis = await db.query(
    'SELECT * FROM diagnosis WHERE id = $1',
    [diagnosisId]
  );
  return diagnosis;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-001');

      expect(rbacFindings.length).toBe(0);
    });
  });

  describe('RBAC-002: Service Role in Client-Side Code', () => {
    it('should detect service_role in client component', async () => {
      const file = await createTestFile(
        'components/Dashboard.tsx',
        `
'use client';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://myproject.supabase.co',
  'eyJhbGci...service_role_key_here'
);

export function Dashboard() {
  return <div>Dashboard</div>;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-002');

      expect(rbacFindings.length).toBeGreaterThan(0);
      expect(rbacFindings[0].severity).toBe('critical');
    });

    it('should detect serviceRole in pages directory', async () => {
      const file = await createTestFile(
        'pages/admin.tsx',
        `
const serviceRole = 'secret_service_role_key';

export default function AdminPage() {
  return <div>Admin</div>;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-002');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should detect isAdmin default to true', async () => {
      const file = await createTestFile(
        'components/UserProfile.tsx',
        `
export function UserProfile() {
  const [isAdmin, setIsAdmin] = useState(true);

  return (
    <div>
      {isAdmin && <AdminPanel />}
    </div>
  );
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-002');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should detect role default to admin', async () => {
      const file = await createTestFile(
        'app/layout.tsx',
        `
const user = {
  email: 'user@example.com',
  role: 'admin'
};

export default function Layout() {
  return <div />;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-002');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should detect always-admin condition', async () => {
      const file = await createTestFile(
        'components/Auth.tsx',
        `
function checkAdmin() {
  const isAdmin = true;
  if (isAdmin) {
    return <AdminDashboard />;
  }
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-002');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should not flag service_role in API route', async () => {
      const file = await createTestFile(
        'api/admin.ts',
        `
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req: Request) {
  const data = await supabase.from('users').select('*');
  return Response.json(data);
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-002');

      expect(rbacFindings.length).toBe(0);
    });

    it('should not flag service_role in .server file', async () => {
      const file = await createTestFile(
        'lib/supabase.server.ts',
        `
export const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-002');

      expect(rbacFindings.length).toBe(0);
    });

    it('should not flag isAdmin in test files', async () => {
      const file = await createTestFile(
        'components/Auth.test.tsx',
        `
describe('Auth', () => {
  it('should grant admin access', () => {
    const isAdmin = true;
    expect(isAdmin).toBe(true);
  });
});
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-002');

      expect(rbacFindings.length).toBe(0);
    });
  });

  describe('RBAC-003: SELECT * on PHI Tables', () => {
    it('should detect SELECT * FROM patients', async () => {
      const file = await createTestFile(
        'queries.ts',
        `
async function getAllPatients() {
  const result = await db.query('SELECT * FROM patients');
  return result.rows;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-003');

      expect(rbacFindings.length).toBeGreaterThan(0);
      expect(rbacFindings[0].severity).toBe('medium');
      expect(rbacFindings[0].hipaaReference).toContain('164.502(b)');
    });

    it('should detect SELECT * FROM medical_records', async () => {
      const file = await createTestFile(
        'medical.ts',
        `
const query = \`
  SELECT * FROM medical_records
  WHERE patient_id = ?
\`;
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-003');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should detect .select("*") on prescriptions', async () => {
      const file = await createTestFile(
        'prescriptions-api.ts',
        `
export async function getPrescriptions(patientId: string) {
  const { data } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('patient_id', patientId);
  return data;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-003');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should detect .select(*) without quotes', async () => {
      const file = await createTestFile(
        'diagnosis.ts',
        `
const diagnoses = await db.from('diagnosis').select(*);
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-003');

      expect(rbacFindings.length).toBeGreaterThan(0);
    });

    it('should not flag SELECT with specific fields', async () => {
      const file = await createTestFile(
        'minimal-query.ts',
        `
async function getPatientNames() {
  const result = await db.query(
    'SELECT id, name, dob FROM patients WHERE active = true'
  );
  return result.rows;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-003');

      expect(rbacFindings.length).toBe(0);
    });

    it('should not flag .select() with specific fields', async () => {
      const file = await createTestFile(
        'specific-fields.ts',
        `
const { data } = await supabase
  .from('prescriptions')
  .select('id, medication_name, dosage, patient_id')
  .eq('patient_id', patientId);
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-003');

      expect(rbacFindings.length).toBe(0);
    });

    it('should not flag SELECT * on non-PHI tables', async () => {
      const file = await createTestFile(
        'settings.ts',
        `
const settings = await db.query('SELECT * FROM app_settings');
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-003');

      expect(rbacFindings.length).toBe(0);
    });
  });

  describe('General Scanner Behavior', () => {
    it('should only scan code files', async () => {
      await createTestFile('README.md', 'SELECT * FROM patients');
      await createTestFile('data.json', '{"query": "SELECT * FROM patients"}');
      await createTestFile('code.ts', 'SELECT * FROM patients');

      const findings = await rbacScanner.scan(testFiles, scanOptions);

      // Should only find findings in .ts file
      const mdFindings = findings.filter((f) => f.file.endsWith('.md'));
      const jsonFindings = findings.filter((f) => f.file.endsWith('.json'));

      expect(mdFindings.length).toBe(0);
      expect(jsonFindings.length).toBe(0);
    });

    it('should skip comment lines', async () => {
      const file = await createTestFile(
        'commented.ts',
        `
// SELECT * FROM patients - this is how you would do it
/*
 * const result = await db.query('SELECT * FROM patients');
 */
const validCode = true;
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);
      const rbacFindings = findings.filter((f) => f.id === 'RBAC-003');

      expect(rbacFindings.length).toBe(0);
    });

    it('should include confidence scores', async () => {
      const file = await createTestFile(
        'test.ts',
        `
const patients = await db.query('SELECT * FROM patients');
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);

      for (const finding of findings) {
        expect(finding.confidence).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(finding.confidence);
      }
    });

    it('should include proper HIPAA references', async () => {
      const file = await createTestFile(
        'multi-violation.ts',
        `
// RBAC-001 violation
const records = await MedicalRecord.findAll();

// RBAC-003 violation
const query = 'SELECT * FROM diagnoses';
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);

      for (const finding of findings) {
        expect(finding.hipaaReference).toBeDefined();
        expect(finding.hipaaReference).toMatch(/164\./);
      }
    });

    it('should detect multiple violations in same file', async () => {
      const file = await createTestFile(
        'components/BadComponent.tsx',
        `
'use client';

// RBAC-002: service_role in client
const SERVICE_ROLE_KEY = 'service_role_secret';

// RBAC-002: admin default
const [isAdmin, setIsAdmin] = useState(true);

async function loadData() {
  // RBAC-001: No authorization check
  const patients = await db.from('patients').select('*');

  // RBAC-003: SELECT *
  return patients;
}
        `
      );

      const findings = await rbacScanner.scan([file], scanOptions);

      expect(findings.length).toBeGreaterThan(2);

      const rbac001 = findings.filter((f) => f.id === 'RBAC-001');
      const rbac002 = findings.filter((f) => f.id === 'RBAC-002');
      const rbac003 = findings.filter((f) => f.id === 'RBAC-003');

      expect(rbac001.length).toBeGreaterThan(0);
      expect(rbac002.length).toBeGreaterThan(0);
      expect(rbac003.length).toBeGreaterThan(0);
    });
  });
});
