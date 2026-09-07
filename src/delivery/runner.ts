import { isAbsolute, resolve } from 'path';
import { access } from 'fs/promises';
import { scan } from '../scan.js';
import { loadBaseline, type Baseline } from '../baseline.js';
import type { Confidence, ScanOptions } from '../types.js';
import { getGitContext } from './git.js';
import { buildFindingDelta } from './diff.js';
import { evaluateDeliveryPolicy } from './policy.js';
import { getAcknowledgmentLifecycle, loadDeliveryPolicy } from './governance.js';
import type { DeliveryPolicy, GuardResult } from './types.js';

export interface RunGuardOptions {
  path: string;
  baselineFile?: string;
  configFile?: string;
  policyFile?: string;
  baseRef?: string;
  headRef?: string;
  changedFilesOnly?: boolean;
  enableAI?: boolean;
  minConfidence?: Confidence;
  policy?: DeliveryPolicy;
}

export interface GuardExecution extends GuardResult {
  policySource?: string;
  acknowledgmentLifecycle: Awaited<ReturnType<typeof getAcknowledgmentLifecycle>>;
  baselinePath?: string;
}

async function existingFile(path: string): Promise<string | undefined> {
  try {
    await access(path);
    return path;
  } catch {
    return undefined;
  }
}

async function resolveBaselinePath(root: string, explicit?: string): Promise<string | undefined> {
  if (explicit) {
    const candidate = isAbsolute(explicit) ? explicit : resolve(root, explicit);
    return existingFile(candidate);
  }
  return existingFile(resolve(root, '.vlayer-baseline.json'));
}

function mergePolicy(base: DeliveryPolicy, override?: DeliveryPolicy): DeliveryPolicy {
  if (!override) return base;
  return {
    ...base,
    ...override,
    maxNew: override.maxNew ?? base.maxNew,
    blockOn: override.blockOn ?? base.blockOn,
  };
}

/**
 * Execute a deterministic compliance delivery gate. AI triage is disabled by
 * default so CI decisions are reproducible unless the caller explicitly opts in.
 */
export async function runComplianceGuard(options: RunGuardOptions): Promise<GuardExecution> {
  const projectPath = resolve(options.path);
  const git = await getGitContext(projectPath, options.baseRef, options.headRef ?? 'HEAD');
  const scanRoot = git.available ? git.root : projectPath;
  const baselinePath = await resolveBaselinePath(scanRoot, options.baselineFile);
  const configPath = options.configFile
    ? (isAbsolute(options.configFile) ? options.configFile : resolve(scanRoot, options.configFile))
    : undefined;
  let baseline: Baseline | null = null;
  if (baselinePath) baseline = await loadBaseline(baselinePath);

  const scanOptions: ScanOptions = {
    path: scanRoot,
    configFile: configPath,
    baselineFile: baselinePath,
    enableAI: options.enableAI === true,
    minConfidence: options.minConfidence,
  };
  const result = await scan(scanOptions);
  const delta = buildFindingDelta(result.findings, scanRoot, git.changedFiles, baseline);
  const loadedPolicy = await loadDeliveryPolicy(scanRoot, options.policyFile, configPath);
  const acknowledgmentLifecycle = await getAcknowledgmentLifecycle(scanRoot, configPath);

  let policy = mergePolicy(loadedPolicy.policy, options.policy);
  if (options.changedFilesOnly !== undefined) {
    policy = { ...policy, changedFilesOnly: options.changedFilesOnly };
  }

  const decision = evaluateDeliveryPolicy(
    delta,
    result.findings,
    result.complianceScore?.score,
    baseline !== null,
    git.available,
    policy,
    acknowledgmentLifecycle.expired.length,
  );

  return {
    git,
    delta,
    decision,
    findings: result.findings,
    scannedFiles: result.scannedFiles,
    complianceScore: result.complianceScore?.score,
    baselineLoaded: baseline !== null,
    baselinePath,
    policySource: loadedPolicy.source,
    acknowledgmentLifecycle,
  };
}
