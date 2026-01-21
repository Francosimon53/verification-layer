// Example healthcare service with intentional HIPAA issues

import crypto from 'crypto';

interface Patient {
  id: string;
  name: string;
  ssn: string;
  dateOfBirth: string;
  diagnosis: string;
}

// BAD: Hardcoded SSN for testing
const testPatient = {
  ssn: "123-45-6789",
  mrn: "MRN12345",
};

// BAD: PHI in console logs
export function getPatient(id: string): Patient {
  const patient = fetchFromDb(id);
  console.log("Fetched patient name:", patient.name);
  return patient;
}

// BAD: Weak encryption (MD5)
export function hashPatientId(id: string): string {
  return crypto.createHash('md5').update(id).digest('hex');
}

// BAD: Using deprecated cipher
export function encryptData(data: string, key: string): string {
  const cipher = crypto.createCipher('des', key);
  return cipher.update(data, 'utf8', 'hex');
}

// BAD: HTTP endpoint for PHI
const API_URL = "http://api.healthcare.com/patients";

// BAD: SSL disabled
const dbConfig = {
  host: 'localhost',
  ssl: false,
  rejectUnauthorized: false,
};

// BAD: SELECT * on patient table
async function getAllPatients() {
  return db.query("SELECT * FROM patient WHERE active = true");
}

// BAD: Hardcoded admin role
function checkAccess(user: any) {
  if (user.role = "admin") {
    return true;
  }
  return false;
}

// BAD: CORS wildcard
const corsConfig = {
  allowOrigin: "*",
};

// BAD: No session expiry
const sessionConfig = {
  maxAge: 0,
};

// BAD: Short retention period
const dataPolicy = {
  deleteAfter: 30, // days - too short for HIPAA
};

// BAD: Bulk delete without audit
async function purgeOldRecords() {
  await db.query("TRUNCATE TABLE patient_history");
}

// Stub functions
function fetchFromDb(id: string): Patient {
  return {} as Patient;
}
const db = { query: async (q: string) => {} };
