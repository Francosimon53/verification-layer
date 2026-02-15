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
import { formatScore, getScoreColor } from './compliance-score.js';
import { generateAuditorReport } from './reporters/auditor-report.js';
import { writeFile } from 'fs/promises';
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
  .option('--no-ai', 'Disable AI-powered triage and analysis')
  .option('--audit', 'Run npm audit and include dependency vulnerabilities in report')
  .option('--verbose', 'Show all individual findings instead of grouped summary')
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

      spinner.succeed(`Scan complete. Found ${result.groupedFindings.length} unique issues (${result.rawFindingsCount} total occurrences).`);

      // Run npm audit if --audit flag is provided
      let vulnerabilities: import('./types.js').DependencyVulnerability[] | undefined;
      if (options.audit) {
        const auditSpinner = ora('Running npm audit...').start();
        const { runNpmAudit } = await import('./utils/npm-audit.js');
        const auditResult = await runNpmAudit(absolutePath);

        if (auditResult.error) {
          auditSpinner.warn(`npm audit: ${auditResult.error}`);
        } else {
          const vulnCount = auditResult.vulnerabilities.length;
          auditSpinner.succeed(`npm audit complete. Found ${vulnCount} vulnerabilities.`);
          vulnerabilities = auditResult.vulnerabilities;
        }
      }

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

      // Get previous scan history and create comparison
      const { getMostRecentScan, compareScan, saveScanHistory } = await import('./utils/scan-history.js');
      const previousScan = await getMostRecentScan(absolutePath);
      const comparison = result.complianceScore
        ? compareScan(result.complianceScore.score, result.findings, previousScan)
        : null;

      const reportOptions: ReportOptions = {
        format: options.format,
        outputPath: options.output,
        vulnerabilities,
        scanComparison: comparison,
      };

      await generateReport(result, path, reportOptions);

      // Save current scan to history
      if (result.complianceScore) {
        await saveScanHistory(
          absolutePath,
          result.complianceScore.score,
          result.findings,
          result.scannedFiles
        );
      }

      // Print summary
      const totalFiles = new Set(result.findings.map(f => f.file)).size;
      const grouped = result.groupedFindings;

      console.log('\n' + chalk.bold(`Found ${chalk.white(String(grouped.length))} types of HIPAA violations across ${chalk.white(String(result.rawFindingsCount))} locations in ${chalk.white(String(totalFiles))} files`));
      console.log(`  Files scanned: ${result.scannedFiles}  |  Duration: ${result.scanDuration}ms\n`);

      if (options.verbose) {
        // --verbose: show every individual finding
        for (const f of result.findings) {
          const sevColor = f.severity === 'critical' ? chalk.red : f.severity === 'high' ? chalk.yellow : chalk.gray;
          console.log(`  ${sevColor(f.severity.toUpperCase().padEnd(8))} ${f.file}:${f.line ?? 0}  ${f.title}`);
        }
      } else {
        // Default: grouped table
        const sevColors: Record<string, (s: string) => string> = {
          critical: chalk.red, high: chalk.yellow, medium: chalk.hex('#ca8a04'), low: chalk.blue, info: chalk.gray,
        };
        console.log(chalk.gray('  Severity   Violation Type                                    Count   Files   HIPAA §'));
        console.log(chalk.gray('  ' + '─'.repeat(95)));
        for (const g of grouped) {
          const sev = (sevColors[g.severity] ?? chalk.gray)(g.severity.toUpperCase().padEnd(9));
          const title = g.title.length > 50 ? g.title.slice(0, 47) + '...' : g.title.padEnd(50);
          const count = String(g.occurrenceCount).padStart(5);
          const files = String(g.fileCount).padStart(5);
          const ref = (g.hipaaReference ?? '').slice(0, 15);
          console.log(`  ${sev} ${title} ${count}   ${files}   ${ref}`);
        }
        console.log(chalk.gray('  ' + '─'.repeat(95)));
        if (grouped.length > 0) {
          console.log(chalk.gray(`\n  Use --verbose to see all ${result.rawFindingsCount} individual locations`));
        }
      }

      const acknowledged = result.findings.filter(f => f.acknowledged && !f.acknowledgment?.expired).length;
      const suppressed = result.findings.filter(f => f.suppressed).length;

      if (acknowledged > 0) {
        console.log(chalk.blue(`  Acknowledged: ${acknowledged}`));
      }
      if (suppressed > 0) {
        console.log(chalk.cyan(`  Suppressed: ${suppressed}`));
      }

      // Display vulnerability summary if audit was run
      if (vulnerabilities && vulnerabilities.length > 0) {
        const vulnCounts = {
          critical: vulnerabilities.filter(v => v.severity === 'critical').length,
          high: vulnerabilities.filter(v => v.severity === 'high').length,
          moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
          low: vulnerabilities.filter(v => v.severity === 'low').length,
        };

        console.log('\n' + chalk.bold('Dependency Vulnerabilities:'));
        console.log(`  Total: ${vulnerabilities.length}`);
        if (vulnCounts.critical > 0) {
          console.log(chalk.red(`  Critical: ${vulnCounts.critical}`));
        }
        if (vulnCounts.high > 0) {
          console.log(chalk.yellow(`  High: ${vulnCounts.high}`));
        }
        if (vulnCounts.moderate > 0) {
          console.log(chalk.hex('#ca8a04')(`  Moderate: ${vulnCounts.moderate}`));
        }
        if (vulnCounts.low > 0) {
          console.log(chalk.blue(`  Low: ${vulnCounts.low}`));
        }
      }

      // Exit with error code if new critical issues found (only if not fixing)
      const criticalCount = result.groupedFindings.filter(g => g.severity === 'critical').length;
      if (criticalCount > 0 && !options.fix) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('ai-scan')
  .description('Run AI-powered HIPAA compliance scan (requires API key)')
  .argument('<path>', 'Path to the repository to scan')
  .option('-e, --exclude <patterns>', 'Glob patterns to exclude (comma-separated)')
  .option('-o, --output <path>', 'Output file path for the report')
  .option('-f, --format <format>', 'Report format: json, html, markdown', 'json')
  .option('--budget <cents>', 'AI budget in cents (default: 50)', '50')
  .option('--rules-only', 'Run LLM rules only (skip triage)')
  .action(async (path: string, options) => {
    const spinner = ora('Running AI-powered scan...').start();
    const absolutePath = resolve(path);

    try {
      const { runAIScan } = await import('./ai/scanner.js');
      const { isAIAvailable } = await import('./ai/client.js');

      if (!isAIAvailable()) {
        spinner.fail('AI scanning requires an API key');
        console.error(chalk.red('\nSet ANTHROPIC_API_KEY or VLAYER_AI_KEY environment variable.'));
        console.error(chalk.gray('Get your API key at: https://console.anthropic.com/'));
        process.exit(1);
      }

      // Get all files to scan
      let excludePatterns: string[] | undefined;
      if (options.exclude) {
        const patterns = typeof options.exclude === 'string'
          ? options.exclude.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
          : options.exclude;

        excludePatterns = patterns.map((p: string) => {
          if (p.includes('*') || p.includes('**')) {
            return p.startsWith('**/') ? p : `**/${p}`;
          }
          return `**/${p}/**`;
        });
      }

      const { glob } = await import('glob');
      const defaultExclude = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
      ];

      const files = await glob('**/*', {
        cwd: absolutePath,
        nodir: true,
        ignore: [...defaultExclude, ...(excludePatterns || [])],
        absolute: false,
      });

      // Filter to source code files only
      const sourceFiles = files.filter(f =>
        /\.(js|jsx|ts|tsx|py|java|rb|php|go|rs|cs|swift|kt)$/.test(f)
      );

      if (sourceFiles.length === 0) {
        spinner.warn('No source files found to scan');
        return;
      }

      const result = await runAIScan(absolutePath, {
        enableLLMRules: true,
        enableTriage: !options.rulesOnly,
        budgetCents: parseInt(options.budget),
        targetFiles: sourceFiles.slice(0, 20), // Limit to 20 files for cost control
      });

      spinner.succeed(`AI scan complete: ${result.aiFindings.length} findings, ${result.stats.costCents}¢`);

      // Generate report
      const { generateReport } = await import('./reporters/index.js');
      const { groupFindings } = await import('./scan.js');
      const aiGrouped = groupFindings(result.aiFindings);
      const scanResult = {
        findings: result.aiFindings,
        groupedFindings: aiGrouped,
        rawFindingsCount: result.aiFindings.length,
        scannedFiles: result.stats.filesScanned,
        scanDuration: 0,
      };

      await generateReport(scanResult, path, {
        format: options.format,
        outputPath: options.output,
      });

      // Print summary
      console.log('\n' + chalk.bold('AI Scan Summary:'));
      console.log(`  Files scanned: ${result.stats.filesScanned}`);
      console.log(`  AI findings: ${result.aiFindings.length}`);
      console.log(`  AI calls made: ${result.stats.aiCallsMade}`);
      console.log(`  Cost: ${chalk.cyan(result.stats.costCents + '¢')}`);

      const critical = result.aiFindings.filter(f => f.severity === 'critical').length;
      const high = result.aiFindings.filter(f => f.severity === 'high').length;

      if (critical > 0) {
        console.log(chalk.red(`  Critical: ${critical}`));
      }
      if (high > 0) {
        console.log(chalk.yellow(`  High: ${high}`));
      }

      if (critical > 0) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('AI scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('skill-scan')
  .description('Scan AI Agent Skills (SKILL.md) for HIPAA violations')
  .argument('<path>', 'Path to skill file or directory')
  .option('-f, --format <format>', 'Report format: json, html, markdown', 'json')
  .option('-o, --output <path>', 'Output file path for the report')
  .action(async (path: string, options) => {
    const spinner = ora('Scanning AI Agent Skill(s)...').start();
    const absolutePath = resolve(path);

    try {
      const { skillsScanner } = await import('./scanners/skills/index.js');
      const { glob } = await import('glob');
      const { stat } = await import('fs/promises');

      // Check if path is file or directory
      const stats = await stat(absolutePath);
      let skillFiles: string[] = [];

      if (stats.isDirectory()) {
        // Scan directory for SKILL.md files
        skillFiles = await glob('**/*{SKILL,skill,Skill}.md', {
          cwd: absolutePath,
          nodir: true,
          absolute: true,
        });
      } else {
        // Single file
        skillFiles = [absolutePath];
      }

      if (skillFiles.length === 0) {
        spinner.warn('No SKILL.md files found');
        console.log(chalk.yellow('\nLooking for files named: SKILL.md, skill.md, *.skill.md'));
        return;
      }

      spinner.text = `Scanning ${skillFiles.length} skill file(s)...`;

      const findings = await skillsScanner.scan(skillFiles, { path: absolutePath });

      spinner.succeed(`Scan complete. Found ${findings.length} issue(s) in ${skillFiles.length} skill(s).`);

      // Generate report
      const { generateReport } = await import('./reporters/index.js');
      const { groupFindings: groupSkillFindings } = await import('./scan.js');
      const skillGrouped = groupSkillFindings(findings);
      const result = {
        findings,
        groupedFindings: skillGrouped,
        rawFindingsCount: findings.length,
        scannedFiles: skillFiles.length,
        scanDuration: 0,
      };

      await generateReport(result, path, {
        format: options.format,
        outputPath: options.output,
      });

      // Print summary
      const critical = findings.filter(f => f.severity === 'critical').length;
      const high = findings.filter(f => f.severity === 'high').length;
      const medium = findings.filter(f => f.severity === 'medium').length;

      console.log('\n' + chalk.bold('AI Agent Skills Security Summary:'));
      console.log(`  Skills scanned: ${skillFiles.length}`);
      console.log(`  Total findings: ${findings.length}`);

      if (critical > 0) {
        console.log(chalk.red.bold(`  🚨 Critical: ${critical}`));
      }
      if (high > 0) {
        console.log(chalk.red(`  ⚠️  High: ${high}`));
      }
      if (medium > 0) {
        console.log(chalk.yellow(`  ⚡ Medium: ${medium}`));
      }

      // Show category breakdown
      const byCategory: Record<string, number> = {};
      for (const f of findings) {
        const cat = f.id.split('-')[1] || 'other';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      }

      if (Object.keys(byCategory).length > 0) {
        console.log('\n' + chalk.bold('Issues by Type:'));
        if (byCategory.phi) console.log(chalk.red(`  PHI Exposure: ${byCategory.phi}`));
        if (byCategory.api) console.log(chalk.red(`  Credential Leaks: ${byCategory.api}`));
        if (byCategory.data) console.log(chalk.red(`  Data Exfiltration: ${byCategory.data}`));
        if (byCategory.http) console.log(chalk.yellow(`  HIPAA Violations: ${byCategory.http}`));
      }

      console.log('');

      // Security recommendation
      if (critical > 0 || high > 0) {
        console.log(chalk.red.bold('❌ DO NOT INSTALL THIS SKILL'));
        console.log(chalk.red('   Critical or high-severity security issues detected.'));
        console.log(chalk.gray('   Installing this skill could compromise PHI and violate HIPAA.\n'));
        process.exit(1);
      } else if (medium > 0) {
        console.log(chalk.yellow.bold('⚠️  REVIEW REQUIRED'));
        console.log(chalk.yellow('   Medium-severity issues found. Review before installing.\n'));
      } else {
        console.log(chalk.green.bold('✅ SKILL APPEARS SAFE'));
        console.log(chalk.green('   No critical HIPAA violations detected.\n'));
      }
    } catch (error) {
      spinner.fail('Skill scan failed');
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
  .command('watch')
  .description('Watch for file changes and scan automatically')
  .argument('<path>', 'Path to watch')
  .option('-c, --categories <categories...>', 'Compliance categories to check')
  .option('-e, --exclude <patterns>', 'Glob patterns to exclude (comma-separated)')
  .option('--config <path>', 'Path to configuration file')
  .option('--min-confidence <level>', 'Minimum confidence level (low, medium, high)', 'low')
  .action(async (path: string, options) => {
    const { watch: watchScan } = await import('chokidar');
    const absolutePath = resolve(path);

    console.log(chalk.bold.cyan('\n🔍 VLayer Watch Mode\n'));
    console.log(chalk.gray(`Watching: ${absolutePath}`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    let isScanning = false;
    let previousFindings = new Map<string, number>();
    let scanCount = 0;

    async function performScan(changedFile?: string) {
      if (isScanning) return;
      isScanning = true;
      scanCount++;

      const scanId = scanCount;
      const timestamp = new Date().toLocaleTimeString();

      try {
        if (changedFile) {
          console.log(chalk.dim(`[${timestamp}] File changed: ${changedFile}`));
        }

        const categories = options.categories as ComplianceCategory[] | undefined;
        let excludePatterns: string[] | undefined;

        if (options.exclude) {
          const patterns = typeof options.exclude === 'string'
            ? options.exclude.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
            : options.exclude;

          excludePatterns = patterns.map((p: string) => {
            if (p.includes('*') || p.includes('**')) {
              return p.startsWith('**/') ? p : `**/${p}`;
            }
            return `**/${p}/**`;
          });
        }

        const result = await scan({
          path: absolutePath,
          categories,
          exclude: excludePatterns,
          configFile: options.config,
          minConfidence: options.minConfidence as any,
        });

        // Filter active findings (not baseline, not suppressed, not acknowledged)
        const activeFindings = result.findings.filter(
          f => !f.isBaseline && !f.suppressed && !f.acknowledged
        );

        // Group by severity
        const bySeverity = {
          critical: activeFindings.filter(f => f.severity === 'critical').length,
          high: activeFindings.filter(f => f.severity === 'high').length,
          medium: activeFindings.filter(f => f.severity === 'medium').length,
          low: activeFindings.filter(f => f.severity === 'low').length,
        };

        // Check for new critical/high findings
        const currentFindings = new Map<string, number>();
        for (const finding of activeFindings) {
          const key = `${finding.file}:${finding.line}:${finding.id}`;
          currentFindings.set(key, finding.severity === 'critical' ? 2 : finding.severity === 'high' ? 1 : 0);
        }

        const newCriticalOrHigh: string[] = [];
        for (const [key, severity] of currentFindings.entries()) {
          if (severity >= 1 && !previousFindings.has(key)) {
            newCriticalOrHigh.push(key);
          }
        }

        previousFindings = currentFindings;

        // Display results
        console.log(chalk.dim(`\n[${timestamp}] Scan #${scanId} complete`));

        if (activeFindings.length === 0) {
          console.log(chalk.green.bold('✓ No compliance issues found!'));
        } else {
          console.log(chalk.yellow(`Found ${activeFindings.length} issue(s):`));

          if (bySeverity.critical > 0) {
            console.log(chalk.red.bold(`  ● ${bySeverity.critical} Critical`));
          }
          if (bySeverity.high > 0) {
            console.log(chalk.red(`  ● ${bySeverity.high} High`));
          }
          if (bySeverity.medium > 0) {
            console.log(chalk.yellow(`  ● ${bySeverity.medium} Medium`));
          }
          if (bySeverity.low > 0) {
            console.log(chalk.blue(`  ● ${bySeverity.low} Low`));
          }

          // Show new critical/high findings
          if (newCriticalOrHigh.length > 0) {
            console.log(chalk.red.bold(`\n⚠️  ${newCriticalOrHigh.length} new critical/high finding(s) detected!`));

            for (const key of newCriticalOrHigh.slice(0, 3)) {
              const [file, line] = key.split(':');
              const finding = activeFindings.find(f =>
                f.file === file && f.line === parseInt(line)
              );

              if (finding) {
                console.log(chalk.red(`   ${finding.title}`));
                console.log(chalk.gray(`   ${file}:${line}`));
              }
            }

            if (newCriticalOrHigh.length > 3) {
              console.log(chalk.gray(`   ... and ${newCriticalOrHigh.length - 3} more`));
            }
          }
        }

        console.log(chalk.dim('\nWatching for changes...\n'));

      } catch (error) {
        console.error(chalk.red(`[${timestamp}] Scan failed:`), error instanceof Error ? error.message : error);
      } finally {
        isScanning = false;
      }
    }

    // Initial scan
    await performScan();

    // Watch for changes
    const defaultExclude = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
    ];

    const excludePatterns = options.exclude
      ? [...defaultExclude, ...(typeof options.exclude === 'string' ? options.exclude.split(',') : options.exclude)]
      : defaultExclude;

    const watcher = watchScan(absolutePath, {
      ignored: excludePatterns,
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('change', (filePath) => {
      performScan(filePath);
    });

    watcher.on('add', (filePath) => {
      performScan(filePath);
    });

    // Handle exit
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nStopping watch mode...'));
      watcher.close();
      process.exit(0);
    });
  });

program
  .command('score')
  .description('Calculate HIPAA compliance score for a repository')
  .argument('<path>', 'Path to the repository')
  .option('-c, --categories <categories...>', 'Compliance categories to check')
  .option('-e, --exclude <patterns>', 'Glob patterns to exclude (comma-separated)')
  .option('--config <path>', 'Path to configuration file')
  .option('--baseline <path>', 'Path to baseline file')
  .option('-f, --format <format>', 'Output format: text, json', 'text')
  .action(async (path: string, options) => {
    const spinner = ora('Calculating compliance score...').start();

    try {
      const categories = options.categories as ComplianceCategory[] | undefined;
      let excludePatterns: string[] | undefined;

      if (options.exclude) {
        const patterns = typeof options.exclude === 'string'
          ? options.exclude.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
          : options.exclude;

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
        baselineFile: options.baseline,
      });

      spinner.stop();

      if (!result.complianceScore) {
        console.error(chalk.red('Failed to calculate compliance score'));
        process.exit(1);
      }

      const score = result.complianceScore;

      if (options.format === 'json') {
        console.log(JSON.stringify(score, null, 2));
      } else {
        // Text format (default)
        const scoreColor = getScoreColor(score.score);
        const colorFn = scoreColor === 'green' ? chalk.green : scoreColor === 'yellow' ? chalk.yellow : chalk.red;

        console.log(chalk.bold('\n📊 HIPAA Compliance Score\n'));
        console.log(colorFn.bold(`Score: ${score.score}/100 (Grade ${score.grade})`));
        console.log(colorFn(`Status: ${score.status.toUpperCase()}\n`));

        console.log(chalk.bold('Findings Breakdown:'));
        console.log(`  ${chalk.red('Critical:')} ${score.breakdown.critical}`);
        console.log(`  ${chalk.red('High:')} ${score.breakdown.high}`);
        console.log(`  ${chalk.yellow('Medium:')} ${score.breakdown.medium}`);
        console.log(`  ${chalk.blue('Low:')} ${score.breakdown.low}`);
        console.log(`  ${chalk.white('Total Active:')} ${score.breakdown.total}`);

        if (score.breakdown.acknowledged > 0) {
          console.log(`  ${chalk.gray('Acknowledged:')} ${score.breakdown.acknowledged}`);
        }

        console.log(chalk.bold('\nPenalty Points:'));
        console.log(`  Critical: ${chalk.red(`-${score.penalties.critical}`)}`);
        console.log(`  High: ${chalk.red(`-${score.penalties.high}`)}`);
        console.log(`  Medium: ${chalk.yellow(`-${score.penalties.medium}`)}`);
        console.log(`  Low: ${chalk.blue(`-${score.penalties.low}`)}`);
        console.log(`  ${chalk.bold('Total:')} ${chalk.red(`-${score.penalties.total}`)}`);

        if (score.recommendations.length > 0) {
          console.log(chalk.bold('\n💡 Recommendations:'));
          for (const rec of score.recommendations) {
            console.log(`  • ${rec}`);
          }
        }

        console.log('');
      }

      // Exit with error code if score is below 60
      if (score.score < 60) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Score calculation failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate auditor-ready compliance report with SHA256 hash')
  .argument('<path>', 'Path to the repository')
  .option('-o, --output <path>', 'Output file path for the report', 'vlayer-audit-report.html')
  .option('--org <name>', 'Organization name for the report')
  .option('--period <period>', 'Report period (e.g., "January 2024")')
  .option('--auditor <name>', 'Auditor name')
  .option('-c, --categories <categories...>', 'Compliance categories to check')
  .option('-e, --exclude <patterns>', 'Glob patterns to exclude (comma-separated)')
  .option('--config <path>', 'Path to configuration file')
  .option('--baseline <path>', 'Path to baseline file')
  .option('--include-baseline', 'Include baseline comparison in report')
  .action(async (path: string, options) => {
    const spinner = ora('Generating auditor report...').start();

    try {
      const categories = options.categories as ComplianceCategory[] | undefined;
      let excludePatterns: string[] | undefined;

      if (options.exclude) {
        const patterns = typeof options.exclude === 'string'
          ? options.exclude.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
          : options.exclude;

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
        baselineFile: options.baseline,
      });

      if (!result.complianceScore) {
        spinner.fail('Failed to calculate compliance score');
        process.exit(1);
      }

      const { html, hash } = generateAuditorReport(result, path, {
        organizationName: options.org,
        reportPeriod: options.period,
        auditorName: options.auditor,
        includeBaseline: options.includeBaseline,
      });

      await writeFile(options.output, html, 'utf-8');

      spinner.succeed(`Auditor report generated: ${options.output}`);

      console.log(chalk.bold('\n📄 Report Details:\n'));
      console.log(`${chalk.cyan('Location:')} ${options.output}`);
      console.log(`${chalk.cyan('SHA256 Hash:')} ${chalk.gray(hash)}`);
      console.log(`${chalk.cyan('Compliance Score:')} ${formatScore(result.complianceScore)}`);
      console.log(`${chalk.cyan('Total Findings:')} ${result.complianceScore.breakdown.total}`);
      console.log(`${chalk.cyan('Files Scanned:')} ${result.scannedFiles}`);

      console.log(chalk.gray('\n💡 This report is ready for audit review and includes:'));
      console.log(chalk.gray('   • Compliance score with visual gauge'));
      console.log(chalk.gray('   • Executive summary with key metrics'));
      console.log(chalk.gray('   • Detailed findings with HIPAA references'));
      console.log(chalk.gray('   • Suppression and acknowledgment audit trails'));
      console.log(chalk.gray('   • SHA256 hash for document integrity verification'));
      console.log(chalk.gray('   • Print-friendly CSS for PDF export\n'));

    } catch (error) {
      spinner.fail('Report generation failed');
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

// Marketplace commands
const marketplaceCommand = program
  .command('marketplace')
  .alias('market')
  .description('Community Rules Marketplace - Share and discover healthcare compliance rules');

marketplaceCommand
  .command('search')
  .description('Search for rules in the marketplace')
  .argument('[query]', 'Search query (rule name, description, tags)', '')
  .option('--framework <framework>', 'Filter by compliance framework (hipaa, state-law, payer-specific)')
  .option('--jurisdiction <state>', 'Filter by state jurisdiction (california, new-york, texas, etc.)')
  .option('--payer <payer>', 'Filter by payer (medicare, medicaid, bcbs, etc.)')
  .option('--tech <stack>', 'Filter by tech stack (fhir, hl7, nextjs, etc.)')
  .option('--verified', 'Show only verified rules')
  .option('--min-rating <rating>', 'Minimum rating (1-5)', '0')
  .option('--limit <number>', 'Maximum results to show', '20')
  .action(async (query: string, options) => {
    const spinner = ora('Searching marketplace...').start();

    try {
      const { MarketplaceRegistry } = await import('./marketplace/index.js');
      const registry = new MarketplaceRegistry();

      const filters: any = {};
      if (options.framework) filters.framework = options.framework;
      if (options.jurisdiction) filters.jurisdiction = options.jurisdiction;
      if (options.payer) filters.payer = options.payer;
      if (options.tech) filters.techStack = options.tech;
      if (options.verified) filters.verified = true;
      if (options.minRating) filters.minRating = parseFloat(options.minRating);

      const result = await registry.search(query, filters, 1, parseInt(options.limit));

      spinner.succeed(`Found ${result.total} rule(s)`);

      if (result.rules.length === 0) {
        console.log(chalk.yellow('\nNo rules found matching your criteria.'));
        console.log(chalk.gray('Try broadening your search or removing filters.'));
        return;
      }

      console.log(chalk.bold('\n📦 Marketplace Rules:\n'));

      for (const rule of result.rules) {
        const verified = rule.verified ? chalk.green('✓ Verified') : chalk.gray('Unverified');
        const rating = '⭐'.repeat(Math.round(rule.rating));

        console.log(chalk.cyan.bold(`${rule.id}`));
        console.log(`  ${rule.name} ${verified}`);
        console.log(chalk.gray(`  ${rule.description}`));
        console.log(`  ${rating} ${rule.rating.toFixed(1)} (${rule.reviews} reviews) | ${rule.downloads} downloads`);
        console.log(chalk.gray(`  Author: ${rule.author.name}${rule.author.organization ? ` (${rule.author.organization})` : ''}`));
        console.log(chalk.gray(`  Framework: ${rule.framework} | Severity: ${rule.severity} | Version: ${rule.version}`));

        if (rule.jurisdiction) {
          console.log(chalk.gray(`  Jurisdiction: ${rule.jurisdiction}`));
        }
        if (rule.payer) {
          console.log(chalk.gray(`  Payer: ${rule.payer}`));
        }

        console.log(chalk.gray(`  Tags: ${rule.tags.join(', ')}`));
        console.log('');
      }

      console.log(chalk.gray(`\nShowing ${result.rules.length} of ${result.total} results`));
      console.log(chalk.cyan('\nInstall a rule:') + chalk.white(' vlayer marketplace install <rule-id>'));
    } catch (error) {
      spinner.fail('Search failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

marketplaceCommand
  .command('install')
  .description('Install a rule from the marketplace')
  .argument('<rule-id>', 'Rule ID to install')
  .option('--version <version>', 'Specific version to install')
  .option('--package', 'Install as a package (collection of rules)')
  .action(async (ruleId: string, options) => {
    const spinner = ora(`Installing ${ruleId}...`).start();

    try {
      const { RulesInstaller } = await import('./marketplace/index.js');
      const installer = new RulesInstaller(process.cwd());

      if (options.package) {
        const installed = await installer.installPackage(ruleId);
        spinner.succeed(`Installed package with ${installed.length} rule(s)`);

        console.log(chalk.green('\n✓ Package installed successfully!'));
        console.log(chalk.gray(`\nInstalled rules:`));
        installed.forEach(r => console.log(chalk.gray(`  • ${r.id} (v${r.version})`)));
      } else {
        const installed = await installer.install(ruleId, options.version);
        spinner.succeed('Rule installed');

        console.log(chalk.green('\n✓ Rule installed successfully!'));
        console.log(chalk.gray(`\nRule: ${installed.id}`));
        console.log(chalk.gray(`Version: ${installed.version}`));
        console.log(chalk.gray(`Location: .vlayer/marketplace/${installed.id}.yaml`));
      }

      console.log(chalk.cyan('\nRun a scan:') + chalk.white(' vlayer scan .'));
    } catch (error) {
      spinner.fail('Installation failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

marketplaceCommand
  .command('list')
  .description('List installed marketplace rules')
  .option('--enabled', 'Show only enabled rules')
  .option('--disabled', 'Show only disabled rules')
  .action(async (options) => {
    try {
      const { RulesInstaller } = await import('./marketplace/index.js');
      const installer = new RulesInstaller(process.cwd());

      let installed = await installer.listInstalled();

      if (options.enabled) {
        installed = installed.filter(r => r.enabled);
      } else if (options.disabled) {
        installed = installed.filter(r => !r.enabled);
      }

      if (installed.length === 0) {
        console.log(chalk.yellow('No marketplace rules installed.'));
        console.log(chalk.gray('\nSearch for rules:') + chalk.white(' vlayer marketplace search'));
        return;
      }

      console.log(chalk.bold(`\n📦 Installed Rules (${installed.length}):\n`));

      for (const rule of installed) {
        const status = rule.enabled ? chalk.green('✓ Enabled') : chalk.gray('○ Disabled');
        const source = rule.source === 'marketplace' ? chalk.blue('[Marketplace]') : chalk.gray('[Local]');

        console.log(`${status} ${chalk.cyan(rule.id)} ${source}`);
        console.log(chalk.gray(`  Version: ${rule.version} | Installed: ${new Date(rule.installedAt).toLocaleDateString()}`));
        console.log('');
      }

      console.log(chalk.gray('Update all:') + chalk.white(' vlayer marketplace update'));
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

marketplaceCommand
  .command('update')
  .description('Update installed rules to latest versions')
  .option('--dry-run', 'Show what would be updated without installing')
  .action(async (options) => {
    const spinner = ora('Checking for updates...').start();

    try {
      const { RulesInstaller } = await import('./marketplace/index.js');
      const installer = new RulesInstaller(process.cwd());

      const result = await installer.updateAll();

      spinner.succeed('Update check complete');

      if (result.updated.length === 0 && result.failed.length === 0) {
        console.log(chalk.green('\n✓ All rules are up to date!'));
        return;
      }

      if (result.updated.length > 0) {
        console.log(chalk.green(`\n✓ Updated ${result.updated.length} rule(s):`));
        result.updated.forEach(id => console.log(chalk.gray(`  • ${id}`)));
      }

      if (result.failed.length > 0) {
        console.log(chalk.red(`\n✗ Failed to update ${result.failed.length} rule(s):`));
        result.failed.forEach(id => console.log(chalk.gray(`  • ${id}`)));
      }
    } catch (error) {
      spinner.fail('Update failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

marketplaceCommand
  .command('uninstall')
  .description('Uninstall a marketplace rule')
  .argument('<rule-id>', 'Rule ID to uninstall')
  .action(async (ruleId: string) => {
    const spinner = ora(`Uninstalling ${ruleId}...`).start();

    try {
      const { RulesInstaller } = await import('./marketplace/index.js');
      const installer = new RulesInstaller(process.cwd());

      await installer.uninstall(ruleId);

      spinner.succeed('Rule uninstalled');
      console.log(chalk.green(`\n✓ ${ruleId} has been removed.`));
    } catch (error) {
      spinner.fail('Uninstall failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

marketplaceCommand
  .command('featured')
  .description('Show featured/popular rules')
  .option('--limit <number>', 'Number of rules to show', '10')
  .action(async (options) => {
    const spinner = ora('Loading featured rules...').start();

    try {
      const { MarketplaceRegistry } = await import('./marketplace/index.js');
      const registry = new MarketplaceRegistry();

      const featured = await registry.getFeatured(parseInt(options.limit));

      spinner.succeed(`Found ${featured.length} featured rule(s)`);

      console.log(chalk.bold('\n⭐ Featured Rules:\n'));

      for (const rule of featured) {
        const rating = '⭐'.repeat(Math.round(rule.rating));

        console.log(chalk.cyan.bold(`${rule.id}`));
        console.log(`  ${rule.name} ${chalk.green('✓')}`);
        console.log(chalk.gray(`  ${rule.description}`));
        console.log(`  ${rating} ${rule.rating.toFixed(1)} | ${rule.downloads} downloads`);
        console.log(chalk.gray(`  ${rule.framework} • ${rule.category} • ${rule.severity}`));
        console.log('');
      }

      console.log(chalk.cyan('\nInstall:') + chalk.white(' vlayer marketplace install <rule-id>'));
    } catch (error) {
      spinner.fail('Failed to load featured rules');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

marketplaceCommand
  .command('stats')
  .description('Show marketplace statistics')
  .action(async () => {
    const spinner = ora('Loading marketplace stats...').start();

    try {
      const { MarketplaceRegistry } = await import('./marketplace/index.js');
      const registry = new MarketplaceRegistry();

      const metadata = await registry.getMetadata();

      spinner.succeed('Stats loaded');

      console.log(chalk.bold('\n📊 Marketplace Statistics:\n'));
      console.log(`Total Rules: ${chalk.cyan(metadata.totalRules)}`);
      console.log(`Total Packages: ${chalk.cyan(metadata.totalPackages)}`);
      console.log('');

      console.log(chalk.bold('Rules by Framework:'));
      Object.entries(metadata.frameworks)
        .sort(([, a], [, b]) => b - a)
        .forEach(([framework, count]) => {
          console.log(`  ${framework}: ${chalk.cyan(count)}`);
        });
      console.log('');

      console.log(chalk.bold('Rules by Category:'));
      Object.entries(metadata.categories)
        .sort(([, a], [, b]) => b - a)
        .forEach(([category, count]) => {
          console.log(`  ${category}: ${chalk.cyan(count)}`);
        });
      console.log('');

      console.log(chalk.bold('Top Contributors:'));
      metadata.topContributors.slice(0, 5).forEach((contributor, i) => {
        console.log(`  ${i + 1}. ${contributor.name}`);
        console.log(chalk.gray(`     ${contributor.rulesPublished} rules | ${contributor.downloads} downloads`));
      });
      console.log('');

      console.log(chalk.gray('Search rules:') + chalk.white(' vlayer marketplace search'));
    } catch (error) {
      spinner.fail('Failed to load stats');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// Templates commands
const templatesCommand = program
  .command('templates')
  .description('Export compliance document templates');

templatesCommand
  .command('export')
  .description('Export a compliance document template')
  .argument('<template>', 'Template name: baa, physical, irp, npp, security-officer')
  .option('-o, --output <path>', 'Output file path')
  .action(async (template: string, options) => {
    try {
      const validTemplates = ['baa', 'physical', 'irp', 'npp', 'security-officer'];

      if (!validTemplates.includes(template)) {
        console.error(chalk.red(`Unknown template: ${template}`));
        console.log(chalk.yellow('\nAvailable templates:'));
        console.log(chalk.gray('  • baa - Business Associate Agreement Verification Letter'));
        console.log(chalk.gray('  • physical - Physical Safeguards Checklist'));
        console.log(chalk.gray('  • irp - Incident Response Plan'));
        console.log(chalk.gray('  • npp - Notice of Privacy Practices'));
        console.log(chalk.gray('  • security-officer - Security Officer Designation'));
        process.exit(1);
      }

      // Read template file
      const { readFile: fsReadFile } = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');

      // Get the directory of the current module
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      // Map template names to file names
      const templateFiles: Record<string, string> = {
        'baa': 'baa-verification-letter.md',
        'physical': 'physical-safeguards-checklist.md',
        'irp': 'irp.md',
        'npp': 'notice-of-privacy-practices.md',
        'security-officer': 'security-officer-designation.md',
      };

      const templateFileName = templateFiles[template];
      const templatePath = join(__dirname, '..', 'templates', templateFileName);

      const templateContent = await fsReadFile(templatePath, 'utf-8');

      // Determine output path
      const outputPath = options.output || `./${templateFileName}`;

      // Write template to output location
      await writeFile(outputPath, templateContent, 'utf-8');

      console.log(chalk.green(`\n✓ Template exported successfully!`));
      console.log(chalk.cyan(`\nFile: ${outputPath}`));

      // Provide template-specific instructions
      if (template === 'baa') {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. Open the file and fill in the bracketed placeholders:'));
        console.log(chalk.gray('     [BA COMPANY NAME], [DATE], [SCORE], etc.'));
        console.log(chalk.gray('  2. Check all applicable boxes (☐ → ☑)'));
        console.log(chalk.gray('  3. Attach your vlayer compliance report as Exhibit A'));
        console.log(chalk.gray('  4. Have both parties sign and date'));
        console.log(chalk.gray('  5. Retain for 6 years per HIPAA requirements\n'));
      } else if (template === 'physical') {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. Review Section A (Remote/Cloud) - applies to ALL organizations'));
        console.log(chalk.gray('  2. Review Section B (Physical Office) - only if you have a physical location'));
        console.log(chalk.gray('  3. Check all applicable boxes (☐ → ☑)'));
        console.log(chalk.gray('  4. Fill in verification details and dates'));
        console.log(chalk.gray('  5. Complete remediation plan for non-compliant items'));
        console.log(chalk.gray('  6. Sign and date the attestation'));
        console.log(chalk.gray('  7. Retain for 6 years per HIPAA requirements\n'));
      } else if (template === 'irp') {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. Fill in organization and IRT contact information'));
        console.log(chalk.gray('  2. Customize severity levels and response times for your organization'));
        console.log(chalk.gray('  3. Update external contact information (HHS, FBI, insurance, etc.)'));
        console.log(chalk.gray('  4. Review and customize incident response procedures'));
        console.log(chalk.gray('  5. Obtain executive approval and signatures'));
        console.log(chalk.gray('  6. Distribute to all IRT members'));
        console.log(chalk.gray('  7. Schedule quarterly drills and annual updates\n'));
      } else if (template === 'npp') {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. Replace all [PLACEHOLDERS] with your organization\'s information'));
        console.log(chalk.gray('  2. Review 2024 updates: 15-day timeline, in-person inspection rights'));
        console.log(chalk.gray('  3. Customize uses and disclosures to match your practices'));
        console.log(chalk.gray('  4. Review with healthcare attorney for state-specific requirements'));
        console.log(chalk.gray('  5. Have Privacy Officer approve the final version'));
        console.log(chalk.gray('  6. Post prominently in your facility and on website'));
        console.log(chalk.gray('  7. Provide to all patients and obtain signed acknowledgment\n'));
      } else if (template === 'security-officer') {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. Fill in Security Officer name and contact information'));
        console.log(chalk.gray('  2. Customize responsibilities and authorities for your organization'));
        console.log(chalk.gray('  3. Define budget, resources, and staff allocation'));
        console.log(chalk.gray('  4. Identify backup/interim Security Officers'));
        console.log(chalk.gray('  5. Obtain executive signature (CEO/COO)'));
        console.log(chalk.gray('  6. Obtain Security Officer signature accepting designation'));
        console.log(chalk.gray('  7. Distribute to stakeholders and HR\n'));
      }

    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

templatesCommand
  .command('list')
  .description('List available templates')
  .action(() => {
    console.log(chalk.bold('\n📄 Available Compliance Templates:\n'));

    console.log(chalk.cyan('baa') + chalk.gray(' - Business Associate Agreement Verification Letter'));
    console.log(chalk.gray('  Annual security verification letter for HIPAA Business Associates'));
    console.log(chalk.gray('  Includes technical safeguards checklist and compliance report attachment'));
    console.log(chalk.gray('  Usage: vlayer templates export baa\n'));

    console.log(chalk.cyan('physical') + chalk.gray(' - Physical Safeguards Checklist'));
    console.log(chalk.gray('  HIPAA Physical Safeguards compliance checklist (§164.310)'));
    console.log(chalk.gray('  Section A: Remote/Cloud setup | Section B: Physical office controls'));
    console.log(chalk.gray('  Usage: vlayer templates export physical\n'));

    console.log(chalk.cyan('irp') + chalk.gray(' - Incident Response Plan'));
    console.log(chalk.gray('  Complete incident response procedures and breach notification guidelines'));
    console.log(chalk.gray('  Includes IRT roles, severity levels, 5-phase response, and HIPAA timeline'));
    console.log(chalk.gray('  Usage: vlayer templates export irp\n'));

    console.log(chalk.cyan('npp') + chalk.gray(' - Notice of Privacy Practices'));
    console.log(chalk.gray('  HIPAA §164.520 compliant patient notice (includes 2024 updates)'));
    console.log(chalk.gray('  15-day access timeline, in-person inspection rights, electronic copy'));
    console.log(chalk.gray('  Usage: vlayer templates export npp\n'));

    console.log(chalk.cyan('security-officer') + chalk.gray(' - Security Officer Designation'));
    console.log(chalk.gray('  Official HIPAA §164.308(a)(2) required designation document'));
    console.log(chalk.gray('  Defines responsibilities, authorities, reporting structure, and signatures'));
    console.log(chalk.gray('  Usage: vlayer templates export security-officer\n'));
  });

program
  .command('history')
  .description('Show scan history with compliance scores over time')
  .argument('[path]', 'Path to the project', '.')
  .option('-l, --limit <number>', 'Maximum number of scans to show', '10')
  .action(async (path: string, options) => {
    const absolutePath = resolve(path);

    try {
      const { getAllScans, formatHistoryDate } = await import('./utils/scan-history.js');
      const scans = await getAllScans(absolutePath);

      if (scans.length === 0) {
        console.log(chalk.yellow('\nNo scan history found.'));
        console.log(chalk.gray('Run `vlayer scan .` to create your first scan history entry.\n'));
        return;
      }

      const limit = parseInt(options.limit);
      const displayScans = scans.slice(0, limit);

      console.log(chalk.bold('\n📊 Scan History\n'));
      console.log(chalk.gray(`Showing ${displayScans.length} of ${scans.length} scan(s)\n`));

      // Find max and min scores for context
      const scores = scans.map(s => s.complianceScore);
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);

      for (let i = 0; i < displayScans.length; i++) {
        const scan = displayScans[i];
        const prevScan = i < scans.length - 1 ? scans[i + 1] : null;
        const scoreChange = prevScan ? scan.complianceScore - prevScan.complianceScore : 0;

        const scoreColor = scan.complianceScore >= 90 ? chalk.green
          : scan.complianceScore >= 70 ? chalk.yellow
          : chalk.red;

        const changeArrow = scoreChange > 0 ? chalk.green('↑')
          : scoreChange < 0 ? chalk.red('↓')
          : chalk.gray('→');

        const changeStr = prevScan
          ? ` (${scoreChange >= 0 ? '+' : ''}${scoreChange}) ${changeArrow}`
          : '';

        const date = formatHistoryDate(scan.date);
        const isBest = scan.complianceScore === maxScore;
        const isWorst = scan.complianceScore === minScore;

        console.log(
          chalk.cyan(date) +
          '  ' +
          scoreColor.bold(`${scan.complianceScore}/100`) +
          changeStr +
          (isBest ? chalk.green.bold(' 🏆 Best') : '') +
          (isWorst ? chalk.red(' ⚠️ Lowest') : '')
        );

        // Show severity breakdown
        const severityStr = [
          scan.severity.critical > 0 ? chalk.red(`${scan.severity.critical}C`) : null,
          scan.severity.high > 0 ? chalk.yellow(`${scan.severity.high}H`) : null,
          scan.severity.medium > 0 ? chalk.hex('#ca8a04')(`${scan.severity.medium}M`) : null,
          scan.severity.low > 0 ? chalk.blue(`${scan.severity.low}L`) : null,
        ].filter(Boolean).join(' ');

        if (severityStr) {
          console.log(chalk.gray(`         Issues: ${severityStr}  •  Files: ${scan.totalFilesScanned}`));
        } else {
          console.log(chalk.gray(`         No active issues  •  Files: ${scan.totalFilesScanned}`));
        }

        console.log('');
      }

      if (scans.length > limit) {
        console.log(chalk.gray(`Use --limit ${scans.length} to see all scans\n`));
      }

      // Show statistics
      const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const trend = scans.length > 1
        ? scans[0].complianceScore - scans[scans.length - 1].complianceScore
        : 0;

      console.log(chalk.bold('Statistics:'));
      console.log(`  Total scans: ${scans.length}`);
      console.log(`  Average score: ${avgScore}/100`);
      console.log(`  Best score: ${chalk.green(maxScore)}/100`);
      console.log(`  Lowest score: ${chalk.red(minScore)}/100`);

      if (trend !== 0) {
        const trendColor = trend > 0 ? chalk.green : chalk.red;
        const trendArrow = trend > 0 ? '↑' : '↓';
        console.log(`  Overall trend: ${trendColor(`${trend >= 0 ? '+' : ''}${trend} ${trendArrow}`)}`);
      }

      console.log('');
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('training')
  .description('Interactive HIPAA security training for developers')
  .option('--status', 'Show training completion status')
  .action(async (options) => {
    try {
      const { runTraining, showTrainingStatus } = await import('./training/index.js');

      if (options.status) {
        await showTrainingStatus();
      } else {
        await runTraining();
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program.parse();
