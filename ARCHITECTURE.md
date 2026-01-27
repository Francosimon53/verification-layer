# vlayer — Architecture

> HIPAA Compliance Scanner CLI · VS Code Extension · GitHub Actions

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ENTRY POINTS                                │
│                                                                     │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │   CLI    │    │  VS Code Extension│    │   GitHub Actions     │   │
│  │ vlayer   │    │  vscode-vlayer/   │    │ hipaa-pr-check.yml   │   │
│  │ scan .   │    │                  │    │                      │   │
│  │ audit    │    │  • Scan on save  │    │  • PR scan           │   │
│  │ rules    │    │  • Diagnostics   │    │  • Comment report    │   │
│  │ init     │    │  • Code actions  │    │  • Block on critical │   │
│  └────┬─────┘    │  • Status bar   │    └──────────┬───────────┘   │
│       │          │  • Slack/Teams   │               │               │
│       │          └────────┬─────────┘               │               │
│       │                   │                         │               │
└───────┼───────────────────┼─────────────────────────┼───────────────┘
        │                   │                         │
        ▼                   ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CONFIGURATION                                │
│                                                                     │
│   .vlayerrc.json          vlayer-rules.yaml       CLI flags         │
│   ├─ exclude              ├─ custom patterns      ├─ --categories   │
│   ├─ ignorePaths          ├─ severity             ├─ --exclude      │
│   ├─ safeHttpDomains      ├─ include/exclude      ├─ --fix          │
│   ├─ contextLines         └─ fix strategies       └─ --format       │
│   └─ categories                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SCAN ENGINE                                 │
│                                                                     │
│   src/scan.ts — Orchestration                                       │
│                                                                     │
│   1. Load config ──► 2. Discover files (glob) ──► 3. Run scanners   │
│                                                                     │
│   ┌─────────────────── Scanners (parallel) ──────────────────────┐  │
│   │                                                               │  │
│   │  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐  │  │
│   │  │   PHI    │ │ Encryption │ │  Access  │ │    Audit     │  │  │
│   │  │ 18 ptns  │ │  20+ ptns  │ │ Control  │ │   Logging    │  │  │
│   │  └──────────┘ └────────────┘ └──────────┘ └──────────────┘  │  │
│   │  ┌──────────┐ ┌────────────┐                                 │  │
│   │  │Retention │ │  Security  │     Total: 88 patterns          │  │
│   │  └──────────┘ └────────────┘                                 │  │
│   └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   4. Load custom rules (YAML) ──► 5. Detect tech stack              │
│   6. Sort findings by severity ──► 7. Return ScanResult             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   AUTO-FIXER     │ │   REPORTER   │ │  STACK DETECTOR  │
│   src/fixer/     │ │  src/reporters│ │ src/stack-detector│
│                  │ │              │ │                  │
│  13 fix strategies│ │  • JSON      │ │  10 frameworks   │
│  Bottom-to-top   │ │  • HTML      │ │   8 databases    │
│  Crypto evidence │ │  • Markdown  │ │   7 auth systems │
│                  │ │  • PDF audit │ │                  │
└────────┬─────────┘ └──────┬───────┘ └──────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        OUTPUT LAYER                                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  Console     │  │   Reports    │  │     Audit Trail           │ │
│  │  ├─ Summary  │  │  ├─ JSON     │  │  .vlayer/audit-trail.json │ │
│  │  ├─ Findings │  │  ├─ HTML     │  │  ├─ Crypto evidence      │ │
│  │  └─ Exit code│  │  ├─ Markdown │  │  ├─ Manual reviews       │ │
│  │     (0 | 1)  │  │  └─ PDF     │  │  └─ SHA256 report hash   │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │  VS Code     │  │ Notifications│                                │
│  │  ├─ Squiggles│  │  ├─ Slack    │                                │
│  │  ├─ Status   │  │  └─ Teams    │                                │
│  │  └─ Actions  │  └──────────────┘                                │
│  └──────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
                    ┌──────────────┐
                    │  User Input  │
                    │ CLI / VSCode │
                    │ / GH Action  │
                    └──────┬───────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Load Config       │
                │  .vlayerrc.json     │
                │  vlayer-rules.yaml  │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Discover Files    │
                │   glob + excludes   │
                └──────────┬──────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │     Run 6 Scanners           │
            │     (parallel execution)     │
            │                              │
            │  PHI · Encryption · Access   │
            │  Audit · Retention · Security│
            └──────────────┬───────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  Apply Custom Rules │
                │  (YAML → regex)     │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  Detect Tech Stack  │
                │  framework/db/auth  │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  Sort by Severity   │
                │  critical → info    │
                └──────────┬──────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         ┌────▼────┐             ┌──────▼──────┐
         │  --fix  │             │  Generate   │
         │  mode?  │             │  Report     │
         └────┬────┘             │ json/html/  │
              │ yes              │ md/pdf      │
              ▼                  └─────────────┘
     ┌──────────────────┐
     │  Apply Fixes     │
     │  (bottom-to-top) │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │  Create Audit    │
     │  Trail + Evidence│
     │  SHA256 hashes   │
     └──────────────────┘
