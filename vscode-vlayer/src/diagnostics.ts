import * as vscode from 'vscode';
import type { Finding, Severity, ScanResult } from 'verification-layer';

const SEVERITY_MAP: Record<Severity, vscode.DiagnosticSeverity> = {
  critical: vscode.DiagnosticSeverity.Error,
  high: vscode.DiagnosticSeverity.Error,
  medium: vscode.DiagnosticSeverity.Warning,
  low: vscode.DiagnosticSeverity.Information,
  info: vscode.DiagnosticSeverity.Hint,
};

export function createDiagnosticCollection(): vscode.DiagnosticCollection {
  return vscode.languages.createDiagnosticCollection('vlayer');
}

export function findingToDiagnostic(finding: Finding): vscode.Diagnostic {
  const line = (finding.line ?? 1) - 1; // VS Code uses 0-based lines
  const column = (finding.column ?? 1) - 1;

  // Create range for the finding
  const range = new vscode.Range(
    new vscode.Position(line, column),
    new vscode.Position(line, column + 100) // Extend to end of reasonable code span
  );

  // Create message with title and recommendation
  const message = `${finding.title}\n\n${finding.recommendation}`;

  const diagnostic = new vscode.Diagnostic(
    range,
    message,
    SEVERITY_MAP[finding.severity]
  );

  // Set diagnostic code to HIPAA reference
  diagnostic.code = finding.hipaaReference ?? finding.id;
  diagnostic.source = 'vlayer';

  // Store finding data for code actions
  (diagnostic as DiagnosticWithFinding).finding = finding;

  return diagnostic;
}

export interface DiagnosticWithFinding extends vscode.Diagnostic {
  finding?: Finding;
}

export function updateDiagnostics(
  diagnosticCollection: vscode.DiagnosticCollection,
  result: ScanResult,
  workspacePath: string
): void {
  // Clear existing diagnostics
  diagnosticCollection.clear();

  // Group findings by file
  const findingsByFile = new Map<string, Finding[]>();

  for (const finding of result.findings) {
    const filePath = finding.file.startsWith('/')
      ? finding.file
      : `${workspacePath}/${finding.file}`;

    if (!findingsByFile.has(filePath)) {
      findingsByFile.set(filePath, []);
    }
    findingsByFile.get(filePath)!.push(finding);
  }

  // Create diagnostics for each file
  for (const [filePath, findings] of findingsByFile) {
    const uri = vscode.Uri.file(filePath);
    const diagnostics = findings.map(findingToDiagnostic);
    diagnosticCollection.set(uri, diagnostics);
  }
}

export function clearDiagnostics(diagnosticCollection: vscode.DiagnosticCollection): void {
  diagnosticCollection.clear();
}

export function getDiagnosticsForDocument(
  diagnosticCollection: vscode.DiagnosticCollection,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  return [...(diagnosticCollection.get(document.uri) ?? [])];
}
