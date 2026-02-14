'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'idle' | 'initializing' | 'downloading' | 'scanning' | 'analyzing' | 'complete';

const PHASE_CONFIG: Record<Exclude<Phase, 'idle'>, { label: string; minPct: number; maxPct: number }> = {
  initializing: { label: 'Initializing scanner...', minPct: 0, maxPct: 10 },
  downloading:  { label: 'Downloading repository...', minPct: 10, maxPct: 25 },
  scanning:     { label: 'Scanning files...', minPct: 25, maxPct: 85 },
  analyzing:    { label: 'Analyzing results...', minPct: 85, maxPct: 95 },
  complete:     { label: 'Scan complete', minPct: 95, maxPct: 100 },
};

const FAKE_FILES = [
  'src/index.ts', 'src/app.tsx', 'src/config.ts', 'src/auth/login.ts',
  'src/auth/session.ts', 'src/auth/middleware.ts', 'src/db/connection.ts',
  'src/db/migrations.ts', 'src/db/schema.ts', 'src/api/routes.ts',
  'src/api/handlers.ts', 'src/api/validators.ts', 'src/models/user.ts',
  'src/models/patient.ts', 'src/models/record.ts', 'src/services/email.ts',
  'src/services/storage.ts', 'src/services/encryption.ts', 'src/utils/crypto.ts',
  'src/utils/logger.ts', 'src/utils/sanitize.ts', 'lib/supabase.ts',
  'lib/stripe.ts', 'lib/redis.ts', 'components/Form.tsx', 'components/Table.tsx',
  'components/Dashboard.tsx', 'pages/api/webhook.ts', 'pages/api/upload.ts',
  'middleware.ts', 'next.config.js', 'package.json', '.env.example',
  'docker-compose.yml', 'Dockerfile', 'tsconfig.json', 'prisma/schema.prisma',
  'src/controllers/admin.ts', 'src/controllers/records.ts',
  'src/middleware/cors.ts', 'src/middleware/rateLimit.ts',
  'tests/auth.test.ts', 'tests/api.test.ts',
];

interface RescanButtonProps {
  projectId: string;
}

export function RescanButton({ projectId }: RescanButtonProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanDoneRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (fileRef.current) { clearInterval(fileRef.current); fileRef.current = null; }
    if (phaseTimerRef.current) { clearTimeout(phaseTimerRef.current); phaseTimerRef.current = null; }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Animate progress within a phase range
  useEffect(() => {
    if (phase === 'idle') return;
    const config = PHASE_CONFIG[phase];
    if (!config) return;

    if (phase === 'complete') {
      setProgress(100);
      return;
    }

    // Gradually move progress within the phase range
    const interval = setInterval(() => {
      setProgress((prev) => {
        const range = config.maxPct - config.minPct;
        const target = config.maxPct - range * 0.1; // Stop at 90% of range
        if (prev >= target) return prev;
        return Math.min(prev + 0.5, target);
      });
    }, 200);

    return () => clearInterval(interval);
  }, [phase]);

  // Cycle fake file names during scanning phase
  useEffect(() => {
    if (phase !== 'scanning') {
      if (fileRef.current) { clearInterval(fileRef.current); fileRef.current = null; }
      return;
    }
    let idx = 0;
    setCurrentFile(FAKE_FILES[0]);
    fileRef.current = setInterval(() => {
      idx = (idx + 1) % FAKE_FILES.length;
      setCurrentFile(FAKE_FILES[idx]);
    }, 150);
    return () => { if (fileRef.current) { clearInterval(fileRef.current); fileRef.current = null; } };
  }, [phase]);

  async function handleRescan() {
    cleanup();
    scanDoneRef.current = false;
    setError(null);
    setProgress(0);
    setPhase('initializing');

    // Phase transitions on timers
    phaseTimerRef.current = setTimeout(() => {
      setPhase('downloading');
      setProgress(10);
      phaseTimerRef.current = setTimeout(() => {
        setPhase('scanning');
        setProgress(25);
      }, 3000);
    }, 2000);

    // Fire-and-forget the POST
    fetch(`/api/projects/${projectId}/scan`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const detail = [
            body.error,
            body.step ? `Step: ${body.step}` : '',
            body.code ? `Code: ${body.code}` : '',
            body.details ? `Details: ${body.details}` : '',
            body.stack ? `\nStack:\n${Array.isArray(body.stack) ? body.stack.join('\n') : body.stack}` : '',
          ].filter(Boolean).join('\n');
          throw new Error(detail || 'Scan failed');
        }
        scanDoneRef.current = true;
      })
      .catch((err: Error) => {
        cleanup();
        setPhase('idle');
        setProgress(0);
        setError(err.message || 'Network error');
      });

    // Poll project status every 3s
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) return;
        const { project } = await res.json();
        if (project.status !== 'scanning') {
          cleanup();
          setPhase('analyzing');
          setProgress(90);
          setTimeout(() => {
            setPhase('complete');
            setProgress(100);
            setTimeout(() => {
              setPhase('idle');
              setProgress(0);
              router.refresh();
            }, 1500);
          }, 1500);
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);
  }

  const isRunning = phase !== 'idle';
  const config = phase !== 'idle' ? PHASE_CONFIG[phase] : null;

  return (
    <div className="w-full max-w-sm">
      {!isRunning ? (
        <button
          onClick={handleRescan}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Re-scan
        </button>
      ) : (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 backdrop-blur-sm">
          {/* Phase label with pulse dot */}
          <div className="flex items-center gap-2 mb-3">
            {phase !== 'complete' ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            ) : (
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="text-sm font-medium text-white">{config?.label}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-700/50 rounded-full h-1.5 mb-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Progress percentage + current file */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{Math.round(progress)}%</span>
            {phase === 'scanning' && currentFile && (
              <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                {currentFile}
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
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
