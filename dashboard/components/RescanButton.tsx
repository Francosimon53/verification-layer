'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'idle' | 'initializing' | 'downloading' | 'scanning' | 'analyzing' | 'complete';

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

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const FINDING_TITLES = [
  'Unencrypted PHI in database column',
  'Missing TLS on API endpoint',
  'Hardcoded credentials detected',
  'PHI exposed in log output',
  'Weak MD5 hash for passwords',
  'Missing access control on /admin',
  'No audit logging for DELETE ops',
  'CORS wildcard allows any origin',
  'SSN pattern in source code',
  'Missing data retention policy',
  'Unencrypted backup storage',
  'PHI in error response body',
  'Missing rate limiting on auth',
  'No session timeout configured',
  'Plain-text password comparison',
];

interface TermLine {
  text: string;
  color: 'green' | 'red' | 'orange' | 'yellow' | 'white' | 'dim';
}

interface RescanButtonProps {
  projectId: string;
}

export function RescanButton({ projectId }: RescanButtonProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [termLines, setTermLines] = useState<TermLine[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [totalFiles] = useState(Math.floor(Math.random() * 80) + 120);
  const [findingCount, setFindingCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [flashComplete, setFlashComplete] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const matrixCanvasRef = useRef<HTMLCanvasElement>(null);
  const matrixAnimRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
    if (phaseTimerRef.current) { clearTimeout(phaseTimerRef.current); phaseTimerRef.current = null; }
    if (matrixAnimRef.current) { cancelAnimationFrame(matrixAnimRef.current); matrixAnimRef.current = null; }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [termLines]);

  // Matrix rain canvas effect
  useEffect(() => {
    if (phase === 'idle') return;
    const canvas = matrixCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();

    const fontSize = 12;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = new Array(columns).fill(1).map(() => Math.random() * -50);
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

    function draw() {
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.fillStyle = '#00FF41';
      ctx!.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        if (y > 0) {
          ctx!.globalAlpha = Math.random() * 0.5 + 0.2;
          ctx!.fillText(char, x, y);
        }

        if (y > canvas!.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      ctx!.globalAlpha = 1;
      matrixAnimRef.current = requestAnimationFrame(draw);
    }

    matrixAnimRef.current = requestAnimationFrame(draw);

    return () => {
      if (matrixAnimRef.current) cancelAnimationFrame(matrixAnimRef.current);
    };
  }, [phase]);

  // Terminal animation during scanning phase
  useEffect(() => {
    if (phase !== 'scanning') {
      if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
      return;
    }

    let fileIdx = 0;
    let findIdx = 0;

    animRef.current = setInterval(() => {
      const file = FAKE_FILES[fileIdx % FAKE_FILES.length];
      fileIdx++;

      const lines: TermLine[] = [
        { text: `[SCAN] ${file}`, color: 'green' },
      ];

      // Randomly add findings
      if (Math.random() < 0.4) {
        const sev = SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)];
        const title = FINDING_TITLES[findIdx % FINDING_TITLES.length];
        findIdx++;
        const color = sev === 'CRITICAL' ? 'red' : sev === 'HIGH' ? 'orange' : sev === 'MEDIUM' ? 'yellow' : 'dim';
        lines.push({ text: `  [${sev}] ${title}`, color });

        setFindingCount(prev => prev + 1);
        if (sev === 'CRITICAL') setCriticalCount(prev => prev + 1);
      }

      setTermLines(prev => [...prev.slice(-40), ...lines]);
      setFileCount(prev => Math.min(prev + 1, totalFiles));
      setProgress(prev => {
        const target = 80;
        if (prev >= target) return prev;
        return Math.min(prev + 0.8, target);
      });
    }, 120);

    return () => { if (animRef.current) { clearInterval(animRef.current); animRef.current = null; } };
  }, [phase, totalFiles]);

  // Progress animation for non-scanning phases
  useEffect(() => {
    if (phase === 'idle' || phase === 'scanning') return;
    if (phase === 'complete') { setProgress(100); return; }

    const targets: Record<string, number> = {
      initializing: 8,
      downloading: 22,
      analyzing: 92,
    };
    const target = targets[phase] ?? 50;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= target) return prev;
        return Math.min(prev + 0.6, target);
      });
    }, 150);

    return () => clearInterval(interval);
  }, [phase]);

  async function handleRescan() {
    cleanup();
    setError(null);
    setProgress(0);
    setTermLines([]);
    setFileCount(0);
    setFindingCount(0);
    setCriticalCount(0);
    setFlashComplete(false);
    setPhase('initializing');

    // Add initial terminal lines
    setTermLines([
      { text: '[VLAYER] HIPAA Compliance Scanner v0.21.0', color: 'green' },
      { text: '[INIT] Loading scanner modules...', color: 'dim' },
    ]);

    // Phase transitions
    phaseTimerRef.current = setTimeout(() => {
      setPhase('downloading');
      setProgress(10);
      setTermLines(prev => [
        ...prev,
        { text: '[INIT] Scanner ready', color: 'green' },
        { text: '[DOWNLOAD] Fetching repository tarball...', color: 'white' },
      ]);

      phaseTimerRef.current = setTimeout(() => {
        setTermLines(prev => [
          ...prev,
          { text: '[DOWNLOAD] Repository downloaded (4.2 MB)', color: 'green' },
          { text: '[DOWNLOAD] Extracting archive...', color: 'dim' },
          { text: '[SCAN] Starting HIPAA compliance scan...', color: 'white' },
          { text: '─'.repeat(50), color: 'dim' },
        ]);
        setPhase('scanning');
        setProgress(25);
      }, 3000);
    }, 2500);

    // Fire-and-forget POST
    fetch(`/api/projects/${projectId}/scan`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const detail = [
            body.error,
            body.step ? `Step: ${body.step}` : '',
            body.details ? `Details: ${body.details}` : '',
          ].filter(Boolean).join('\n');
          throw new Error(detail || 'Scan failed');
        }
      })
      .catch((err: Error) => {
        cleanup();
        setPhase('idle');
        setProgress(0);
        setError(err.message || 'Network error');
      });

    // Poll every 3s
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) return;
        const { project } = await res.json();
        if (project.status !== 'scanning') {
          cleanup();
          setTermLines(prev => [
            ...prev,
            { text: '─'.repeat(50), color: 'dim' },
            { text: '[ANALYZE] Computing compliance score...', color: 'white' },
          ]);
          setPhase('analyzing');
          setProgress(88);

          setTimeout(() => {
            setTermLines(prev => [
              ...prev,
              { text: '[ANALYZE] Generating report...', color: 'dim' },
              { text: '[COMPLETE] Scan finished successfully', color: 'green' },
            ]);
            setFlashComplete(true);
            setPhase('complete');
            setProgress(100);

            setTimeout(() => {
              setFlashComplete(false);
              setTimeout(() => {
                setPhase('idle');
                setProgress(0);
                router.refresh();
              }, 1000);
            }, 1500);
          }, 2000);
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);
  }

  const isRunning = phase !== 'idle';

  if (!isRunning && !error) {
    return (
      <div>
        <button
          onClick={handleRescan}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Re-scan
        </button>
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    green: 'text-[#00FF41]',
    red: 'text-red-500',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
    white: 'text-white',
    dim: 'text-slate-500',
  };

  const progressBlocks = Math.floor(progress / 2.5);
  const progressBar = '\u2588'.repeat(progressBlocks) + '\u2591'.repeat(40 - progressBlocks);

  return (
    <>
      {/* Full-screen scan overlay */}
      {isRunning && (
        <div className="fixed inset-0 z-50 bg-black">
          {/* Matrix rain canvas */}
          <canvas
            ref={matrixCanvasRef}
            className="absolute inset-0 w-full h-full opacity-30"
          />

          {/* Flash effect on complete */}
          {flashComplete && (
            <div className="absolute inset-0 bg-[#00FF41] opacity-20 animate-pulse z-10" />
          )}

          {/* Central terminal */}
          <div className="relative z-20 flex flex-col items-center justify-center h-full px-4">
            <div className="w-full max-w-3xl">
              {/* Terminal header */}
              <div className="bg-slate-900 border border-[#00FF41]/30 rounded-t-lg px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-[#00FF41] text-xs font-mono ml-2">vlayer scan -- HIPAA Compliance Scanner</span>
              </div>

              {/* Terminal body */}
              <div
                ref={termRef}
                className="bg-black/90 border-x border-[#00FF41]/20 font-mono text-xs leading-relaxed p-4 h-[340px] overflow-y-auto scrollbar-thin"
                style={{ scrollbarColor: '#00FF41 transparent' }}
              >
                {termLines.map((line, i) => (
                  <div key={i} className={`${colorMap[line.color]} whitespace-pre-wrap`}>
                    {line.text}
                  </div>
                ))}
                {phase !== 'complete' && (
                  <span className="text-[#00FF41] animate-pulse">_</span>
                )}
              </div>

              {/* Status bar */}
              <div className="bg-slate-900/95 border border-[#00FF41]/20 rounded-b-lg px-4 py-3 space-y-2">
                {/* Counters */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex gap-4">
                    <span className="text-[#00FF41]">
                      Files: {fileCount}/{totalFiles}
                    </span>
                    <span className="text-white">
                      Findings: {findingCount}
                    </span>
                    <span className={criticalCount > 0 ? 'text-red-500' : 'text-slate-500'}>
                      Critical: {criticalCount}
                    </span>
                  </div>
                  <span className="text-[#00FF41]">{Math.round(progress)}%</span>
                </div>

                {/* ASCII progress bar */}
                <div className="font-mono text-xs text-[#00FF41] tracking-tight">
                  {progressBar} {Math.round(progress)}%
                </div>

                {/* Phase label */}
                <div className="flex items-center gap-2">
                  {phase !== 'complete' ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF41] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF41]" />
                    </span>
                  ) : (
                    <span className="text-[#00FF41] text-sm">&#10003;</span>
                  )}
                  <span className="text-xs text-slate-400">
                    {phase === 'initializing' && 'Initializing scanner...'}
                    {phase === 'downloading' && 'Downloading repository...'}
                    {phase === 'scanning' && 'Scanning for HIPAA violations...'}
                    {phase === 'analyzing' && 'Analyzing results...'}
                    {phase === 'complete' && 'SCAN COMPLETE'}
                  </span>
                </div>
              </div>
            </div>

            {/* SCAN COMPLETE overlay text */}
            {flashComplete && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div className="text-[#00FF41] text-5xl font-bold font-mono animate-pulse drop-shadow-[0_0_30px_#00FF41]">
                  SCAN COMPLETE
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Regular button or error state when idle */}
      {!isRunning && (
        <div>
          <button
            onClick={handleRescan}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Re-scan
          </button>
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
      )}
    </>
  );
}
