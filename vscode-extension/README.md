# VLayer - HIPAA Compliance Scanner for VS Code

Real-time HIPAA compliance scanning directly in your editor. Catch PHI exposure, encryption issues, and other compliance violations as you code.

## Features

### 🔍 Real-time Scanning
- Automatic scan on file save
- Instant inline diagnostics with severity indicators
- Hover tooltips with HIPAA references and recommendations

### 🎯 Smart Diagnostics
- **Severity levels**: Critical, High, Medium, Low
- **Confidence scoring**: High, Medium, Low confidence for each finding
- **Context-aware**: Distinguishes code from strings and comments

### ⚡ Quick Fixes
- Apply auto-fixes directly from the editor
- Suppress findings with inline comments
- One-click remediation for common issues

### 📊 Status Bar
- Live compliance score for current file
- Quick overview of issue counts by severity
- Visual indicators for critical issues

### 🛠️ Commands

- **VLayer: Scan Current File** - Scan the active file
- **VLayer: Scan Workspace** - Scan entire workspace
- **VLayer: Clear Diagnostics** - Clear all diagnostics

## Configuration

Access settings via `File > Preferences > Settings` and search for "VLayer":

```json
{
  "vlayer.enableAutoScan": true,
  "vlayer.minConfidence": "low",
  "vlayer.showStatusBar": true,
  "vlayer.configPath": ""
}
```

### Settings

- **vlayer.enableAutoScan** - Enable/disable automatic scanning on file save
- **vlayer.minConfidence** - Minimum confidence level to show (low, medium, high)
- **vlayer.showStatusBar** - Show/hide compliance score in status bar
- **vlayer.configPath** - Path to custom vlayer configuration file

## HIPAA Categories

VLayer scans for:

1. **PHI Exposure** - Social Security Numbers, Medical Record Numbers, Dates of Birth
2. **Encryption** - Weak crypto (MD5, DES), missing TLS, hardcoded keys
3. **Audit Logging** - Missing audit trails for PHI access
4. **Access Control** - CORS misconfigurations, hardcoded credentials
5. **Data Retention** - Improper data deletion, missing retention policies

## Usage

### Basic Workflow

1. Open a workspace with healthcare application code
2. Files are automatically scanned on save (if auto-scan is enabled)
3. View inline diagnostics with severity markers
4. Hover over issues to see HIPAA references and recommendations
5. Apply quick fixes or suppress findings as needed

### Manual Scanning

Use Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- Type "VLayer: Scan Current File" to scan active file
- Type "VLayer: Scan Workspace" to scan all files

### Custom Configuration

Create `.vlayerrc.json` in your workspace root:

```json
{
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "categories": ["phi-exposure", "encryption", "audit-logging"],
  "customRulesPath": "./custom-hipaa-rules.yaml"
}
```

## Custom Rules

Define custom compliance rules in YAML:

```yaml
version: "1.0"
rules:
  - id: custom-phi-check
    name: Custom PHI Pattern
    description: Detects custom PHI patterns
    category: phi-exposure
    severity: high
    pattern: "customPattern.*PHI"
    recommendation: Remove or encrypt PHI data
    confidence: high
    adjustConfidenceByContext: true
```

## Requirements

- VS Code 1.80.0 or higher
- Node.js 18+ (for workspace scanning)

## Known Issues

- Large workspaces may take longer to scan initially
- Binary files are automatically excluded from scanning

## Release Notes

### 2.0.0

- ✨ Real-time scanning on file save
- ✨ Inline diagnostics with severity and confidence
- ✨ Hover tooltips with HIPAA references
- ✨ Quick fix actions for auto-remediation
- ✨ Status bar compliance score
- ✨ Workspace-wide scanning
- ✨ Configurable confidence thresholds

## Support

- 📖 [Documentation](https://github.com/Francosimon53/verification-layer)
- 🐛 [Report Issues](https://github.com/Francosimon53/verification-layer/issues)
- 💬 [Discussions](https://github.com/Francosimon53/verification-layer/discussions)

## License

MIT License - see [LICENSE](https://github.com/Francosimon53/verification-layer/blob/main/LICENSE) for details.

---

**Happy compliant coding!** 🏥🔒
