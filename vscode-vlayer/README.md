# HIPAA Compliance Scanner (vlayer)

A VS Code extension that scans your codebase for HIPAA compliance issues and displays inline warnings.

## Features

- **Inline Warnings**: See HIPAA compliance issues directly in your code with squiggly underlines
- **Automatic Scanning**: Scans your workspace on startup and when files are saved
- **Quick Fixes**: Apply automatic fixes for common issues
- **Status Bar**: Shows the count of compliance issues at a glance
- **Configurable**: Enable/disable categories, exclude patterns, and more

## Compliance Categories

The extension scans for issues in these HIPAA compliance categories:

- **PHI Exposure** - Detects potential exposure of Protected Health Information
- **Encryption** - Identifies weak cryptography and missing TLS
- **Audit Logging** - Checks for proper logging of PHI access
- **Access Control** - Finds authentication and authorization issues
- **Data Retention** - Flags improper data deletion practices

## Commands

- `vlayer: Scan Workspace for HIPAA Issues` - Run a full workspace scan
- `vlayer: Scan Current File for HIPAA Issues` - Scan only the current file

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `vlayer.enable` | `true` | Enable HIPAA compliance scanning |
| `vlayer.scanOnSave` | `true` | Automatically scan files when saved |
| `vlayer.categories` | All | Categories to scan for |
| `vlayer.exclude` | `node_modules`, `dist`, `.git` | Glob patterns to exclude |
| `vlayer.debounceDelay` | `1000` | Delay in ms before rescanning |

## Severity Levels

| vlayer Severity | VS Code Display |
|-----------------|-----------------|
| critical | Error (red) |
| high | Error (red) |
| medium | Warning (yellow) |
| low | Information (blue) |
| info | Hint (gray) |

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch
```

### Testing the Extension

1. Open this folder in VS Code
2. Press F5 to open Extension Development Host
3. Open a project with potential HIPAA issues
4. Verify that warnings appear inline

## Requirements

This extension requires the `verification-layer` package to be installed.

## License

MIT
