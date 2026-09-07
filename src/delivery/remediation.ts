import type { Finding } from '../types.js';
import { generateFindingHash, normalizeFindingFile } from '../baseline.js';
import type { GuardResult, RemediationItem, RemediationPlan } from './types.js';

function consideredNewFindings(guard: GuardResult): Finding[] {
  return guard.decision.consideredScope === 'changed-files'
    ? guard.delta.newFindingsInChangedFiles
    : guard.delta.newFindings;
}

/**
 * Convert a policy decision into a developer-facing remediation plan. The plan
 * never mutates source; it only advertises a safe-fix command when the scanner
 * has a registered fix type for the finding.
 */
export function buildRemediationPlan(
  projectPath: string,
  guard: GuardResult,
): RemediationPlan {
  const blockingSeverities = new Set(
    guard.decision.reasons
      .filter(reason => reason.code === 'BLOCKING_SEVERITY' && reason.severity)
      .map(reason => reason.severity!),
  );

  const budgetSeverities = new Set(
    guard.decision.reasons
      .filter(reason => reason.code === 'SEVERITY_BUDGET_EXCEEDED' && reason.severity)
      .map(reason => reason.severity!),
  );

  const considered = consideredNewFindings(guard);
  const relevant = considered.filter(finding =>
    blockingSeverities.has(finding.severity) || budgetSeverities.has(finding.severity));

  const items: RemediationItem[] = relevant.map(finding => {
    const autoFixAvailable = Boolean(finding.fixType);
    return {
      fingerprint: generateFindingHash(finding, projectPath),
      severity: finding.severity,
      title: finding.title,
      file: normalizeFindingFile(finding, projectPath),
      line: finding.line,
      recommendation: finding.recommendation,
      autoFixAvailable,
      command: autoFixAvailable ? `vlayer scan ${JSON.stringify(projectPath)} --fix` : undefined,
    };
  });

  return {
    deployAllowed: guard.decision.deployAllowed,
    blockingCount: items.length,
    items,
  };
}

export function remediationToMarkdown(plan: RemediationPlan): string {
  const lines = [
    plan.deployAllowed ? '# Deployment approved' : '# Deployment blocked',
    '',
  ];

  if (plan.items.length === 0) {
    lines.push(plan.deployAllowed
      ? 'No blocking remediation is required.'
      : 'The policy failed for a non-finding condition. Review the policy reasons.');
    return lines.join('\n');
  }

  lines.push(`Blocking findings: ${plan.items.length}`, '');
  for (const item of plan.items) {
    lines.push(
      `## ${item.severity.toUpperCase()} — ${item.title}`,
      '',
      `- Location: \`${item.file}${item.line ? `:${item.line}` : ''}\``,
      `- Recommendation: ${item.recommendation}`,
      `- Auto-fix registered: ${item.autoFixAvailable ? 'yes' : 'no'}`,
    );
    if (item.command) lines.push(`- Safe-fix command: \`${item.command}\``);
    lines.push('');
  }

  return lines.join('\n');
}
