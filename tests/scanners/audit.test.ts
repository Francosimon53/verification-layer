import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { auditScanner } from '../../src/scanners/audit/index.js';
import type { ScanOptions } from '../../src/types.js';

const TEST_DIR = join(process.cwd(), '.tmp-audit-scan');

const defaultOptions: ScanOptions = {
  path: TEST_DIR,
};

async function createTestFile(filename: string, content: string): Promise<string> {
  const filePath = join(TEST_DIR, filename);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('Audit Scanner', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('Logging Framework Detection', () => {
    it('should detect missing logging framework in package.json', async () => {
      const file = await createTestFile('package.json', `{
        "name": "test-app",
        "dependencies": {
          "express": "^4.18.0"
        }
      }`);

      const findings = await auditScanner.scan([file], defaultOptions);

      const frameworkFinding = findings.find(f => f.id === 'audit-no-framework');
      expect(frameworkFinding).toBeDefined();
      expect(frameworkFinding?.severity).toBe('high');
      expect(frameworkFinding?.hipaaReference).toBe('§164.312(b)');
    });

    it('should NOT flag when winston is present', async () => {
      const file = await createTestFile('package-winston.json', `{
        "name": "test-app",
        "dependencies": {
          "winston": "^3.8.0"
        }
      }`);

      const findings = await auditScanner.scan([file], defaultOptions);

      const frameworkFinding = findings.find(f => f.id === 'audit-no-framework');
      expect(frameworkFinding).toBeUndefined();
    });

    it('should NOT flag when pino is present', async () => {
      const file = await createTestFile('package-pino.json', `{
        "name": "test-app",
        "dependencies": {
          "pino": "^8.0.0"
        }
      }`);

      const findings = await auditScanner.scan([file], defaultOptions);

      const frameworkFinding = findings.find(f => f.id === 'audit-no-framework');
      expect(frameworkFinding).toBeUndefined();
    });

    it('should NOT flag when bunyan is present', async () => {
      const file = await createTestFile('package-bunyan.json', `{
        "name": "test-app",
        "dependencies": {
          "bunyan": "^1.8.0"
        }
      }`);

      const findings = await auditScanner.scan([file], defaultOptions);

      const frameworkFinding = findings.find(f => f.id === 'audit-no-framework');
      expect(frameworkFinding).toBeUndefined();
    });

    it('should NOT flag when log4js is present', async () => {
      const file = await createTestFile('package-log4js.json', `{
        "name": "test-app",
        "dependencies": {
          "log4js": "^6.9.0"
        }
      }`);

      const findings = await auditScanner.scan([file], defaultOptions);

      const frameworkFinding = findings.find(f => f.id === 'audit-no-framework');
      expect(frameworkFinding).toBeUndefined();
    });

    it('should NOT flag when morgan is present', async () => {
      const file = await createTestFile('package-morgan.json', `{
        "name": "test-app",
        "dependencies": {
          "morgan": "^1.10.0"
        }
      }`);

      const findings = await auditScanner.scan([file], defaultOptions);

      const frameworkFinding = findings.find(f => f.id === 'audit-no-framework');
      expect(frameworkFinding).toBeUndefined();
    });
  });

  describe('Unlogged PHI Operations Detection', () => {
    describe('Create Operations', () => {
      it('should detect unlogged create operation on patient data', async () => {
        const file = await createTestFile('patient-service.ts', `
          class PatientService {
            async createPatient(data) {
              return this.db.create(data);
            }
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const createFinding = findings.find(f => f.id.includes('audit-unlogged-create'));
        expect(createFinding).toBeDefined();
        expect(createFinding?.severity).toBe('medium');
      });

      it('should detect unlogged insert operation on health data', async () => {
        const file = await createTestFile('health-repo.ts', `
          function saveHealthRecord(record) {
            return db.insert(record);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const insertFinding = findings.find(f => f.id.includes('audit-unlogged-create'));
        expect(insertFinding).toBeDefined();
      });

      it('should detect unlogged save operation', async () => {
        const file = await createTestFile('medical-model.ts', `
          async function storeMedicalRecord(data) {
            await record.save(data);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const saveFinding = findings.find(f => f.id.includes('audit-unlogged-create'));
        expect(saveFinding).toBeDefined();
      });
    });

    describe('Update Operations', () => {
      it('should detect unlogged update operation on patient data', async () => {
        const file = await createTestFile('patient-update.ts', `
          class PatientRepo {
            async updatePatient(id, data) {
              return this.db.update(data);
            }
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const updateFinding = findings.find(f => f.id.includes('audit-unlogged-update'));
        expect(updateFinding).toBeDefined();
      });

      it('should detect unlogged modify operation', async () => {
        const file = await createTestFile('health-modify.ts', `
          function modifyHealthRecord(record) {
            return record.modify(updates);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const modifyFinding = findings.find(f => f.id.includes('audit-unlogged-update'));
        expect(modifyFinding).toBeDefined();
      });

      it('should detect unlogged patch operation', async () => {
        const file = await createTestFile('medical-patch.ts', `
          async function patchMedicalData(id, changes) {
            await api.patch(changes);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const patchFinding = findings.find(f => f.id.includes('audit-unlogged-update'));
        expect(patchFinding).toBeDefined();
      });
    });

    describe('Delete Operations', () => {
      it('should detect unlogged delete operation on patient data', async () => {
        const file = await createTestFile('patient-delete.ts', `
          class PatientService {
            async deletePatient(id) {
              return this.db.delete(id);
            }
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const deleteFinding = findings.find(f => f.id.includes('audit-unlogged-delete'));
        expect(deleteFinding).toBeDefined();
      });

      it('should detect unlogged remove operation', async () => {
        const file = await createTestFile('health-remove.ts', `
          function removeHealthRecord(id) {
            return records.remove(id);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const removeFinding = findings.find(f => f.id.includes('audit-unlogged-delete'));
        expect(removeFinding).toBeDefined();
      });

      it('should detect unlogged destroy operation', async () => {
        const file = await createTestFile('medical-destroy.ts', `
          async function destroyMedicalRecord(record) {
            await record.destroy();
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const destroyFinding = findings.find(f => f.id.includes('audit-unlogged-delete'));
        expect(destroyFinding).toBeDefined();
      });
    });

    describe('Read Operations', () => {
      it('should detect unlogged read operation on patient data', async () => {
        const file = await createTestFile('patient-read.ts', `
          class PatientRepo {
            async getPatient(id) {
              return this.db.read(id);
            }
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const readFinding = findings.find(f => f.id.includes('audit-unlogged-read'));
        expect(readFinding).toBeDefined();
      });

      it('should detect unlogged get operation', async () => {
        const file = await createTestFile('health-get.ts', `
          function getHealthRecords(patientId) {
            return api.get(patientId);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const getFinding = findings.find(f => f.id.includes('audit-unlogged-read'));
        expect(getFinding).toBeDefined();
      });

      it('should detect unlogged find operation', async () => {
        const file = await createTestFile('medical-find.ts', `
          async function findMedicalRecords(query) {
            return db.find(query);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const findFinding = findings.find(f => f.id.includes('audit-unlogged-read'));
        expect(findFinding).toBeDefined();
      });

      it('should detect unlogged fetch operation', async () => {
        const file = await createTestFile('diagnosis-fetch.ts', `
          async function fetchDiagnosis(id) {
            return service.fetch(id);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const fetchFinding = findings.find(f => f.id.includes('audit-unlogged-read'));
        expect(fetchFinding).toBeDefined();
      });
    });

    describe('Auth Operations', () => {
      it('should detect unlogged login operation in patient context', async () => {
        const file = await createTestFile('patient-auth.ts', `
          class PatientPortal {
            async loginPatient(credentials) {
              return auth.login(credentials);
            }
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const loginFinding = findings.find(f => f.id.includes('audit-unlogged-auth'));
        expect(loginFinding).toBeDefined();
      });

      it('should detect unlogged authenticate operation', async () => {
        const file = await createTestFile('health-auth.ts', `
          function authenticateHealthProvider(token) {
            return auth.authenticate(token);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const authFinding = findings.find(f => f.id.includes('audit-unlogged-auth'));
        expect(authFinding).toBeDefined();
      });

      it('should detect unlogged authorize operation', async () => {
        const file = await createTestFile('medical-authorize.ts', `
          async function authorizeMedicalAccess(user, resource) {
            return permissions.authorize(user, resource);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const authorizeFinding = findings.find(f => f.id.includes('audit-unlogged-auth'));
        expect(authorizeFinding).toBeDefined();
      });
    });
  });

  describe('False Positive Prevention', () => {
    describe('Files with Logging', () => {
      it('should NOT flag when .log() is present', async () => {
        const file = await createTestFile('patient-logged.ts', `
          class PatientService {
            async createPatient(data) {
              this.logger.log('Creating patient', { userId: user.id });
              return this.db.create(data);
            }
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });

      it('should NOT flag when .info() is present', async () => {
        const file = await createTestFile('health-info-log.ts', `
          function updateHealthRecord(data) {
            logger.info('Updating health record');
            return db.update(data);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });

      it('should NOT flag when .warn() is present', async () => {
        const file = await createTestFile('medical-warn-log.ts', `
          async function deleteMedicalRecord(id) {
            logger.warn('Deleting medical record', { id });
            return db.delete(id);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });

      it('should NOT flag when .error() is present', async () => {
        const file = await createTestFile('patient-error-log.ts', `
          async function getPatient(id) {
            try {
              return db.get(id);
            } catch (e) {
              logger.error('Failed to get patient', e);
            }
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });

      it('should NOT flag when .audit() is present', async () => {
        const file = await createTestFile('health-audit-log.ts', `
          function createHealthRecord(data) {
            auditLogger.audit('health_record_created', { userId: user.id });
            return db.create(data);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });

      it('should NOT flag when logger. is used', async () => {
        const file = await createTestFile('medical-logger.ts', `
          async function saveMedicalData(data) {
            logger.debug('Saving medical data');
            return db.save(data);
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });
    });

    describe('Non-PHI Files', () => {
      it('should NOT flag operations in non-PHI context', async () => {
        const file = await createTestFile('user-service.ts', `
          class UserService {
            async createUser(data) {
              return this.db.create(data);
            }
            async deleteUser(id) {
              return this.db.delete(id);
            }
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });

      it('should NOT flag generic CRUD operations', async () => {
        const file = await createTestFile('product-repo.ts', `
          class ProductRepository {
            create(product) { return db.insert(product); }
            read(id) { return db.get(id); }
            update(id, data) { return db.update(data); }
            delete(id) { return db.remove(id); }
          }
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });
    });

    describe('Test Files', () => {
      it('should NOT flag test files', async () => {
        const file = await createTestFile('patient.test.ts', `
          describe('PatientService', () => {
            it('should create patient', async () => {
              await service.create(patientData);
            });
          });
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });

      it('should NOT flag spec files', async () => {
        const file = await createTestFile('health.spec.ts', `
          describe('HealthService', () => {
            it('should delete health record', async () => {
              await service.delete(recordId);
            });
          });
        `);

        const findings = await auditScanner.scan([file], defaultOptions);

        const unloggedFinding = findings.find(f => f.id.includes('audit-unlogged'));
        expect(unloggedFinding).toBeUndefined();
      });
    });
  });

  describe('Finding Metadata', () => {
    it('should include correct HIPAA reference', async () => {
      const file = await createTestFile('hipaa-ref.ts', `
        class PatientRepo {
          async createPatient(data) {
            return this.db.create(data);
          }
        }
      `);

      const findings = await auditScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('audit-unlogged'));
      expect(finding?.hipaaReference).toBe('§164.312(b)');
    });

    it('should include line number in finding', async () => {
      const file = await createTestFile('line-num.ts', `// line 1
// line 2
// patient service
function createPatient(data) { // line 4
  return db.create(data); // line 5
}
`);

      const findings = await auditScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('audit-unlogged'));
      expect(finding?.line).toBe(5);
    });

    it('should include context lines', async () => {
      const file = await createTestFile('context.ts', `const a = 1;
const b = 2;
// patient handler
function savePatient(data) {
  return db.create(data);
}
const c = 3;
`);

      const findings = await auditScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('audit-unlogged'));
      expect(finding?.context).toBeDefined();
      expect(finding?.context?.length).toBeGreaterThan(0);
    });

    it('should include appropriate recommendation', async () => {
      const file = await createTestFile('recommendation.ts', `
        class PatientService {
          deletePatient(id) {
            return db.delete(id);
          }
        }
      `);

      const findings = await auditScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('audit-unlogged-delete'));
      expect(finding?.recommendation).toContain('delete');
      expect(finding?.recommendation).toContain('Log');
    });
  });

  describe('Multiple PHI Keywords', () => {
    it('should detect issues with treatment keyword', async () => {
      const file = await createTestFile('treatment.ts', `
        class TreatmentService {
          async deleteTreatmentPlan(id) {
            return this.db.delete(id);
          }
        }
      `);

      const findings = await auditScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('audit-unlogged'));
      expect(finding).toBeDefined();
    });

    it('should detect issues with diagnosis keyword', async () => {
      const file = await createTestFile('diagnosis-service.ts', `
        function updateDiagnosis(id, data) {
          return db.update(data);
        }
      `);

      const findings = await auditScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('audit-unlogged'));
      expect(finding).toBeDefined();
    });
  });
});
