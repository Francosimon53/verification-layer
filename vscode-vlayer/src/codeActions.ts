import * as vscode from 'vscode';
import type { Finding } from 'verification-layer';
import { DiagnosticWithFinding } from './diagnostics';

export class VlayerCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'vlayer') {
        continue;
      }

      const finding = (diagnostic as DiagnosticWithFinding).finding;
      if (!finding?.fixType) {
        continue;
      }

      // Create quick fix action
      const action = new vscode.CodeAction(
        `Apply vlayer fix: ${this.getFixDescription(finding)}`,
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [diagnostic];
      action.command = {
        command: 'vlayer.applyFix',
        title: 'Apply vlayer fix',
        arguments: [finding, document.uri],
      };
      action.isPreferred = true;

      actions.push(action);
    }

    return actions;
  }

  private getFixDescription(finding: Finding): string {
    const descriptions: Record<string, string> = {
      'sql-injection-template': 'Convert to parameterized query',
      'sql-injection-concat': 'Use parameterized query',
      'hardcoded-password': 'Move to environment variable',
      'hardcoded-secret': 'Move to environment variable',
      'api-key-exposed': 'Move to environment variable',
      'phi-console-log': 'Remove PHI from console.log',
      'http-url': 'Use HTTPS instead of HTTP',
      'innerhtml-unsanitized': 'Sanitize HTML content',
      'phi-localstorage': 'Remove PHI from localStorage',
      'phi-url-param': 'Remove PHI from URL',
      'phi-log-unredacted': 'Redact PHI in log',
      'cookie-insecure': 'Add secure cookie flags',
      'backup-unencrypted': 'Add encryption to backup',
    };

    return descriptions[finding.fixType!] ?? 'Fix compliance issue';
  }
}

export async function applyFix(finding: Finding, documentUri: vscode.Uri): Promise<void> {
  if (!finding.fixType || finding.line === undefined) {
    vscode.window.showWarningMessage('This issue cannot be auto-fixed.');
    return;
  }

  try {
    const { applyFixesSimple } = await import('verification-layer/dist/fixer/index.js');
    const result = await applyFixesSimple([finding]);

    if (result.fixedCount > 0) {
      // Reload the document to show changes
      const document = await vscode.workspace.openTextDocument(documentUri);
      await vscode.window.showTextDocument(document);
      vscode.window.showInformationMessage(`Fixed: ${finding.title}`);
    } else {
      vscode.window.showWarningMessage('Could not apply automatic fix.');
    }
  } catch (error) {
    console.error('Fix error:', error);
    vscode.window.showErrorMessage(`Failed to apply fix: ${error}`);
  }
}

export function registerCodeActionsProvider(context: vscode.ExtensionContext): void {
  const provider = new VlayerCodeActionProvider();

  // Register for all file types
  const selector: vscode.DocumentSelector = { scheme: 'file' };

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      selector,
      provider,
      {
        providedCodeActionKinds: VlayerCodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  // Register the applyFix command
  context.subscriptions.push(
    vscode.commands.registerCommand('vlayer.applyFix', applyFix)
  );
}
