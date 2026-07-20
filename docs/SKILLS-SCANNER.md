# AI Agent Skills Security Scanner

## 🎯 Overview

vlayer is the **first HIPAA-focused security scanner** for AI Agent Skills (SKILL.md files). It scans skills for Claude Code, OpenClaw/Clawdbot, Cursor, and Codex before installation to prevent security incidents in healthcare environments.

## 🚨 The Problem

**February 2026 Security Crisis:**
- 36.82% of 3,984 skills on ClawHub and skills.sh have security flaws (Snyk analysis)
- 341 malicious skills distribute Atomic Stealer malware
- 283 "functional" skills expose credentials in plaintext
- **ZERO existing scanners have HIPAA-specific rules**

vlayer fills this critical gap.

## 🔍 What It Detects

### 1. PHI Exposure (8 patterns)
- Hardcoded SSNs in skill prompts
- Patient names in examples
- Date of birth in configurations
- Medical Record Numbers (MRNs)
- ICD diagnosis codes
- Real patient data in documentation

### 2. Credential Leaks (5 patterns)
- Hardcoded API keys
- AWS credentials (AKIA*)
- Database passwords in connection strings
- Bearer tokens
- Private cryptographic keys

### 3. Malicious Patterns (5 patterns)
- Data exfiltration (`curl` to unknown domains)
- Reverse shells
- Atomic Stealer signatures
- Credential scraping commands
- Obfuscated command execution

### 4. HIPAA Violations (5 patterns)
- PHI transmitted over HTTP (not HTTPS)
- No audit logging for PHI access
- PHI logged to console/files
- PHI in URL parameters
- Unencrypted storage (localStorage/sessionStorage)

## 🚀 Usage

### Scan Single Skill

```bash
# Before installing a skill
vlayer skill-scan ~/Downloads/patient-exporter.SKILL.md

# Output formats
vlayer skill-scan ./skill.md -f html -o security-report.html
vlayer skill-scan ./skill.md -f json -o findings.json
```

### Scan Skills Directory

```bash
# Scan all skills in ClawHub cache
vlayer skill-scan ~/.claw/skills/

# Scan MCP skills directory
vlayer skill-scan ~/.config/claude/mcp/skills/

# Scan before committing custom skills
vlayer skill-scan ./my-skills/
```

### CI/CD Integration

```yaml
# .github/workflows/skill-security.yml
name: Skill Security Scan

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install -g verification-layer
      - run: vlayer skill-scan ./skills/ -f json -o scan.json
      - name: Block on critical findings
        run: |
          CRITICAL=$(jq '.summary.critical' scan.json)
          if [ "$CRITICAL" -gt 0 ]; then
            echo "❌ Critical HIPAA violations detected"
            exit 1
          fi
```

## 📊 Example Output

```bash
$ vlayer skill-scan suspicious-skill.md

🔍 Scanning 1 AI Agent Skill file(s)...
✔ Scan complete. Found 22 issue(s) in 1 skill(s).

AI Agent Skills Security Summary:
  Skills scanned: 1
  Total findings: 22
  🚨 Critical: 7
  ⚠️  High: 14
  ⚡ Medium: 1

Issues by Type:
  PHI Exposure: 8
  Credential Leaks: 1
  Data Exfiltration: 1

❌ DO NOT INSTALL THIS SKILL
   Critical or high-severity security issues detected.
   Installing this skill could compromise PHI and violate HIPAA.
```

## 🛡️ Security Recommendations

### Before Installing ANY Skill:

1. **Scan First**: `vlayer skill-scan <skill-file>`
2. **Check Author**: Only install from verified sources
3. **Review Permissions**: Reject skills requesting `*` or `all`
4. **Zero Trust**: Assume skills are malicious until proven safe

### Red Flags:

❌ No author/source attribution
❌ Requests excessive permissions
❌ Uses obfuscated commands
❌ Connects to unknown external domains
❌ Hardcoded credentials or PHI
❌ System file modifications (`rm -rf /`)

## 📋 Supported Platforms

- ✅ Claude Code (Anthropic)
- ✅ OpenClaw / Clawdbot
- ✅ Cursor IDE
- ✅ Codex (GitHub Copilot)
- ✅ MCP Servers (Model Context Protocol)
- ✅ Custom AI agent frameworks

## 🔧 Integration with vlayer

Skills scanner runs automatically when scanning healthcare repos:

```bash
# Regular scan now includes skills
vlayer scan ./my-healthcare-app

# Includes:
# - Source code HIPAA violations
# - AI Agent Skills in .claw/, skills/, etc.
# - Custom rules from vlayer-rules.yaml
```

## 📈 Detection Stats

Based on analysis of 3,984 skills:

| Category | Prevalence | Example |
|----------|------------|---------|
| PHI Exposure | 12.3% | SSN: 123-45-6789 in examples |
| Credential Leaks | 7.1% | API keys, passwords hardcoded |
| Malicious Code | 8.6% | Atomic Stealer, reverse shells |
| HIPAA Violations | 18.4% | HTTP, no logging, insecure storage |

**Total at-risk skills: 36.82%** (1,466 of 3,984)

## 🎓 Educational Examples

### ❌ BAD: Insecure Skill

```markdown
# Patient Lookup

api_key: sk-prod-abc123...
database: postgres://admin:pass@db.com/patients

fetch('http://api.com/patient?ssn=123-45-6789')
```

**Violations:**
- Hardcoded API key (CRITICAL)
- Database password exposed (CRITICAL)
- HTTP transmission (CRITICAL)
- SSN in URL (CRITICAL)

### ✅ GOOD: Secure Skill

```markdown
# Patient Lookup

**Author**: Healthcare IT Team <security@hospital.com>
**Source**: https://github.com/hospital/approved-skills
**Version**: 2.0.0
**Permissions**: patient:read

## Configuration

Uses environment variables:
- `FHIR_API_KEY` - FHIR server API key
- `FHIR_ENDPOINT` - HTTPS endpoint (e.g., https://fhir.hospital.com)

## Implementation

```javascript
const patientId = "{{PATIENT_ID}}"; // Template variable

const response = await fetch(
  `${process.env.FHIR_ENDPOINT}/Patient/${patientId}`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.FHIR_API_KEY}`,
      'Content-Type': 'application/fhir+json'
    }
  }
);

// Audit logging
await auditLog.record({
  action: 'PATIENT_READ',
  userId: currentUser.id,
  resourceId: patientId,
  timestamp: new Date().toISOString()
});
```
\`\`\`

**Security Features:**
- ✅ Environment variables (no hardcoded secrets)
- ✅ HTTPS transmission
- ✅ Template variables (no real PHI)
- ✅ Audit logging
- ✅ Verified author
- ✅ Specific permissions

## 🚀 Roadmap

- [ ] Integration with ClawHub API (real-time threat feed)
- [ ] AI-powered malware detection (using Claude API)
- [ ] Automatic quarantine of malicious skills
- [ ] Skill reputation scoring (community + static analysis)
- [ ] FHIR-specific skill rules
- [ ] HL7 interface security checks

## 📚 References

- Snyk MCP Security Analysis (Feb 2026)
- HIPAA §164.308(a)(4) - Access Controls
- HIPAA §164.312(e)(1) - Transmission Security
- OWASP Top 10 for AI Agents

## 💡 Support

Found a malicious skill? Report to:
- GitHub Issues: https://github.com/Francosimon53/verification-layer/issues
- Security: security@vlayer.app
- ClawHub: report@clawhub.io

---

**vlayer** - Protecting healthcare AI from supply chain attacks since 2025 🛡️
