import * as vscode from 'vscode';
import * as path from 'path';
import { scan } from 'verification-layer';
import type { Finding, ScanResult } from 'verification-layer';

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  console.log('VLayer HIPAA extension activated');

  // Create diagnostic collection
  diagnosticCollection = vscode.languages.createDiagnosticCollection('vlayer');
  context.subscriptions.push(diagnosticCollection);

  // Create output channel
  outputChannel = vscode.window.createOutputChannel('VLayer HIPAA');
  context.subscriptions.push(outputChannel);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('vlayer.scanCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await scanDocument(editor.document);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vlayer.scanWorkspace', async () => {
      await scanWorkspace();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vlayer.clearDiagnostics', () => {
      diagnosticCollection.clear();
      updateStatusBar(null);
    })
  );

  // Watch for file saves
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      const config = vscode.workspace.getConfiguration('vlayer');
      if (config.get<boolean>('enableAutoScan', true)) {
        await scanDocument(document);
      }
    })
  );

  // Watch for active editor changes to update status bar
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor) {
        await updateStatusBarForDocument(editor.document);
      }
    })
  );

  // Scan current file on startup if open
  if (vscode.window.activeTextEditor) {
    scanDocument(vscode.window.activeTextEditor.document);
  }
}

async function scanDocument(document: vscode.TextDocument): Promise<void> {
  if (document.uri.scheme !== 'file') {
    return;
  }

  const filePath = document.uri.fsPath;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

  if (!workspaceFolder) {
    return;
  }

  const config = vscode.workspace.getConfiguration('vlayer');
  const minConfidence = config.get<string>('minConfidence', 'low');
  const configPath = config.get<string>('configPath', '');

  try {
    outputChannel.appendLine(`Scanning ${path.basename(filePath)}...`);

    const scanOptions: any = {
      path: workspaceFolder.uri.fsPath,
      minConfidence: minConfidence as any,
    };

    if (configPath) {
      scanOptions.configFile = path.resolve(workspaceFolder.uri.fsPath, configPath);
    }

    const result: ScanResult = await scan(scanOptions);

    // Filter findings for this specific file
    const fileFindings = result.findings.filter(
      (f) => f.file === filePath && !f.isBaseline && !f.suppressed && !f.acknowledged
    );

    const diagnostics = fileFindings.map((finding) => createDiagnostic(finding, document));
    diagnosticCollection.set(document.uri, diagnostics);

    outputChannel.appendLine(
      `Found ${fileFindings.length} issue(s) in ${path.basename(filePath)}`
    );

    await updateStatusBarForDocument(document);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Error scanning ${path.basename(filePath)}: ${errorMessage}`);
    vscode.window.showErrorMessage(`VLayer: Failed to scan file - ${errorMessage}`);
  }
}

async function scanWorkspace(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage('No workspace folder open');
    return;
  }

  const workspaceFolder = workspaceFolders[0];
  const config = vscode.workspace.getConfiguration('vlayer');
  const minConfidence = config.get<string>('minConfidence', 'low');
  const configPath = config.get<string>('configPath', '');

  try {
    outputChannel.show();
    outputChannel.appendLine('Starting workspace scan...');

    const scanOptions: any = {
      path: workspaceFolder.uri.fsPath,
      minConfidence: minConfidence as any,
    };

    if (configPath) {
      scanOptions.configFile = path.resolve(workspaceFolder.uri.fsPath, configPath);
    }

    const result: ScanResult = await scan(scanOptions);

    // Group findings by file
    const findingsByFile = new Map<string, Finding[]>();

    for (const finding of result.findings) {
      if (finding.isBaseline || finding.suppressed || finding.acknowledged) {
        continue;
      }

      const findings = findingsByFile.get(finding.file) || [];
      findings.push(finding);
      findingsByFile.set(finding.file, findings);
    }

    // Clear all diagnostics first
    diagnosticCollection.clear();

    // Set diagnostics for each file
    for (const [filePath, findings] of findingsByFile.entries()) {
      const uri = vscode.Uri.file(filePath);

      try {
        const document = await vscode.workspace.openTextDocument(uri);
        const diagnostics = findings.map((f) => createDiagnostic(f, document));
        diagnosticCollection.set(uri, diagnostics);
      } catch {
        // File might not be accessible, skip it
      }
    }

    const totalIssues = result.findings.filter(
      (f) => !f.isBaseline && !f.suppressed && !f.acknowledged
    ).length;

    outputChannel.appendLine(
      `Workspace scan complete: ${totalIssues} issue(s) in ${findingsByFile.size} file(s)`
    );

    vscode.window.showInformationMessage(
      `VLayer: Found ${totalIssues} issue(s) in ${findingsByFile.size} file(s)`
    );

    // Update status bar for active editor
    if (vscode.window.activeTextEditor) {
      await updateStatusBarForDocument(vscode.window.activeTextEditor.document);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Error scanning workspace: ${errorMessage}`);
    vscode.window.showErrorMessage(`VLayer: Workspace scan failed - ${errorMessage}`);
  }
}

