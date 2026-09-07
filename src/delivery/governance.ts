import { readFile } from 'fs/promises';
import { isAbsolute, join, resolve } from 'path';
import type { AcknowledgedFinding, Severity } from '../types.js';
import { loadConfig } from '../config.js';
import type { DeliveryPolicy, SeverityBudget } from './types.js';

const VALID_SEVERITIES = new Set<Severity>(['critical', 'high', 'medium', 'low', 'info']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as unknown;
  } catch {
    return undefined;
  }
}

function parseSeverityArray(value: unknown): Severity[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((item): item is Severity =>
    typeof item === 'string' && VALID_SEVERITIES.has(item as Severity));
  return values.length > 0 ? values : [];
}

function parseSeverityBudget(value: unknown): SeverityBudget | undefined {
  if (!isRecord(value)) return undefined;
  const budget: SeverityBudget = {};
  for (const severity of VALID_SEVERITIES) {
    const candidate = value[severity];
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 0) {
      budget[severity] = candidate;
    }
  }
  return budget;
}

export function parseDeliveryPolicy(value: unknown): DeliveryPolicy {
  if (!isRecord(value)) return {};

  const policy: DeliveryPolicy = {};
  const blockOn = parseSeverityArray(value.blockOn);
  const maxNew = parseSeverityBudget(value.maxNew);
  if (blockOn !== undefined) policy.blockOn = blockOn;
  if (maxNew !== undefined) policy.maxNew = maxNew;
  if (typeof value.changedFilesOnly === 'boolean') policy.changedFilesOnly = value.changedFilesOnly;
  if (typeof value.minimumScore === 'number' && value.minimumScore >= 0 && value.minimumScore <= 100) {
    policy.minimumScore = value.minimumScore;
  }
  if (typeof value.requireBaseline === 'boolean') policy.requireBaseline = value.requireBaseline;
  if (typeof value.failOnExpiredAcknowledgments === 'boolean') {
    policy.failOnExpiredAcknowledgments = value.failOnExpiredAcknowledgments;
  }
  return policy;
}

export interface LoadedDeliveryPolicy {
  policy: DeliveryPolicy;
  source?: string;
}

/**
 * Load delivery policy from an explicit file, conventional policy file, or the
 * `deliveryPolicy` block inside the scanner config, in that precedence order.
 */
export async function loadDeliveryPolicy(
  projectPath: string,
  policyFile?: string,
  configFile?: string,
): Promise<LoadedDeliveryPolicy> {
  const root = resolve(projectPath);
  const explicit = policyFile
    ? (isAbsolute(policyFile) ? policyFile : resolve(root, policyFile))
    : undefined;
  const candidates = [
    explicit,
    join(root, 'vlayer.policy.json'),
    join(root, '.vlayer', 'policy.json'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const raw = await readJson(candidate);
    if (raw !== undefined) {
      return { policy: parseDeliveryPolicy(raw), source: candidate };
    }
  }

  const configPath = configFile
    ? (isAbsolute(configFile) ? configFile : resolve(root, configFile))
    : join(root, '.vlayerrc.json');
  const rawConfig = await readJson(configPath);
  if (isRecord(rawConfig) && rawConfig.deliveryPolicy !== undefined) {
    return {
      policy: parseDeliveryPolicy(rawConfig.deliveryPolicy),
      source: `${configPath}#deliveryPolicy`,
    };
  }

  return { policy: {} };
}

export interface AcknowledgmentLifecycle {
  total: number;
  active: AcknowledgedFinding[];
  expired: AcknowledgedFinding[];
  expiringSoon: AcknowledgedFinding[];
}

/**
 * Summarize exception governance directly from the scanner configuration.
 */
export async function getAcknowledgmentLifecycle(
  projectPath: string,
  configFile?: string,
  now = new Date(),
): Promise<AcknowledgmentLifecycle> {
  const config = await loadConfig(resolve(projectPath), configFile);
  const acknowledgments = config.acknowledgedFindings ?? [];
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const expired: AcknowledgedFinding[] = [];
  const active: AcknowledgedFinding[] = [];
  const expiringSoon: AcknowledgedFinding[] = [];

  for (const acknowledgment of acknowledgments) {
    const expiresAt = acknowledgment.expiresAt ? new Date(acknowledgment.expiresAt) : undefined;
    if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < now.getTime()) {
      expired.push(acknowledgment);
      continue;
    }

    active.push(acknowledgment);
    if (
      expiresAt
      && !Number.isNaN(expiresAt.getTime())
      && expiresAt.getTime() - now.getTime() <= thirtyDays
    ) {
      expiringSoon.push(acknowledgment);
    }
  }

  return {
    total: acknowledgments.length,
    active,
    expired,
    expiringSoon,
  };
}