```

## Directory Structure

```
verification-layer/
├── src/
│   ├── cli.ts                    # CLI entry — commander.js commands
│   ├── index.ts                  # Public API exports
│   ├── scan.ts                   # Scan orchestration pipeline
│   ├── config.ts                 # Config loading & merging
│   ├── types.ts                  # Core TypeScript interfaces
│   │
│   ├── scanners/                 # Category-specific scanners
│   │   ├── phi/                  #   PHI exposure (18 patterns)
│   │   ├── encryption/           #   Crypto & TLS validation
│   │   ├── access/               #   Access control & auth
│   │   ├── audit/                #   Audit logging detection
│   │   ├── retention/            #   Data retention policies
│   │   └── security/             #   General security issues
│   │
│   ├── rules/                    # Custom rules engine
│   │   ├── loader.ts             #   YAML rule loading
│   │   ├── scanner.ts            #   Custom rule execution
│   │   └── schema.ts             #   Zod validation schemas
│   │
│   ├── fixer/                    # Auto-fix engine
│   │   ├── index.ts              #   Fix orchestration + audit trail
│   │   └── strategies.ts         #   13 fix strategies
│   │
│   ├── reporters/                # Report generation
│   │   ├── index.ts              #   JSON, HTML, Markdown
│   │   ├── audit-report.ts       #   PDF audit trail
│   │   ├── fix-report.ts         #   Fix summary formatting
│   │   └── remediation-guides.ts #   Stack-specific examples
│   │
│   ├── audit/                    # Audit trail system
│   │   ├── index.ts              #   Trail creation & storage
│   │   └── evidence.ts           #   Cryptographic proof (SHA256)
│   │
│   └── stack-detector/           # Tech stack detection
│       ├── index.ts              #   Framework/DB/auth detection
│       └── stack-guides.ts       #   Stack-specific recommendations
│
├── vscode-vlayer/                # VS Code extension
│   └── src/
│       ├── extension.ts          #   Extension lifecycle
│       ├── scanner.ts            #   Workspace scanning + debounce
│       ├── diagnostics.ts        #   Inline diagnostics
│       ├── codeActions.ts        #   Quick-fix code actions
│       └── notifications.ts      #   Slack/Teams webhooks
│
├── tests/                        # Test suite (Vitest)
│   └── scanners/
│       ├── phi.test.ts
│       ├── encryption.test.ts
│       ├── access.test.ts
│       ├── audit.test.ts
│       ├── retention.test.ts
│       └── security.test.ts
│
├── .github/workflows/
│   ├── ci.yml                    # Lint → Test → Build → Release
│   └── hipaa-pr-check.yml        # PR compliance gate
│
├── .vlayerrc.example.json        # Config template
└── vlayer-rules.example.yaml     # Custom rules template
```

## Integration Examples

### CLI — Scan a project

```bash
# Basic scan with JSON report
vlayer scan ./src -f json -o report.json

# Scan specific categories with auto-fix
vlayer scan . --categories phi-exposure encryption --fix

# Generate PDF audit report
vlayer audit . --generate-report --org "HealthCo" --auditor "Jane Doe"

# Validate custom rules
vlayer rules validate vlayer-rules.yaml
```

### GitHub Actions — PR gate

```yaml
# .github/workflows/hipaa-pr-check.yml
name: HIPAA Compliance Check
on: [pull_request]

jobs:
  hipaa-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx vlayer scan . -f json -o hipaa-results.json
      # Posts findings as PR comment, blocks on critical/high
```

### VS Code Extension — Settings

```jsonc
// .vscode/settings.json
{
  "vlayer.enable": true,
  "vlayer.scanOnSave": true,
  "vlayer.categories": ["phi-exposure", "encryption", "access-control"],
  "vlayer.exclude": ["**/*.test.ts"],
  "vlayer.notifications.enable": true,
  "vlayer.notifications.slackWebhook": "https://hooks.slack.com/...",
  "vlayer.notifications.minSeverity": "high"
}
```

### Custom Rules — YAML

```yaml
# vlayer-rules.yaml
rules:
  - id: no-patient-export
    name: "Block raw patient data export"
    category: phi-exposure
    severity: critical
    pattern: "exportPatients?\\("
    include: ["**/*.ts", "**/*.js"]
    recommendation: "Use de-identified export endpoint"
    hipaaReference: "§164.514(a)"
    fix:
      type: replace
      replacement: "exportDeidentifiedPatients("
