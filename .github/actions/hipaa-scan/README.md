# HIPAA Scan GitHub Action

Reusable GitHub Action to scan your repository for HIPAA compliance issues using vlayer.

## Usage

### Basic Usage

```yaml
name: HIPAA Compliance

on: [push, pull_request]

jobs:
  hipaa-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run HIPAA Scan
        uses: Francosimon53/verification-layer/.github/actions/hipaa-scan@v1
```

### Advanced Usage with Baseline

```yaml
name: HIPAA Compliance

on: [pull_request]

jobs:
  hipaa-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run HIPAA Scan
        uses: Francosimon53/verification-layer/.github/actions/hipaa-scan@v1
        with:
          baseline-file: '.vlayer-baseline.json'
          min-confidence: 'high'
          exclude-patterns: 'tests/**,docs/**'
          fail-on: 'critical,high'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `path` | Path to scan | No | `.` |
| `baseline-file` | Path to baseline file for comparison | No | `''` |
| `min-confidence` | Minimum confidence level (high, medium, low) | No | `low` |
| `exclude-patterns` | Comma-separated glob patterns to exclude | No | `''` |
| `fail-on` | Severity levels that cause failure | No | `critical,high` |
| `output-format` | Report format (json, html, markdown) | No | `json` |
| `github-token` | GitHub token for posting PR comments | No | `${{ github.token }}` |

## Outputs

| Output | Description |
|--------|-------------|
| `total-findings` | Total number of findings |
| `new-findings` | Number of new findings (not in baseline) |
| `critical-findings` | Number of critical findings |
| `high-findings` | Number of high severity findings |

## Examples

### Scan with Custom Exclusions

```yaml
- name: Run HIPAA Scan
  uses: Francosimon53/verification-layer/.github/actions/hipaa-scan@v1
  with:
    exclude-patterns: 'tests/**,examples/**,docs/**'
```

### Only Fail on Critical Issues

```yaml
- name: Run HIPAA Scan
  uses: Francosimon53/verification-layer/.github/actions/hipaa-scan@v1
  with:
    fail-on: 'critical'
    min-confidence: 'high'
```

### Generate HTML Report

```yaml
- name: Run HIPAA Scan
  uses: Francosimon53/verification-layer/.github/actions/hipaa-scan@v1
  with:
    output-format: 'html'

- name: Upload Report
  uses: actions/upload-artifact@v4
  with:
    name: hipaa-report
    path: hipaa-results.html
```

## Creating a Baseline

To create a baseline file for your repository:

```bash
# Install vlayer
npm install -g verification-layer

# Generate baseline
vlayer baseline . -o .vlayer-baseline.json

# Commit the baseline file
git add .vlayer-baseline.json
git commit -m "chore: add HIPAA compliance baseline"
```

Once committed, the action will use the baseline to only fail on NEW findings.

## Learn More

- [vlayer Documentation](https://github.com/Francosimon53/verification-layer)
- [HIPAA Compliance Guide](https://github.com/Francosimon53/verification-layer/blob/main/ARCHITECTURE.md)
- [Suppression & Baseline Guide](https://github.com/Francosimon53/verification-layer#suppression--baseline)
