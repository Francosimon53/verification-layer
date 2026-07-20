import { NextResponse } from 'next/server';

/**
 * Build a sanitized JSON error response.
 *
 * Logs the full error server-side (preserving the stack/details for debugging)
 * and returns ONLY the generic `fallback` string in the response body, so
 * internal error messages never leak to the client. The caller keeps control of
 * the HTTP `status`; `extra` lets a route preserve additional body fields
 * (e.g. `{ ok: false }`).
 */
export function jsonError(
  error: unknown,
  fallback: string,
  status = 500,
  extra?: Record<string, unknown>,
) {
  console.error(error);
  return NextResponse.json({ ...extra, error: fallback }, { status });
}