```

### npm — Programmatic API

```typescript
import { scan } from 'vlayer';

const result = await scan('./src', {
  categories: ['phi-exposure'],
  exclude: ['**/*.test.ts'],
});

console.log(`Found ${result.findings.length} issues`);
```

## Detection Categories

| Category | Patterns | Severity Range | Examples |
|----------|----------|----------------|----------|
| **PHI Exposure** | 18 | Critical–Medium | SSN hardcoding, PHI in localStorage, patient data in URLs, PHI in logs |
| **Encryption** | 20+ | Critical–Low | MD5/SHA1/DES/RC4, HTTP URLs, disabled SSL/TLS, unencrypted backups |
| **Access Control** | 10+ | Critical–Medium | SQL injection, XSS, CORS wildcards, hardcoded credentials |
| **Audit Logging** | 5+ | High–Medium | Missing logging framework, unlogged PHI operations |
| **Data Retention** | 5+ | High–Medium | Bulk deletes without audit, missing retention policies |
| **Security** | 10+ | Critical–Low | eval(), hardcoded API keys, insecure cookies, missing auth |

### Auto-Fix Strategies (13)

| Strategy | Detection | Fix Applied |
|----------|-----------|-------------|
| `sql-injection-template` | `` `SELECT ${var}` `` | `query('SELECT ?', [var])` |
| `sql-injection-concat` | `"SELECT " + var` | `query('SELECT ?', [var])` |
| `hardcoded-password` | `password = "secret"` | `password = process.env.PASSWORD` |
| `hardcoded-secret` | `secret = "xyz"` | `secret = process.env.SECRET` |
| `api-key-exposed` | `apiKey = "key123"` | `apiKey = process.env.API_KEY` |
| `phi-console-log` | `console.log(patient)` | `// [VLAYER] PHI removed` |
| `http-url` | `http://example.com` | `https://example.com` |
| `innerhtml-unsanitized` | `.innerHTML = text` | `.textContent = text` |
| `phi-localstorage` | `localStorage.setItem(...)` | `// [VLAYER] Use server-side session` |
| `phi-url-param` | `` fetch(`/api?id=${id}`) `` | `// [VLAYER] Use POST with body` |
| `phi-log-unredacted` | `logger.info(..., patient)` | `logger.info(..., redactPHI(patient))` |
| `cookie-insecure` | `cookie: {}` | `cookie: { httpOnly: true, secure: true }` |
| `backup-unencrypted` | `writeFile('backup.sql', ...)` | `// [VLAYER] Encrypt before writing` |

## Notifications

```
┌───────────────────────────────────────────────────┐
│              NOTIFICATION FLOW                     │
│                                                    │
│  Scan Result ──► New findings? ──► Filter by       │
│                  (diff check)      minSeverity     │
│                                        │           │
│                        ┌───────────────┼────────┐  │
│                        ▼               ▼        │  │
│                  ┌──────────┐   ┌───────────┐   │  │
│                  │  Slack   │   │  Teams    │   │  │
│                  │ Webhook  │   │ Webhook   │   │  │
│                  └──────────┘   └───────────┘   │  │
└───────────────────────────────────────────────────┘
```

## Current Metrics

| Metric          | Value |
|-----------------|-------|
| Scan patterns   | 88    |
| Auto-fix strategies | 13 |
| Test cases      | 253   |
| Scanner categories | 6  |
| Frameworks detected | 10 |
| Databases detected  | 8  |
| Auth providers detected | 7 |
| Report formats  | 4 (JSON, HTML, Markdown, PDF) |

## Roadmap

### Done
- [x] Core scan engine with 6 category scanners
- [x] 88 detection patterns across HIPAA categories
- [x] 13 auto-fix strategies with bottom-to-top processing
- [x] JSON, HTML, Markdown, PDF report generation
- [x] Tech stack detection (10 frameworks, 8 databases, 7 auth)
- [x] Custom rules engine (YAML with Zod validation)
- [x] Cryptographic audit trail with SHA256 evidence
- [x] GitHub Actions PR compliance gate
- [x] CI/CD with semantic-release
- [x] Dependabot for dependency updates
- [x] Pre-commit hook (husky) for local scanning
- [x] 253 test cases with Vitest

### In Progress
- [ ] VS Code extension — inline diagnostics + code actions
- [ ] Slack/Teams webhook notifications
- [ ] npm publish to registry

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
