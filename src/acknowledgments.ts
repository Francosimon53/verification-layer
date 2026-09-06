import { minimatch } from 'minimatch';
import type { Finding, VlayerConfig } from './types.js';

export interface AcknowledgmentMatch {
  acknowledged: boolean;
  reason?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  ticketUrl?: string;
  expired?: boolean;
}

/**
 * Check if a finding matches any acknowledged finding pattern in the config
 */
export function checkAcknowledgment(
  finding: Finding,
  config: VlayerConfig
): AcknowledgmentMatch {
  if (!config.acknowledgedFindings || config.acknowledgedFindings.length === 0) {
    return { acknowledged: false };
  }

  for (const ack of config.acknowledgedFindings) {
    // Check if file path matches the pattern. `dot: true` lets `**` traverse
    // dot-directories — finding.file is an absolute path, and a checkout under
    // e.g. `.claude/worktrees/<branch>/` would otherwise match no pattern,
    // silently disabling every acknowledgment.
    if (!minimatch(finding.file, ack.pattern, { dot: true })) {
      continue;
    }

    // Check if finding ID matches (if specified)
    if (ack.id) {
      const idPattern = new RegExp(ack.id.replace(/\*/g, '.*'));
      if (!idPattern.test(finding.id)) {
        continue;
      }
    }

    // Check if category matches (if specified)
    if (ack.category && ack.category !== finding.category) {
      continue;
    }

    // Check if severity matches (if specified)
    if (ack.severity && ack.severity !== finding.severity) {
      continue;
    }

    // Expired acknowledgments must never suppress findings. Return the match
    // metadata so callers can still distinguish an expired exception from no
    // matching exception at all.
    const expired = ack.expiresAt ? new Date(ack.expiresAt) < new Date() : false;
    if (expired) {
      return {
        acknowledged: false,
        reason: ack.reason,
        acknowledgedBy: ack.acknowledgedBy,
        acknowledgedAt: ack.acknowledgedAt,
        ticketUrl: ack.ticketUrl,
        expired: true,
      };
    }

    // All criteria matched and the acknowledgment is still active.
    return {
      acknowledged: true,
      reason: ack.reason,
      acknowledgedBy: ack.acknowledgedBy,
      acknowledgedAt: ack.acknowledgedAt,
      ticketUrl: ack.ticketUrl,
      expired: false,
    };
  }

  return { acknowledged: false };
}

/**
 * Apply acknowledgments to all findings
 */
export function applyAcknowledgments(
  findings: Finding[],
  config: VlayerConfig
): Finding[] {
  return findings.map(finding => {
    const ack = checkAcknowledgment(finding, config);

    if (ack.acknowledged) {
      return {
        ...finding,
        acknowledged: true,
        acknowledgment: {
          reason: ack.reason!,
          acknowledgedBy: ack.acknowledgedBy!,
          acknowledgedAt: ack.acknowledgedAt!,
          ticketUrl: ack.ticketUrl,
          expired: ack.expired,
        },
      };
    }

    return finding;
  });
}

/**
 * Validate acknowledged finding configuration
 */
export function validateAcknowledgedFinding(
  ack: unknown,
  index: number
): string[] {
  const errors: string[] = [];
  const value: Record<string, unknown> =
    typeof ack === 'object' && ack !== null ? (ack as Record<string, unknown>) : {};

  if (!value.pattern || typeof value.pattern !== 'string') {
    errors.push(`acknowledgedFindings[${index}]: 'pattern' is required and must be a string`);
  }

  if (!value.reason || typeof value.reason !== 'string') {
    errors.push(`acknowledgedFindings[${index}]: 'reason' is required and must be a string`);
  }

  if (!value.acknowledgedBy || typeof value.acknowledgedBy !== 'string') {
    errors.push(`acknowledgedFindings[${index}]: 'acknowledgedBy' is required and must be a string`);
  }

  if (!value.acknowledgedAt || typeof value.acknowledgedAt !== 'string') {
    errors.push(`acknowledgedFindings[${index}]: 'acknowledgedAt' is required and must be a string`);
  } else {
    // Validate ISO 8601 date format
    const date = new Date(value.acknowledgedAt);
    if (isNaN(date.getTime())) {
      errors.push(`acknowledgedFindings[${index}]: 'acknowledgedAt' must be a valid ISO 8601 date`);
    }
  }

  if (value.expiresAt !== undefined) {
    if (typeof value.expiresAt !== 'string') {
      errors.push(`acknowledgedFindings[${index}]: 'expiresAt' must be a valid ISO 8601 date`);
    } else {
      const date = new Date(value.expiresAt);
      if (isNaN(date.getTime())) {
        errors.push(`acknowledgedFindings[${index}]: 'expiresAt' must be a valid ISO 8601 date`);
      }
    }
  }

  return errors;
}