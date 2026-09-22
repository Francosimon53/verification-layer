import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const insertMock = vi.fn();
const recordEventMock = vi.fn();
const notifyMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => insertMock(table, row),
    }),
  }),
}));

vi.mock('@/lib/aws-validation-server', () => ({
  recordAwsValidationEvent: (input: unknown) => recordEventMock(input),
}));

vi.mock('@/lib/aws-validation-notify', () => ({
  notifyFounder: (text: string) => notifyMock(text),
}));

const { POST } = await import('./route');

const SESSION_ID = '3f0c9a5e-2f9e-4c1a-9b7d-1c2d3e4f5a6b';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION_ID,
    email: 'security@example.com',
    company: 'Example Health',
    review_due: 'this_month',
    note: 'Customer security review for one workload.',
    answers: { usesAws: true, processesPhi: true, evidenceReason: 'customer_security_review', customerRequested: true, injected: 'x' },
    attribution: { utm_source: 'linkedin', utm_medium: 'post', utm_campaign: 'phi-pilot', referrer_host: 'www.linkedin.com', extra: 'no' },
    ...overrides,
  };
}

function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/aws/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null });
  recordEventMock.mockReset().mockResolvedValue(undefined);
  notifyMock.mockReset().mockResolvedValue(undefined);
});

describe('POST /api/aws/intake', () => {
  it('rejects a bad email', async () => {
    const response = await POST(request(validPayload({ email: 'not-an-email' })));
    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown review_due', async () => {
    const response = await POST(request(validPayload({ review_due: 'someday' })));
    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejects a note over 500 characters', async () => {
    const response = await POST(request(validPayload({ note: 'x'.repeat(501) })));
    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('accepts a valid payload, stores contact details only in intakes and notifies', async () => {
    const response = await POST(request(validPayload()));
    expect(response.status).toBe(204);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const [table, row] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(table).toBe('aws_validation_intakes');
    expect(row).toMatchObject({
      session_id: SESSION_ID,
      email: 'security@example.com',
      company: 'Example Health',
      review_due: 'this_month',
      note: 'Customer security review for one workload.',
    });
    expect(row.answers).toEqual({ usesAws: true, processesPhi: true, evidenceReason: 'customer_security_review', customerRequested: true });
    expect(row.attribution).toEqual({ utm_source: 'linkedin', utm_medium: 'post', utm_campaign: 'phi-pilot', referrer_host: 'www.linkedin.com' });

    expect(recordEventMock).toHaveBeenCalledTimes(1);
    const event = recordEventMock.mock.calls[0][0] as { eventName: string; source: string; path: string; properties: Record<string, unknown> };
    expect(event).toMatchObject({ eventName: 'intake_requested', source: 'server', path: '/aws/early-access' });
    expect(event.properties).toMatchObject({ review_due: 'this_month', usesAws: true, utm_source: 'linkedin' });
    const serialized = JSON.stringify(event.properties);
    expect(serialized).not.toContain('security@example.com');
    expect(serialized).not.toContain('Example Health');
    expect(serialized).not.toContain('Customer security review for one workload');

    expect(notifyMock).toHaveBeenCalledTimes(1);
    const message = notifyMock.mock.calls[0][0] as string;
    expect(message).toContain('Example Health');
    expect(message).toContain('security@example.com');
    expect(message).toContain('this_month');
    expect(message).toContain('customer_security_review');
    expect(message).toContain('linkedin');
  });
});
