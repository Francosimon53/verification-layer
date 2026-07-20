'use client';

import { useEffect, useState } from 'react';

export function SuccessToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success' || params.get('checkout') === 'success') {
      setMessage('Welcome to vlayer Pro! Your 14-day trial has started.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  if (!message) return null;

  return (
    <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg shadow-xl flex items-center gap-3 max-w-md">
      <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-sm text-emerald-300">{message}</span>
      <button onClick={() => setMessage(null)} className="text-slate-500 hover:text-white ml-auto">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
