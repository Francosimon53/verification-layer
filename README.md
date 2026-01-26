# vlayer - HIPAA Compliance Scanner

**Automated security scanning for healthcare applications.** Detect PHI exposure, fix vulnerabilities, and generate audit-ready compliance reports.

[![CI](https://github.com/Francosimon53/verification-layer/actions/workflows/ci.yml/badge.svg)](https://github.com/Francosimon53/verification-layer/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/verification-layer)](https://www.npmjs.com/package/verification-layer)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)

---

## What is vlayer?

vlayer is a CLI tool that scans your codebase for HIPAA compliance issues. It's designed for healthcare startups and developers building applications that handle Protected Health Information (PHI).

**Key capabilities:**
- Scan for 50+ security vulnerabilities and PHI exposure patterns
- Auto-fix common issues with one command
- Generate professional audit reports (HTML, PDF, JSON)
- Detect your tech stack and provide tailored recommendations
- Create cryptographic audit trails for compliance documentation

---

## Quick Start

```bash
# Install
npm install
npm run build

# Scan a project
node dist/cli.js scan /path/to/your/project

# Generate HTML report
node dist/cli.js scan /path/to/project -f html -o report.html

# Auto-fix issues
node dist/cli.js scan /path/to/project --fix

# Generate audit PDF
node dist/cli.js audit /path/to/project --generate-report
```

---

## Features

### 1. Vulnerability Detection

Scans for **50+ security patterns** across 5 HIPAA compliance categories:

| Category | What it detects |
|----------|-----------------|
| **PHI Exposure** | SSN/MRN in code, PHI in logs, localStorage, URLs |
| **Encryption** | Weak crypto (MD5, DES), disabled SSL/TLS, HTTP URLs |
| **Access Control** | SQL injection, XSS, CORS wildcards, hardcoded credentials |
| **Audit Logging** | Missing logging framework, unlogged PHI operations |
| **Data Retention** | Bulk deletes without audit, missing retention policies |

<details>
<summary><strong>View all detection patterns</strong></summary>

**PHI Exposure (18 patterns)**
- Social Security Numbers (XXX-XX-XXXX)
- Medical Record Numbers (MRN patterns)
- Date of Birth handling
- Diagnosis codes (ICD-10)
- PHI in console.log statements
- PHI in localStorage/sessionStorage
- Patient data in URLs
- Unencrypted patient contact info

**Security Vulnerabilities (20+ patterns)**
- Hardcoded passwords and secrets
- API keys (generic, Stripe, AWS)
- Database URIs with credentials
- SQL injection (template literals & concatenation)
- innerHTML without sanitization
- eval() and Function constructor
- dangerouslySetInnerHTML in React

**Infrastructure Issues**
- HTTP URLs for PHI transmission
- Disabled SSL/TLS verification
- CORS wildcard origins
- Sessions without expiration
- Missing authentication checks

</details>

---

### 2. Auto-Fix (`--fix`)

Automatically remediate common vulnerabilities:

```bash
node dist/cli.js scan ./my-app --fix
```

| Issue | Auto-Fix Applied |
|-------|------------------|
| SQL injection | Convert to parameterized query `query('SELECT * FROM users WHERE id = ?', [id])` |
| Hardcoded password | Replace with `process.env.PASSWORD` |
| Hardcoded API key | Replace with `process.env.API_KEY` |
| HTTP URL | Upgrade to HTTPS |
| innerHTML | Replace with `textContent` |
| PHI in console.log | Comment out with review marker |

**Example output:**
```
✔ Scan complete. Found 29 issues.
✔ Applied 8 automatic fixes.

Changes by file:
  src/api/users.ts
    Line 45: SQL injection → parameterized query
    Line 89: Hardcoded password → process.env.DB_PASSWORD
  src/utils/logger.ts
    Line 12: PHI in console.log → commented out
```

---

### 3. Stack Detection

vlayer automatically detects your tech stack and provides **personalized code examples**:

```
Stack detected:
  Framework: Next.js
  Database: Supabase
  Auth: Supabase Auth
```

**Supported technologies:**

| Type | Detected |
|------|----------|
| Frameworks | Next.js, React, Vue, Nuxt, Angular, Express, Fastify, NestJS |
| Databases | Supabase, Firebase, PostgreSQL, MySQL, MongoDB, Prisma, Drizzle |
| Auth | NextAuth, Supabase Auth, Firebase Auth, Auth0, Clerk, Passport |

**Stack-specific recommendations include:**

- **Next.js + Supabase**: Server Components for PHI, Row Level Security (RLS), middleware protection
- **Express + PostgreSQL**: express-session with Redis, parameterized queries
- **React + Firebase**: Firestore Security Rules, Admin SDK for PHI

---

### 4. Remediation Guides

Each finding includes a detailed remediation guide with:

- **HIPAA Impact**: Why this matters for compliance
- **Multiple fix options**: Different approaches with trade-offs
- **Code examples**: Copy-paste ready solutions
- **Documentation links**: Official resources

The guides are **personalized to your stack** - if you're using Supabase, you'll see Supabase-specific code examples, not generic SQL.

---

### 5. Audit Trail & PDF Reports

Generate compliance documentation with cryptographic verification:

```bash
# Run scan with fixes (creates audit trail)
node dist/cli.js scan ./my-app --fix

# Generate PDF report
node dist/cli.js audit ./my-app --generate-report --org "Healthcare Inc" --auditor "Jane Smith"
```

**Audit trail includes:**

| For Auto-Fixed Issues | For Manual Review Items |
|-----------------------|-------------------------|
| Code before & after | Status: "Pending human review" |
| SHA256 file hashes | Assigned responsible party |
| Timestamp of change | Suggested deadline by severity |
| HIPAA reference resolved | Full finding details |

**PDF Report sections:**
1. Cover Page - Project info, scan statistics
2. Executive Summary - Remediation rate, risk breakdown
3. Fix Evidence - Cryptographic proof of each change
4. Manual Reviews - Pending items with deadlines
5. Verification Page - Report hash, signature fields

---

## Report Examples

### HTML Report

The HTML report includes:
- Summary cards with severity counts
- Stack detection section with tailored recommendations
- Each finding with code context and line highlighting
- Expandable remediation guides with code examples
- Auto-fixable badge on issues that can be fixed automatically

### JSON Report

Machine-readable format for CI/CD integration:

```json
{
  "summary": {
    "total": 29,
    "critical": 8,
    "high": 12,
    "medium": 6,
    "low": 3
  },
  "stack": {
    "framework": "nextjs",
    "database": "supabase",
    "auth": "supabase-auth"
  },
  "findings": [...]
}
```

---

## Configuration

Create `.vlayerrc.json` in your project root:

```json
{
  "exclude": ["**/*.test.ts", "**/__mocks__/**"],
  "ignorePaths": ["sample-data", "fixtures"],
  "safeHttpDomains": ["my-internal-cdn.com"],
  "contextLines": 3,
  "categories": ["phi-exposure", "encryption", "access-control"]
}
```

| Option | Description | Default |
|--------|-------------|---------|
| `exclude` | Glob patterns to skip | `[]` |
| `ignorePaths` | Path substrings to ignore | `[]` |
| `safeHttpDomains` | HTTP domains to allow (CDNs) | Built-in list |
| `contextLines` | Lines of context in reports | `2` |
| `categories` | Categories to scan | All |

---

## CLI Reference

```bash
# Basic scan
vlayer scan <path>

# Scan options
vlayer scan <path> -f html -o report.html    # HTML report
vlayer scan <path> -f markdown -o report.md  # Markdown report
vlayer scan <path> -c phi-exposure encryption # Specific categories
vlayer scan <path> --fix                      # Auto-fix issues

# Audit commands
vlayer audit <path> --summary                 # View audit summary
vlayer audit <path> --generate-report         # Generate PDF
vlayer audit <path> --generate-report --text  # Generate text instead
vlayer audit <path> --generate-report --org "Company" --auditor "Name"
```

**Exit codes:**
- `0` - No critical issues
- `1` - Critical issues found (useful for CI/CD)

---

## HIPAA References

Each finding maps to specific HIPAA regulations:

| Reference | Requirement |
|-----------|-------------|
| §164.502, §164.514 | PHI disclosure and de-identification |
| §164.312(a)(1) | Access control mechanisms |
| §164.312(a)(2)(iv) | Encryption and decryption |
| §164.312(b) | Audit controls |
| §164.312(d) | Person or entity authentication |
| §164.312(e)(1) | Transmission security |
| §164.530(j) | Documentation retention (6 years) |

---

## Roadmap

### Coming Soon
- [x] GitHub Action for CI/CD integration
- [x] Automated npm releases with semantic-release
- [x] Dependabot for dependency updates
- [ ] VS Code extension with inline warnings
- [ ] Slack/Teams notifications for new findings
- [ ] Custom rule definitions (YAML)

### Planned
- [ ] HITRUST CSF mapping
- [ ] SOC 2 compliance checks
- [ ] AWS/GCP/Azure infrastructure scanning
- [ ] Team dashboard with trend tracking
- [ ] Jira/Linear integration for issue tracking

### Future
- [ ] AI-powered fix suggestions
- [ ] Dependency vulnerability scanning
- [ ] Runtime PHI detection agent
- [ ] Compliance certification workflows

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

```bash
# Development
npm install
npm run dev      # Watch mode
npm run test     # Run tests
npm run lint     # Lint code
```

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built for healthcare developers who take compliance seriously.
  <br>
  <a href="https://github.com/Francosimon53/verification-layer/issues">Report Bug</a>
  ·
  <a href="https://github.com/Francosimon53/verification-layer/issues">Request Feature</a>
</p>
