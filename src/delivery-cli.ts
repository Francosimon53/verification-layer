#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { applyFixes } from './fixer/index.js';
import {
  buildComplianceGraph,
  buildEvidencePackage,
  buildRemediationPlan,
  getAcknowledgmentLifecycle,
  graphToMermaid,
  remediationToMarkdown,
  runComplianceGuard,
  saveEvidencePackage,
  verifyEvidencePackage,
} from './delivery/index.js';
import type { EvidencePackage, GuardResult } from './delivery/types.js';

interface CommonOptions {
  baseline?: string;
  config?: string;
  policy?: string;
  base?: string;
  head?: string;
  allFiles?: boolean;
  ai?: boolean;
  minConfidence?: 'high' | 'medium' | 'low';
}

function addCommonOptions(command: Command): Command {
  return command
    .option('--baseline <path>', 'Baseline file (default: .vlayer-baseline.json when present)')
    .option('--config <path>', 'Scanner configuration file')
    .option('--policy <path>', 'Delivery policy JSON file')
    .option('--base <ref>', 'Git base branch, tag, or SHA')
    .option('--head <ref>', 'Git head branch, tag, or SHA', 'HEAD')
    .option('--all-files', 'Evaluate all new findings instead of changed files only')
    .option('--ai', 'Enable AI triage for this gate (off by default for deterministic CI)')
    .option('--min-confidence <level>', 'Minimum confidence: high, medium, low');
}

async function executeGuard(path: string, options: CommonOptions) {
  return runComplianceGuard({
    path,
    baselineFile: options.baseline,
    configFile: options.config,
    policyFile: options.policy,
    baseRef: options.base,
    headRef: options.head,
    changedFilesOnly: options.allFiles ? false : undefined,
    enableAI: options.ai === true,
    minConfidence: options.minConfidence,
  });
}

function guardJson(guard: Awaited<ReturnType<typeof runComplianceGuard>>) {
  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    source: guard.git,
    baseline: {
      loaded: guard.baselineLoaded,
      path: guard.baselinePath,
    },
    policySource: guard.policySource,
    decision: guard.decision,
    summary: {
      scannedFiles: guard.scannedFiles,
      complianceScore: guard.complianceScore,
      newFindings: guard.delta.newFindings.length,
      newFindingsInChangedFiles: guard.delta.newFindingsInChangedFiles.length,
      baselineFindings: guard.delta.baselineFindings.length,
      resolvedFindings: guard.delta.resolvedFindings.length,
      expiredAcknowledgments: guard.acknowledgmentLifecycle.expired.length,
    },
    newFindings: guard.delta.newFindings.map(finding => ({
      id: finding.id,
      severity: finding.severity,
      title: finding.title,
      file: finding.file,
      line: finding.line,
      recommendation: finding.recommendation,
      hipaaReference: finding.hipaaReference,
      fixType: finding.fixType,
    })),
    resolvedFindings: guard.delta.resolvedFindings,
  };
}

function printDecision(guard: Awaited<ReturnType<typeof runComplianceGuard>>): void {
  const decision = guard.decision;
  console.log('');
  console.log(decision.deployAllowed
    ? chalk.green.bold('DEPLOYMENT APPROVED')
    : chalk.red.bold('DEPLOYMENT BLOCKED'));
  console.log(chalk.gray(`Scope: ${decision.consideredScope}`));
  if (guard.git.headSha) console.log(chalk.gray(`Head: ${guard.git.headSha}`));
  if (guard.git.baseSha) console.log(chalk.gray(`Base: ${guard.git.baseSha}`));
  console.log(chalk.gray(`Changed files: ${guard.git.changedFiles.length}`));
  console.log(`Compliance score: ${guard.complianceScore ?? 'N/A'}`);
  console.log(`New findings: ${guard.delta.newFindings.length}`);
  console.log(`New in changed files: ${guard.delta.newFindingsInChangedFiles.length}`);
  console.log(`Resolved: ${guard.delta.resolvedFindings.length}`);
  console.log(`Baseline debt: ${guard.delta.baselineFindings.length}`);

  if (decision.reasons.length > 0) {
    console.log(chalk.bold('\nPolicy reasons:'));
    for (const reason of decision.reasons) {
      console.log(chalk.red(`  - ${reason.message}`));
    }
  }

  const soon = guard.acknowledgmentLifecycle.expiringSoon.length;
  if (soon > 0) {
    console.log(chalk.yellow(`\n${soon} acknowledgment${soon === 1 ? '' : 's'} expire within 30 days.`));
  }
}

