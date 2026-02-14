import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify a GitHub webhook signature (HMAC SHA-256).
 * Returns true if the signature is valid.
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
