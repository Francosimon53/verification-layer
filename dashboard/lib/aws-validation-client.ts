'use client';

import {
  AWS_ATTRIBUTION_VALUE_MAX_LENGTH,
  sanitizeAwsAnswers,
  sanitizeAwsAttribution,
  type AwsValidationAnswers,
  type AwsValidationAttribution,
  type AwsValidationEventName,
  type AwsValidationEventPayload,
} from '@/lib/aws-validation';

export type { AwsValidationAttribution } from '@/lib/aws-validation';

const SESSION_KEY = 'vlayer.aws-validation.session';
const ANSWERS_KEY = 'vlayer.aws-validation.answers';
const ATTRIBUTION_KEY = 'vlayer.aws-validation.attribution';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;
// Keep attribution well inside the 4,000-character event property budget.
const ATTRIBUTION_VALUE_MAX_LENGTH = AWS_ATTRIBUTION_VALUE_MAX_LENGTH;

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

function sanitizeAttributionValue(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, ATTRIBUTION_VALUE_MAX_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

function readAttributionFromPage(): AwsValidationAttribution {
  const attribution: AwsValidationAttribution = {};
  const params = new URLSearchParams(globalThis.location.search);

  for (const key of UTM_KEYS) {
    const sanitized = sanitizeAttributionValue(params.get(key));
    if (sanitized) attribution[key] = sanitized;
  }

  // Hostname only: never the referrer path or query string.
  try {
    const referrer = globalThis.document.referrer;
    if (referrer) {
      const host = new URL(referrer).hostname;
      if (host && host !== globalThis.location.hostname) attribution.referrer_host = host;
    }
  } catch {
    // Unparseable referrer: leave referrer_host unset.
  }

  return attribution;
}

/**
 * Attribution is captured once per session, on the first page load that
 * creates it, and reused on every later event from that session.
 */
export function getAwsValidationAttribution(): AwsValidationAttribution {
  const stored = globalThis.sessionStorage.getItem(ATTRIBUTION_KEY);
  if (stored) {
    try {
      return sanitizeAwsAttribution(JSON.parse(stored));
    } catch {
      // Corrupt entry: fall through and capture again.
    }
  }

  const attribution = readAttributionFromPage();
  globalThis.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  return attribution;
}

export async function trackAwsValidationEvent(
  eventName: AwsValidationEventName,
  properties: Record<string, unknown> = {}
): Promise<boolean> {
  const answers = getAwsValidationAnswers();
  const attribution = getAwsValidationAttribution();
  const payload: AwsValidationEventPayload = {
    eventId: createUuid(),
    sessionId: getAwsValidationSessionId(),
    eventName,
    path: globalThis.location.pathname,
    properties: { ...attribution, ...answers, ...properties },
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
