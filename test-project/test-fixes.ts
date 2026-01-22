// Test file for --fix functionality

// Hardcoded password (should be fixed)
const password = "supersecret123";

// Hardcoded API key (should be fixed)
const apiKey = process.env.API_KEY;

// Hardcoded secret (should be fixed)
const appSecret = "my_super_secret_value_here";

// HTTP URL (should be fixed to HTTPS)
const apiUrl = "http://api.example.com/data";
const anotherUrl = "https://healthcare-api.com/patients";

// SQL injection with template literal (should be detected)
function getUserById(userId: string) {
  return db.query('SELECT * FROM users WHERE id = ?', [userId]);
}

// SQL injection via method call (should be detected)
function findUser(name: string) {
  return connection.execute('SELECT * FROM users WHERE name = '?'', [name]);
}

// SQL concatenation (should be detected)
function searchUsers(name: string) {
  return db.execute('SELECT * FROM users WHERE name = ? ORDER BY id', [name]);
}

// NOT SQL - just UI string (should NOT be detected)
const message = `${count} items selected`;
const info = `Data from last month: ${amount}`;

// innerHTML (should be fixed)
function displayMessage(text: string) {
  document.getElementById('msg').textContent = text;
}

// PHI console log (should be commented out)
function processPatient(patient: any) {
  // [VLAYER] PHI logging removed - review needed: console.log("Patient data:", patient);
  // [VLAYER] PHI logging removed - review needed: console.log("Processing patient SSN:", patient.ssn);
}

// These should NOT be auto-fixed (no fix strategy)
const unsafeEval = eval("1+1");
localStorage.setItem('patient_data', JSON.stringify(patient));
