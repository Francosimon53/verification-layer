'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RescanButtonProps {
  projectId: string;
}

export function RescanButton({ projectId }: RescanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRescan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/scan`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = [
          body.error,
          body.step ? `Step: ${body.step}` : '',
          body.code ? `Code: ${body.code}` : '',
          body.details ? `Details: ${body.details}` : '',
          body.stack ? `\nStack:\n${Array.isArray(body.stack) ? body.stack.join('\n') : body.stack}` : '',
        ].filter(Boolean).join('\n');
        setError(detail || 'Scan failed (no details)');
        return;
      }
      router.refresh();
    } catch (err: any) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleRescan}
        disabled={loading}
        className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-700 disabled:to-slate-800 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none flex items-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Scanning...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Re-scan
          </>
        )}
      </button>
      {error && (
        <div className="mt-3 max-w-lg bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <pre className="text-sm text-red-300 whitespace-pre-wrap break-all font-mono">{error}</pre>
          </div>
          <button onClick={() => setError(null)} className="mt-2 text-xs text-red-400 hover:text-red-300">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
