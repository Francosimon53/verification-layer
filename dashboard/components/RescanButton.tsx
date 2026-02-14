'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RescanButtonProps {
  projectId: string;
}

export function RescanButton({ projectId }: RescanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRescan() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/scan`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Scan failed');
      }
      router.refresh();
    } catch {
      alert('Scan failed');
    } finally {
      setLoading(false);
    }
  }

  return (
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
  );
}
