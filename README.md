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
- **Professional suppression system** with inline comments and justifications
- **Baseline support** to focus on new findings while tracking existing issues
- **Confidence levels** for progressive strictness adoption

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

# Check compliance score
node dist/cli.js score /path/to/project

# Generate auditor-ready report
node dist/cli.js report /path/to/project -o audit-report.html
```

---

## 🌐 Web Dashboard

**Live Dashboard**: [https://dashboard-silk-zeta-55.vercel.app](https://dashboard-silk-zeta-55.vercel.app)

Monitor HIPAA compliance across all your projects with our web dashboard:

**Features:**
- 📊 **Visual Compliance Scores** - Animated gauges showing 0-100 scores
- 📈 **Historical Tracking** - View compliance trends over time
- 🗂️ **Multi-Project Management** - Monitor multiple codebases from one place
- 🔍 **Detailed Findings** - Filter by severity and view recommendations
- 📋 **Executive Reports** - Share compliance status with stakeholders

**Quick Start:**
1. Visit the dashboard and create a project
2. Run a scan: `node dist/cli.js scan ./src --format json --output scan.json`
3. Upload results via API:
   ```bash
   curl -X POST https://dashboard-silk-zeta-55.vercel.app/api/projects/{projectId}/scans \
     -H "Content-Type: application/json" \
     -d @scan.json
   ```

See [dashboard/README.md](dashboard/README.md) for API documentation and deployment instructions.

---

## 🆕 Compliance Score & Dashboard

### HIPAA Compliance Score (0-100)

VLayer calculates a compliance score based on findings weighted by severity and confidence:

```bash
# Calculate compliance score
node dist/cli.js score ./src

# Output as JSON
node dist/cli.js score ./src -f json
```

**Scoring System:**
- 🔴 Critical: -10 points each
- 🟠 High: -5 points each
- 🟡 Medium: -2 points each
- 🔵 Low: -1 point each
- ✅ Acknowledged findings: 25% penalty reduction

**Grading:**
- A (90-100): Excellent compliance posture
- B (80-89): Good compliance
- C (70-79): Fair compliance
- D (60-69): Poor compliance
- F (<60): Critical - requires immediate attention

### Auditor-Ready Reports

Generate professional compliance reports with SHA256 hash verification:

```bash
# Basic auditor report
node dist/cli.js report ./src

# Full-featured report
node dist/cli.js report ./src \
  -o compliance-report.html \
  --org "HealthTech Inc" \
  --period "Q1 2024" \
  --auditor "John Doe" \
  --include-baseline
```

**Report Features:**
- 📊 Compliance score with visual gauge (green/yellow/red)
- 📈 Executive summary with key metrics
- 📋 Findings table with filtering by severity
- 🔒 Suppression and acknowledgment audit trails
- 📄 Baseline comparison (if enabled)
- 🔐 SHA256 hash for document integrity
- 🖨️ Print-friendly CSS for PDF export

---

## 🆕 IDE & Developer Experience

### VS Code Extension

Get real-time HIPAA compliance feedback directly in your editor:

```bash
# Install from the vscode-extension directory
cd vscode-extension
npm install
npm run compile
```

**Features:**
- ✅ Real-time scanning on file save
- ✅ Inline diagnostics with severity markers
- ✅ Hover tooltips with HIPAA references and recommendations
- ✅ Quick-fix actions for auto-remediation
- ✅ Status bar compliance score
- ✅ Commands: "VLayer: Scan Current File", "VLayer: Scan Workspace"

**Configuration:**
```json
{
  "vlayer.enableAutoScan": true,
  "vlayer.minConfidence": "low",
  "vlayer.showStatusBar": true,
  "vlayer.configPath": ".vlayerrc.json"
}
```

### Watch Mode

Continuous monitoring with real-time feedback:

```bash
# Watch a directory for changes
node dist/cli.js watch ./src

# Watch with specific categories
node dist/cli.js watch ./src --categories phi-exposure encryption

