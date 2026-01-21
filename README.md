# Verification Layer

CLI tool for HIPAA compliance scanning and reporting. Scans repositories for healthcare data security issues and generates detailed compliance reports.

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# Scan a repository
node dist/cli.js scan <path>

# Generate HTML report
node dist/cli.js scan <path> -f html -o report.html

# Generate Markdown report
node dist/cli.js scan <path> -f markdown -o report.md

# Scan specific categories only
node dist/cli.js scan <path> -c phi-exposure encryption
```

## Compliance Categories

| Category | Description |
|----------|-------------|
| `phi-exposure` | Detects hardcoded PHI (SSN, MRN, DOB), PHI in logs, PHI in URLs |
| `encryption` | Identifies weak crypto (MD5, DES, RC4), disabled SSL/TLS, missing encryption |
| `audit-logging` | Checks for logging framework, unlogged PHI operations |
| `access-control` | Finds CORS issues, hardcoded roles, auth bypass, session problems |
| `data-retention` | Flags improper deletion, short retention periods, missing backups |

## Configuration

Create a `.vlayerrc.json` in your project root:

```json
{
  "exclude": ["**/*.test.ts", "**/__mocks__/**"],
  "ignorePaths": ["sample-data", "fixtures"],
  "safeHttpDomains": ["my-cdn.com"],
  "contextLines": 2
}
```

| Option | Description |
|--------|-------------|
| `exclude` | Glob patterns to exclude from scanning |
| `ignorePaths` | Path substrings to skip |
| `safeHttpDomains` | HTTP domains to ignore (CDNs, namespaces) |
| `contextLines` | Lines of context above/below findings (default: 2) |

Built-in safe domains: w3.org, googleapis.com, jsdelivr.net, unpkg.com, cdnjs.cloudflare.com, etc.

## Report Formats

- **JSON** (default): Machine-readable, ideal for CI/CD integration
- **HTML**: Visual report with color-coded severity and code context
- **Markdown**: Documentation-friendly format

## Exit Codes

- `0`: No critical issues found
- `1`: Critical issues detected (useful for CI/CD pipelines)

## HIPAA References

Each finding includes relevant HIPAA regulation references:
- §164.502, §164.514 - PHI disclosure rules
- §164.312(a) - Access controls
- §164.312(b) - Audit controls
- §164.312(e) - Transmission security
- §164.530(j) - Retention requirements

## License

MIT
