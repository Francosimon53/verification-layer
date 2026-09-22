export const AWS_VALIDATION_EVENT_NAMES = [
  'landing_view',
  'start_clicked',
  'aws_yes',
  'phi_yes',
  'active_evidence_request',
  'report_preview',
  'pricing_view',
  'checkout_started',
  'payment',
] as const;

export type AwsValidationEventName = (typeof AWS_VALIDATION_EVENT_NAMES)[number];
export type AwsValidationEventSource = 'browser' | 'server' | 'stripe';

export const AWS_EVIDENCE_REASONS = [
  'customer_security_review',
  'sales_or_procurement',
  'audit_or_risk_review',
  'proactive_assurance',
] as const;

export type AwsEvidenceReason = (typeof AWS_EVIDENCE_REASONS)[number];

export interface AwsValidationAnswers {
  usesAws?: boolean;
  processesPhi?: boolean;
  evidenceReason?: AwsEvidenceReason;
  customerRequested?: boolean;
}

export interface AwsValidationEventPayload {
  eventId: string;
  sessionId: string;
  eventName: AwsValidationEventName;
  path: string;
  properties?: Record<string, unknown>;
}

export const AWS_VALIDATION_EXPERIMENT = 'aws_phi_validation';
export const AWS_PILOT_PRICE_CENTS = 49_900;
export const AWS_PILOT_PRICE_LABEL = '$499';

export function isAwsValidationEventName(value: unknown): value is AwsValidationEventName {
  return typeof value === 'string' && AWS_VALIDATION_EVENT_NAMES.includes(value as AwsValidationEventName);
}

export function isAwsEvidenceReason(value: unknown): value is AwsEvidenceReason {
  return typeof value === 'string' && AWS_EVIDENCE_REASONS.includes(value as AwsEvidenceReason);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function sanitizeAwsAnswers(value: unknown): AwsValidationAnswers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const input = value as Record<string, unknown>;
  const answers: AwsValidationAnswers = {};

  if (typeof input.usesAws === 'boolean') answers.usesAws = input.usesAws;
  if (typeof input.processesPhi === 'boolean') answers.processesPhi = input.processesPhi;
  if (isAwsEvidenceReason(input.evidenceReason)) answers.evidenceReason = input.evidenceReason;
  if (typeof input.customerRequested === 'boolean') answers.customerRequested = input.customerRequested;

  return answers;
}

export function sanitizeEventProperties(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const serialized = JSON.stringify(value);
  if (serialized.length > 4_000) {
    throw new Error('Event properties exceed the allowed size');
  }

  return JSON.parse(serialized) as Record<string, unknown>;
}