async function appendGithubSummary(guard: Awaited<ReturnType<typeof runComplianceGuard>>): Promise<void> {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const lines = [
    '## vlayer compliance delivery gate',
    '',
    `**Decision:** ${guard.decision.deployAllowed ? 'PASS' : 'FAIL'}`,
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Compliance score | ${guard.complianceScore ?? 'N/A'} |`,
    `| New findings | ${guard.delta.newFindings.length} |`,
    `| New in changed files | ${guard.delta.newFindingsInChangedFiles.length} |`,
    `| Resolved | ${guard.delta.resolvedFindings.length} |`,
    `| Baseline debt | ${guard.delta.baselineFindings.length} |`,
    `| Expired exceptions | ${guard.acknowledgmentLifecycle.expired.length} |`,
    '',
  ];

  if (guard.decision.reasons.length > 0) {
    lines.push('### Policy reasons', '');
    for (const reason of guard.decision.reasons) lines.push(`- ${reason.message}`);
    lines.push('');
  }

  await writeFile(summaryFile, `${lines.join('\n')}\n`, { flag: 'a' });
}

function setDecisionExitCode(guard: GuardResult): void {
  if (!guard.decision.deployAllowed) process.exitCode = 2;
}

const program = new Command();
program
  .name('vlayer-ci')
  .description('Compliance delivery gates, evidence, graph, and remediation for vlayer')
  .version('1.0.0');

addCommonOptions(
  program
    .command('guard')
    .description('Decide whether a software change may be deployed')
    .argument('[path]', 'Repository path', '.')
    .option('-o, --output <path>', 'Write the machine-readable guard result to JSON'),
).action(async (path: string, options: CommonOptions & { output?: string }) => {
  try {
    const guard = await executeGuard(path, options);
    printDecision(guard);
    await appendGithubSummary(guard);
    if (options.output) {
      const output = resolve(options.output);
      await writeFile(output, JSON.stringify(guardJson(guard), null, 2), 'utf-8');
      console.log(chalk.gray(`\nGuard result: ${output}`));
    }
    setDecisionExitCode(guard);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : 'Compliance guard failed'));
    process.exitCode = 1;
  }
});

addCommonOptions(
  program
    .command('evidence')
    .description('Generate a tamper-evident compliance evidence package')
    .argument('[path]', 'Repository path', '.')
    .option('-o, --output <path>', 'Evidence package output', 'vlayer-evidence.json'),
).action(async (path: string, options: CommonOptions & { output: string }) => {
  try {
    const guard = await executeGuard(path, options);
    const evidence = buildEvidencePackage(guard.git.root, guard);
    const output = resolve(options.output);
    await saveEvidencePackage(output, evidence);
    printDecision(guard);
    console.log(chalk.cyan(`\nEvidence package: ${output}`));
    console.log(chalk.cyan(`SHA256: ${evidence.packageHash}`));
    setDecisionExitCode(guard);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : 'Evidence generation failed'));
    process.exitCode = 1;
  }
});

addCommonOptions(
  program
    .command('graph')
    .description('Generate the code-to-control compliance graph')
    .argument('[path]', 'Repository path', '.')
    .option('-o, --output <path>', 'Graph JSON output', 'vlayer-compliance-graph.json')
    .option('--mermaid <path>', 'Also write a Mermaid graph file'),
).action(async (path: string, options: CommonOptions & { output: string; mermaid?: string }) => {
  try {
    const guard = await executeGuard(path, options);
    const graph = buildComplianceGraph(guard.findings, guard.git.root, guard.decision, guard.git);
    const output = resolve(options.output);
    await writeFile(output, JSON.stringify(graph, null, 2), 'utf-8');
    console.log(chalk.cyan(`Compliance graph: ${output}`));
    console.log(chalk.gray(`${graph.nodes.length} nodes / ${graph.edges.length} edges`));
    if (options.mermaid) {
      const mermaidPath = resolve(options.mermaid);
      await writeFile(mermaidPath, graphToMermaid(graph), 'utf-8');
      console.log(chalk.cyan(`Mermaid graph: ${mermaidPath}`));
    }
    setDecisionExitCode(guard);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : 'Graph generation failed'));
    process.exitCode = 1;
  }
});

program
  .command('exceptions')
  .description('Review acknowledgment/exception lifecycle')
  .argument('[path]', 'Repository path', '.')
  .option('--config <path>', 'Scanner configuration file')
  .option('-f, --format <format>', 'text or json', 'text')
  .action(async (path: string, options: { config?: string; format: string }) => {
    try {
      const lifecycle = await getAcknowledgmentLifecycle(path, options.config);
      if (options.format === 'json') {
        console.log(JSON.stringify(lifecycle, null, 2));
      } else {
        console.log(chalk.bold('\nCompliance exceptions'));
        console.log(`Total: ${lifecycle.total}`);
        console.log(`Active: ${lifecycle.active.length}`);
        console.log(`Expiring in 30 days: ${lifecycle.expiringSoon.length}`);
        console.log(`Expired: ${lifecycle.expired.length}`);
        for (const acknowledgment of lifecycle.expired) {
          console.log(chalk.red(`  - ${acknowledgment.id ?? acknowledgment.pattern}: ${acknowledgment.reason}`));
        }
      }
      if (lifecycle.expired.length > 0) process.exitCode = 2;
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Exception review failed'));
      process.exitCode = 1;
    }
  });

addCommonOptions(
  program
    .command('agent')
    .description('Explain a deployment decision and generate a remediation plan')
    .argument('[path]', 'Repository path', '.')
    .option('-o, --output <path>', 'Write agent result JSON')
    .option('--markdown <path>', 'Write remediation plan as Markdown')
    .option('--apply-safe-fixes', 'Apply registered deterministic fixes, then re-evaluate'),
).action(async (
  path: string,
  options: CommonOptions & { output?: string; markdown?: string; applySafeFixes?: boolean },
) => {
  try {
    let guard = await executeGuard(path, options);
    let fixReport: { fixedCount: number; skippedCount: number } | undefined;

    if (options.applySafeFixes && !guard.decision.deployAllowed) {
      const candidates = (guard.decision.consideredScope === 'changed-files'
        ? guard.delta.newFindingsInChangedFiles
        : guard.delta.newFindings).filter(finding => finding.fixType);

      if (candidates.length > 0) {
        const report = await applyFixes(candidates, guard.git.root, guard.scannedFiles, 0);
        fixReport = { fixedCount: report.fixedCount, skippedCount: report.skippedCount };
        guard = await executeGuard(path, options);
      }
    }

    const remediation = buildRemediationPlan(guard.git.root, guard);
    printDecision(guard);
    console.log(chalk.bold('\nRemediation'));
    if (remediation.items.length === 0) {
      console.log(remediation.deployAllowed
        ? chalk.green('No blocking remediation required.')
        : chalk.yellow('Policy failed for a governance condition; review policy reasons above.'));
    } else {
      for (const item of remediation.items) {
        console.log(`\n${chalk.red(item.severity.toUpperCase())} ${item.title}`);
        console.log(chalk.gray(`${item.file}${item.line ? `:${item.line}` : ''}`));
        console.log(item.recommendation);
        if (item.autoFixAvailable) console.log(chalk.cyan('Deterministic auto-fix is registered.'));
      }
    }

    if (fixReport) {
      console.log(chalk.cyan(`\nSafe fixes applied: ${fixReport.fixedCount}; skipped: ${fixReport.skippedCount}`));
    }

    if (options.markdown) {
      await writeFile(resolve(options.markdown), remediationToMarkdown(remediation), 'utf-8');
    }
    if (options.output) {
      await writeFile(resolve(options.output), JSON.stringify({
        schemaVersion: '1.0',
        decision: guard.decision,
        remediation,
        fixReport,
      }, null, 2), 'utf-8');
    }
    setDecisionExitCode(guard);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : 'Compliance agent failed'));
    process.exitCode = 1;
  }
});

program
  .command('verify-evidence')
  .description('Verify the SHA256 integrity of a vlayer evidence package')
  .argument('<file>', 'Evidence package JSON')
  .action(async (file: string) => {
    try {
      const evidence = JSON.parse(await readFile(resolve(file), 'utf-8')) as EvidencePackage;
      const valid = verifyEvidencePackage(evidence);
      console.log(valid
        ? chalk.green.bold('Evidence package integrity verified')
        : chalk.red.bold('Evidence package integrity check FAILED'));
      if (!valid) process.exitCode = 2;
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Evidence verification failed'));
      process.exitCode = 1;
    }
  });

program.parseAsync().catch(error => {
  console.error(chalk.red(error instanceof Error ? error.message : 'vlayer-ci failed'));
  process.exitCode = 1;
});
