# Start Here in 2 Minutes

Get your first HIPAA compliance scan running in under 2 minutes. No signup, no configuration.

---

## Try in your browser (30 seconds)

No install needed. Paste any code snippet and see vlayer findings instantly:

**[Open vlayer Playground](https://play.vlayer.app)**

---

## Scan your project (2 minutes)

### Step 1: Run your first scan

```bash
npx @francosimon/vlayer scan ./src
```

vlayer scans every file in `./src` and prints findings grouped by severity: Critical, High, Medium, Low.

### Step 2: Get your compliance score

```bash
npx @francosimon/vlayer score ./src
```

Returns a 0–100 HIPAA compliance score with a letter grade (A–F) and a breakdown by category.

### Step 3: Generate an HTML report

```bash
npx @francosimon/vlayer scan ./src -f html -o hipaa-report.html
```

Opens a self-contained HTML report with findings, remediation guides, and HIPAA references. Share it with your team or compliance officer.

### Step 4 (optional): Auto-fix what you can

```bash
npx @francosimon/vlayer scan ./src --fix
```

vlayer applies safe, automatic fixes where possible — adding `httpOnly` to cookies, replacing `md5` with `sha256`, masking PHI in logs, and more. Review the changes before committing.

---

## What gets scanned

vlayer checks your code against 131 rules (125 pattern-based + 6 AI-powered) across the 5 HIPAA compliance categories:

| Category | What it checks |
|----------|---------------|
| **PHI Exposure** | SSN, MRN, DOB, diagnosis codes in logs, URLs, headers, localStorage, cookies, email templates, error messages |
| **Encryption** | Weak crypto (MD5, SHA1, DES, RC4), disabled SSL/TLS, unencrypted backups, HTTP endpoints |
| **Access Control** | Missing authentication, CORS wildcards, hardcoded admin roles, session misconfiguration, auth bypass |
| **Audit Logging** | Unlogged CRUD operations on PHI, missing auth event logging, no logging framework detected |
| **Data Retention** | Retention periods under 6 years, bulk deletes without audit trail, disabled backups, PHI caching |

---

## Next steps

- **[Add to CI/CD](https://github.com/Francosimon53/verification-layer#github-action)** — Block non-compliant code on every PR with the GitHub Action
- **[Custom rules](https://github.com/Francosimon53/verification-layer#custom-rules)** — Write org-specific rules in YAML with `.vlayer.yml`
- **[Pro dashboard](https://vlayer.app/pricing)** — Team dashboard, scan history, PDF audit reports, and HIPAA document templates