# Watch with custom config
node dist/cli.js watch ./src --config .vlayerrc.json
```

**Features:**
- 🔍 Automatic scan on file save/create
- 🎨 Colored terminal output by severity
- 📊 Diff tracking (new findings vs. previous scan)
- 🚨 Alerts for new critical/high severity findings
- ⚡ Smart file filtering (excludes node_modules, dist, etc.)

---

## Suppression & Baseline

### Inline Suppressions

Suppress specific findings with inline comments (justification required):

```typescript
// vlayer-ignore phi-ssn-hardcoded -- Test data for unit tests
const testSSN = "123-45-6789";
```

### Baseline for Existing Codebases

Generate a baseline to track existing findings without blocking progress:

```bash
# Generate baseline from current state
node dist/cli.js baseline . -o .vlayer-baseline.json

# Scan with baseline (only NEW findings cause failures)
node dist/cli.js scan . --baseline .vlayer-baseline.json
```

### Confidence Levels

Filter findings by confidence level for progressive adoption:

```bash
# Only fail on high-confidence findings
node dist/cli.js scan . --min-confidence high
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

# Watch mode
vlayer watch <path>                           # Watch for changes
vlayer watch <path> -c phi-exposure          # Watch specific categories
vlayer watch <path> --config .vlayerrc.json  # Watch with custom config
vlayer watch <path> --min-confidence high    # Watch with confidence filter

# Audit commands
vlayer audit <path> --summary                 # View audit summary
vlayer audit <path> --generate-report         # Generate PDF
vlayer audit <path> --generate-report --text  # Generate text instead
vlayer audit <path> --generate-report --org "Company" --auditor "Name"

# Baseline commands
vlayer baseline <path>                        # Generate baseline
vlayer baseline <path> -o custom.json         # Custom output path
vlayer scan <path> --baseline .vlayer-baseline.json  # Scan with baseline

# Compliance score
vlayer score <path>                           # Calculate compliance score
vlayer score <path> -f json                   # JSON output
vlayer score <path> --baseline baseline.json  # Score with baseline

# Auditor reports
vlayer report <path>                          # Generate auditor report
vlayer report <path> -o report.html           # Custom output path
vlayer report <path> --org "Company Name"     # Set organization
vlayer report <path> --include-baseline       # Include baseline comparison
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

### Recently Completed ✅
- [x] **Phase 4A: Web Dashboard**
  - [x] Next.js dashboard deployed to Vercel
  - [x] Multi-project management with REST API
  - [x] Visual compliance score gauges and charts
  - [x] Historical score tracking and trends
  - [x] Detailed findings viewer with filtering
  - [x] Live at: https://dashboard-silk-zeta-55.vercel.app
- [x] **Phase 3B: Dashboard & Compliance Score**
  - [x] HIPAA Compliance Score (0-100) with severity weighting
  - [x] Enhanced HTML reports with visual gauge
  - [x] Auditor-ready reports with SHA256 hash
  - [x] Executive summary and filterable findings table
  - [x] Print-friendly CSS for PDF export
- [x] **Phase 3A: IDE & Developer Experience**
  - [x] VS Code Extension v2.0 with real-time scanning
  - [x] Watch mode for continuous monitoring
  - [x] Inline diagnostics with hover tooltips
  - [x] Quick-fix actions and status bar integration
- [x] **Phase 2B: Enhanced Custom Rules**
  - [x] Semantic awareness for custom rules
  - [x] Pattern-aware context detection
  - [x] Confidence level controls
- [x] **Phase 2A: Semantic Context Analysis**
  - [x] AST-based semantic analysis
  - [x] Context-aware confidence levels
  - [x] Test file detection
- [x] **Phase 1B: Reusable GitHub Action**
  - [x] GitHub Action for CI/CD integration
  - [x] Enhanced npm package
  - [x] Baseline and suppression systems

### Coming Soon
- [ ] Slack/Teams notifications for new findings
- [ ] CLI integration with dashboard auto-upload
- [ ] Database backend for dashboard (currently file-based)

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