function createDiagnostic(finding: Finding, document: vscode.TextDocument): vscode.Diagnostic {
  const line = finding.line ? finding.line - 1 : 0;
  const lineText = document.lineAt(line).text;
  const startChar = finding.column || 0;
  const endChar = finding.column ? finding.column + 10 : lineText.length;

  const range = new vscode.Range(line, startChar, line, endChar);

  const severity = getSeverity(finding.severity);
  const diagnostic = new vscode.Diagnostic(range, finding.title, severity);

  diagnostic.source = 'vlayer';
  diagnostic.code = finding.id;

  // Add detailed message with confidence
  const confidence = finding.confidence || 'medium';
  diagnostic.message = `${finding.title} [${confidence} confidence]\n\n${finding.description}`;

  // Store finding data for hover and quick fixes
  (diagnostic as any).vlayerFinding = finding;

  return diagnostic;
}

function getSeverity(severity: string): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'critical':
    case 'high':
      return vscode.DiagnosticSeverity.Error;
    case 'medium':
      return vscode.DiagnosticSeverity.Warning;
    case 'low':
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Warning;
  }
}

async function updateStatusBarForDocument(document: vscode.TextDocument): Promise<void> {
  const config = vscode.workspace.getConfiguration('vlayer');
  const showStatusBar = config.get<boolean>('showStatusBar', true);

  if (!showStatusBar) {
    statusBarItem.hide();
    return;
  }

  const diagnostics = diagnosticCollection.get(document.uri);

  if (!diagnostics || diagnostics.length === 0) {
    updateStatusBar({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
    return;
  }

  const stats = {
    total: diagnostics.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const diag of diagnostics) {
    const finding = (diag as any).vlayerFinding as Finding;
    if (finding) {
      if (finding.severity === 'critical') stats.critical++;
      else if (finding.severity === 'high') stats.high++;
      else if (finding.severity === 'medium') stats.medium++;
      else stats.low++;
    }
  }

  updateStatusBar(stats);
}

function updateStatusBar(stats: { total: number; critical: number; high: number; medium: number; low: number } | null): void {
  if (!stats || stats.total === 0) {
    statusBarItem.text = '$(check) VLayer: Compliant';
    statusBarItem.tooltip = 'No HIPAA compliance issues found';
    statusBarItem.backgroundColor = undefined;
  } else {
    const icon = stats.critical > 0 || stats.high > 0 ? '$(error)' : '$(warning)';
    statusBarItem.text = `${icon} VLayer: ${stats.total} issue(s)`;
    statusBarItem.tooltip = `HIPAA Issues:\nCritical: ${stats.critical}\nHigh: ${stats.high}\nMedium: ${stats.medium}\nLow: ${stats.low}`;

    if (stats.critical > 0) {
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (stats.high > 0) {
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      statusBarItem.backgroundColor = undefined;
    }
  }

  statusBarItem.show();
}

// Register hover provider
class VLayerHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    const diagnostics = diagnosticCollection.get(document.uri);

    if (!diagnostics) {
      return null;
    }

    for (const diagnostic of diagnostics) {
      if (diagnostic.range.contains(position)) {
        const finding = (diagnostic as any).vlayerFinding as Finding;

        if (!finding) {
          return null;
        }

        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        markdown.appendMarkdown(`### ${finding.title}\n\n`);
        markdown.appendMarkdown(`**Severity:** ${finding.severity} | **Confidence:** ${finding.confidence || 'medium'}\n\n`);
        markdown.appendMarkdown(`**Description:** ${finding.description}\n\n`);

        if (finding.hipaaReference) {
          markdown.appendMarkdown(`**HIPAA Reference:** ${finding.hipaaReference}\n\n`);
        }

        markdown.appendMarkdown(`**Recommendation:** ${finding.recommendation}\n\n`);

        if (finding.fixType) {
          markdown.appendMarkdown(`💡 *Quick fix available*\n\n`);
        }

        return new vscode.Hover(markdown, diagnostic.range);
      }
    }

    return null;
  }
}

// Register code action provider for quick fixes
class VLayerCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    const diagnostics = diagnosticCollection.get(document.uri);

    if (!diagnostics) {
      return [];
    }

    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of diagnostics) {
      if (diagnostic.range.intersection(range)) {
        const finding = (diagnostic as any).vlayerFinding as Finding;

        if (finding && finding.fixType) {
          const action = new vscode.CodeAction(
            `Fix: ${finding.title}`,
            vscode.CodeActionKind.QuickFix
          );

          action.diagnostics = [diagnostic];
          action.isPreferred = true;

          // Apply auto-fix
          action.command = {
            title: 'Apply VLayer Fix',
            command: 'vlayer.applyFix',
            arguments: [document, finding],
          };

          actions.push(action);
        }

        // Add suppress action
        const suppressAction = new vscode.CodeAction(
          'Suppress VLayer finding',
          vscode.CodeActionKind.QuickFix
        );

        suppressAction.diagnostics = [diagnostic];
        suppressAction.command = {
          title: 'Suppress VLayer Finding',
          command: 'vlayer.suppressFinding',
          arguments: [document, finding, diagnostic.range],
        };

        actions.push(suppressAction);
      }
    }

    return actions;
  }
}

export function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  if (outputChannel) {
    outputChannel.dispose();
  }
}
