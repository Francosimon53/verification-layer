import * as vscode from 'vscode';
import {
  createDiagnosticCollection,
  updateDiagnostics,
  clearDiagnostics,
} from './diagnostics';
import {
  scanWorkspace,
  scanWithDebounce,
  clearCache,
  invalidateCacheForFile,
} from './scanner';
import { registerCodeActionsProvider } from './codeActions';

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  console.log('vlayer extension activating...');

  // Create diagnostic collection
  diagnosticCollection = createDiagnosticCollection();
  context.subscriptions.push(diagnosticCollection);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'vlayer.scan';
  context.subscriptions.push(statusBarItem);

  // Register code actions provider
  registerCodeActionsProvider(context);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('vlayer.scan', () => runFullScan()),
    vscode.commands.registerCommand('vlayer.scanFile', () => runFileScan())
  );

  // Listen for file saves
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      const config = vscode.workspace.getConfiguration('vlayer');
      if (!config.get<boolean>('enable') || !config.get<boolean>('scanOnSave')) {
        return;
      }
      onFileSaved(document);
    })
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('vlayer')) {
        clearCache();
        const config = vscode.workspace.getConfiguration('vlayer');
        if (config.get<boolean>('enable')) {
          runFullScan();
        } else {
          clearDiagnostics(diagnosticCollection);
          updateStatusBar(0);
        }
      }
    })
  );

  // Initial scan on activation
  const config = vscode.workspace.getConfiguration('vlayer');
  if (config.get<boolean>('enable')) {
    runFullScan();
  }

  console.log('vlayer extension activated');
}

export function deactivate(): void {
  clearCache();
}

async function runFullScan(): Promise<void> {
  const config = vscode.workspace.getConfiguration('vlayer');
  if (!config.get<boolean>('enable')) {
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage('No workspace folder open');
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Scanning for HIPAA compliance issues...',
      cancellable: false,
    },
    async () => {
      try {
        const result = await scanWorkspace(workspacePath);
        updateDiagnostics(diagnosticCollection, result, workspacePath);
        updateStatusBar(result.findings.length);

        if (result.findings.length > 0) {
          const critical = result.findings.filter(
            (f) => f.severity === 'critical' || f.severity === 'high'
          ).length;

          if (critical > 0) {
            vscode.window.showWarningMessage(
              `Found ${result.findings.length} HIPAA issues (${critical} critical/high)`
            );
          }
        }
      } catch (error) {
        console.error('Scan error:', error);
        vscode.window.showErrorMessage(`vlayer scan failed: ${error}`);
      }
    }
  );
}

async function runFileScan(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No file open');
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const filePath = editor.document.uri.fsPath;

  try {
    clearCache();
    const result = await scanWorkspace(workspacePath);
    updateDiagnostics(diagnosticCollection, result, workspacePath);
    updateStatusBar(result.findings.length);

    const fileFindings = result.findings.filter(
      (f) => f.file === filePath || filePath.endsWith(f.file)
    );

    if (fileFindings.length > 0) {
      vscode.window.showInformationMessage(
        `Found ${fileFindings.length} issues in current file`
      );
    } else {
      vscode.window.showInformationMessage('No HIPAA issues found in current file');
    }
  } catch (error) {
    console.error('File scan error:', error);
    vscode.window.showErrorMessage(`vlayer scan failed: ${error}`);
  }
}

function onFileSaved(document: vscode.TextDocument): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;

  // Invalidate cache for this file
  invalidateCacheForFile(document.uri.fsPath);

  // Debounced scan
  scanWithDebounce(workspacePath, (result) => {
    updateDiagnostics(diagnosticCollection, result, workspacePath);
    updateStatusBar(result.findings.length);
  });
}

function updateStatusBar(issueCount: number): void {
  if (issueCount === 0) {
    statusBarItem.text = '$(shield) HIPAA: OK';
    statusBarItem.tooltip = 'No HIPAA compliance issues found';
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = `$(warning) HIPAA: ${issueCount} issues`;
    statusBarItem.tooltip = `${issueCount} HIPAA compliance issues found. Click to scan.`;
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground'
    );
  }
  statusBarItem.show();
}
