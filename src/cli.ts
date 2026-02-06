#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resolve } from 'path';
import { scan } from './scan.js';
import { generateReport } from './reporters/index.js';
import { applyFixes } from './fixer/index.js';
import { generateFixReport } from './reporters/fix-report.js';
import { loadAuditTrail, getAuditSummary } from './audit/index.js';
import { generateAuditReport, generateTextAuditReport } from './reporters/audit-report.js';
import { loadCustomRules, validateRulesFile } from './rules/index.js';
import type { ComplianceCategory, ReportOptions, AuditReportOptions } from './types.js';

const program = new Command();

program
  .name('vlayer')
  .description('HIPAA compliance scanner for healthcare applications')
  .version('0.2.0');

program
  .command('scan')
  .description('Scan a repository for HIPAA compliance issues')
  .argument('<path>', 'Path to the repository to scan')
  .option('-c, --categories <categories...>', 'Compliance categories to check')
  .option('-e, --exclude <patterns>', 'Glob patterns to exclude (comma-separated or space-separated)')
  .option('-o, --output <path>', 'Output file path for the report')
  .option('-f, --format <format>', 'Report format: json, html, markdown', 'json')
  .option('--config <path>', 'Path to configuration file')
  .option('--rules <path>', 'Path to custom rules YAML file')
  .option('--baseline <path>', 'Path to baseline file for comparison')
  .option('--min-confidence <level>', 'Minimum confidence level (high, medium, low)', 'low')
  .option('--fix', 'Automatically fix detected issues where possible')
  .action(async (path: string, options) => {
    const spinner = ora('Scanning repository...').start();
    const absolutePath = resolve(path);

    try {
      const categories = options.categories as ComplianceCategory[] | undefined;

      // Parse exclude patterns - support both comma-separated and array format
      let excludePatterns: string[] | undefined;
      if (options.exclude) {
        let patterns: string[];
        if (typeof options.exclude === 'string') {
          // Split by comma and trim whitespace
          patterns = options.exclude.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
        } else if (Array.isArray(options.exclude)) {
          patterns = options.exclude;
        } else {
          patterns = [];
        }

        // Convert simple patterns to glob patterns
        excludePatterns = patterns.map((p: string) => {
          // If already a glob pattern (contains * or **), use as-is
          if (p.includes('*') || p.includes('**')) {
            return p.startsWith('**/') ? p : `**/${p}`;
          }
          // Otherwise, convert simple directory/file names to glob patterns
          return `**/${p}/**`;
        });
      }

      const result = await scan({
        path,
        categories,
        exclude: excludePatterns,
        configFile: options.config,
        baselineFile: options.baseline,
        minConfidence: options.minConfidence as 'high' | 'medium' | 'low' | undefined,
      });

      spinner.succeed(`Scan complete. Found ${result.findings.length} issues.`);

      // Apply fixes if --fix flag is provided
      if (options.fix) {
        const fixSpinner = ora('Applying automatic fixes...').start();
        const fixReport = await applyFixes(
          result.findings,
          absolutePath,
          result.scannedFiles,
          result.scanDuration
        );
        fixSpinner.succeed(`Applied ${fixReport.fixedCount} automatic fixes.`);
        console.log(generateFixReport(fixReport));

        // Show audit trail info
        console.log(chalk.cyan('\nAudit Trail saved to: ') + chalk.white(`${absolutePath}/.vlayer/audit-trail.json`));
        console.log(chalk.cyan('Evidence hash: ') + chalk.white(fixReport.auditTrail.reportHash || 'N/A'));
        console.log(chalk.cyan('Manual reviews pending: ') + chalk.yellow(fixReport.auditTrail.manualReviewCount.toString()));

        if (fixReport.auditTrail.manualReviewCount > 0) {
          console.log(chalk.yellow('\nRun `vlayer audit <path> --generate-report` to generate PDF audit report.'));
        }
      }

      const reportOptions: ReportOptions = {
        format: options.format,
        outputPath: options.output,
      };

      await generateReport(result, path, reportOptions);

      // Print summary
      const acknowledged = result.findings.filter(f => f.acknowledged && !f.acknowledgment?.expired).length;
      const suppressed = result.findings.filter(f => f.suppressed).length;
      const baseline = result.findings.filter(f => f.isBaseline).length;
      const newFindings = result.findings.filter(f =>
        !f.acknowledged && !f.suppressed && !f.isBaseline
      );
      const critical = newFindings.filter(f => f.severity === 'critical').length;
      const high = newFindings.filter(f => f.severity === 'high').length;

      console.log('\n' + chalk.bold('Summary:'));
      console.log(`  Files scanned: ${result.scannedFiles}`);
      console.log(`  Duration: ${result.scanDuration}ms`);
      console.log(`  Total findings: ${result.findings.length}`);

      if (acknowledged > 0) {
        console.log(chalk.blue(`  Acknowledged: ${acknowledged}`));
      }
      if (suppressed > 0) {
        console.log(chalk.cyan(`  Suppressed: ${suppressed}`));
      }
      if (baseline > 0) {
        console.log(chalk.gray(`  Baseline: ${baseline}`));
      }
      if (newFindings.length > 0) {
        console.log(chalk.yellow(`  New/Requiring action: ${newFindings.length}`));
      }

      if (critical > 0) {
        console.log(chalk.red(`  Critical (new): ${critical}`));
      }
      if (high > 0) {
        console.log(chalk.yellow(`  High (new): ${high}`));
      }

      // Exit with error code if new critical issues found (only if not fixing)
      if (critical > 0 && !options.fix) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('baseline')
  .description('Generate a baseline file from current scan results')
  .argument('[path]', 'Path to the repository to scan', '.')
  .option('-o, --output <path>', 'Output path for baseline file', '.vlayer-baseline.json')
  .option('-c, --categories <categories...>', 'Compliance categories to check')
  .option('-e, --exclude <patterns>', 'Glob patterns to exclude')
  .option('--config <path>', 'Path to configuration file')
  .action(async (path: string, options) => {
    const spinner = ora('Generating baseline...').start();
    const absolutePath = resolve(path);

    try {
      const categories = options.categories as ComplianceCategory[] | undefined;

      // Parse exclude patterns
      let excludePatterns: string[] | undefined;
      if (options.exclude) {
        let patterns: string[];
        if (typeof options.exclude === 'string') {
          patterns = options.exclude.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
        } else if (Array.isArray(options.exclude)) {
          patterns = options.exclude;
        } else {
          patterns = [];
        }

        excludePatterns = patterns.map((p: string) => {
          if (p.includes('*') || p.includes('**')) {
            return p.startsWith('**/') ? p : `**/${p}`;
          }
          return `**/${p}/**`;
        });
      }

      const result = await scan({
        path,
        categories,
        exclude: excludePatterns,
        configFile: options.config,
      });

      const { saveBaseline } = await import('./baseline.js');
      const outputPath = resolve(options.output);
      await saveBaseline(outputPath, result.findings);

      spinner.succeed(`Baseline generated with ${result.findings.length} findings`);
      console.log(chalk.green(`\nBaseline saved to: ${outputPath}`));
      console.log(chalk.gray('Use --baseline flag with scan command to compare against this baseline.'));
    } catch (error) {
      spinner.fail('Baseline generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('audit')
  .description('Manage audit trail and generate compliance reports')
  .argument('<path>', 'Path to the project with audit trail')
  .option('--generate-report', 'Generate PDF audit report')
  .option('-o, --output <path>', 'Output path for the PDF report')
  .option('--org <name>', 'Organization name for the report')
  .option('--auditor <name>', 'Auditor name for the report')
  .option('--text', 'Generate text report instead of PDF')
  .option('--summary', 'Show audit trail summary only')
  .action(async (path: string, options) => {
    const absolutePath = resolve(path);

    try {
      const trail = await loadAuditTrail(absolutePath);

      if (!trail) {
        console.log(chalk.red('No audit trail found.'));
        console.log(chalk.yellow('Run `vlayer scan <path> --fix` to generate an audit trail.'));
        process.exit(1);
      }

      // Show summary
      const summary = getAuditSummary(trail);

      console.log(chalk.bold('\n=== Audit Trail Summary ===\n'));
      console.log(`Project: ${chalk.cyan(trail.projectName)}`);
      console.log(`Scan Date: ${chalk.white(new Date(trail.createdAt).toLocaleString())}`);
      console.log(`Report ID: ${chalk.gray(trail.id)}`);
      console.log('');
      console.log(`Total Findings: ${chalk.white(summary.totalFindings)}`);
      console.log(`Auto-Fixed: ${chalk.green(summary.autoFixed)}`);
      console.log(`Pending Manual Review: ${chalk.yellow(summary.pendingManualReview)}`);

      if (summary.overdueCount > 0) {
        console.log(`Overdue Items: ${chalk.red(summary.overdueCount)}`);
      }

      console.log('');
      console.log(`Report Hash: ${chalk.gray(summary.reportHash || 'N/A')}`);

      // Show review status breakdown
      if (Object.keys(summary.reviewsByStatus).length > 0) {
        console.log('\n' + chalk.bold('Reviews by Status:'));
        for (const [status, count] of Object.entries(summary.reviewsByStatus)) {
          const statusLabel = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          console.log(`  ${statusLabel}: ${count}`);
        }
      }

      // Show severity breakdown
      if (Object.keys(summary.reviewsBySeverity).length > 0) {
        console.log('\n' + chalk.bold('Pending Reviews by Severity:'));
        const severityColors: Record<string, typeof chalk.red> = {
          critical: chalk.red,
          high: chalk.yellow,
          medium: chalk.hex('#ca8a04'),
          low: chalk.green,
          info: chalk.blue,
        };
        for (const [severity, count] of Object.entries(summary.reviewsBySeverity)) {
          const color = severityColors[severity] || chalk.white;
          console.log(`  ${color(severity.charAt(0).toUpperCase() + severity.slice(1))}: ${count}`);
        }
      }

      if (options.summary) {
        return;
      }

      // Generate report if requested
      if (options.generateReport) {
        const outputPath = options.output || `${absolutePath}/vlayer-audit-report.pdf`;

        const reportOptions: AuditReportOptions = {
          outputPath,
          organizationName: options.org,
          auditorName: options.auditor,
          includeEvidence: true,
          includeManualReviews: true,
        };

        if (options.text) {
          // Generate text report
          const textReport = generateTextAuditReport(trail);
          const textPath = outputPath.replace('.pdf', '.txt');
          const { writeFile } = await import('fs/promises');
          await writeFile(textPath, textReport);
          console.log(chalk.green(`\nText audit report generated: ${textPath}`));
        } else {
          // Generate PDF report
          const spinner = ora('Generating PDF audit report...').start();

          try {
            const { path: pdfPath, hash } = await generateAuditReport(trail, reportOptions);
            spinner.succeed('PDF audit report generated.');

            console.log(chalk.green(`\nAudit report saved to: ${pdfPath}`));
            console.log(chalk.cyan(`Report verification hash: ${hash}`));
            console.log(chalk.gray('\nThis hash can be used to verify the report integrity.'));
          } catch (err) {
            spinner.fail('Failed to generate PDF report');
            console.error(chalk.red(err instanceof Error ? err.message : 'Unknown error'));

            // Fallback to text
            console.log(chalk.yellow('\nFalling back to text report...'));
            const textReport = generateTextAuditReport(trail);
            const textPath = outputPath.replace('.pdf', '.txt');
            const { writeFile } = await import('fs/promises');
            await writeFile(textPath, textReport);
            console.log(chalk.green(`Text audit report generated: ${textPath}`));
          }
        }
      } else {
        console.log(chalk.yellow('\nUse --generate-report to create a PDF audit report.'));
      }

    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a vlayer configuration file')
  .action(() => {
    console.log(chalk.yellow('Configuration initialization not yet implemented'));
  });

// Rules subcommands
const rulesCommand = program
  .command('rules')
  .description('Manage custom compliance rules');

rulesCommand
  .command('list')
  .description('List all loaded custom rules')
  .argument('[path]', 'Path to the project', '.')
  .option('--rules <path>', 'Path to custom rules YAML file')
  .action(async (path: string, options) => {
    const absolutePath = resolve(path);

    try {
      const { rules, errors } = await loadCustomRules(absolutePath, options.rules);

      if (errors.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        for (const error of errors) {
          console.log(chalk.yellow(`  - ${error.error}`));
          if (error.details) {
            console.log(chalk.gray(`    ${error.details}`));
          }
        }
      }

      if (rules.length === 0) {
        console.log(chalk.yellow('\nNo custom rules found.'));
        console.log(chalk.gray('Create a vlayer-rules.yaml file or add rules to .vlayer/rules/'));
        return;
      }

      console.log(chalk.bold(`\nLoaded ${rules.length} custom rule(s):\n`));

      const severityColors: Record<string, typeof chalk.red> = {
        critical: chalk.red,
        high: chalk.yellow,
        medium: chalk.hex('#ca8a04'),
        low: chalk.green,
        info: chalk.blue,
      };

      for (const rule of rules) {
        const color = severityColors[rule.severity] || chalk.white;
        console.log(`  ${chalk.cyan(rule.id)}`);
        console.log(`    Name: ${rule.name}`);
        console.log(`    Category: ${rule.category}`);
        console.log(`    Severity: ${color(rule.severity)}`);
        console.log(`    Pattern: ${chalk.gray(rule.pattern)}`);
        if (rule.include) {
          console.log(`    Include: ${chalk.gray(rule.include.join(', '))}`);
        }
        if (rule.exclude) {
          console.log(`    Exclude: ${chalk.gray(rule.exclude.join(', '))}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

rulesCommand
  .command('validate')
  .description('Validate a custom rules YAML file')
  .argument('<file>', 'Path to the rules YAML file')
  .action(async (file: string) => {
    const absolutePath = resolve(file);
    const spinner = ora('Validating rules file...').start();

    try {
      const result = await validateRulesFile(absolutePath);

      if (result.valid) {
        spinner.succeed(`Valid! Found ${result.rules} rule(s).`);
      } else {
        spinner.fail('Validation failed');
        console.log(chalk.red('\nErrors:'));
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error.error}`));
          if (error.details) {
            console.log(chalk.gray(`    ${error.details}`));
          }
        }
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Validation failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program.parse();
