#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scan } from './scan.js';
import { generateReport } from './reporters/index.js';
import type { ComplianceCategory, ReportOptions } from './types.js';

const program = new Command();

program
  .name('vlayer')
  .description('HIPAA compliance scanner for healthcare applications')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan a repository for HIPAA compliance issues')
  .argument('<path>', 'Path to the repository to scan')
  .option('-c, --categories <categories...>', 'Compliance categories to check')
  .option('-e, --exclude <patterns...>', 'Glob patterns to exclude')
  .option('-o, --output <path>', 'Output file path for the report')
  .option('-f, --format <format>', 'Report format: json, html, markdown', 'json')
  .option('--config <path>', 'Path to configuration file')
  .action(async (path: string, options) => {
    const spinner = ora('Scanning repository...').start();

    try {
      const categories = options.categories as ComplianceCategory[] | undefined;

      const result = await scan({
        path,
        categories,
        exclude: options.exclude,
        configFile: options.config,
      });

      spinner.succeed(`Scan complete. Found ${result.findings.length} issues.`);

      const reportOptions: ReportOptions = {
        format: options.format,
        outputPath: options.output,
      };

      await generateReport(result, path, reportOptions);

      // Print summary
      const critical = result.findings.filter(f => f.severity === 'critical').length;
      const high = result.findings.filter(f => f.severity === 'high').length;

      console.log('\n' + chalk.bold('Summary:'));
      console.log(`  Files scanned: ${result.scannedFiles}`);
      console.log(`  Duration: ${result.scanDuration}ms`);
      console.log(`  Total findings: ${result.findings.length}`);

      if (critical > 0) {
        console.log(chalk.red(`  Critical: ${critical}`));
      }
      if (high > 0) {
        console.log(chalk.yellow(`  High: ${high}`));
      }

      // Exit with error code if critical issues found
      if (critical > 0) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Scan failed');
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

program.parse();
