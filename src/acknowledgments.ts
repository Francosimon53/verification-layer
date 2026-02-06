import { minimatch } from 'minimatch';
import type { Finding, VlayerConfig, AcknowledgedFinding } from './types.js';

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
    // Check if file path matches the pattern
    if (!minimatch(finding.file, ack.pattern)) {
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

    // Check if acknowledgment has expired
    const expired = ack.expiresAt ? new Date(ack.expiresAt) < new Date() : false;

    // All criteria matched
    return {
      acknowledged: true,
      reason: ack.reason,
      acknowledgedBy: ack.acknowledgedBy,
      acknowledgedAt: ack.acknowledgedAt,
      ticketUrl: ack.ticketUrl,
      expired,
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
  ack: any,
  index: number
): string[] {
  const errors: string[] = [];

  if (!ack.pattern || typeof ack.pattern !== 'string') {
    errors.push(`acknowledgedFindings[${index}]: 'pattern' is required and must be a string`);
  }

  if (!ack.reason || typeof ack.reason !== 'string') {
    errors.push(`acknowledgedFindings[${index}]: 'reason' is required and must be a string`);
  }

  if (!ack.acknowledgedBy || typeof ack.acknowledgedBy !== 'string') {
    errors.push(`acknowledgedFindings[${index}]: 'acknowledgedBy' is required and must be a string`);
  }

  if (!ack.acknowledgedAt || typeof ack.acknowledgedAt !== 'string') {
    errors.push(`acknowledgedFindings[${index}]: 'acknowledgedAt' is required and must be a string`);
  } else {
    // Validate ISO 8601 date format
    const date = new Date(ack.acknowledgedAt);
    if (isNaN(date.getTime())) {
      errors.push(`acknowledgedFindings[${index}]: 'acknowledgedAt' must be a valid ISO 8601 date`);
    }
  }

  if (ack.expiresAt) {
    const date = new Date(ack.expiresAt);
    if (isNaN(date.getTime())) {
      errors.push(`acknowledgedFindings[${index}]: 'expiresAt' must be a valid ISO 8601 date`);
    }
  }

  return errors;
}
