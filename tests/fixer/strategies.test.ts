import { describe, it, expect } from 'vitest';
import { applyFixStrategy } from '../../src/fixer/strategies.js';

describe('Fix Strategies', () => {
  describe('Existing Strategies', () => {
    describe('sql-injection-template', () => {
      it('should convert template literal to parameterized query', () => {
        const input = 'db.query(`SELECT * FROM users WHERE id = ${userId}`)';
        const result = applyFixStrategy(input, 'sql-injection-template');

        expect(result).toContain('?');
        expect(result).toContain('[userId]');
      });
    });

    describe('hardcoded-password', () => {
      it('should replace hardcoded password with env var', () => {
        const input = 'const password = "secret123"';
        const result = applyFixStrategy(input, 'hardcoded-password');

        expect(result).toContain('process.env');
        expect(result).not.toContain('secret123');
      });
    });

    describe('phi-console-log', () => {
      it('should comment out console.log with PHI', () => {
        const input = '  console.log(patientData);';
        const result = applyFixStrategy(input, 'phi-console-log');

        expect(result).toContain('[VLAYER]');
        expect(result).toContain('// ');
      });
    });

    describe('http-url', () => {
      it('should upgrade http to https', () => {
        const input = 'const url = "http://api.example.com/data"';
        const result = applyFixStrategy(input, 'http-url');

        expect(result).toContain('https://');
        expect(result).not.toContain('http://api');
      });

      it('should not change localhost', () => {
        const input = 'const url = "http://localhost:3000"';
        const result = applyFixStrategy(input, 'http-url');

        expect(result).toBeNull();
      });
    });

    describe('innerhtml-unsanitized', () => {
      it('should replace innerHTML with textContent', () => {
        const input = 'element.innerHTML = userInput;';
        const result = applyFixStrategy(input, 'innerhtml-unsanitized');

        expect(result).toContain('textContent');
        expect(result).not.toContain('innerHTML');
      });
    });
  });

  describe('New Strategies', () => {
    describe('phi-localstorage', () => {
      it('should comment out localStorage.setItem with PHI', () => {
        const input = '  localStorage.setItem("patientData", data);';
        const result = applyFixStrategy(input, 'phi-localstorage');

        expect(result).toBeDefined();
        expect(result).toContain('[VLAYER]');
        expect(result).toContain('server-side session');
        expect(result).toContain('Original:');
      });

      it('should comment out localStorage.getItem with PHI', () => {
        const input = '  localStorage.getItem("patientRecord");';
        const result = applyFixStrategy(input, 'phi-localstorage');

        expect(result).toBeDefined();
        expect(result).toContain('[VLAYER]');
      });

      it('should include TODO with replacement suggestion', () => {
        const input = 'localStorage.setItem("medicalHistory", history);';
        const result = applyFixStrategy(input, 'phi-localstorage');

        expect(result).toContain('TODO');
        expect(result).toContain('sessionApi');
      });
    });

    describe('phi-url-param', () => {
      it('should add comment for fetch with PHI in URL', () => {
        const input = '  fetch(`/api/patient?ssn=${ssn}`);';
        const result = applyFixStrategy(input, 'phi-url-param');

        expect(result).toBeDefined();
        expect(result).toContain('[VLAYER]');
        expect(result).toContain('POST');
        expect(result).toContain('Original:');
      });

      it('should add comment for axios.get with PHI', () => {
        const input = 'axios.get(`/api?patientId=${id}`);';
        const result = applyFixStrategy(input, 'phi-url-param');

        expect(result).toBeDefined();
        expect(result).toContain('axios.post');
      });

      it('should include TODO with POST body suggestion', () => {
        const input = 'fetch("/api/data?mrn=" + mrn);';
        const result = applyFixStrategy(input, 'phi-url-param');

        expect(result).toBeDefined();
        expect(result).toContain('TODO');
      });
    });

    describe('phi-log-unredacted', () => {
      it('should wrap patient data with redactPHI()', () => {
        const input = 'logger.info("Processing", patientData);';
        const result = applyFixStrategy(input, 'phi-log-unredacted');

        expect(result).toBeDefined();
        expect(result).toContain('redactPHI(patientData)');
      });

      it('should handle simple logger call with patient variable', () => {
        const input = 'logger.info(patientRecord);';
        const result = applyFixStrategy(input, 'phi-log-unredacted');

        expect(result).toBeDefined();
        expect(result).toContain('redactPHI(patientRecord)');
      });

      it('should handle logger.debug with patient data', () => {
        const input = 'logger.debug("Data:", patientInfo);';
        const result = applyFixStrategy(input, 'phi-log-unredacted');

        expect(result).toBeDefined();
        expect(result).toContain('redactPHI');
      });

      it('should handle logger.error with patient data', () => {
        const input = 'logger.error(patientError);';
        const result = applyFixStrategy(input, 'phi-log-unredacted');

        expect(result).toBeDefined();
        expect(result).toContain('redactPHI');
      });
    });

    describe('cookie-insecure', () => {
      it('should add httpOnly and secure to cookie config', () => {
        const input = 'const config = { cookie: { maxAge: 3600 } };';
        const result = applyFixStrategy(input, 'cookie-insecure');

        expect(result).toBeDefined();
        expect(result).toContain('httpOnly: true');
        expect(result).toContain('secure: true');
      });

      it('should add options to res.cookie()', () => {
        const input = "res.cookie('session', token)";
        const result = applyFixStrategy(input, 'cookie-insecure');

        expect(result).toBeDefined();
        expect(result).toContain('httpOnly: true');
        expect(result).toContain('secure: true');
      });

      it('should preserve existing cookie options', () => {
        const input = 'cookie: { maxAge: 3600, sameSite: "strict" }';
        const result = applyFixStrategy(input, 'cookie-insecure');

        expect(result).toBeDefined();
        expect(result).toContain('maxAge');
        expect(result).toContain('httpOnly: true');
      });

      it('should not modify if httpOnly already exists', () => {
        const input = 'cookie: { httpOnly: true, maxAge: 3600 }';
        const result = applyFixStrategy(input, 'cookie-insecure');

        expect(result).toBeNull();
      });
    });

    describe('backup-unencrypted', () => {
      it('should add encryption comment for writeFile backup', () => {
        const input = '  fs.writeFile("backup.sql", data);';
        const result = applyFixStrategy(input, 'backup-unencrypted');

        expect(result).toBeDefined();
        expect(result).toContain('[VLAYER]');
        expect(result).toContain('encrypt');
        expect(result).toContain('TODO');
      });

      it('should add comment for unencrypted backup path', () => {
        const input = 'const backupPath = "data/backup.csv";';
        const result = applyFixStrategy(input, 'backup-unencrypted');

        expect(result).toBeDefined();
        expect(result).toContain('encrypted backup format');
      });

      it('should suggest BACKUP_KEY environment variable', () => {
        const input = 'writeFile("patient_backup.json", patientData);';
        const result = applyFixStrategy(input, 'backup-unencrypted');

        expect(result).toBeDefined();
        expect(result).toContain('BACKUP_KEY');
      });

      it('should not modify already encrypted backup', () => {
        const input = 'const backupPath = "backup.sql.gpg";';
        const result = applyFixStrategy(input, 'backup-unencrypted');

        expect(result).toBeNull();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return null for unknown fix type', () => {
      const input = 'some random code';
      // @ts-expect-error - testing invalid fix type
      const result = applyFixStrategy(input, 'unknown-type');

      expect(result).toBeNull();
    });

    it('should preserve indentation', () => {
      const input = '    localStorage.setItem("patient", data);';
      const result = applyFixStrategy(input, 'phi-localstorage');

      expect(result).toBeDefined();
      expect(result?.startsWith('    ')).toBe(true);
    });
  });
});
