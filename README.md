# vlayer - HIPAA Compliance on Every Commit

**Automated security scanning for healthcare applications.** 163+ detection rules that catch PHI exposures, missing encryption, and access control gaps before they reach production. HIPAA 2026 ready - 15/15 requirements covered.

[![CI](https://github.com/Francosimon53/verification-layer/actions/workflows/ci.yml/badge.svg)](https://github.com/Francosimon53/verification-layer/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/verification-layer)](https://www.npmjs.com/package/verification-layer)
[![HIPAA 2026](https://img.shields.io/badge/HIPAA%202026-15%2F15%20Ready-brightgreen)](https://vlayer.app)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)

---

## 🚀 Quick Start

```bash
# Install globally
npm install -g verification-layer

# Or use with npx (no install needed)
npx vlayer scan ./src

# Scan with HTML report
npx vlayer scan ./src -f html -o report.html

# Check compliance score
npx vlayer score ./src

# Auto-fix issues
npx vlayer scan ./src --fix
```

---

## What is vlayer?

vlayer is a CLI tool and platform that scans your codebase for HIPAA compliance issues. Built for healthcare startups and developers building applications that handle Protected Health Information (PHI).

**🎯 Key Features:**
- **163+ detection rules** across 12 categories (PHI exposure, encryption, access control, audit logging, data retention, and more)
- **HIPAA 2026 NPRM ready** - Covers all 15 new cybersecurity requirements
- **10 training modules** with 45+ questions and SHA-256 verifiable certificates
- **5 HIPAA templates** - IRP, BAA, NPP, Security Officer role, Physical Safeguards
- **Compliance scoring (0-100)** - Track your HIPAA readiness over time
- **CI/CD integration** - GitHub Actions, pre-commit hooks, PR comments
- **PDF audit reports** - Executive summaries and technical findings for auditors
- **VS Code Extension** - Real-time scanning with inline diagnostics
- **Pro Dashboard** - Historical scans, team management, templates access at [app.vlayer.app](https://app.vlayer.app)

---

## 🌐 Links

- **Landing**: [vlayer.app](https://vlayer.app) - Product overview and pricing
- **Dashboard**: [app.vlayer.app](https://app.vlayer.app) - Pro dashboard with historical scans and team management
- **Documentation**: [docs.vlayer.app](https://docs.vlayer.app) - Complete guides and API reference
- **GitHub**: [github.com/Francosimon53/verification-layer](https://github.com/Francosimon53/verification-layer) - Open source CLI
- **npm**: [npmjs.com/package/verification-layer](https://www.npmjs.com/package/verification-layer) - Install the scanner

---

## 💰 Pricing

| Plan | Price | Features |
|------|-------|----------|
| **Open Source** | **$0/forever** | Full scanner, CLI, 163+ rules, compliance scoring, training module, community support |
| **Pro** | **$49/month** ($490/year) | Everything in OSS + GitHub App with PR comments, pre-commit hooks, historical scan dashboard, HIPAA document templates, team tracking (10 users), PDF audit reports, email support (48h SLA). **14-day free trial** |
| **Enterprise** | **Custom** | Everything in Pro + custom detection rules, self-hosted deployment, SSO/RBAC integration, dedicated compliance consultant, custom training modules, audit preparation support, priority support (4h SLA). Contact: [sales@vlayer.app](mailto:sales@vlayer.app) |

[Start Free Trial](https://app.vlayer.app/pricing) • [View Pricing](https://vlayer.app/#pricing)

---

## 🛡️ HIPAA 2026 Ready

The new HIPAA Security Rule (NPRM 2026) adds 15 cybersecurity requirements. vlayer covers **all 15**:

✅ Network Segmentation
✅ Encryption Standards
✅ Multi-Factor Auth
✅ Audit Log Monitoring
✅ Incident Response
✅ Vulnerability Scanning
✅ Asset Inventory
✅ Access Controls
✅ Data Minimization
✅ Secure Configuration
✅ Patch Management
✅ Risk Assessments
✅ Business Continuity
✅ Security Training
✅ Third-Party Risk

**Non-Compliance Costs:**
- $2M average breach cost
- $100-$50K per violation (Tier 1-4)
- $1.5M annual cap per violation type
- Criminal penalties: $250K + 10 years jail

---

## 📊 Detection Categories

vlayer scans for **163+ security patterns** across 12 HIPAA compliance categories:

| Category | Rules | What it detects |
|----------|-------|-----------------|
| **PHI Exposure** | 28 | SSN/MRN in code, PHI in logs, localStorage, URLs, diagnosis codes, unencrypted patient data |
| **Encryption** | 18 | Weak crypto (MD5, DES), disabled SSL/TLS, HTTP URLs, missing at-rest encryption |
| **Access Control** | 24 | SQL injection, XSS, CORS wildcards, hardcoded credentials, IDOR vulnerabilities, missing auth |
| **Audit Logging** | 15 | Missing logging framework, unlogged PHI operations, insufficient audit trails |
| **Data Retention** | 12 | Bulk deletes without audit, missing retention policies, improper data deletion |
| **Network Segmentation** | 14 | Missing network isolation, insecure API endpoints, unrestricted PHI access |
| **Multi-Factor Auth** | 8 | Missing MFA, weak authentication, password-only access to PHI |
| **Incident Response** | 10 | Missing IRP, unmonitored security events, no breach notification process |
| **Vulnerability Management** | 11 | Unpatched dependencies, missing security updates, known CVEs |
| **Asset Inventory** | 9 | Undocumented PHI storage, shadow IT, untracked data flows |
| **Session Management** | 8 | Weak session configs, missing timeouts, insecure cookies |
| **Third-Party Risk** | 6 | Unsafe vendor integrations, missing BAAs, unvetted third-party code |

**Total: 163+ rules**

---

## 🎓 Training Module

Turn your developers into HIPAA-aware engineers with built-in training:

```bash
vlayer train
```

- **10 interactive modules** covering HIPAA fundamentals, technical safeguards, and best practices
- **45+ quiz questions** with immediate feedback
- **SHA-256 verifiable certificates** for audit documentation
- Track team progress and completion rates (Pro plan)

**Topics covered:**
- HIPAA Privacy & Security Rules
- PHI identification and handling
- Encryption standards and implementation
- Access controls and authentication
- Audit logging and monitoring
- Incident response procedures
- Business Associate Agreements
- Data breach notification requirements
- Physical and technical safeguards
- Compliance penalties and enforcement

---

## 📄 HIPAA Templates

5 production-ready policy templates (Pro plan):

```bash
vlayer templates list
vlayer templates export irp
```

| Template | Description |
|----------|-------------|
| **Incident Response Plan (IRP)** | Step-by-step breach response procedures |
| **Business Associate Agreement (BAA)** | Standard BAA for third-party vendors |
| **Notice of Privacy Practices (NPP)** | Patient rights and PHI usage disclosure |
| **Security Officer Role** | Responsibilities and authority documentation |
| **Physical Safeguards** | Facility access controls and workstation security |

All templates are:
- ✅ HIPAA-compliant and audit-ready
- ✅ Customizable to your organization
- ✅ Available in Word and PDF formats
- ✅ Regularly updated for regulatory changes

---

## 🔧 CLI Commands

```bash
# Scanning
vlayer scan <path>                      # Basic scan
vlayer scan <path> -f html -o report.html   # HTML report
vlayer scan <path> -f markdown -o report.md # Markdown report
vlayer scan <path> --fix                     # Auto-fix issues
vlayer scan <path> -c phi-exposure encryption # Specific categories

# Compliance Score
vlayer score <path>                     # Calculate compliance score (0-100)
vlayer score <path> -f json             # JSON output

# Watch Mode
vlayer watch <path>                     # Watch for changes
vlayer watch <path> -c phi-exposure     # Watch specific categories

# Audit Reports
vlayer report <path>                    # Generate auditor-ready report
vlayer report <path> -o report.html     # Custom output path
vlayer report <path> --org "Company"    # Set organization name

# Training
vlayer train                            # Start interactive training
vlayer train --module 2                 # Specific module
vlayer train --certificate              # Generate certificate

# Templates (Pro)
vlayer templates list                   # List available templates
vlayer templates export irp             # Export Incident Response Plan
vlayer templates export baa             # Export Business Associate Agreement

# Baseline
vlayer baseline <path>                  # Generate baseline
vlayer scan <path> --baseline .vlayer-baseline.json # Scan with baseline

# Configuration
vlayer init                             # Generate .vlayerrc.json
```

**Exit codes:**
- `0` - No critical issues
- `1` - Critical issues found (useful for CI/CD)

---

## ⚙️ CI/CD Integration

### GitHub Actions

```yaml
name: HIPAA Compliance
on: [push, pull_request]

jobs:
  vlayer-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npx vlayer scan ./src
```

### Pre-commit Hook

```bash
# Install pre-commit hook
npx vlayer install-hook

# .git/hooks/pre-commit will now run vlayer on staged files
```

### Pull Request Comments (Pro)

Install the [vlayer GitHub App](https://app.vlayer.app) to get automatic PR comments with compliance findings.

---

## 📊 Compliance Dashboard (Pro)

Access historical scans, team management, and audit reports at [app.vlayer.app](https://app.vlayer.app):

- **Historical Scans** - Track compliance trends over time
- **Team Management** - Invite team members (10 seats on Pro)
- **Templates Library** - Access all 5 HIPAA document templates
- **PDF Reports** - Generate audit-ready reports
- **Training Dashboard** - Track team training completion
- **Compliance Score Tracking** - Monitor your 0-100 score over time

**Features:**
- Dark theme with professional UI
- Filter findings by severity and category
- Export data in JSON, CSV, or PDF
- Email notifications for critical findings
- Integration with Slack/Teams (coming soon)

---

## 🔍 VS Code Extension

Real-time HIPAA compliance feedback in your editor:

```bash
# Install from the vscode-extension directory
cd vscode-extension
npm install
npm run compile
```

**Features:**
- ✅ Real-time scanning on file save
- ✅ Inline diagnostics with severity markers
- ✅ Hover tooltips with HIPAA references
- ✅ Quick-fix actions for auto-remediation
- ✅ Status bar compliance score
- ✅ Commands: "VLayer: Scan Current File", "VLayer: Scan Workspace"

---

## 🤖 AI-Powered Scanning (Optional)

Reduce false positives and catch complex violations with Claude AI:

```bash
# Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Run AI-powered scan
vlayer ai-scan ./src

# Adjust budget
vlayer ai-scan ./src --budget 100
```

**AI Features:**
- 6 specialized LLM rules for complex HIPAA violations
- Automatic triage to reduce false positives by 50%+
- PHI scrubbing (HIPAA-safe, no PHI sent to API)
- Cost control with budget limits and caching

**Typical cost:** $0.10-$0.50 per scan

---

## 📝 Configuration

Create `.vlayerrc.json` in your project root:

```json
{
  "exclude": ["**/*.test.ts", "**/__mocks__/**"],
  "ignorePaths": ["sample-data", "fixtures"],
  "safeHttpDomains": ["my-internal-cdn.com"],
  "contextLines": 3,
  "categories": ["phi-exposure", "encryption", "access-control"],
  "minConfidence": "medium",
  "ai": {
    "enabled": true,
    "enableTriage": true,
    "budgetCents": 50
  }
}
```

---

## 🏗️ Auto-Fix

Automatically remediate common vulnerabilities:

```bash
vlayer scan ./my-app --fix
```

| Issue | Auto-Fix Applied |
|-------|------------------|
| SQL injection | Convert to parameterized query |
| Hardcoded password | Replace with `process.env.PASSWORD` |
| Hardcoded API key | Replace with `process.env.API_KEY` |
| HTTP URL | Upgrade to HTTPS |
| innerHTML | Replace with `textContent` |
| PHI in console.log | Comment out with review marker |

---

## 📚 HIPAA References

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

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

```bash
# Development
npm install
npm run dev      # Watch mode
npm run test     # Run tests
npm run lint     # Lint code
npm run typecheck # Type check
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 📧 Contact

- **General inquiries**: [hello@vlayer.app](mailto:hello@vlayer.app)
- **Sales & Enterprise**: [sales@vlayer.app](mailto:sales@vlayer.app)
- **Enterprise solutions**: [enterprise@vlayer.app](mailto:enterprise@vlayer.app)
- **Support**: [GitHub Issues](https://github.com/Francosimon53/verification-layer/issues)

---

<p align="center">
  <strong>Built for healthcare developers who take compliance seriously.</strong>
  <br><br>
  <a href="https://vlayer.app">Website</a> •
  <a href="https://docs.vlayer.app">Documentation</a> •
  <a href="https://app.vlayer.app">Dashboard</a> •
  <a href="https://github.com/Francosimon53/verification-layer/issues">Report Bug</a> •
  <a href="https://github.com/Francosimon53/verification-layer/issues">Request Feature</a>
</p>
