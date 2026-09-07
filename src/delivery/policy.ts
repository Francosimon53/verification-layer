import type { Finding, Severity } from '../types.js';
import type {
  DeliveryPolicy,
  FindingDelta,
  PolicyDecision,
  PolicyReason,
  SeverityBudget,
} from './types.js';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const DEFAULT_DELIVERY_POLICY: Required<Pick<
  DeliveryPolicy,
  'changedFilesOnly' | 'minimumScore' | 'requireBaseline' | 'failOnExpiredAcknowledgments'
>> & {
  blockOn: Severity[];
  maxNew: SeverityBudget;
} = {
  blockOn: ['critical', 'high'],
  maxNew: {},
  changedFilesOnly: true,
  minimumScore: 0,
  requireBaseline: false,
  failOnExpiredAcknowledgments: true,
};

function countsFor(findings: Finding[]): Record<Severity, number> {
  return {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    info: findings.filter(f => f.severity === 'info').length,
  };
}

export function resolveDeliveryPolicy(policy: DeliveryPolicy = {}): PolicyDecision['policy'] {
  return {
    blockOn: policy.blockOn ?? DEFAULT_DELIVERY_POLICY.blockOn,
    maxNew: policy.maxNew ?? DEFAULT_DELIVERY_POLICY.maxNew,
    changedFilesOnly: policy.changedFilesOnly ?? DEFAULT_DELIVERY_POLICY.changedFilesOnly,
    minimumScore: policy.minimumScore ?? DEFAULT_DELIVERY_POLICY.minimumScore,
    requireBaseline: policy.requireBaseline ?? DEFAULT_DELIVERY_POLICY.requireBaseline,
    failOnExpiredAcknowledgments:
      policy.failOnExpiredAcknowledgments ?? DEFAULT_DELIVERY_POLICY.failOnExpiredAcknowledgments,
  };
}

/**
 * Decide whether a software change is allowed to ship. The policy deliberately
 * evaluates new active risk instead of the repository's historical debt.
 */
export function evaluateDeliveryPolicy(
  delta: FindingDelta,
  allFindings: Finding[],
  complianceScore: number | undefined,
  baselineLoaded: boolean,
  gitAvailable: boolean,
  policy: DeliveryPolicy = {},
  expiredAcknowledgmentCount = 0,
): PolicyDecision {
  const resolved = resolveDeliveryPolicy(policy);
  const useChangedFiles = resolved.changedFilesOnly && gitAvailable;
  const considered = useChangedFiles
    ? delta.newFindingsInChangedFiles
    : delta.newFindings;
  const counts = countsFor(considered);
  const reasons: PolicyReason[] = [];

  for (const severity of resolved.blockOn) {
    const count = counts[severity];
    if (count > 0) {
      reasons.push({
        code: 'BLOCKING_SEVERITY',
        severity,
        count,
        message: `${count} new ${severity} finding${count === 1 ? '' : 's'} in the evaluated change`,
      });
    }
  }

  for (const severity of SEVERITIES) {
    const limit = resolved.maxNew[severity];
    if (limit === undefined) continue;
    const count = counts[severity];
    if (count > limit) {
      reasons.push({
        code: 'SEVERITY_BUDGET_EXCEEDED',
        severity,
        count,
        limit,
        message: `${severity} budget exceeded: ${count} new finding${count === 1 ? '' : 's'} (limit ${limit})`,
      });
    }
  }

  if (resolved.minimumScore > 0 && (complianceScore ?? 0) < resolved.minimumScore) {
    reasons.push({
      code: 'MINIMUM_SCORE',
      message: `Compliance score ${complianceScore ?? 0} is below required minimum ${resolved.minimumScore}`,
    });
  }

  if (resolved.requireBaseline && !baselineLoaded) {
    reasons.push({
      code: 'BASELINE_REQUIRED',
      message: 'A committed baseline is required by delivery policy',
    });
  }

  const expiredInFindings = allFindings.filter(f => f.acknowledgment?.expired === true).length;
  const expired = Math.max(expiredAcknowledgmentCount, expiredInFindings);
  if (resolved.failOnExpiredAcknowledgments && expired > 0) {
    reasons.push({
      code: 'EXPIRED_ACKNOWLEDGMENT',
      count: expired,
      message: `${expired} acknowledgment${expired === 1 ? '' : 's'} expired and require re-review`,
    });
  }

  const deployAllowed = reasons.length === 0;
  return {
    status: deployAllowed ? 'pass' : 'fail',
    deployAllowed,
    evaluatedAt: new Date().toISOString(),
    consideredScope: useChangedFiles ? 'changed-files' : 'all-files',
    counts,
    totalConsidered: considered.length,
    reasons,
    policy: resolved,
  };
}
