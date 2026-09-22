'use client';

import {
  sanitizeAwsAnswers,
  type AwsValidationAnswers,
  type AwsValidationEventName,
  type AwsValidationEventPayload,
} from '@/lib/aws-validation';

const SESSION_KEY = 'vlayer.aws-validation.session';
const ANSWERS_KEY = 'vlayer.aws-validation.answers';

function createUuid(): string {
  return globalThis.crypto.randomUUID();
}

export function getAwsValidationSessionId(): string {
  const existing = globalThis.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const sessionId = createUuid();
  globalThis.sessionStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

export function getAwsValidationAnswers(): AwsValidationAnswers {
  const stored = globalThis.sessionStorage.getItem(ANSWERS_KEY);
  if (!stored) return {};

  try {
    return sanitizeAwsAnswers(JSON.parse(stored));
  } catch {
    return {};
  }
}

export function saveAwsValidationAnswers(answers: AwsValidationAnswers): void {
  globalThis.sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(sanitizeAwsAnswers(answers)));
}

export async function trackAwsValidationEvent(
  eventName: AwsValidationEventName,
  properties: Record<string, unknown> = {}
): Promise<boolean> {
  const answers = getAwsValidationAnswers();
  const payload: AwsValidationEventPayload = {
    eventId: createUuid(),
    sessionId: getAwsValidationSessionId(),
    eventName,
    path: globalThis.location.pathname,
    properties: { ...answers, ...properties },
  };

  try {
    const response = await fetch('/api/aws/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
