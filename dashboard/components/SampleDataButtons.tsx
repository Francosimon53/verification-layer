'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LoadSampleDataButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLoad = async () => {
    setLoading(true);
    await fetch('/api/sample-data', { method: 'POST' });
    router.refresh();
  };

  return (
    <button
      onClick={handleLoad}
      disabled={loading}
      className="inline-flex items-center px-6 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white font-medium rounded-lg transition-all"
    >
      {loading ? 'Loading...' : 'Load Sample Data'}
    </button>
  );
}

export function ClearSampleDataButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClear = async () => {
    setLoading(true);
    await fetch('/api/sample-data', { method: 'DELETE' });
    router.refresh();
  };

  return (
    <button
      onClick={handleClear}
      disabled={loading}
      className="text-sm text-slate-500 hover:text-red-400 transition-colors"
    >
      {loading ? 'Clearing...' : 'Clear Sample Data'}
    </button>
  );
}
