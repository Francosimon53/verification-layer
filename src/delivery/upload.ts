import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { verifyEvidencePackage } from './evidence.js';
import type { EvidencePackage } from './types.js';

export interface UploadEvidenceOptions {
  url?: string;
  token?: string;
  timeoutMs?: number;
}

export interface UploadEvidenceResult {
  ok: boolean;
  status: number;
  scanId?: string;
  projectId?: string;
  message?: string;
}

function resolveIngestUrl(value?: string): URL {
  const raw = value || process.env.VLAYER_INGEST_URL || 'https://vlayer.app/api/ingest';
  const url = new URL(raw);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Evidence uploads require HTTPS (except localhost development)');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Ingest URL must not contain credentials, query parameters, or fragments');
  }
  return url;
}

/**
 * Upload an already-verified evidence package. Tokens are accepted only in the
 * Authorization header and are never included in the result or thrown errors.
 */
export async function uploadEvidencePackage(
  evidence: EvidencePackage,
  options: UploadEvidenceOptions = {},
): Promise<UploadEvidenceResult> {
  if (!verifyEvidencePackage(evidence)) {
    throw new Error('Evidence package integrity check failed; refusing upload');
  }

  const token = options.token || process.env.VLAYER_TOKEN;
  if (!token) throw new Error('VLAYER_TOKEN is required to upload evidence');

  const url = resolveIngestUrl(options.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'verification-layer',
      },
      body: JSON.stringify(evidence),
      signal: controller.signal,
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    const record = payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : {};
    if (!response.ok) {
      throw new Error(`Workspace upload failed with HTTP ${response.status}`);
    }
    const safeValue = (value: unknown): string | undefined =>
      typeof value === 'string' && !value.includes(token) ? value : undefined;

    return {
      ok: true,
      status: response.status,
      scanId: safeValue(record.scanId),
      projectId: safeValue(record.projectId),
      message: safeValue(record.message),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadEvidenceFile(
  path: string,
  options: UploadEvidenceOptions = {},
): Promise<UploadEvidenceResult> {
  const evidence = JSON.parse(await readFile(resolve(path), 'utf-8')) as EvidencePackage;
  return uploadEvidencePackage(evidence, options);
}
