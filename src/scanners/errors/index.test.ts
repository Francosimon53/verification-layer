/**
 * Error Handling Security Scanner Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { errorsScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Error Handling Security Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'errors-test-'));
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

  describe('ERROR-001: Unsanitized Error Details Sent to User', () => {
    it('should detect error.stack in res.send', async () => {
      const file = await createTestFile(
        'error-stack.ts',
        `
// VIOLATION ERROR-001: Sending error.stack to user
app.get('/api/data', (req, res) => {
  try {
    processData();
  } catch (error) {
    res.send(error.stack);
  }
});
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some((f) => f.id === 'ERROR-001')).toBe(true);
    });

    it('should detect error.stack in res.json', async () => {
      const file = await createTestFile(
        'error-json.ts',
        `
// VIOLATION ERROR-001: JSON with error.stack
export async function handler(req, res) {
  try {
    await fetchData();
  } catch (err) {
    res.json({ error: err.stack });
  }
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-001')).toBe(true);
    });

    it('should detect error.message in res.send', async () => {
      const file = await createTestFile(
        'error-message.ts',
        `
// VIOLATION ERROR-001: Sending error.message
catch (error) {
  res.send(error.message);
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-001')).toBe(true);
    });

    it('should detect error object sent directly', async () => {
      const file = await createTestFile(
        'error-direct.ts',
        `
// VIOLATION ERROR-001: Sending full error object
catch (err) {
  return res.json(err);
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-001')).toBe(true);
    });

    it('should detect error in catch block response', async () => {
      const file = await createTestFile(
        'catch-error.ts',
        `
// VIOLATION ERROR-001: Catch block sends error
try {
  doSomething();
} catch (error) { res.send(error); }
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-001')).toBe(true);
    });

    it('should detect next(error) pattern', async () => {
      const file = await createTestFile(
        'next-error.ts',
        `
// VIOLATION ERROR-001: Passing error to next
catch (error) {
  next(error);
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-001')).toBe(true);
    });

    it('should NOT flag sanitized errors', async () => {
      const file = await createTestFile(
        'sanitized.ts',
        `
// SECURE: Sanitized error message
catch (error) {
  const sanitizedError = sanitizeError(error);
  res.send(sanitizedError);
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      const error001 = findings.filter((f) => f.id === 'ERROR-001');
      expect(error001.length).toBe(0);
    });

    it('should NOT flag generic error messages', async () => {
      const file = await createTestFile(
        'generic.ts',
        `
// SECURE: Generic error message
catch (error) {
  res.status(500).json({ error: "An error occurred" });
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      const error001 = findings.filter((f) => f.id === 'ERROR-001');
      expect(error001.length).toBe(0);
    });

    it('should NOT flag console logging (not sent to user)', async () => {
      const file = await createTestFile(
        'console.ts',
        `
// SECURE: Logging error.stack (not sending to user)
catch (error) {
  console.error(error.stack);
  res.status(500).json({ error: "Internal server error" });
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      const error001 = findings.filter((f) => f.id === 'ERROR-001');
      expect(error001.length).toBe(0);
    });

    it('should NOT flag development environment checks', async () => {
      const file = await createTestFile(
        'dev-env.ts',
        `
// SECURE: Development mode only
catch (error) {
  if (process.env.NODE_ENV === 'development') {
    res.send(error.stack);
  }
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      const error001 = findings.filter((f) => f.id === 'ERROR-001');
      expect(error001.length).toBe(0);
    });
  });

  describe('ERROR-002: PHI in Error Logs or Thrown Errors', () => {
    it('should detect patient data in console.log', async () => {
      const file = await createTestFile(
        'console-patient.ts',
        `
// VIOLATION ERROR-002: PHI in console.log
function processPatient(patient) {
  console.log('Processing patient:', patient);
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-002')).toBe(true);
    });

    it('should detect SSN in console.error', async () => {
      const file = await createTestFile(
        'console-ssn.ts',
        `
// VIOLATION ERROR-002: SSN in error log
if (!validSSN(ssn)) {
  console.error('Invalid SSN:', ssn);
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-002')).toBe(true);
    });

    it('should detect DOB in logger.warn', async () => {
      const file = await createTestFile(
        'logger-dob.ts',
        `
// VIOLATION ERROR-002: DOB in logger
logger.warn('Missing DOB for patient:', { dob: patient.dob });
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-002')).toBe(true);
    });

    it('should detect MRN in throw Error', async () => {
      const file = await createTestFile(
        'throw-mrn.ts',
        `
// VIOLATION ERROR-002: MRN in thrown error
if (!patient) {
  throw new Error('Patient not found with MRN: ' + mrn);
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-002')).toBe(true);
    });

    it('should detect diagnosis in logger.error', async () => {
      const file = await createTestFile(
        'logger-diagnosis.ts',
        `
// VIOLATION ERROR-002: Diagnosis in error log
logger.error('Failed to save diagnosis:', diagnosis);
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-002')).toBe(true);
    });

    it('should detect medication in console.warn', async () => {
      const file = await createTestFile(
        'console-medication.ts',
        `
// VIOLATION ERROR-002: Medication in warning
console.warn('Discontinued medication:', medication);
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-002')).toBe(true);
    });

    it('should detect health_record in logger', async () => {
      const file = await createTestFile(
        'logger-health.ts',
        `
// VIOLATION ERROR-002: Health record in log
logger.info('Updating health_record:', health_record);
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-002')).toBe(true);
    });

    it('should detect patientData in console', async () => {
      const file = await createTestFile(
        'patient-data.ts',
        `
// VIOLATION ERROR-002: Patient data object
console.debug('Patient data:', patientData);
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-002')).toBe(true);
    });

    it('should NOT flag redacted PHI', async () => {
      const file = await createTestFile(
        'redacted.ts',
        `
// SECURE: Redacted patient data
logger.error('Error processing patient:', {
  patientId: redact(patient.id)
});
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      const error002 = findings.filter((f) => f.id === 'ERROR-002');
      expect(error002.length).toBe(0);
    });

    it('should NOT flag masked data', async () => {
      const file = await createTestFile(
        'masked.ts',
        `
// SECURE: Masked SSN
console.log('SSN:', maskSsn(patient.ssn));
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      const error002 = findings.filter((f) => f.id === 'ERROR-002');
      expect(error002.length).toBe(0);
    });

    it('should NOT flag generic patient messages', async () => {
      const file = await createTestFile(
        'generic-message.ts',
        `
// SECURE: Generic message without PHI
if (!patient) {
  throw new Error("Patient not found");
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      const error002 = findings.filter((f) => f.id === 'ERROR-002');
      expect(error002.length).toBe(0);
    });

    it('should NOT flag patient ID only', async () => {
      const file = await createTestFile(
        'patient-id.ts',
        `
// SECURE: Patient ID is allowed (not full PHI)
logger.error('Error for patient_id:', patient_id);
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      const error002 = findings.filter((f) => f.id === 'ERROR-002');
      expect(error002.length).toBe(0);
    });

    it('should NOT flag test files', async () => {
      const file = await createTestFile(
        'patient.test.ts',
        `
// SECURE: Test file
describe('patient tests', () => {
  it('should process patient', () => {
    console.log(patient);
  });
});
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      const error002 = findings.filter((f) => f.id === 'ERROR-002');
      expect(error002.length).toBe(0);
    });
  });

  describe('Combined violations', () => {
    it('should detect multiple ERROR-001 and ERROR-002 violations in same file', async () => {
      const file = await createTestFile(
        'combined.ts',
        `
// Multiple violations
export async function handler(req, res) {
  try {
    const patient = await getPatient(req.params.id);
    console.log('Processing patient:', patient); // ERROR-002
    processHealthRecord(patient);
  } catch (error) {
    logger.error('Patient error:', patient); // ERROR-002
    res.send(error.stack); // ERROR-001
  }
}
`
      );

      const findings = await errorsScanner.scan([file], scanOptions);
      expect(findings.some((f) => f.id === 'ERROR-001')).toBe(true);
      expect(findings.some((f) => f.id === 'ERROR-002')).toBe(true);
      expect(findings.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should provide correct HIPAA references', async () => {
    const file = await createTestFile(
      'hipaa-refs.ts',
      `
res.send(error.stack); // ERROR-001
console.log(patient); // ERROR-002
`
    );

    const findings = await errorsScanner.scan([file], scanOptions);
    const error001 = findings.find((f) => f.id === 'ERROR-001');
    const error002 = findings.find((f) => f.id === 'ERROR-002');

    expect(error001?.hipaaReference).toContain('164.312(b)');
    expect(error002?.hipaaReference).toContain('164.312(c)');
  });

  it('should have correct severity levels', async () => {
    const file = await createTestFile(
      'severity.ts',
      `
res.json(error); // ERROR-001 (high)
console.log(patient.ssn); // ERROR-002 (critical)
`
    );

    const findings = await errorsScanner.scan([file], scanOptions);
    const error001 = findings.find((f) => f.id === 'ERROR-001');
    const error002 = findings.find((f) => f.id === 'ERROR-002');

    expect(error001?.severity).toBe('high');
    expect(error002?.severity).toBe('critical');
  });
});
