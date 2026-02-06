import type { Finding, ScanResult } from './types.js';

export interface ComplianceScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  breakdown: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    acknowledged: number;
  };
  penalties: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  recommendations: string[];
}

const SEVERITY_PENALTIES = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
  info: 0,
};

const ACKNOWLEDGED_REDUCTION = 0.25; // 25% of original penalty

/**
 * Calculate HIPAA compliance score from scan results
 */
export function calculateComplianceScore(result: ScanResult): ComplianceScore {
  const findings = result.findings;

  // Count findings by severity
  const breakdown = {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    acknowledged: 0,
  };

  const penalties = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  };

  for (const finding of findings) {
    // Skip baseline and suppressed findings
    if (finding.isBaseline || finding.suppressed) {
      continue;
    }

    breakdown.total++;

    // Count by severity
    if (finding.severity === 'critical') breakdown.critical++;
    else if (finding.severity === 'high') breakdown.high++;
    else if (finding.severity === 'medium') breakdown.medium++;
    else if (finding.severity === 'low') breakdown.low++;

    // Calculate penalty
    const basePenalty = SEVERITY_PENALTIES[finding.severity] || 0;
    const isAcknowledged = finding.acknowledged === true;

    if (isAcknowledged) {
      breakdown.acknowledged++;
    }

    // Reduce penalty for acknowledged findings
    const penalty = isAcknowledged ? basePenalty * ACKNOWLEDGED_REDUCTION : basePenalty;

    // Apply penalty
    if (finding.severity === 'critical') penalties.critical += penalty;
    else if (finding.severity === 'high') penalties.high += penalty;
    else if (finding.severity === 'medium') penalties.medium += penalty;
    else if (finding.severity === 'low') penalties.low += penalty;

    penalties.total += penalty;
  }

  // Calculate score (start at 100, subtract penalties)
  const rawScore = Math.max(0, 100 - penalties.total);
  const score = Math.round(rawScore);

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  // Determine status
  let status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  if (score >= 90) status = 'excellent';
  else if (score >= 80) status = 'good';
  else if (score >= 70) status = 'fair';
  else if (score >= 60) status = 'poor';
  else status = 'critical';

  // Generate recommendations
  const recommendations = generateRecommendations(breakdown, score);

  return {
    score,
    grade,
    status,
    breakdown,
    penalties,
    recommendations,
  };
}

function generateRecommendations(
  breakdown: ComplianceScore['breakdown'],
  score: number
): string[] {
  const recommendations: string[] = [];

  if (breakdown.critical > 0) {
    recommendations.push(
      `Address ${breakdown.critical} critical issue(s) immediately - these pose severe HIPAA compliance risks`
    );
  }

  if (breakdown.high > 0) {
    recommendations.push(
      `Resolve ${breakdown.high} high severity issue(s) as soon as possible`
    );
  }

  if (breakdown.medium > 0 && breakdown.medium > 10) {
    recommendations.push(
      `Review and remediate ${breakdown.medium} medium severity findings to improve compliance posture`
    );
  }

  if (breakdown.acknowledged > 0) {
    recommendations.push(
      `${breakdown.acknowledged} finding(s) are acknowledged but should still be addressed when possible`
    );
  }

  if (score < 70) {
    recommendations.push(
      'Your compliance score is below acceptable levels. Consider a comprehensive security audit'
    );
  }

  if (score >= 90 && breakdown.total === 0) {
    recommendations.push('Excellent! No active compliance issues found. Maintain regular scanning.');
  } else if (score >= 90) {
    recommendations.push('Great compliance posture! Continue monitoring and maintaining best practices.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue regular scanning to maintain HIPAA compliance');
  }

  return recommendations;
}

/**
 * Format score for display
 */
export function formatScore(score: ComplianceScore): string {
  const { score: value, grade, status } = score;
  return `${value}/100 (${grade}) - ${status.toUpperCase()}`;
}

/**
 * Get color for score (for terminal output)
 */
export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

/**
 * Get score summary text
 */
export function getScoreSummary(complianceScore: ComplianceScore): string {
  const { score, grade, status, breakdown } = complianceScore;

  let summary = `HIPAA Compliance Score: ${score}/100 (Grade ${grade})\n`;
  summary += `Status: ${status.toUpperCase()}\n\n`;

  summary += `Findings Breakdown:\n`;
  summary += `  Critical: ${breakdown.critical}\n`;
  summary += `  High: ${breakdown.high}\n`;
  summary += `  Medium: ${breakdown.medium}\n`;
  summary += `  Low: ${breakdown.low}\n`;
  summary += `  Total Active: ${breakdown.total}\n`;

  if (breakdown.acknowledged > 0) {
    summary += `  Acknowledged: ${breakdown.acknowledged}\n`;
  }

  summary += `\nPenalty Points:\n`;
  summary += `  Critical: -${complianceScore.penalties.critical}\n`;
  summary += `  High: -${complianceScore.penalties.high}\n`;
  summary += `  Medium: -${complianceScore.penalties.medium}\n`;
  summary += `  Low: -${complianceScore.penalties.low}\n`;
  summary += `  Total: -${complianceScore.penalties.total}\n`;

  return summary;
}
