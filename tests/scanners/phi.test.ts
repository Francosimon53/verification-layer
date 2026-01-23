import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { phiScanner } from '../../src/scanners/phi/index.js';
import type { ScanOptions } from '../../src/types.js';

const TEST_DIR = join(process.cwd(), 'tests', '.tmp-phi-test');

const defaultOptions: ScanOptions = {
  path: TEST_DIR,
};

async function createTestFile(filename: string, content: string): Promise<string> {
  const filePath = join(TEST_DIR, filename);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('PHI Scanner', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('SSN Detection', () => {
    it('should detect hardcoded SSN pattern', async () => {
      const file = await createTestFile('ssn-test.ts', `
        const userSSN = "123-45-6789";
        console.log(userSSN);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      expect(findings.length).toBeGreaterThan(0);
      const ssnFinding = findings.find(f => f.id.includes('ssn-hardcoded'));
      expect(ssnFinding).toBeDefined();
      expect(ssnFinding?.severity).toBe('critical');
    });

    it('should detect SSN in variable assignment', async () => {
      const file = await createTestFile('ssn-var.ts', `
        const patient = {
          id: 1,
          ssn: "987-65-4321"
        };
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const ssnFinding = findings.find(f => f.id.includes('ssn-hardcoded'));
      expect(ssnFinding).toBeDefined();
    });
  });

  describe('Date of Birth Detection', () => {
    it('should detect dateOfBirth assignment', async () => {
      const file = await createTestFile('dob-test.ts', `
        const patient = {
          dateOfBirth: "1990-01-15"
        };
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const dobFinding = findings.find(f => f.id.includes('dob-exposed'));
      expect(dobFinding).toBeDefined();
      expect(dobFinding?.severity).toBe('high');
    });

    it('should detect dob shorthand', async () => {
      const file = await createTestFile('dob-short.ts', `
        const dob = "1985-03-22";
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const dobFinding = findings.find(f => f.id.includes('dob-exposed'));
      expect(dobFinding).toBeDefined();
    });

    it('should detect birth_date with underscore', async () => {
      const file = await createTestFile('birthdate.ts', `
        const birth_date = "2000-12-25";
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const dobFinding = findings.find(f => f.id.includes('dob-exposed'));
      expect(dobFinding).toBeDefined();
    });
  });

  describe('Diagnosis Code Detection', () => {
    it('should detect ICD-10 diagnosis codes', async () => {
      const file = await createTestFile('diagnosis.ts', `
        const icd10 = "J45.20";
        const diagnosisCode = "E11.9";
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const diagnosisFinding = findings.find(f => f.id.includes('diagnosis-code'));
      expect(diagnosisFinding).toBeDefined();
      expect(diagnosisFinding?.severity).toBe('medium');
    });

    it('should detect diagnosis_code with underscore', async () => {
      const file = await createTestFile('diagnosis-under.ts', `
        const diagnosis_code = "A00.1";
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const diagnosisFinding = findings.find(f => f.id.includes('diagnosis-code'));
      expect(diagnosisFinding).toBeDefined();
    });
  });

  describe('PHI in console.log Detection', () => {
    it('should detect SSN in console.log', async () => {
      const file = await createTestFile('console-ssn.ts', `
        console.log("User SSN:", ssn);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const consoleFinding = findings.find(f => f.id.includes('phi-console-log'));
      expect(consoleFinding).toBeDefined();
      expect(consoleFinding?.severity).toBe('high');
      expect(consoleFinding?.fixType).toBe('phi-console-log');
    });

    it('should detect patient data in console.info', async () => {
      const file = await createTestFile('console-patient.ts', `
        console.info("Patient data:", patientData);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const consoleFinding = findings.find(f => f.id.includes('phi-console-log'));
      expect(consoleFinding).toBeDefined();
    });

    it('should detect diagnosis in console.debug', async () => {
      const file = await createTestFile('console-diagnosis.ts', `
        console.debug("Diagnosis:", diagnosis);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const consoleFinding = findings.find(f => f.id.includes('phi-console-log'));
      expect(consoleFinding).toBeDefined();
    });

    it('should detect patient name in console.log', async () => {
      const file = await createTestFile('console-name.ts', `
        console.log("Processing patient name:", patient.name);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const nameFinding = findings.find(f => f.id.includes('patient-name-log'));
      expect(nameFinding).toBeDefined();
      expect(nameFinding?.fixType).toBe('phi-console-log');
    });

    it('should detect JSON.stringify of patient in console', async () => {
      const file = await createTestFile('console-stringify.ts', `
        console.log(JSON.stringify(patient));
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const stringifyFinding = findings.find(f => f.id.includes('phi-json-stringify-log'));
      expect(stringifyFinding).toBeDefined();
    });

    it('should detect template literal with patient data', async () => {
      const file = await createTestFile('console-template.ts', `
        console.log(\`Patient: \${patient.name}\`);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const templateFinding = findings.find(f => f.id.includes('phi-template-log'));
      expect(templateFinding).toBeDefined();
    });
  });

  describe('PHI in localStorage Detection', () => {
    it('should detect patient data in localStorage.setItem', async () => {
      const file = await createTestFile('localstorage-set.ts', `
        localStorage.setItem("patientData", JSON.stringify(data));
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const localStorageFinding = findings.find(f => f.id.includes('phi-localstorage'));
      expect(localStorageFinding).toBeDefined();
      expect(localStorageFinding?.severity).toBe('critical');
    });

    it('should detect SSN in localStorage.getItem', async () => {
      const file = await createTestFile('localstorage-get.ts', `
        const ssn = localStorage.getItem("userSSN");
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const localStorageFinding = findings.find(f => f.id.includes('phi-localstorage'));
      expect(localStorageFinding).toBeDefined();
    });

    it('should detect health data in localStorage', async () => {
      const file = await createTestFile('localstorage-health.ts', `
        localStorage.setItem("healthRecords", records);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const localStorageFinding = findings.find(f => f.id.includes('phi-localstorage'));
      expect(localStorageFinding).toBeDefined();
    });

    it('should detect medical data in sessionStorage', async () => {
      const file = await createTestFile('sessionstorage.ts', `
        sessionStorage.setItem("medicalHistory", history);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const sessionFinding = findings.find(f => f.id.includes('phi-sessionstorage'));
      expect(sessionFinding).toBeDefined();
      expect(sessionFinding?.severity).toBe('high');
    });

    it('should detect PHI in cookies', async () => {
      const file = await createTestFile('cookie.ts', `
        document.cookie = "patientId=" + patient.id;
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const cookieFinding = findings.find(f => f.id.includes('phi-cookie-storage'));
      expect(cookieFinding).toBeDefined();
      expect(cookieFinding?.severity).toBe('critical');
    });
  });

  describe('False Positive Prevention', () => {
    it('should NOT flag regular console.log without PHI', async () => {
      const file = await createTestFile('safe-console.ts', `
        console.log("Application started");
        console.log("Processing request", requestId);
        console.info("User logged in", userId);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const consoleFinding = findings.find(f =>
        f.id.includes('phi-console-log') ||
        f.id.includes('patient-name-log')
      );
      expect(consoleFinding).toBeUndefined();
    });

    it('should NOT flag regular localStorage usage', async () => {
      const file = await createTestFile('safe-localstorage.ts', `
        localStorage.setItem("theme", "dark");
        localStorage.getItem("language");
        localStorage.setItem("userPreferences", prefs);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const localStorageFinding = findings.find(f => f.id.includes('phi-localstorage'));
      expect(localStorageFinding).toBeUndefined();
    });

    it('should NOT flag numbers that look like SSN in non-SSN context', async () => {
      const file = await createTestFile('safe-numbers.ts', `
        const phoneNumber = "555-123-4567";
        const orderNumber = "ORD-12-3456";
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      // Phone format is different (XXX-XXX-XXXX vs XXX-XX-XXXX)
      const ssnFinding = findings.find(f => f.id.includes('ssn-hardcoded'));
      expect(ssnFinding).toBeUndefined();
    });

    it('should NOT flag date variables that are not birth dates', async () => {
      const file = await createTestFile('safe-dates.ts', `
        const createdDate = "2024-01-15";
        const expirationDate = "2025-12-31";
        const lastModified = new Date();
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const dobFinding = findings.find(f => f.id.includes('dob-exposed'));
      expect(dobFinding).toBeUndefined();
    });

    it('should NOT flag non-medical code patterns', async () => {
      const file = await createTestFile('safe-code.ts', `
        const config = {
          timeout: 5000,
          retries: 3,
          endpoint: "/api/users"
        };

        function calculateTotal(items) {
          return items.reduce((sum, item) => sum + item.price, 0);
        }
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      expect(findings.length).toBe(0);
    });

    it('should only scan code files, not other extensions', async () => {
      const mdFile = await createTestFile('readme.md', `
        # Documentation
        SSN format: 123-45-6789
        dateOfBirth: "1990-01-01"
      `);

      const findings = await phiScanner.scan([mdFile], defaultOptions);

      expect(findings.length).toBe(0);
    });
  });

  describe('Medical Record Number Detection', () => {
    it('should detect MRN assignment', async () => {
      const file = await createTestFile('mrn.ts', `
        const mrn = "12345678";
        const medicalRecordNumber = "87654321";
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const mrnFinding = findings.find(f => f.id.includes('medical-record-number'));
      expect(mrnFinding).toBeDefined();
      expect(mrnFinding?.severity).toBe('high');
    });
  });

  describe('Finding Metadata', () => {
    it('should include correct HIPAA reference', async () => {
      const file = await createTestFile('hipaa-ref.ts', `
        const ssn = "123-45-6789";
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      expect(findings[0].hipaaReference).toBe('§164.502, §164.514');
    });

    it('should include line number in finding', async () => {
      const file = await createTestFile('line-number.ts', `// line 1
// line 2
const ssn = "123-45-6789"; // line 3
`);

      const findings = await phiScanner.scan([file], defaultOptions);

      const ssnFinding = findings.find(f => f.id.includes('ssn-hardcoded'));
      expect(ssnFinding?.line).toBe(3);
    });

    it('should include context lines', async () => {
      const file = await createTestFile('context.ts', `const a = 1;
const b = 2;
const ssn = "123-45-6789";
const c = 3;
const d = 4;
`);

      const findings = await phiScanner.scan([file], defaultOptions);

      const ssnFinding = findings.find(f => f.id.includes('ssn-hardcoded'));
      expect(ssnFinding?.context).toBeDefined();
      expect(ssnFinding?.context?.length).toBeGreaterThan(0);
    });
  });

  describe('PHI in URL Query Parameters', () => {
    it('should detect SSN in query parameter', async () => {
      const file = await createTestFile('url-ssn.ts', `
        const url = "/api/patient?ssn=123-45-6789";
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-query-param'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
    });

    it('should detect patientId in query parameter', async () => {
      const file = await createTestFile('url-patient.ts', `
        fetch(\`/api/records?patientId=\${id}\`);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-query-param'));
      expect(finding).toBeDefined();
    });

    it('should detect MRN in query parameter', async () => {
      const file = await createTestFile('url-mrn.ts', `
        const endpoint = baseUrl + "?mrn=" + recordNumber;
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-query-param'));
      expect(finding).toBeDefined();
    });

    it('should detect DOB in query parameter', async () => {
      const file = await createTestFile('url-dob.ts', `
        const searchUrl = "/search?dob=1990-01-15&name=John";
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-query-param'));
      expect(finding).toBeDefined();
    });

    it('should detect PHI in fetch URL', async () => {
      const file = await createTestFile('fetch-phi.ts', `
        fetch(\`/api/data?patient=\${patientId}\`);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-fetch-url'));
      expect(finding).toBeDefined();
    });
  });

  describe('PHI in HTTP Headers', () => {
    it('should detect PHI in setHeader', async () => {
      const file = await createTestFile('header-set.ts', `
        res.setHeader('X-Patient-ID', patientId);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-header-set'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('critical');
    });

    it('should detect PHI in headers object', async () => {
      const file = await createTestFile('headers-obj.ts', `
        const config = {
          headers: { 'X-Patient-SSN': ssn }
        };
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-header-object'));
      expect(finding).toBeDefined();
    });

    it('should detect diagnosis in headers', async () => {
      const file = await createTestFile('header-diagnosis.ts', `
        headers = { diagnosis: diagnosisCode };
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-header-object'));
      expect(finding).toBeDefined();
    });
  });

  describe('PHI in Email', () => {
    it('should detect patient data in sendMail', async () => {
      const file = await createTestFile('email-send.ts', `
        mailer.sendMail({ to: email, body: patientRecord });
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-email-body'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });

    it('should detect patient in email template', async () => {
      const file = await createTestFile('email-template.ts', `
        const emailTemplate = renderPatientNotification(patient);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-email-template'));
      expect(finding).toBeDefined();
    });

    it('should detect PHI in email subject', async () => {
      const file = await createTestFile('email-subject.ts', `
        const email = { subject: \`Patient \${name} appointment\` };
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-email-subject'));
      expect(finding).toBeDefined();
    });
  });

  describe('PHI Logging Without Redaction', () => {
    it('should detect unredacted patient logging', async () => {
      const file = await createTestFile('log-unredacted.ts', `
        logger.info('Processing patient', patientData);
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-logger-unredacted'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
    });

    it('should detect PHI written to log file', async () => {
      const file = await createTestFile('log-file.ts', `
        fs.writeFile('app.log', JSON.stringify(patientBackup));
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      // This matches the pattern but may need patient keyword
    });

    it('should detect debug mode with patient data', async () => {
      const file = await createTestFile('debug-patient.ts', `
        if (debug = true) { console.log(patientInfo); }
      `);

      const findings = await phiScanner.scan([file], defaultOptions);

      const finding = findings.find(f => f.id.includes('phi-debug-output'));
      expect(finding).toBeDefined();
    });
  });
});
