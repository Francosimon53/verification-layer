#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { uploadEvidenceFile } from './delivery/upload.js';

const program = new Command();

program
  .name('vlayer-upload')
  .description('Upload a verified vlayer evidence package to a compliance workspace')
  .argument('<file>', 'Evidence package JSON')
  .option('--url <url>', 'Workspace ingest URL (default: VLAYER_INGEST_URL or https://vlayer.app/api/ingest)')
  .option('--token-env <name>', 'Environment variable containing the project token', 'VLAYER_TOKEN')
  .action(async (file: string, options: { url?: string; tokenEnv: string }) => {
    try {
      const token = process.env[options.tokenEnv];
      if (!token) {
        throw new Error(`${options.tokenEnv} is not set`);
      }

      const result = await uploadEvidenceFile(file, {
        url: options.url,
        token,
      });

      console.log(chalk.green.bold('Evidence uploaded'));
      if (result.projectId) console.log(`Project: ${result.projectId}`);
      if (result.scanId) console.log(`Scan: ${result.scanId}`);
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Evidence upload failed'));
      process.exitCode = 1;
    }
  });

program.parseAsync().catch(error => {
  console.error(chalk.red(error instanceof Error ? error.message : 'vlayer-upload failed'));
  process.exitCode = 1;
});
